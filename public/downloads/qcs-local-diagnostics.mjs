#!/usr/bin/env node
// Standalone Node.js 22+ runner. Importing this module performs no diagnostics.
import { open } from 'node:fs/promises';
import { isIP, BlockList, connect as tcpConnect } from 'node:net';
import { connect as tlsConnect, checkServerIdentity } from 'node:tls';
import { Resolver } from 'node:dns/promises';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LIMITS = Object.freeze({ requestBytes: 16384, outputBytes: 65536, deadlineMs: 60000, dnsRecords: 128 });
const operations = Object.freeze({
  ping: { count: [1, 10, 4], timeoutMs: [100, 5000, 1000], packetBytes: [0, 1400, 32] },
  traceroute: { maxHops: [1, 20, 12], timeoutMs: [100, 5000, 500] },
  dns: { timeoutMs: [100, 5000, 5000], recordType: ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA'] },
  tcp: { timeoutMs: [100, 5000, 5000], port: [1, 65535, 443] },
  tls: { timeoutMs: [100, 5000, 5000], port: [1, 65535, 443], serverName: null },
});
const blocked = new BlockList();
blocked.addSubnet('0.0.0.0', 8, 'ipv4');
blocked.addSubnet('224.0.0.0', 4, 'ipv4');
blocked.addSubnet('240.0.0.0', 4, 'ipv4');
blocked.addSubnet('ff00::', 8, 'ipv6');
blocked.addAddress('::', 'ipv6');
const knownErrors = new Set(['ABORTED', 'DEADLINE', 'UNSUPPORTED_PLATFORM', 'INVALID_ADDRESS', 'OUTPUT_LIMIT', 'CLEANUP_FAILED',
  'ENOENT', 'EACCES', 'EPERM', 'ECONNREFUSED', 'ECONNRESET', 'ENETUNREACH', 'EHOSTUNREACH', 'EPIPE',
  'ENOTFOUND', 'ENODATA', 'EAI_AGAIN', 'ESERVFAIL', 'EREFUSED', 'ETIMEOUT', 'ETIMEDOUT', 'ECANCELLED',
  'ERR_TLS_CERT_ALTNAME_INVALID', 'CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID', 'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY']);

function fault(code, message = 'The diagnostic could not complete.') {
  return Object.assign(new Error(message), { code });
}
function exactObject(value, allowed, required = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw fault('INVALID_REQUEST', 'Expected a plain JSON object.');
  for (const key of Reflect.ownKeys(value)) {
    if (!allowed.includes(key) || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) {
      throw fault('INVALID_REQUEST', 'Unexpected key or accessor in request.');
    }
  }
  if (required.some(key => !Object.hasOwn(value, key))) throw fault('INVALID_REQUEST', 'Missing required request field.');
}
function hostname(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 253 || !/[a-z]/i.test(value) || /^(?:0x[0-9a-f]+|\d+)(?:\.(?:0x[0-9a-f]+|\d+))*\.?$/i.test(value)) return false;
  const labels = value.endsWith('.') ? value.slice(0, -1).split('.') : value.split('.');
  return labels.every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
}
function allowedAddress(value) {
  if (typeof value !== 'string' || value.includes('%')) return false;
  const family = isIP(value);
  if (!family || blocked.check(value, family === 4 ? 'ipv4' : 'ipv6')) return false;
  if (family === 4) return value.split('.').at(-1) !== '255';
  const canonical = new URL(`http://[${value}]/`).hostname;
  if (canonical.startsWith('[::ffff:')) return false;
  // Deprecated IPv4-compatible destinations are not accepted (loopback ::1 is).
  return canonical === '[::1]' || !/^\[::(?:[a-f0-9]{1,4}:)?[a-f0-9]{1,4}\]$/i.test(canonical);
}
function targetValid(value) {
  if (typeof value !== 'string' || value.length > 253 || /[\s%]/.test(value)) return false;
  return isIP(value) ? allowedAddress(value) : hostname(value);
}

export function validateRequest(input) {
  exactObject(input, ['schemaVersion', 'kind', 'operation', 'target', 'parameters'], ['schemaVersion', 'kind', 'operation', 'target', 'parameters']);
  if (input.schemaVersion !== 1 || input.kind !== 'qcs-local-diagnostic' ||
      typeof input.operation !== 'string' || !Object.hasOwn(operations, input.operation)) throw fault('INVALID_REQUEST', 'Unsupported diagnostic schema or operation.');
  if (!targetValid(input.target)) throw fault('INVALID_REQUEST', 'Use one unicast IP or ASCII hostname, without a URL, zone, range or shell characters.');
  const fields = operations[input.operation];
  exactObject(input.parameters, Object.keys(fields));
  const parameters = {};
  for (const [key, rule] of Object.entries(fields)) {
    const supplied = Object.hasOwn(input.parameters, key);
    const value = input.parameters[key];
    if (key === 'serverName') {
      if (supplied) {
        if (!hostname(value) || isIP(value)) throw fault('INVALID_REQUEST', 'serverName must be an ASCII DNS hostname.');
        parameters[key] = value;
      }
    } else if (key === 'recordType') {
      if (supplied && !rule.includes(value)) throw fault('INVALID_REQUEST', 'Unsupported DNS record type.');
      parameters[key] = supplied ? value : 'A';
    } else {
      if (supplied && (!Number.isSafeInteger(value) || value < rule[0] || value > rule[1])) throw fault('INVALID_REQUEST', `Invalid ${key} bound.`);
      parameters[key] = supplied ? value : rule[2];
    }
  }
  return Object.freeze({ schemaVersion: 1, kind: 'qcs-local-diagnostic', operation: input.operation,
    target: input.target, parameters: Object.freeze(parameters) });
}

function confirm(request, confirmTarget) {
  if (typeof confirmTarget !== 'string' || confirmTarget !== request.target) throw fault('CONFIRMATION_REQUIRED', 'Exact --confirm-target is required; no diagnostic was started.');
}
function text(value, max = 256) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, '').slice(0, max) : null;
}
function duration(start) { return Math.round((performance.now() - start) * 100) / 100; }
function abortError(signal) { return fault(signal.reason?.code === 'DEADLINE' ? 'DEADLINE' : 'ABORTED'); }

// Every resource owns a cancellation cleanup, including resolution before a socket opens.
function cancellable(signal, start) {
  return new Promise((resolve, reject) => {
    let settled = false, stop = () => {};
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      try { stop(); } catch { error = fault('CLEANUP_FAILED'); }
      if (error) reject(error); else resolve(value);
    };
    const abort = () => finish(abortError(signal));
    if (signal.aborted) return abort();
    signal.addEventListener('abort', abort, { once: true });
    try {
      stop = start(finish) || (() => {});
      if (settled) stop();
    } catch (error) { finish(error); }
  });
}
function query(name, recordType, ctx) {
  return cancellable(ctx.signal, finish => {
    const resolver = ctx.adapters.createResolver({ timeout: Math.min(ctx.request.parameters.timeoutMs, 5000), tries: 1 });
    try { resolver.resolve(name, recordType).then(value => finish(null, value), finish); }
    catch (error) { resolver.cancel(); throw error; }
    return () => resolver.cancel();
  });
}
async function resolveOne(ctx) {
  const { target } = ctx.request;
  if (isIP(target)) return target;
  let addresses;
  try { addresses = await query(target, 'A', ctx); }
  catch (error) {
    if (!['ENODATA', 'ENOTFOUND'].includes(error.code)) throw error;
    addresses = await query(target, 'AAAA', ctx);
  }
  const address = addresses?.[0];
  if (!allowedAddress(address)) throw fault('INVALID_ADDRESS');
  return address;
}
function dnsRecords(answer, type) {
  const rows = Array.isArray(answer) ? answer : [answer];
  const bounded = rows.slice(0, LIMITS.dnsRecords);
  const records = bounded.map(row => {
    if (type === 'TXT') return { chunkCount: Array.isArray(row) ? row.length : 0,
      byteLength: Array.isArray(row) ? row.reduce((n, part) => n + Buffer.byteLength(String(part)), 0) : 0 };
    if (type === 'A' || type === 'AAAA') return { address: isIP(row) ? row : null };
    if (['NS', 'CNAME'].includes(type)) return { name: hostname(row) ? row : null };
    if (type === 'MX') return { exchange: hostname(row?.exchange) ? row.exchange : null,
      priority: Number.isSafeInteger(row?.priority) ? row.priority : null };
    return Object.fromEntries(['nsname', 'hostmaster', 'serial', 'refresh', 'retry', 'expire', 'minttl'].map(key => [key,
      ['nsname', 'hostmaster'].includes(key) ? (hostname(row?.[key]) ? row[key] : null) : (Number.isSafeInteger(row?.[key]) ? row[key] : null)]));
  });
  return { recordCount: rows.length, recordsTruncated: rows.length > bounded.length, records };
}
async function runDns(ctx, observations, limitations) {
  const { target, parameters } = ctx.request;
  observations.recordType = parameters.recordType;
  observations.resolverMode = 'system-configured-dns';
  limitations.push('Uses Node DNS queries through configured DNS servers, not the hosts file or a browser resolver. No resolver override, DNSSEC validation or propagation claim.');
  if (parameters.recordType === 'TXT') limitations.push('TXT content is withheld: records can contain verification tokens or other sensitive text. Only chunk counts and byte lengths are reported.');
  const began = performance.now();
  const answer = await query(target, parameters.recordType, ctx);
  observations.durationMs = duration(began);
  Object.assign(observations, dnsRecords(answer, parameters.recordType));
  return 'The DNS query returned records; this is one resolver observation, not proof of global propagation.';
}
async function runSocket(ctx, observations, limitations) {
  const { request } = ctx;
  const address = await resolveOne(ctx);
  Object.assign(observations, { resolvedAddress: address, addressFamily: isIP(address), port: request.parameters.port });
  limitations.push('One resolved address and one port are tested; other addresses, ports and application health are not tested. DNS resolution is excluded from the connection/handshake duration.');
  const secure = request.operation === 'tls';
  const verificationName = (request.parameters.serverName || request.target).replace(/\.$/, '');
  if (secure) {
    observations.authorized = false;
    observations.verificationName = verificationName;
    limitations.push('TLS verifies the certificate chain and requested name using Node trust settings. It does not test HTTP, client-certificate authentication, STARTTLS, revocation or every cipher. No application payload is sent.');
  } else observations.connected = false;
  const began = performance.now();
  await cancellable(ctx.signal, finish => {
    const options = { host: address, port: request.parameters.port, family: isIP(address), autoSelectFamily: false };
    if (secure) Object.assign(options, { rejectUnauthorized: true, minVersion: 'TLSv1.2',
      ...(isIP(verificationName) ? {} : { servername: verificationName }),
      checkServerIdentity: (_hostname, cert) => checkServerIdentity(verificationName, cert) });
    const socket = secure ? ctx.adapters.tlsConnect(options) : ctx.adapters.tcpConnect(options);
    socket.once('error', error => finish(error));
    socket.once('close', () => finish(fault('ECONNRESET')));
    socket.once(secure ? 'secureConnect' : 'connect', () => {
      try {
        if (secure) {
          if (socket.authorized !== true) return finish(fault('UNABLE_TO_VERIFY_LEAF_SIGNATURE'));
          const cert = socket.getPeerCertificate();
          // Verify again for injected/test transports; never accept a name mismatch.
          const mismatch = checkServerIdentity(verificationName, cert);
          if (mismatch) return finish(mismatch);
          Object.assign(observations, { authorized: true, handshakeDurationMs: duration(began),
            protocol: text(socket.getProtocol()), cipher: text(socket.getCipher()?.name),
            certificate: { subjectCN: text(cert.subject?.CN), issuerCN: text(cert.issuer?.CN),
              validFrom: text(cert.valid_from), validTo: text(cert.valid_to), fingerprint256: text(cert.fingerprint256), serialNumber: text(cert.serialNumber) } });
        } else Object.assign(observations, { connected: true, connectDurationMs: duration(began) });
        finish(null);
      } catch (error) { finish(error); }
    });
    return () => socket.destroy();
  });
  return secure ? 'A certificate-verified TLS handshake completed; application health was not tested.' : 'One TCP connection completed; no application protocol or service health was tested.';
}

export function buildWindowsCommand(request, address) {
  const checked = validateRequest(request);
  if (!['ping', 'traceroute'].includes(checked.operation) || !allowedAddress(address)) throw fault('INVALID_REQUEST', 'Invalid command request.');
  const p = checked.parameters, family = isIP(address) === 4 ? '/4' : '/6';
  return checked.operation === 'ping'
    ? { file: 'C:\\Windows\\System32\\PING.EXE', args: [family, '/n', String(p.count), '/w', String(p.timeoutMs), '/l', String(p.packetBytes), address] }
    : { file: 'C:\\Windows\\System32\\TRACERT.EXE', args: [family, '/d', '/h', String(p.maxHops), '/w', String(p.timeoutMs), address] };
}
async function runCommand(ctx, observations, limitations) {
  if (ctx.adapters.platform !== 'win32') throw fault('UNSUPPORTED_PLATFORM');
  const address = await resolveOne(ctx);
  const command = buildWindowsCommand(ctx.request, address);
  Object.assign(observations, { resolvedAddress: address, addressFamily: isIP(address), command: ctx.request.operation === 'ping' ? 'ping' : 'tracert',
    exitCode: null, signal: null, rawStdout: '', rawStderr: '', outputTruncated: false, rawEncoding: 'utf8' });
  limitations.push('Raw Windows command output is not parsed. Exit code 0 and completed mean the command ended, not that the destination replied. No packet-loss or latency numbers are inferred.');
  limitations.push('Windows output is decoded as UTF-8; localized OEM characters may be replaced. Stdout and stderr share a 64 KiB byte cap. Only the fixed C:\\Windows\\System32 executable is supported; no PATH fallback.');
  if (ctx.request.operation === 'traceroute') limitations.push('ICMP traceroute may show silent hops and may stop at the deadline before maxHops. Asterisks alone do not prove packet loss for application traffic.');
  const chunks = { rawStdout: [], rawStderr: [] };
  let used = 0;
  try {
    return await cancellable(ctx.signal, finish => {
      const child = ctx.adapters.spawn(command.file, command.args, { shell: false, windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'], detached: false });
      const capture = (key, chunk) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const remaining = LIMITS.outputBytes - used;
        chunks[key].push(buffer.subarray(0, remaining));
        used += Math.min(buffer.length, remaining);
        if (buffer.length > remaining) {
          observations.outputTruncated = true;
          finish(fault('OUTPUT_LIMIT'));
        }
      };
      child.stdout.on('data', chunk => capture('rawStdout', chunk));
      child.stderr.on('data', chunk => capture('rawStderr', chunk));
      child.stdout.once('error', error => finish(error));
      child.stderr.once('error', error => finish(error));
      child.once('error', error => finish(error));
      child.once('close', (code, signal) => {
        observations.exitCode = Number.isInteger(code) ? code : null;
        observations.signal = text(signal, 32);
        finish(null, code === 0 ? 'The Windows command completed. Review raw evidence; reachability is not inferred.' : null);
      });
      return () => {
        try {
          if (child.exitCode === null && child.signalCode === null && !child.kill('SIGKILL')) throw fault('CLEANUP_FAILED');
        } finally {
          child.stdout.destroy();
          child.stderr.destroy();
        }
      };
    });
  } finally {
    let remaining = LIMITS.outputBytes;
    for (const key of Object.keys(chunks)) {
      let decoded = text(Buffer.concat(chunks[key]).toString('utf8'), LIMITS.outputBytes);
      if (Buffer.byteLength(decoded) > remaining) {
        observations.outputTruncated = true;
        decoded = Buffer.from(decoded).subarray(0, remaining).toString('utf8');
        while (Buffer.byteLength(decoded) > remaining) decoded = decoded.slice(0, -1);
      }
      observations[key] = decoded;
      remaining -= Buffer.byteLength(decoded);
    }
  }
}

export async function runDiagnostic(input, { confirmTarget, signal, adapters = {} } = {}) {
  const request = validateRequest(input);
  confirm(request, confirmTarget);
  const startedAt = new Date().toISOString();
  const observations = {};
  const limitations = ['A local snapshot, not a simulation, continuous monitor or proof of end-to-end network health.',
    'Results can identify internal hosts and topology. Review locally before sharing; no report is uploaded by this runner.',
    'Only authorized unicast targets are allowed. Directed broadcast addresses cannot all be identified without a subnet mask; never use one. IPv4 addresses ending in .255 and IPv4-mapped IPv6 are rejected.'];
  const controller = new AbortController();
  const relay = () => controller.abort(fault('ABORTED'));
  if (signal?.aborted) relay(); else signal?.addEventListener('abort', relay, { once: true });
  const deadlineMs = ['ping', 'traceroute'].includes(request.operation) ? LIMITS.deadlineMs : request.parameters.timeoutMs;
  const timer = setTimeout(() => controller.abort(fault('DEADLINE')), deadlineMs);
  const ctx = { request, signal: controller.signal, adapters: { createResolver: options => new Resolver(options),
    tcpConnect, tlsConnect, spawn, platform: process.platform, ...adapters } };
  let status = 'completed', summary;
  try {
    if (ctx.signal.aborted) throw abortError(ctx.signal);
    if (request.operation === 'dns') summary = await runDns(ctx, observations, limitations);
    else if (['tcp', 'tls'].includes(request.operation)) summary = await runSocket(ctx, observations, limitations);
    else summary = await runCommand(ctx, observations, limitations);
    if (!summary) { status = 'failed'; summary = 'The Windows command ended unsuccessfully; see its raw evidence. No cause is inferred.'; }
  } catch (error) {
    const code = knownErrors.has(error?.code) ? error.code : 'OPERATION_FAILED';
    observations.errorCode = code;
    status = ['DEADLINE', 'ETIMEOUT', 'ETIMEDOUT'].includes(code) ? 'timeout' : 'failed';
    summary = code === 'ABORTED' ? 'Cancelled by the operator; incomplete evidence is not proof of an outage.'
      : code === 'UNSUPPORTED_PLATFORM' ? 'Ping and traceroute are supported only on Windows in this version. No command or network probe was started.'
      : code === 'CLEANUP_FAILED' ? 'Resource cleanup failed. Check for a remaining diagnostic process before running another request.'
      : status === 'timeout' ? 'The time budget expired; a timeout alone does not identify the cause.'
      : 'The diagnostic did not complete successfully. The error code is evidence, not a root-cause diagnosis.';
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', relay);
    if (!controller.signal.aborted) controller.abort(fault('ABORTED'));
  }
  return { schemaVersion: 1, kind: 'qcs-local-diagnostic-result', operation: request.operation, target: request.target,
    parameters: request.parameters, startedAt, finishedAt: new Date().toISOString(), status, summary, observations, limitations };
}

function localPath(value) {
  if (typeof value !== 'string' || !value || value.length > 4096 || /[\u0000-\u001f]/.test(value) || /^[/\\]{2}/.test(value)) throw fault('INVALID_CLI', 'Use a local regular-file path, not a network or device path.');
  if (process.platform === 'win32') {
    if (/:(?![/\\])/.test(value) || value.slice(2).includes(':') ||
        value.split(/[/\\]/).some(part => /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw fault('INVALID_CLI', 'Windows device, drive-relative and alternate-stream paths are not allowed.');
  }
  return path.resolve(value);
}
export function parseArgs(args) {
  if (!Array.isArray(args) || args.length !== 6) throw fault('INVALID_CLI', 'Required: --request FILE --confirm-target EXACT --out FILE');
  const result = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i], value = args[i + 1];
    if (!['--request', '--confirm-target', '--out'].includes(key) || Object.hasOwn(result, key) || typeof value !== 'string' || !value || value.startsWith('--')) throw fault('INVALID_CLI', 'Unknown, duplicate or missing CLI argument.');
    result[key] = value;
  }
  return { requestFile: localPath(result['--request']), confirmTarget: result['--confirm-target'], outputFile: localPath(result['--out']) };
}
async function readRequest(filename) {
  const handle = await open(filename, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > LIMITS.requestBytes) throw fault('INVALID_REQUEST', 'Request must be a regular JSON file of at most 16 KiB.');
    const buffer = Buffer.alloc(LIMITS.requestBytes + 1);
    let count = 0;
    while (count < buffer.length) {
      const read = await handle.read(buffer, count, buffer.length - count, null);
      if (!read.bytesRead) break;
      count += read.bytesRead;
    }
    if (count > LIMITS.requestBytes) throw fault('INVALID_REQUEST', 'Request exceeds 16 KiB.');
    try { return validateRequest(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, count)))); }
    catch { throw fault('INVALID_REQUEST', 'Request JSON or schema is invalid.'); }
  } finally { await handle.close(); }
}

export async function main(args = process.argv.slice(2)) {
  if (Number(process.versions.node.split('.')[0]) < 22) throw fault('UNSUPPORTED_RUNTIME', 'Node.js 22 or later is required.');
  const options = parseArgs(args);
  const request = await readRequest(options.requestFile);
  confirm(request, options.confirmTarget);
  // Reserve exclusively before any network activity; never truncate an existing result.
  const output = await open(options.outputFile, 'wx', 0o600);
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.on('SIGINT', abort);
  process.on('SIGTERM', abort);
  try {
    const result = await runDiagnostic(request, { confirmTarget: options.confirmTarget, signal: controller.signal });
    await output.writeFile(`${JSON.stringify(result, null, 2)}\n`, 'utf8');
    await output.sync();
    return result.status === 'completed' ? 0 : 1;
  } finally {
    process.removeListener('SIGINT', abort);
    process.removeListener('SIGTERM', abort);
    await output.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(code => {
    process.exitCode = code;
    process.stdout.write(code === 0 ? 'Diagnostic report saved locally. Review limitations before interpreting results.\n' : 'Incomplete diagnostic report saved locally. Review status and error code.\n');
  }).catch(error => {
    process.exitCode = 2;
    const code = ['INVALID_CLI', 'INVALID_REQUEST', 'CONFIRMATION_REQUIRED', 'UNSUPPORTED_RUNTIME'].includes(error?.code) ? error.code : 'LOCAL_FILE_ERROR';
    process.stderr.write(`${code}: request not run or report could not be saved. Check local paths, permissions and required arguments; existing files are never overwritten.\n`);
  });
}

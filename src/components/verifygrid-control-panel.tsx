"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Ban,
  Cable,
  CheckCircle2,
  Clock3,
  CloudCog,
  Copy,
  Cpu,
  DatabaseZap,
  FilePlus2,
  FileSearch,
  FileText,
  Fingerprint,
  LockKeyhole,
  ListChecks,
  MailPlus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Siren,
  Target,
  Trash2,
  Upload,
  Wrench
} from "lucide-react";
import { capabilityCatalog, connectorCatalog, type VerifyGridConnector } from "@/lib/verifygrid-catalog";
import type { VerifyGridEngagementRecord, VerifyGridPortfolio } from "@/lib/verifygrid";

type View = "command" | "scope" | "methodology" | "evidence" | "findings" | "execution" | "automation" | "reports" | "activity";

type VerifyGridAutomation = {
  connectors: Array<{
    id: string;
    engagementId: string;
    provider: string;
    label: string;
    status: string;
    baseUrl: string;
    credentialRef: string;
    connectorMode: "cloud_api" | "sensor_api";
    syncMode: string;
    scheduleMinutes: number;
    credentialsReady: boolean;
    lastSyncAt: string;
    nextSyncAt: string;
    lastSuccessAt: string;
    consecutiveFailures: number;
    lastError: string;
    runs: Array<{ id: string; status: string; trigger: string; attempt: number; errorMessage: string; createdAt: string; completedAt: string }>;
  }>;
  sensors: Array<{ id: string; name: string; status: string; tokenLastFour: string; capabilities: string[]; runtimeCapabilities: string[]; healthStatus: string; lastError: string; version: string; region: string; lastSeenAt: string; createdAt: string }>;
  memberships: Array<{ id: string; email: string; displayName: string; role: string; status: string; invitedAt: string; acceptedAt: string; lastAccessAt: string }>;
};

function localDateTime(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function label(value: string) {
  return value.replace(/_/g, " ");
}

function groupTestCases(testCases: VerifyGridEngagementRecord["testCases"]) {
  return Object.entries(testCases.reduce<Record<string, VerifyGridEngagementRecord["testCases"]>>((groups, testCase) => {
    (groups[testCase.category] ||= []).push(testCase);
    return groups;
  }, {}));
}

const verifyGridDateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
  hour12: false
});

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : verifyGridDateTime.format(date);
}

function initialEngagementDraft() {
  const start = new Date(Date.now() + 24 * 60 * 60_000);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60_000);
  return {
    organizationName: "",
    legalName: "",
    primaryContactName: "",
    primaryContactEmail: "",
    countryCode: "IN",
    timezone: "Asia/Kolkata",
    title: "External network security assessment",
    serviceType: "external_network_vapt",
    testMode: "safe_checks",
    riskTier: "standard",
    scopeSummary: "",
    plannedStartAt: localDateTime(start),
    plannedEndAt: localDateTime(end),
    emergencyContactName: "",
    emergencyContactEmail: "",
    emergencyContactPhone: "",
    noExclusionsConfirmed: false
  };
}

function initialScopeDraft() {
  return {
    targetType: "domain",
    value: "",
    environment: "production",
    criticality: "medium",
    permission: "safe_checks",
    inScope: true,
    ownershipConfirmed: false,
    notes: ""
  };
}

function initialFindingDraft() {
  return {
    title: "",
    description: "",
    severity: "medium",
    confidence: "unverified",
    source: "manual",
    sourceReference: "",
    cvssScore: "",
    epssScore: "",
    knownExploited: false,
    businessImpact: "",
    evidenceSummary: "",
    remediation: "",
    ownerName: "",
    ownerEmail: "",
    dueAt: ""
  };
}

function initialAuthorizationDraft() {
  const start = new Date();
  return {
    approvedByName: "",
    approvedByEmail: "",
    approvedByTitle: "",
    authorityConfirmed: false,
    validFrom: localDateTime(start),
    validUntil: localDateTime(new Date(start.getTime() + 7 * 24 * 60 * 60_000)),
    artifactUrl: "",
    artifactSha256: "",
    notes: ""
  };
}

function initialImportDraft() {
  return { connector: "nessus_xml" as VerifyGridConnector, fileName: "", content: "", enrich: true };
}

function initialExecutionDraft() {
  const start = new Date(Date.now() + 10 * 60_000);
  return {
    capability: "asset_inventory",
    targetIds: [] as string[],
    rationale: "Validate the approved target posture within the current rules of engagement.",
    requestedStartAt: localDateTime(start),
    validUntil: localDateTime(new Date(start.getTime() + 2 * 60 * 60_000)),
    acknowledgeNonDestructive: false
  };
}

const providerDefaults = {
  tenable: { label: "Tenable Vulnerability Management", baseUrl: "https://cloud.tenable.com", credentialRef: "VERIFYGRID_TENABLE" },
  qualys: { label: "Qualys VMDR", baseUrl: "https://qualysapi.qualys.com", credentialRef: "VERIFYGRID_QUALYS" },
  rapid7: { label: "Rapid7 InsightVM", baseUrl: "https://insightvm.example.com", credentialRef: "VERIFYGRID_RAPID7" },
  greenbone: { label: "Greenbone GMP", baseUrl: "https://greenbone.local", credentialRef: "VERIFYGRID_GREENBONE" }
} as const;

type ConnectorDraft = {
  provider: keyof typeof providerDefaults;
  label: string;
  baseUrl: string;
  credentialRef: string;
  syncMode: string;
  scheduleMinutes: string;
};

function initialConnectorDraft(): ConnectorDraft {
  return { provider: "tenable" as keyof typeof providerDefaults, ...providerDefaults.tenable, syncMode: "differential", scheduleMinutes: "1440" };
}

function initialSensorDraft() {
  return { name: "QCS scanner node", capabilities: ["asset_inventory", "dns_posture", "tls_posture", "tcp_service_validation", "http_security_headers", "network_service_scan", "web_passive_scan", "template_vulnerability_scan"] };
}

function initialMemberDraft() {
  return { email: "", displayName: "", role: "client_viewer", expiresInHours: "48" };
}

async function responseJson(response: Response) {
  return response.json() as Promise<{
    error?: string;
    portfolio?: VerifyGridPortfolio;
    engagement?: VerifyGridEngagementRecord;
    batchId?: string;
    promoted?: number;
    duplicates?: number;
    jobId?: string;
    reportId?: string;
  }>;
}

async function automationJson(response: Response) {
  return response.json() as Promise<{
    error?: string;
    automation?: VerifyGridAutomation;
    token?: string;
    accessUrl?: string;
    sensor?: { id: string; name: string };
    membership?: { id: string; email: string };
    run?: { id: string; status: string };
  }>;
}

export function VerifyGridControlPanel({ initialPortfolio }: { initialPortfolio: VerifyGridPortfolio | null }) {
  const [portfolio, setPortfolio] = useState(initialPortfolio);
  const [selectedId, setSelectedId] = useState(initialPortfolio?.engagements[0]?.id || "");
  const [view, setView] = useState<View>("command");
  const [creating, setCreating] = useState(false);
  const [engagementDraft, setEngagementDraft] = useState(initialEngagementDraft);
  const [scopeDraft, setScopeDraft] = useState(initialScopeDraft);
  const [findingDraft, setFindingDraft] = useState(initialFindingDraft);
  const [authorizationDraft, setAuthorizationDraft] = useState(initialAuthorizationDraft);
  const [importDraft, setImportDraft] = useState(initialImportDraft);
  const [executionDraft, setExecutionDraft] = useState(initialExecutionDraft);
  const [automation, setAutomation] = useState<VerifyGridAutomation | null>(null);
  const [automationWorkspaceId, setAutomationWorkspaceId] = useState("");
  const [connectorDraft, setConnectorDraft] = useState(initialConnectorDraft);
  const [sensorDraft, setSensorDraft] = useState(initialSensorDraft);
  const [memberDraft, setMemberDraft] = useState(initialMemberDraft);
  const [jobSensors, setJobSensors] = useState<Record<string, string>>({});
  const [emergencyReason, setEmergencyReason] = useState("");
  const [oneTimeValue, setOneTimeValue] = useState<{ title: string; value: string } | null>(null);
  const [reportType, setReportType] = useState("executive");
  const [resolution, setResolution] = useState({ findingId: "", note: "" });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(initialPortfolio ? "VerifyGrid operations are current." : "Apply the VerifyGrid database migration to activate this workspace.");

  const selected = portfolio?.engagements.find((engagement) => engagement.id === selectedId) || portfolio?.engagements[0] || null;

  async function load(preferredId = selectedId) {
    const response = await fetch("/api/admin/verifygrid/engagements", { cache: "no-store" });
    const result = await responseJson(response);
    if (!response.ok || !result.portfolio) throw new Error(result.error || "Unable to load VerifyGrid.");
    setPortfolio(result.portfolio);
    setSelectedId(result.portfolio.engagements.some((item) => item.id === preferredId) ? preferredId : result.portfolio.engagements[0]?.id || "");
  }

  async function loadAutomation(workspaceId: string) {
    setBusy("automation-load");
    try {
      const response = await fetch(`/api/admin/verifygrid/workspaces/${workspaceId}/automation`, { cache: "no-store" });
      const result = await automationJson(response);
      if (!response.ok || !result.automation) throw new Error(result.error || "Unable to load automation controls.");
      setAutomation(result.automation);
      setAutomationWorkspaceId(workspaceId);
    } finally {
      setBusy("");
    }
  }

  async function mutateResult(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
    const response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const result = await responseJson(response);
    if (!response.ok) throw new Error(result.error || "VerifyGrid operation failed.");
    return result;
  }

  async function mutate(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
    return (await mutateResult(path, method, body)).engagement;
  }

  async function createEngagement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create");
    try {
      const engagement = await mutate("/api/admin/verifygrid/engagements", "POST", {
        ...engagementDraft,
        rulesOfEngagement: {
          businessHoursOnly: false,
          maxRequestsPerSecond: 5,
          sourceIps: [],
          prohibitedActions: ["Denial of service", "Persistence", "Destructive changes", "Access to third-party targets"],
          stopConditions: ["Service instability", "Client stop request", "Target ownership dispute", "Unexpected sensitive data exposure"],
          noExclusionsConfirmed: engagementDraft.noExclusionsConfirmed,
          notes: ""
        }
      });
      if (!engagement) throw new Error("The engagement was created without a response record.");
      await load(engagement.id);
      setSelectedId(engagement.id);
      setCreating(false);
      setEngagementDraft(initialEngagementDraft());
      setView("scope");
      setMessage(`${engagement.reference} created. Scope authorization remains blocked until targets are recorded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create engagement.");
    } finally {
      setBusy("");
    }
  }

  async function addScope(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy("scope");
    try {
      await mutate(`/api/admin/verifygrid/engagements/${selected.id}/scope`, "POST", scopeDraft);
      await load(selected.id);
      setScopeDraft(initialScopeDraft());
      setMessage("Scope saved. Any previous authorization was invalidated against the new scope hash.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save target.");
    } finally {
      setBusy("");
    }
  }

  async function removeScope(targetId: string) {
    if (!selected || !window.confirm("Remove this target and invalidate any authorization for the previous scope?")) return;
    setBusy(`scope-${targetId}`);
    try {
      await mutate(`/api/admin/verifygrid/engagements/${selected.id}/scope`, "DELETE", { targetId });
      await load(selected.id);
      setMessage("Scope target removed. Authorization review is required.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to remove target.");
    } finally {
      setBusy("");
    }
  }

  async function authorize(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy("authorize");
    try {
      await mutate(`/api/admin/verifygrid/engagements/${selected.id}/authorize`, "POST", authorizationDraft);
      await load(selected.id);
      setMessage("Authorization recorded and cryptographically bound to the current scope.");
      setView("command");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to record authorization.");
    } finally {
      setBusy("");
    }
  }

  async function transition(action: string) {
    if (!selected) return;
    setBusy(action);
    try {
      await mutate(`/api/admin/verifygrid/engagements/${selected.id}`, "PATCH", { action, reason: "Operator action from VerifyGrid command workspace." });
      await load(selected.id);
      setMessage(`Engagement moved through the ${action} control.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to change engagement state.");
    } finally {
      setBusy("");
    }
  }

  async function addFinding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy("finding");
    try {
      await mutate(`/api/admin/verifygrid/engagements/${selected.id}/findings`, "POST", {
        ...findingDraft,
        cvssScore: findingDraft.cvssScore ? Number(findingDraft.cvssScore) : null,
        epssScore: findingDraft.epssScore ? Number(findingDraft.epssScore) : null
      });
      await load(selected.id);
      setFindingDraft(initialFindingDraft());
      setMessage("Finding added to the evidence-led remediation queue.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create finding.");
    } finally {
      setBusy("");
    }
  }

  async function updateFinding(findingId: string, status: string, note = "") {
    if (!selected) return;
    setBusy(`finding-${findingId}`);
    try {
      await mutate(`/api/admin/verifygrid/findings/${findingId}`, "PATCH", { status, resolutionNote: note });
      await load(selected.id);
      setResolution({ findingId: "", note: "" });
      setMessage(`Finding moved to ${label(status)}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update finding.");
    } finally {
      setBusy("");
    }
  }

  async function updateTestCase(testCaseId: string, status: string, currentSummary: string, currentAssignee: string) {
    if (!selected) return;
    let resultSummary = currentSummary;
    let assignedTo = currentAssignee;
    if (["passed", "finding", "not_applicable"].includes(status)) {
      const summary = window.prompt("Record the test evidence and conclusion (at least 20 characters):", currentSummary);
      if (summary === null) return;
      if (summary.trim().length < 20) {
        setMessage("Completed methodology tests require an evidence summary of at least 20 characters.");
        return;
      }
      resultSummary = summary.trim();
    }
    if (status === "running" && !assignedTo) {
      const assignee = window.prompt("Assign the analyst responsible for this test:");
      if (assignee === null) return;
      assignedTo = assignee.trim();
    }
    setBusy(`test-case-${testCaseId}`);
    try {
      await mutate(`/api/admin/verifygrid/test-cases/${testCaseId}`, "PATCH", { status, resultSummary, assignedTo });
      await load(selected.id);
      setMessage(`Methodology test moved to ${label(status)} with an accountable evidence trail.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update the methodology test.");
    } finally {
      setBusy("");
    }
  }

  async function requestRetest(findingId: string) {
    if (!selected) return;
    setBusy(`retest-${findingId}`);
    try {
      await mutate(`/api/admin/verifygrid/findings/${findingId}/retests`, "POST");
      await load(selected.id);
      setMessage("Retest requested and added to the verification queue.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to request retest.");
    } finally {
      setBusy("");
    }
  }

  async function selectImportFile(file?: File) {
    if (!file) return;
    if (file.size > 2_000_000) {
      setMessage("Scanner exports must be 2 MB or smaller for direct control-plane import.");
      return;
    }
    const content = await file.text();
    setImportDraft((current) => ({ ...current, fileName: file.name, content }));
    setMessage(`${file.name} loaded locally. It will be hashed and reconciled when you import it.`);
  }

  async function importEvidence(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy("import");
    try {
      const result = await mutateResult(`/api/admin/verifygrid/engagements/${selected.id}/imports`, "POST", importDraft);
      await load(selected.id);
      setImportDraft(initialImportDraft());
      setMessage(`Evidence batch ${result.batchId || "created"} imported. Review scope disposition before promotion.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to import scanner evidence.");
    } finally {
      setBusy("");
    }
  }

  async function promoteBatch(batchId: string) {
    if (!selected || !window.confirm("Promote pending in-scope observations at low severity or higher into the remediation queue?")) return;
    setBusy(`promote-${batchId}`);
    try {
      const result = await mutateResult(`/api/admin/verifygrid/imports/${batchId}/promote`, "POST", {
        minimumSeverity: "low",
        includeInformational: false
      });
      await load(selected.id);
      setMessage(`${result.promoted || 0} observation(s) promoted; ${result.duplicates || 0} reconciled with existing findings.`);
      setView("findings");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to promote scanner observations.");
    } finally {
      setBusy("");
    }
  }

  function toggleExecutionTarget(targetId: string) {
    setExecutionDraft((current) => ({
      ...current,
      targetIds: current.targetIds.includes(targetId)
        ? current.targetIds.filter((id) => id !== targetId)
        : [...current.targetIds, targetId]
    }));
  }

  async function createExecutionRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy("execution");
    try {
      const result = await mutateResult(`/api/admin/verifygrid/engagements/${selected.id}/execution-jobs`, "POST", executionDraft);
      await load(selected.id);
      setExecutionDraft(initialExecutionDraft());
      setMessage(`Execution manifest ${result.jobId || "created"} validated against the current scope and authorization.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to prepare the execution manifest.");
    } finally {
      setBusy("");
    }
  }

  async function cancelExecutionRecord(jobId: string) {
    if (!selected) return;
    const reason = window.prompt("Record the cancellation reason (at least 20 characters):");
    if (!reason) return;
    setBusy(`cancel-${jobId}`);
    try {
      await mutate(`/api/admin/verifygrid/execution-jobs/${jobId}`, "PATCH", { reason });
      await load(selected.id);
      setMessage("Execution record cancelled and retained in the activity trail.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to cancel the execution record.");
    } finally {
      setBusy("");
    }
  }

  async function approveExecutionRecord(jobId: string) {
    if (!selected) return;
    const approvalNote = window.prompt("Record why this controlled validation is necessary, expected, and within the approved window (at least 30 characters):");
    if (!approvalNote) return;
    if (!window.confirm("Approve this bounded scanner job for the exact targets and authorization shown in its signed manifest?")) return;
    setBusy(`approve-${jobId}`);
    try {
      await mutate(`/api/admin/verifygrid/execution-jobs/${jobId}/approve`, "POST", { approvalNote, acknowledgeControlledValidation: true });
      await load(selected.id);
      setMessage("Controlled validation approved. The manifest was resealed and is ready for a capable connected scanner node.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to approve the execution record.");
    } finally {
      setBusy("");
    }
  }

  async function generateReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy("report");
    try {
      const result = await mutateResult(`/api/admin/verifygrid/engagements/${selected.id}/reports`, "POST", { reportType });
      await load(selected.id);
      setMessage(`${label(reportType)} report ${result.reportId || "snapshot"} generated. Open it from the report list.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate the assurance report.");
    } finally {
      setBusy("");
    }
  }

  async function automationMutation(path: string, method: "POST" | "PATCH", body: unknown) {
    const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await automationJson(response);
    if (!response.ok) throw new Error(result.error || "VerifyGrid automation operation failed.");
    return result;
  }

  function changeConnectorProvider(provider: keyof typeof providerDefaults) {
    setConnectorDraft((current) => ({ ...current, provider, ...providerDefaults[provider] }));
  }

  async function createConnector(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy("connector-create");
    try {
      await automationMutation(`/api/admin/verifygrid/workspaces/${selected.workspace.id}/connectors`, "POST", {
        ...connectorDraft,
        engagementId: selected.id,
        scheduleMinutes: Number(connectorDraft.scheduleMinutes)
      });
      await loadAutomation(selected.workspace.id);
      setConnectorDraft(initialConnectorDraft());
      setMessage("Connector profile created. The status below shows whether its environment-backed credentials are ready.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create connector profile.");
    } finally {
      setBusy("");
    }
  }

  async function syncConnector(connectorId: string) {
    if (!selected) return;
    setBusy(`connector-${connectorId}`);
    try {
      const result = await automationMutation(`/api/admin/verifygrid/connectors/${connectorId}/runs`, "POST", { trigger: "admin" });
      await loadAutomation(selected.workspace.id);
      setMessage(`Connector run ${result.run?.id || "queued"} is ${label(result.run?.status || "queued")}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to queue connector synchronization.");
    } finally {
      setBusy("");
    }
  }

  function toggleSensorCapability(capability: string) {
    setSensorDraft((current) => ({
      ...current,
      capabilities: current.capabilities.includes(capability)
        ? current.capabilities.filter((item) => item !== capability)
        : [...current.capabilities, capability]
    }));
  }

  async function enrollSensor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy("sensor-create");
    try {
      const result = await automationMutation(`/api/admin/verifygrid/workspaces/${selected.workspace.id}/sensors`, "POST", sensorDraft);
      if (result.token) setOneTimeValue({ title: `${result.sensor?.name || "Sensor"} enrollment token`, value: result.token });
      await loadAutomation(selected.workspace.id);
      setSensorDraft(initialSensorDraft());
      setMessage("Sensor enrolled. Store the one-time token on the client sensor before dismissing it.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to enroll sensor.");
    } finally {
      setBusy("");
    }
  }

  async function revokeSensor(sensorId: string) {
    if (!selected) return;
    const reason = window.prompt("Record why this sensor is being revoked (at least 10 characters):");
    if (!reason) return;
    setBusy(`sensor-${sensorId}`);
    try {
      await automationMutation(`/api/admin/verifygrid/sensors/${sensorId}`, "PATCH", { reason });
      await loadAutomation(selected.workspace.id);
      setMessage("Sensor revoked and its active jobs cancelled.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to revoke sensor.");
    } finally {
      setBusy("");
    }
  }

  async function inviteMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy("member-invite");
    try {
      const result = await automationMutation(`/api/admin/verifygrid/workspaces/${selected.workspace.id}/memberships`, "POST", { ...memberDraft, expiresInHours: Number(memberDraft.expiresInHours) });
      if (result.accessUrl) setOneTimeValue({ title: `${result.membership?.email || "Client"} one-time access link`, value: result.accessUrl });
      await loadAutomation(selected.workspace.id);
      setMemberDraft(initialMemberDraft());
      setMessage("Client access issued. Send the one-time link through an approved secure channel.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to issue client access.");
    } finally {
      setBusy("");
    }
  }

  async function revokeMember(membershipId: string) {
    if (!selected) return;
    const reason = window.prompt("Record why this client access is being revoked (at least 10 characters):");
    if (!reason) return;
    setBusy(`member-${membershipId}`);
    try {
      await automationMutation(`/api/admin/verifygrid/memberships/${membershipId}`, "PATCH", { reason });
      await loadAutomation(selected.workspace.id);
      setMessage("Client access revoked immediately.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to revoke client access.");
    } finally {
      setBusy("");
    }
  }

  async function queueExecutionJob(jobId: string, sensorId: string) {
    if (!selected || !sensorId) return;
    setBusy(`queue-${jobId}`);
    try {
      const response = await fetch(`/api/admin/verifygrid/execution-jobs/${jobId}/queue`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sensorId }) });
      const result = await responseJson(response);
      if (!response.ok) throw new Error(result.error || "Unable to queue execution record.");
      await load(selected.id);
      setMessage("The validated manifest is queued to the selected outbound sensor.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to queue execution record.");
    } finally {
      setBusy("");
    }
  }

  async function emergencyStop() {
    if (!selected || emergencyReason.trim().length < 20 || !window.confirm("Stop this engagement and cancel every queued or running sensor job?")) return;
    setBusy("emergency-stop");
    try {
      const response = await fetch(`/api/admin/verifygrid/engagements/${selected.id}/kill-switch`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: emergencyReason }) });
      const result = await responseJson(response);
      if (!response.ok) throw new Error(result.error || "Unable to stop the engagement.");
      await load(selected.id);
      setEmergencyReason("");
      setMessage("Emergency stop recorded. The engagement is paused and every active dispatch is cancelled.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to stop the engagement.");
    } finally {
      setBusy("");
    }
  }

  async function copyOneTimeValue() {
    if (!oneTimeValue) return;
    await navigator.clipboard.writeText(oneTimeValue.value);
    setMessage(`${oneTimeValue.title} copied.`);
  }

  const lifecycleActions = selected ? {
    authorized: ["schedule", "start", "cancel"],
    scheduled: ["start", "pause", "cancel"],
    active: ["pause", "remediation", "cancel"],
    paused: ["resume", "remediation", "cancel"],
    remediation: ["close", "cancel"]
  }[selected.status] || [] : [];

  const methodologyCategories = selected ? groupTestCases(selected.testCases) : [];
  const methodologyComplete = selected?.testCases.filter((testCase) => ["passed", "finding", "not_applicable"].includes(testCase.status)).length || 0;

  return (
    <section className="admin-panel verifygrid-panel" id="verifygrid">
      <div className="panel-heading verifygrid-heading">
        <div>
          <p className="eyebrow">VerifyGrid security assurance</p>
          <h2>Authorization, exposure, remediation, and retest control.</h2>
          <p>Network-first PTaaS operations with a scope-bound execution gate.</p>
        </div>
        <div className="content-action-row">
          <button className="icon-button" disabled={Boolean(busy)} onClick={() => load().catch((error) => setMessage(String(error)))} title="Refresh VerifyGrid" type="button"><RefreshCw aria-hidden="true" size={18} /></button>
          <button className="button primary compact-button" disabled={Boolean(busy)} onClick={() => setCreating((value) => !value)} type="button"><FilePlus2 aria-hidden="true" size={17} /> New engagement</button>
        </div>
      </div>
      <p aria-live="polite" className="form-note verifygrid-message">{message}</p>

      {oneTimeValue ? (
        <div className="verifygrid-one-time" role="status">
          <div><strong>{oneTimeValue.title}</strong><span>This value cannot be recovered after this notice is dismissed.</span></div>
          <code>{oneTimeValue.value}</code>
          <div className="content-action-row"><button className="button primary compact-button" onClick={copyOneTimeValue} type="button"><Copy aria-hidden="true" size={15} /> Copy</button><button className="button secondary compact-button" onClick={() => setOneTimeValue(null)} type="button">Dismiss</button></div>
        </div>
      ) : null}

      {portfolio ? (
        <div className="verifygrid-metrics" aria-label="VerifyGrid portfolio metrics">
          <div><span>Clients</span><strong>{portfolio.metrics.workspaces}</strong></div>
          <div><span>Engagements</span><strong>{portfolio.metrics.engagements}</strong></div>
          <div><span>Authorization review</span><strong>{portfolio.metrics.authorizationPending}</strong></div>
          <div><span>Executable now</span><strong>{portfolio.metrics.executable}</strong></div>
          <div><span>Open findings</span><strong>{portfolio.metrics.openFindings}</strong></div>
          <div><span>Critical</span><strong>{portfolio.metrics.criticalFindings}</strong></div>
          <div><span>Known exploited</span><strong>{portfolio.metrics.knownExploited}</strong></div>
          <div><span>Overdue</span><strong>{portfolio.metrics.overdueFindings}</strong></div>
          <div><span>Pending evidence</span><strong>{portfolio.metrics.pendingObservations}</strong></div>
          <div><span>Prepared checks</span><strong>{portfolio.metrics.preparedJobs}</strong></div>
        </div>
      ) : null}

      {creating ? (
        <form className="content-editor verifygrid-create-form" onSubmit={createEngagement}>
          <div className="content-editor-heading"><div><p className="eyebrow">Engagement intake</p><h3>Open an authorized testing record</h3></div></div>
          <fieldset className="content-editor-section">
            <legend>Client and engagement</legend>
            <div className="content-field-grid">
              <label className="content-field"><span>Organization</span><input required value={engagementDraft.organizationName} onChange={(event) => setEngagementDraft({ ...engagementDraft, organizationName: event.target.value })} /></label>
              <label className="content-field"><span>Legal name</span><input value={engagementDraft.legalName} onChange={(event) => setEngagementDraft({ ...engagementDraft, legalName: event.target.value })} /></label>
              <label className="content-field"><span>Primary contact</span><input required value={engagementDraft.primaryContactName} onChange={(event) => setEngagementDraft({ ...engagementDraft, primaryContactName: event.target.value })} /></label>
              <label className="content-field"><span>Contact email</span><input required type="email" value={engagementDraft.primaryContactEmail} onChange={(event) => setEngagementDraft({ ...engagementDraft, primaryContactEmail: event.target.value })} /></label>
              <label className="content-field content-field-wide"><span>Engagement title</span><input required value={engagementDraft.title} onChange={(event) => setEngagementDraft({ ...engagementDraft, title: event.target.value })} /></label>
              <label className="content-field"><span>Service</span><select value={engagementDraft.serviceType} onChange={(event) => setEngagementDraft({ ...engagementDraft, serviceType: event.target.value })}><option value="external_network_vapt">External network VAPT</option><option value="internal_network_vapt">Internal network VAPT</option><option value="firewall_assurance">Firewall assurance</option><option value="cloud_network_assurance">Cloud network assurance</option><option value="wireless_assessment">Wireless assessment</option><option value="configuration_assurance">Configuration assurance</option><option value="continuous_validation">Continuous validation</option><option value="web_and_api_vapt">Web and API VAPT</option></select></label>
              <label className="content-field"><span>Test mode</span><select value={engagementDraft.testMode} onChange={(event) => setEngagementDraft({ ...engagementDraft, testMode: event.target.value })}><option value="passive_review">Passive review</option><option value="safe_checks">Safe checks</option><option value="controlled_validation">Controlled validation</option><option value="manual_only">Manual only</option></select></label>
              <label className="content-field content-field-wide"><span>Scope summary</span><textarea required rows={3} value={engagementDraft.scopeSummary} onChange={(event) => setEngagementDraft({ ...engagementDraft, scopeSummary: event.target.value })} /></label>
              <label className="content-field"><span>Planned start</span><input type="datetime-local" value={engagementDraft.plannedStartAt} onChange={(event) => setEngagementDraft({ ...engagementDraft, plannedStartAt: event.target.value })} /></label>
              <label className="content-field"><span>Planned end</span><input type="datetime-local" value={engagementDraft.plannedEndAt} onChange={(event) => setEngagementDraft({ ...engagementDraft, plannedEndAt: event.target.value })} /></label>
              <label className="content-field"><span>Emergency contact</span><input required value={engagementDraft.emergencyContactName} onChange={(event) => setEngagementDraft({ ...engagementDraft, emergencyContactName: event.target.value })} /></label>
              <label className="content-field"><span>Emergency email</span><input required type="email" value={engagementDraft.emergencyContactEmail} onChange={(event) => setEngagementDraft({ ...engagementDraft, emergencyContactEmail: event.target.value })} /></label>
              <label className="verifygrid-check content-field-wide"><input checked={engagementDraft.noExclusionsConfirmed} onChange={(event) => setEngagementDraft({ ...engagementDraft, noExclusionsConfirmed: event.target.checked })} type="checkbox" /><span>The client explicitly stated that no exclusions apply.</span></label>
            </div>
          </fieldset>
          <div className="content-action-row"><button className="button primary" disabled={busy === "create"} type="submit"><Plus aria-hidden="true" size={17} /> {busy === "create" ? "Creating..." : "Create engagement"}</button><button className="button secondary" onClick={() => setCreating(false)} type="button">Cancel</button></div>
        </form>
      ) : null}

      {portfolio && portfolio.engagements.length ? (
        <div className="verifygrid-layout">
          <aside className="verifygrid-rail" aria-label="Engagements">
            {portfolio.engagements.map((engagement) => (
              <button aria-current={selected?.id === engagement.id ? "true" : undefined} key={engagement.id} onClick={() => { setSelectedId(engagement.id); setView("command"); setAutomation(null); setAutomationWorkspaceId(""); setImportDraft(initialImportDraft()); setExecutionDraft(initialExecutionDraft()); }} type="button">
                <span><strong>{engagement.workspace.name}</strong><em>{engagement.reference}</em></span>
                <span className={`verifygrid-state state-${engagement.status}`}>{label(engagement.status)}</span>
                <small>{engagement.title}</small>
              </button>
            ))}
          </aside>

          {selected ? (
            <div className="verifygrid-workspace">
              <header className="verifygrid-engagement-header">
                <div><div className="content-card-statuses"><span className={`status-pill content-status-${selected.gate.executable ? "published" : "draft"}`}>{selected.gate.executable ? "execution gate open" : "execution blocked"}</span><span className="status-pill content-kind-pill">{label(selected.testMode)}</span></div><h3>{selected.title}</h3><p>{selected.workspace.name} | {selected.reference} | {label(selected.serviceType)}</p></div>
                <div className="content-action-row">
                  {lifecycleActions.map((action) => <button className="button secondary compact-button" disabled={Boolean(busy)} key={action} onClick={() => transition(action)} type="button">{action === "start" || action === "resume" ? <Play aria-hidden="true" size={15} /> : action === "pause" ? <Pause aria-hidden="true" size={15} /> : action === "remediation" ? <Wrench aria-hidden="true" size={15} /> : <CheckCircle2 aria-hidden="true" size={15} />}{label(action)}</button>)}
                </div>
              </header>

              <div className="content-filter-tabs verifygrid-tabs" aria-label="Engagement views">
                {(["command", "scope", "methodology", "evidence", "findings", "execution", "automation", "reports", "activity"] as const).map((item) => <button aria-pressed={view === item} key={item} onClick={() => { setView(item); if (["execution", "automation"].includes(item) && automationWorkspaceId !== selected.workspace.id) loadAutomation(selected.workspace.id).catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load automation controls.")); }} type="button">{item}</button>)}
              </div>

              {view === "command" ? (
                <div className="verifygrid-command-grid">
                  <section><div className="verifygrid-section-heading"><ShieldCheck aria-hidden="true" size={20} /><div><h4>Execution gate</h4><p>{selected.gate.scopeHash.slice(0, 16)}...</p></div></div>{selected.gate.blockers.length ? <ul className="verifygrid-blockers">{selected.gate.blockers.map((blocker) => <li key={blocker}><AlertTriangle aria-hidden="true" size={16} />{blocker}</li>)}</ul> : <p className="verifygrid-success"><CheckCircle2 aria-hidden="true" size={18} /> Scope, authority, and time window are current.</p>}</section>
                  <section><div className="verifygrid-section-heading"><Clock3 aria-hidden="true" size={20} /><div><h4>Operating window</h4><p>{selected.plannedStartAt ? formatDate(selected.plannedStartAt) : "Not scheduled"}</p></div></div><dl className="verifygrid-facts"><div><dt>Status</dt><dd>{label(selected.status)}</dd></div><div><dt>Emergency owner</dt><dd>{selected.emergencyContactName}</dd></div><div><dt>Targets</dt><dd>{selected.scopeTargets.filter((target) => target.inScope).length} in / {selected.scopeTargets.filter((target) => !target.inScope).length} out</dd></div><div><dt>Findings</dt><dd>{selected.findings.length}</dd></div></dl></section>
                </div>
              ) : null}

              {view === "scope" ? (
                <div className="verifygrid-scope-view">
                  <div className="verifygrid-scope-list">
                    <div className="verifygrid-section-heading"><Target aria-hidden="true" size={20} /><div><h4>Current scope</h4><p>{selected.scopeTargets.length} recorded target(s)</p></div></div>
                    {selected.scopeTargets.length ? selected.scopeTargets.map((target) => <div className="verifygrid-target" key={target.id}><span className={`verifygrid-target-mark ${target.inScope ? "in" : "out"}`}>{target.inScope ? "IN" : "OUT"}</span><div><strong>{target.value}</strong><span>{label(target.targetType)} | {label(target.permission)} | {target.environment}</span></div><button className="icon-button danger" disabled={Boolean(busy)} onClick={() => removeScope(target.id)} title="Remove scope target" type="button"><Trash2 aria-hidden="true" size={17} /></button></div>) : <p className="content-empty-state">No scope targets recorded.</p>}
                  </div>
                  <form className="content-editor verifygrid-compact-form" onSubmit={addScope}><fieldset className="content-editor-section"><legend>Add target or exclusion</legend><div className="content-field-grid"><label className="content-field"><span>Type</span><select value={scopeDraft.targetType} onChange={(event) => setScopeDraft({ ...scopeDraft, targetType: event.target.value })}><option value="domain">Domain</option><option value="hostname">Hostname</option><option value="ip">IP address</option><option value="cidr">CIDR</option><option value="url">URL</option><option value="cloud_account">Cloud account</option><option value="site">Site</option><option value="wireless_ssid">Wireless SSID</option><option value="application">Application</option></select></label><label className="content-field"><span>Target</span><input required value={scopeDraft.value} onChange={(event) => setScopeDraft({ ...scopeDraft, value: event.target.value })} /></label><label className="content-field"><span>Permission</span><select value={scopeDraft.permission} onChange={(event) => setScopeDraft({ ...scopeDraft, permission: event.target.value })}><option value="observe">Observe only</option><option value="safe_checks">Safe checks</option><option value="controlled_validation">Controlled validation</option><option value="manual_only">Manual only</option></select></label><label className="content-field"><span>Criticality</span><select value={scopeDraft.criticality} onChange={(event) => setScopeDraft({ ...scopeDraft, criticality: event.target.value })}><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label><label className="verifygrid-check"><input checked={scopeDraft.inScope} onChange={(event) => setScopeDraft({ ...scopeDraft, inScope: event.target.checked, ownershipConfirmed: event.target.checked ? scopeDraft.ownershipConfirmed : false })} type="checkbox" /><span>In scope</span></label><label className="verifygrid-check"><input checked={scopeDraft.ownershipConfirmed} disabled={!scopeDraft.inScope} onChange={(event) => setScopeDraft({ ...scopeDraft, ownershipConfirmed: event.target.checked })} type="checkbox" /><span>Ownership confirmed</span></label></div><button className="button primary compact-button" disabled={busy === "scope"} type="submit"><Plus aria-hidden="true" size={16} /> Save scope</button></fieldset></form>
                  <form className="content-editor verifygrid-compact-form" onSubmit={authorize}><fieldset className="content-editor-section"><legend>Record authorization</legend><div className="content-field-grid"><label className="content-field"><span>Approver</span><input required value={authorizationDraft.approvedByName} onChange={(event) => setAuthorizationDraft({ ...authorizationDraft, approvedByName: event.target.value })} /></label><label className="content-field"><span>Approver email</span><input required type="email" value={authorizationDraft.approvedByEmail} onChange={(event) => setAuthorizationDraft({ ...authorizationDraft, approvedByEmail: event.target.value })} /></label><label className="content-field"><span>Valid from</span><input required type="datetime-local" value={authorizationDraft.validFrom} onChange={(event) => setAuthorizationDraft({ ...authorizationDraft, validFrom: event.target.value })} /></label><label className="content-field"><span>Valid until</span><input required type="datetime-local" value={authorizationDraft.validUntil} onChange={(event) => setAuthorizationDraft({ ...authorizationDraft, validUntil: event.target.value })} /></label><label className="content-field content-field-wide"><span>Authorization artifact URL</span><input type="url" value={authorizationDraft.artifactUrl} onChange={(event) => setAuthorizationDraft({ ...authorizationDraft, artifactUrl: event.target.value })} /></label><label className="verifygrid-check content-field-wide"><input checked={authorizationDraft.authorityConfirmed} onChange={(event) => setAuthorizationDraft({ ...authorizationDraft, authorityConfirmed: event.target.checked })} type="checkbox" /><span>I verified that this approver can legally authorize testing of the recorded targets.</span></label></div><button className="button primary compact-button" disabled={busy === "authorize" || !authorizationDraft.authorityConfirmed} type="submit"><LockKeyhole aria-hidden="true" size={16} /> Bind authorization</button></fieldset></form>
                </div>
              ) : null}

              {view === "methodology" ? (
                <div className="verifygrid-methodology-view">
                  <div className="verifygrid-methodology-heading">
                    <div className="verifygrid-section-heading"><ListChecks aria-hidden="true" size={20} /><div><h4>Assessment test plan</h4><p>Service-specific coverage with standards references, ownership, evidence, and conclusions</p></div></div>
                    <div className="verifygrid-methodology-metrics" aria-label="Methodology coverage">
                      <div><span>Tests</span><strong>{selected.testCases.length}</strong></div>
                      <div><span>Complete</span><strong>{methodologyComplete}</strong></div>
                      <div><span>Running</span><strong>{selected.testCases.filter((testCase) => testCase.status === "running").length}</strong></div>
                      <div><span>Findings</span><strong>{selected.testCases.filter((testCase) => testCase.status === "finding").length}</strong></div>
                    </div>
                  </div>
                  {methodologyCategories.length ? methodologyCategories.map(([category, testCases]) => (
                    <section className="verifygrid-methodology-category" key={category}>
                      <div className="verifygrid-methodology-category-heading"><h5>{category}</h5><span>{testCases?.length || 0} test(s)</span></div>
                      {testCases?.map((testCase) => (
                        <article className="verifygrid-test-case" key={testCase.id}>
                          <div className="verifygrid-test-case-code"><strong>{testCase.code}</strong><span>{testCase.standardRef}</span></div>
                          <div className="verifygrid-test-case-body"><h6>{testCase.title}</h6><p>{testCase.objective}</p>{testCase.resultSummary ? <small><strong>Result:</strong> {testCase.resultSummary}</small> : null}</div>
                          <div className="verifygrid-test-case-control"><span>{testCase.assignedTo || (testCase.executionMode === "automated" ? "Scanner + analyst" : "Unassigned")}</span><select aria-label={`Status for ${testCase.title}`} disabled={Boolean(busy)} onChange={(event) => updateTestCase(testCase.id, event.target.value, testCase.resultSummary, testCase.assignedTo)} value={testCase.status}><option value="planned">Planned</option><option value="running">Running</option><option value="passed">Passed</option><option value="finding">Finding</option><option value="not_applicable">Not applicable</option></select></div>
                        </article>
                      ))}
                    </section>
                  )) : <p className="content-empty-state">No methodology test plan is available for this engagement.</p>}
                </div>
              ) : null}

              {view === "evidence" ? (
                <div className="verifygrid-evidence-view">
                  <section className="verifygrid-import-list">
                    <div className="verifygrid-section-heading"><DatabaseZap aria-hidden="true" size={20} /><div><h4>Evidence batches</h4><p>Integrity-hashed, scope-reconciled scanner exports</p></div></div>
                    {selected.importBatches.length ? selected.importBatches.map((batch) => (
                      <article className="verifygrid-import-batch" key={batch.id}>
                        <div className="verifygrid-record-top"><div><strong>{connectorCatalog[batch.connector as VerifyGridConnector]?.label || label(batch.connector)}</strong><span>{batch.fileName} | {formatDate(batch.createdAt)}</span></div><span className="status-pill content-status-published">{label(batch.status)}</span></div>
                        <dl className="verifygrid-facts compact"><div><dt>Observed</dt><dd>{batch.observationCount}</dd></div><div><dt>In scope</dt><dd>{batch.inScopeCount}</dd></div><div><dt>Excluded</dt><dd>{batch.outOfScopeCount}</dd></div><div><dt>Unmatched</dt><dd>{batch.unmatchedCount}</dd></div><div><dt>Promoted</dt><dd>{batch.promotedCount}</dd></div><div><dt>Duplicates</dt><dd>{batch.duplicateCount}</dd></div></dl>
                        <div className="verifygrid-record-footer"><small>SHA-256 {batch.contentSha256.slice(0, 20)}... | enrichment {label(batch.enrichmentStatus)}</small>{batch.inScopeCount > batch.promotedCount + batch.duplicateCount ? <button className="button secondary compact-button" disabled={Boolean(busy)} onClick={() => promoteBatch(batch.id)} type="button"><FileSearch aria-hidden="true" size={15} /> Promote in-scope</button> : null}</div>
                      </article>
                    )) : <p className="content-empty-state">No scanner evidence imported.</p>}
                  </section>

                  <form className="content-editor verifygrid-compact-form" onSubmit={importEvidence}>
                    <fieldset className="content-editor-section">
                      <legend>Import scanner evidence</legend>
                      <div className="content-field-grid">
                        <label className="content-field content-field-wide"><span>Connector</span><select value={importDraft.connector} onChange={(event) => setImportDraft({ ...importDraft, connector: event.target.value as VerifyGridConnector, fileName: "", content: "" })}>{Object.entries(connectorCatalog).filter(([, connector]) => connector.directImport).map(([value, connector]) => <option key={value} value={value}>{connector.label}</option>)}</select></label>
                        <label className="content-field content-field-wide verifygrid-file-field"><span>Export file</span><input accept={connectorCatalog[importDraft.connector].accepted} key={`${importDraft.connector}-${importDraft.fileName || "empty"}`} onChange={(event) => selectImportFile(event.target.files?.[0]).catch((error) => setMessage(String(error)))} type="file" /></label>
                        <label className="verifygrid-check content-field-wide"><input checked={importDraft.enrich} onChange={(event) => setImportDraft({ ...importDraft, enrich: event.target.checked })} type="checkbox" /><span>Enrich CVEs with NVD CPE/CVSS, CISA KEV, and FIRST EPSS</span></label>
                      </div>
                      {importDraft.fileName ? <p className="form-note"><Upload aria-hidden="true" size={15} /> {importDraft.fileName} | {(new Blob([importDraft.content]).size / 1024).toFixed(1)} KB ready</p> : null}
                      <button className="button primary compact-button" disabled={busy === "import" || !importDraft.content} type="submit"><Upload aria-hidden="true" size={16} /> {busy === "import" ? "Reconciling..." : "Import and reconcile"}</button>
                    </fieldset>
                  </form>

                  <section className="verifygrid-observation-list">
                    <div className="verifygrid-section-heading"><FileSearch aria-hidden="true" size={20} /><div><h4>Observation queue</h4><p>Latest evidence remains separate from validated findings</p></div></div>
                    {selected.observations.length ? selected.observations.map((observation) => (
                      <div className="verifygrid-observation" key={observation.id}><span className={`severity-pill severity-${observation.severity}`}>{observation.severity}</span><div><strong>{observation.title}</strong><span>{observation.assetIdentifier} | {label(observation.scopeDisposition)} | {label(observation.promotionStatus)}</span><small>{observation.dispositionReason}</small></div>{observation.knownExploited ? <span className="status-pill content-status-deleted">KEV</span> : null}</div>
                    )) : <p className="content-empty-state">No normalized observations recorded.</p>}
                  </section>
                </div>
              ) : null}

              {view === "findings" ? (
                <div className="verifygrid-findings-view">
                  <div className="verifygrid-finding-list"><div className="verifygrid-section-heading"><Fingerprint aria-hidden="true" size={20} /><div><h4>Evidence-led findings</h4><p>Ranked by exploitability, confidence, and business criticality</p></div></div>{selected.findings.length ? selected.findings.map((finding) => <article className={`verifygrid-finding severity-${finding.severity}`} key={finding.id}><div className="verifygrid-finding-top"><div><span className={`severity-pill severity-${finding.severity}`}>{finding.severity}</span><span className="status-pill content-kind-pill">risk {finding.riskScore}</span>{finding.knownExploited ? <span className="status-pill content-status-deleted">known exploited</span> : null}<h5>{finding.title}</h5><p>{finding.businessImpact}</p></div><strong>{label(finding.status)}</strong></div><div className="verifygrid-finding-actions">{finding.status === "open" ? <button className="button secondary compact-button" disabled={Boolean(busy)} onClick={() => updateFinding(finding.id, "validated")} type="button"><CheckCircle2 aria-hidden="true" size={15} /> Validate</button> : null}{finding.status === "validated" ? <button className="button secondary compact-button" disabled={Boolean(busy)} onClick={() => updateFinding(finding.id, "remediation_in_progress")} type="button"><Wrench aria-hidden="true" size={15} /> Start remediation</button> : null}{finding.status === "remediation_in_progress" ? <button className="button secondary compact-button" onClick={() => setResolution({ findingId: finding.id, note: "" })} type="button"><CheckCircle2 aria-hidden="true" size={15} /> Mark resolved</button> : null}{finding.status === "resolved" ? <button className="button primary compact-button" disabled={Boolean(busy)} onClick={() => requestRetest(finding.id)} type="button"><RotateCcw aria-hidden="true" size={15} /> Request retest</button> : null}</div>{resolution.findingId === finding.id ? <form className="verifygrid-resolution" onSubmit={(event) => { event.preventDefault(); updateFinding(finding.id, "resolved", resolution.note); }}><label className="content-field"><span>Resolution evidence</span><textarea required minLength={20} rows={2} value={resolution.note} onChange={(event) => setResolution({ findingId: finding.id, note: event.target.value })} /></label><button className="button primary compact-button" type="submit">Confirm resolution</button></form> : null}</article>) : <p className="content-empty-state">No findings recorded.</p>}</div>
                  <form className="content-editor verifygrid-compact-form" onSubmit={addFinding}><fieldset className="content-editor-section"><legend>Add finding</legend><div className="content-field-grid"><label className="content-field content-field-wide"><span>Title</span><input required value={findingDraft.title} onChange={(event) => setFindingDraft({ ...findingDraft, title: event.target.value })} /></label><label className="content-field"><span>Severity</span><select value={findingDraft.severity} onChange={(event) => setFindingDraft({ ...findingDraft, severity: event.target.value })}><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="informational">Informational</option></select></label><label className="content-field"><span>Confidence</span><select value={findingDraft.confidence} onChange={(event) => setFindingDraft({ ...findingDraft, confidence: event.target.value })}><option value="unverified">Unverified</option><option value="likely">Likely</option><option value="validated">Validated</option></select></label><label className="content-field content-field-wide"><span>Technical observation</span><textarea required rows={3} value={findingDraft.description} onChange={(event) => setFindingDraft({ ...findingDraft, description: event.target.value })} /></label><label className="content-field content-field-wide"><span>Business impact</span><textarea required rows={2} value={findingDraft.businessImpact} onChange={(event) => setFindingDraft({ ...findingDraft, businessImpact: event.target.value })} /></label><label className="content-field content-field-wide"><span>Remediation</span><textarea required rows={3} value={findingDraft.remediation} onChange={(event) => setFindingDraft({ ...findingDraft, remediation: event.target.value })} /></label><label className="content-field"><span>CVSS</span><input max="10" min="0" step="0.1" type="number" value={findingDraft.cvssScore} onChange={(event) => setFindingDraft({ ...findingDraft, cvssScore: event.target.value })} /></label><label className="content-field"><span>EPSS</span><input max="1" min="0" step="0.001" type="number" value={findingDraft.epssScore} onChange={(event) => setFindingDraft({ ...findingDraft, epssScore: event.target.value })} /></label><label className="verifygrid-check content-field-wide"><input checked={findingDraft.knownExploited} onChange={(event) => setFindingDraft({ ...findingDraft, knownExploited: event.target.checked })} type="checkbox" /><span>Known exploited vulnerability</span></label></div><button className="button primary compact-button" disabled={busy === "finding"} type="submit"><Plus aria-hidden="true" size={16} /> Add finding</button></fieldset></form>
                </div>
              ) : null}

              {view === "execution" ? (
                <div className="verifygrid-execution-view">
                  <section className="verifygrid-job-list">
                    <div className="verifygrid-section-heading"><ShieldCheck aria-hidden="true" size={20} /><div><h4>Governed execution records</h4><p>Scope-bound manifests dispatched only through an enrolled outbound sensor</p></div></div>
                    {selected.executionJobs.length ? selected.executionJobs.map((job) => (
                      <article className="verifygrid-job" key={job.id}>
                        <div className="verifygrid-record-top"><div><strong>{capabilityCatalog[job.capability as keyof typeof capabilityCatalog]?.label || label(job.capability)}</strong><span>{label(job.capabilityLevel)} | {job.targetIds.length} target(s)</span></div><span className={`status-pill ${job.status === "cancelled" ? "content-status-deleted" : "content-status-draft"}`}>{label(job.status)}</span></div>
                        <p>{formatDate(job.requestedStartAt)} to {formatDate(job.validUntil)}</p>
                        <div className="verifygrid-record-footer"><small>Manifest {job.manifestSha256.slice(0, 20)}... | {label(job.dispatchStatus)}{job.attempt ? ` | attempt ${job.attempt}/${job.maxAttempts}` : ""}</small>{!["cancelled", "completed", "expired", "failed"].includes(job.status) ? <button className="icon-button danger" disabled={Boolean(busy)} onClick={() => cancelExecutionRecord(job.id)} title="Cancel execution record" type="button"><Ban aria-hidden="true" size={16} /></button> : null}</div>
                        {job.lastError ? <p className="form-note verifygrid-error-note">{job.lastError}</p> : null}
                        {job.status === "manual_approval_required" && capabilityCatalog[job.capability as keyof typeof capabilityCatalog]?.sensorDispatch ? <div className="verifygrid-dispatch-row"><p className="form-note">A separate accountable approval is required for this controlled validation.</p><button className="button primary compact-button" disabled={Boolean(busy)} onClick={() => approveExecutionRecord(job.id)} type="button"><ShieldCheck aria-hidden="true" size={15} /> Approve validation</button></div> : null}
                        {job.status === "validated" ? <div className="verifygrid-dispatch-row"><label className="content-field"><span>Scanner node</span><select value={jobSensors[job.id] || ""} onChange={(event) => setJobSensors((current) => ({ ...current, [job.id]: event.target.value }))}><option value="">Select a connected capable node</option>{automation?.sensors.filter((sensor) => sensor.status === "active" && sensor.healthStatus === "connected" && sensor.capabilities.includes(job.capability) && sensor.runtimeCapabilities.includes(job.capability)).map((sensor) => <option key={sensor.id} value={sensor.id}>{sensor.name} | {sensor.region || "region not reported"} | seen {formatDate(sensor.lastSeenAt)}</option>)}</select></label><button className="button primary compact-button" disabled={!jobSensors[job.id] || Boolean(busy)} onClick={() => queueExecutionJob(job.id, jobSensors[job.id])} type="button"><Send aria-hidden="true" size={15} /> Queue manifest</button></div> : null}
                      </article>
                    )) : <p className="content-empty-state">No execution manifests prepared.</p>}
                  </section>

                  <form className="content-editor verifygrid-compact-form" onSubmit={createExecutionRecord}>
                    <fieldset className="content-editor-section">
                      <legend>Prepare a controlled check</legend>
                      <div className="content-field-grid">
                        <label className="content-field content-field-wide"><span>Capability</span><select value={executionDraft.capability} onChange={(event) => setExecutionDraft({ ...executionDraft, capability: event.target.value })}>{Object.entries(capabilityCatalog).map(([value, capability]) => <option key={value} value={value}>{capability.label} | {label(capability.level)}</option>)}</select><small>{capabilityCatalog[executionDraft.capability as keyof typeof capabilityCatalog]?.description}</small></label>
                        <div className="content-field content-field-wide"><span>Authorized targets</span><div className="verifygrid-target-picker">{selected.scopeTargets.filter((target) => target.inScope).map((target) => <label className="verifygrid-check" key={target.id}><input checked={executionDraft.targetIds.includes(target.id)} onChange={() => toggleExecutionTarget(target.id)} type="checkbox" /><span>{target.value} | {label(target.permission)}</span></label>)}</div></div>
                        <label className="content-field"><span>Requested start</span><input required type="datetime-local" value={executionDraft.requestedStartAt} onChange={(event) => setExecutionDraft({ ...executionDraft, requestedStartAt: event.target.value })} /></label>
                        <label className="content-field"><span>Valid until</span><input required type="datetime-local" value={executionDraft.validUntil} onChange={(event) => setExecutionDraft({ ...executionDraft, validUntil: event.target.value })} /></label>
                        <label className="content-field content-field-wide"><span>Technical rationale</span><textarea minLength={20} required rows={3} value={executionDraft.rationale} onChange={(event) => setExecutionDraft({ ...executionDraft, rationale: event.target.value })} /></label>
                        <label className="verifygrid-check content-field-wide"><input checked={executionDraft.acknowledgeNonDestructive} onChange={(event) => setExecutionDraft({ ...executionDraft, acknowledgeNonDestructive: event.target.checked })} type="checkbox" /><span>This record is non-destructive and remains bound to the current authorization, target permissions, stop conditions, and request ceiling.</span></label>
                      </div>
                      <button className="button primary compact-button" disabled={busy === "execution" || !executionDraft.acknowledgeNonDestructive || !executionDraft.targetIds.length} type="submit"><ShieldCheck aria-hidden="true" size={16} /> Validate manifest</button>
                    </fieldset>
                  </form>
                </div>
              ) : null}

              {view === "automation" ? (
                <div className="verifygrid-automation-view">
                  {busy === "automation-load" && !automation ? <p className="content-empty-state">Loading workspace automation...</p> : null}
                  {automation ? (
                    <>
                      <div className="verifygrid-automation-metrics">
                        <div><span>Connector profiles</span><strong>{automation.connectors.length}</strong></div>
                        <div><span>Connected scanner nodes</span><strong>{automation.sensors.filter((sensor) => sensor.status === "active" && sensor.healthStatus === "connected").length}</strong></div>
                        <div><span>Client members</span><strong>{automation.memberships.filter((member) => member.status === "active").length}</strong></div>
                        <div><span>Connector alerts</span><strong>{automation.connectors.filter((connector) => connector.lastError || !connector.credentialsReady).length}</strong></div>
                      </div>

                      <section className="verifygrid-automation-section">
                        <div className="verifygrid-section-heading"><CloudCog aria-hidden="true" size={20} /><div><h4>Scanner connectors</h4><p>Scheduled differential evidence ingestion with bounded retries and integrity reconciliation</p></div></div>
                        <div className="verifygrid-automation-records">
                          {automation.connectors.length ? automation.connectors.map((connector) => <article className="verifygrid-automation-record" key={connector.id}><div className="verifygrid-record-top"><div><strong>{connector.label}</strong><span>{connector.baseUrl} | every {connector.scheduleMinutes} minutes</span></div><span className={`status-pill ${connector.credentialsReady && !connector.lastError ? "content-status-published" : "content-status-draft"}`}>{label(connector.status)}</span></div><dl className="verifygrid-facts compact"><div><dt>Provider</dt><dd>{label(connector.provider)}</dd></div><div><dt>Mode</dt><dd>{label(connector.connectorMode)}</dd></div><div><dt>Credentials</dt><dd>{connector.connectorMode === "sensor_api" ? "sensor-local" : connector.credentialsReady ? "ready" : "missing"}</dd></div><div><dt>Last success</dt><dd>{connector.lastSuccessAt ? formatDate(connector.lastSuccessAt) : "never"}</dd></div></dl>{connector.lastError ? <p className="form-note verifygrid-error-note">{connector.lastError}</p> : null}<div className="verifygrid-record-footer"><small>{connector.runs[0] ? `Latest run ${label(connector.runs[0].status)} | ${formatDate(connector.runs[0].createdAt)}` : `Next evaluation ${formatDate(connector.nextSyncAt)}`}</small><button className="button secondary compact-button" disabled={Boolean(busy) || !connector.credentialsReady} onClick={() => syncConnector(connector.id)} type="button"><RefreshCw aria-hidden="true" size={15} /> Sync now</button></div></article>) : <p className="content-empty-state">No scanner connector profiles for this client workspace.</p>}
                        </div>
                        <form className="content-editor verifygrid-compact-form" onSubmit={createConnector}><fieldset className="content-editor-section"><legend>Add scanner connector</legend><div className="content-field-grid"><label className="content-field"><span>Provider</span><select value={connectorDraft.provider} onChange={(event) => changeConnectorProvider(event.target.value as keyof typeof providerDefaults)}><option value="tenable">Tenable Vulnerability Management</option><option value="qualys">Qualys VMDR</option><option value="rapid7">Rapid7 InsightVM</option><option value="greenbone">Greenbone GMP via sensor</option></select></label><label className="content-field"><span>Profile label</span><input required value={connectorDraft.label} onChange={(event) => setConnectorDraft({ ...connectorDraft, label: event.target.value })} /></label><label className="content-field content-field-wide"><span>API origin</span><input required type="url" value={connectorDraft.baseUrl} onChange={(event) => setConnectorDraft({ ...connectorDraft, baseUrl: event.target.value })} /></label><label className="content-field"><span>Credential prefix</span><input pattern="[A-Z][A-Z0-9_]{2,60}" required value={connectorDraft.credentialRef} onChange={(event) => setConnectorDraft({ ...connectorDraft, credentialRef: event.target.value.toUpperCase() })} /></label><label className="content-field"><span>Schedule</span><select value={connectorDraft.scheduleMinutes} onChange={(event) => setConnectorDraft({ ...connectorDraft, scheduleMinutes: event.target.value })}><option value="60">Hourly</option><option value="360">Every 6 hours</option><option value="720">Every 12 hours</option><option value="1440">Daily</option><option value="10080">Weekly</option></select></label><label className="content-field"><span>Sync mode</span><select value={connectorDraft.syncMode} onChange={(event) => setConnectorDraft({ ...connectorDraft, syncMode: event.target.value })}><option value="differential">Differential</option><option value="full">Full baseline</option></select></label><p className="form-note content-field-wide">{connectorDraft.provider === "tenable" ? `Configure ${connectorDraft.credentialRef}_ACCESS_KEY and ${connectorDraft.credentialRef}_SECRET_KEY in Vercel.` : connectorDraft.provider === "greenbone" ? "The endpoint and credentials remain inside the client sensor environment; the QCS control plane does not connect to the private GMP service." : `Configure ${connectorDraft.credentialRef}_USERNAME and ${connectorDraft.credentialRef}_PASSWORD in Vercel.`}</p></div><button className="button primary compact-button" disabled={busy === "connector-create"} type="submit"><Plus aria-hidden="true" size={15} /> Add connector</button></fieldset></form>
                      </section>

                      <section className="verifygrid-automation-section">
                        <div className="verifygrid-section-heading"><Cpu aria-hidden="true" size={20} /><div><h4>Outbound sensors</h4><p>Pull-only workers for approved, non-destructive checks; no inbound client firewall rule required</p></div></div>
                        <div className="verifygrid-automation-records">
                          {automation.sensors.length ? automation.sensors.map((sensor) => <article className="verifygrid-automation-record" key={sensor.id}><div className="verifygrid-record-top"><div><strong>{sensor.name}</strong><span>Token ending {sensor.tokenLastFour} | {sensor.region || "region not reported"}</span></div><span className={`status-pill ${sensor.status === "active" && sensor.healthStatus === "connected" ? "content-status-published" : sensor.status === "revoked" ? "content-status-deleted" : "content-status-draft"}`}>{label(sensor.status === "active" ? sensor.healthStatus : sensor.status)}</span></div><p>Authorized: {sensor.capabilities.map(label).join(" | ")}</p><p>Installed: {sensor.runtimeCapabilities.length ? sensor.runtimeCapabilities.map(label).join(" | ") : "waiting for runtime attestation"}</p>{sensor.lastError ? <p className="form-note verifygrid-error-note">{sensor.lastError}</p> : null}<div className="verifygrid-record-footer"><small>{sensor.lastSeenAt ? `Last heartbeat ${formatDate(sensor.lastSeenAt)}${sensor.version ? ` | v${sensor.version}` : ""}` : "Enrollment issued; first heartbeat pending"}</small>{sensor.status === "active" ? <button className="icon-button danger" disabled={Boolean(busy)} onClick={() => revokeSensor(sensor.id)} title="Revoke sensor" type="button"><Ban aria-hidden="true" size={16} /></button> : null}</div></article>) : <p className="content-empty-state">No outbound sensors enrolled.</p>}
                        </div>
                        <form className="content-editor verifygrid-compact-form" onSubmit={enrollSensor}><fieldset className="content-editor-section"><legend>Enroll scanner node</legend><div className="content-field-grid"><label className="content-field content-field-wide"><span>Node name</span><input required value={sensorDraft.name} onChange={(event) => setSensorDraft({ ...sensorDraft, name: event.target.value })} /></label><div className="content-field content-field-wide"><span>Authorized capabilities</span><div className="verifygrid-target-picker">{Object.entries(capabilityCatalog).filter(([, capability]) => capability.sensorDispatch).map(([value, capability]) => <label className="verifygrid-check" key={value}><input checked={sensorDraft.capabilities.includes(value)} onChange={() => toggleSensorCapability(value)} type="checkbox" /><span>{capability.label}{capability.humanApprovalRequired ? " | approval required" : ""}</span></label>)}</div></div><p className="form-note content-field-wide"><Cable aria-hidden="true" size={15} /> The token is displayed once. The container reports installed scanners at runtime; a job cannot queue unless authorization, approval, enrollment, and runtime capability all agree.</p></div><button className="button primary compact-button" disabled={busy === "sensor-create" || !sensorDraft.capabilities.length} type="submit"><Plus aria-hidden="true" size={15} /> Enroll node</button></fieldset></form>
                      </section>

                      <section className="verifygrid-automation-section">
                        <div className="verifygrid-section-heading"><MailPlus aria-hidden="true" size={20} /><div><h4>Client portal access</h4><p>Workspace-scoped reports and remediation visibility with revocable roles</p></div></div>
                        <div className="verifygrid-automation-records">
                          {automation.memberships.length ? automation.memberships.map((member) => <article className="verifygrid-automation-record" key={member.id}><div className="verifygrid-record-top"><div><strong>{member.displayName || member.email}</strong><span>{member.email} | {label(member.role)}</span></div><span className={`status-pill ${member.status === "active" ? "content-status-published" : "content-status-deleted"}`}>{label(member.status)}</span></div><div className="verifygrid-record-footer"><small>{member.lastAccessAt ? `Last access ${formatDate(member.lastAccessAt)}` : `Invited ${formatDate(member.invitedAt)}`}</small>{member.status === "active" ? <button className="icon-button danger" disabled={Boolean(busy)} onClick={() => revokeMember(member.id)} title="Revoke client access" type="button"><Ban aria-hidden="true" size={16} /></button> : null}</div></article>) : <p className="content-empty-state">No client portal members.</p>}
                        </div>
                        <form className="content-editor verifygrid-compact-form" onSubmit={inviteMember}><fieldset className="content-editor-section"><legend>Issue one-time access link</legend><div className="content-field-grid"><label className="content-field"><span>Name</span><input value={memberDraft.displayName} onChange={(event) => setMemberDraft({ ...memberDraft, displayName: event.target.value })} /></label><label className="content-field"><span>Email</span><input required type="email" value={memberDraft.email} onChange={(event) => setMemberDraft({ ...memberDraft, email: event.target.value })} /></label><label className="content-field"><span>Role</span><select value={memberDraft.role} onChange={(event) => setMemberDraft({ ...memberDraft, role: event.target.value })}><option value="client_viewer">Viewer</option><option value="client_analyst">Analyst</option><option value="client_owner">Owner</option></select></label><label className="content-field"><span>Link expiry</span><select value={memberDraft.expiresInHours} onChange={(event) => setMemberDraft({ ...memberDraft, expiresInHours: event.target.value })}><option value="24">24 hours</option><option value="48">48 hours</option><option value="72">72 hours</option><option value="168">7 days</option></select></label></div><button className="button primary compact-button" disabled={busy === "member-invite"} type="submit"><MailPlus aria-hidden="true" size={15} /> Issue access</button></fieldset></form>
                      </section>

                      <section className="verifygrid-emergency-section">
                        <div className="verifygrid-section-heading"><Siren aria-hidden="true" size={20} /><div><h4>Emergency stop</h4><p>Pause this engagement and cancel every queued, claimed, running, or retrying job</p></div></div>
                        <label className="content-field"><span>Accountable stop reason</span><textarea minLength={20} placeholder="Describe the operational or authorization condition requiring an immediate stop." rows={2} value={emergencyReason} onChange={(event) => setEmergencyReason(event.target.value)} /></label>
                        <button className="button secondary compact-button verifygrid-stop-button" disabled={busy === "emergency-stop" || emergencyReason.trim().length < 20} onClick={emergencyStop} type="button"><Siren aria-hidden="true" size={15} /> Stop all execution</button>
                      </section>
                    </>
                  ) : null}
                </div>
              ) : null}

              {view === "reports" ? (
                <div className="verifygrid-reports-view">
                  <section className="verifygrid-report-list">
                    <div className="verifygrid-section-heading"><FileText aria-hidden="true" size={20} /><div><h4>Assurance reports</h4><p>Immutable, versioned snapshots with integrity hashes</p></div></div>
                    {selected.reports.length ? selected.reports.map((report) => <a className="verifygrid-report-link" href={`/admin/verifygrid/reports/${report.id}`} key={report.id} rel="noreferrer" target="_blank"><div><strong>{report.title}</strong><span>{formatDate(report.generatedAt)} | {label(report.reportType)} v{report.version}</span></div><small>{report.snapshotSha256.slice(0, 24)}...</small></a>) : <p className="content-empty-state">No report snapshots generated.</p>}
                  </section>
                  <form className="content-editor verifygrid-compact-form" onSubmit={generateReport}>
                    <fieldset className="content-editor-section">
                      <legend>Generate report snapshot</legend>
                      <label className="content-field"><span>Report type</span><select value={reportType} onChange={(event) => setReportType(event.target.value)}><option value="executive">Executive assurance</option><option value="technical">Technical findings</option><option value="retest">Retest and closure</option></select></label>
                      <p className="form-note">The report captures current scope, authority, evidence provenance, findings, remediation, retests, and prepared execution records.</p>
                      <button className="button primary compact-button" disabled={busy === "report"} type="submit"><FileText aria-hidden="true" size={16} /> {busy === "report" ? "Generating..." : "Generate version"}</button>
                    </fieldset>
                  </form>
                </div>
              ) : null}

              {view === "activity" ? <div className="verifygrid-activity"><div className="verifygrid-section-heading"><Activity aria-hidden="true" size={20} /><div><h4>Engagement activity</h4><p>Latest accountable product events</p></div></div>{selected.activities.length ? selected.activities.map((item) => <div key={item.id}><span>{formatDate(item.createdAt)}</span><strong>{label(item.action)}</strong><em>{item.actor}</em></div>) : <p className="content-empty-state">No activity recorded.</p>}</div> : null}
            </div>
          ) : null}
        </div>
      ) : portfolio ? <div className="verifygrid-empty"><ShieldCheck aria-hidden="true" size={28} /><h3>No engagements yet</h3><p>Open the first client security assurance record.</p></div> : null}
    </section>
  );
}

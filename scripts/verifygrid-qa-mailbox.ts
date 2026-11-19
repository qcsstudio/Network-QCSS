/** Read only the explicitly authorized, capture-only Ethereal QA mailbox. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {ImapFlow} from "imapflow";

export async function readCapturedMessages() {
  assert(process.env.VERIFYGRID_QA_ISOLATED, "An isolated QA environment is required");
  const account = JSON.parse(await fs.readFile(".vercel/staging-mail-account.json", "utf8"));
  assert.equal(account.user, process.env.SMTP_USER, "QA mailbox must match staging SMTP configuration");
  assert.equal(account.imap.host, "imap.ethereal.email");
  assert.equal(account.imap.port, 993);
  assert.equal(account.imap.secure, true);
  const client = new ImapFlow({
    ...account.imap, auth: {user: account.user, pass: account.pass}, logger: false,
    connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 20_000,
    tls: {minVersion: "TLSv1.2"}
  });
  client.on("error", () => {});
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX", {readOnly: true});
    try {
      assert(client.mailbox);
      const count = client.mailbox.exists;
      if (!count) return [];
      const messages: string[] = [];
      for await (const message of client.fetch(`${Math.max(1,count-49)}:*`, {source: true, size: true})) {
        assert((message.size || 0) < 2_000_000, "Captured message exceeds QA bound");
        if (message.source) messages.push(message.source.toString("utf8"));
      }
      return messages;
    } finally {lock.release();}
  } finally {
    if(client.usable) await client.logout().catch(() => {});
    client.close();
  }
}

export async function capturedToken(prefix: "vg_onboard" | "vg_access", recipient: string, excluded?: string) {
  assert(recipient.endsWith("@verifygrid-staging.example"), "Only synthetic QA recipients are permitted");
  for (let attempt = 0; attempt < 3; attempt++) {
    const messages = await readCapturedMessages();
    for (const raw of messages.reverse()) {
      const message = raw.replace(/=\r?\n/g,"").replace(/=([0-9A-F]{2})/gi,(_,hex:string) => String.fromCharCode(parseInt(hex,16)));
      if (!message.toLowerCase().includes(recipient.toLowerCase())) continue;
      const token = message.match(new RegExp(`${prefix}_[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]{32,}`))?.[0];
      if (token && token !== excluded) return token;
    }
    if(attempt < 2) await new Promise(resolve => setTimeout(resolve,1_000));
  }
  throw new Error("The expected one-time token did not arrive in the capture-only mailbox");
}

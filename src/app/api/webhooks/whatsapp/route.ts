import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { decideEditorialApproval, parseApprovalPayload, recordEditorialFeedback, verifyWhatsAppSignature } from "@/lib/editorial-approvals";
import { requestContext } from "@/lib/security";
import { createAuditLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WhatsAppMessage = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  button?: { payload?: string; text?: string };
  interactive?: { button_reply?: { id?: string; title?: string } };
};

function messages(payload: unknown) {
  if (!payload || typeof payload !== "object") return [] as WhatsAppMessage[];
  const entries = (payload as { entry?: Array<{ changes?: Array<{ value?: { messages?: WhatsAppMessage[] } }> }> }).entry || [];
  return entries.flatMap((entry) => entry.changes || []).flatMap((change) => change.value?.messages || []);
}
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256") || "";
  if (!verifyWhatsAppSignature(rawBody, signature)) return new Response("Invalid signature", { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  for (const message of messages(payload)) {
    const sender = message.from || "";
    const actionValue = message.interactive?.button_reply?.id || message.button?.payload || "";
    const action = parseApprovalPayload(actionValue);
    try {
      if (action) {
        const result = await decideEditorialApproval({ ...action, sender });
        if (result.published) {
          revalidatePath("/resources");
          revalidatePath(`/resources/${result.post.slug}`);
          revalidatePath("/sitemap.xml");
        }
        await createAuditLog(
          { action: `content.whatsapp_${result.action}`, actor: `whatsapp:${sender}`, target: result.post.id, metadata: { messageId: message.id || "", published: result.published } },
          await requestContext()
        );
      } else if (message.type === "text" && message.text?.body) {
        const feedback = await recordEditorialFeedback(sender, message.text.body);
        if (feedback) {
          await createAuditLog(
            { action: "content.whatsapp_feedback_received", actor: `whatsapp:${sender}`, target: feedback.postId, metadata: { messageId: message.id || "" } },
            await requestContext()
          );
        }
      }
    } catch (error) {
      console.error("WhatsApp editorial action failed.", { messageId: message.id, error });
    }
  }

  return NextResponse.json({ ok: true });
}

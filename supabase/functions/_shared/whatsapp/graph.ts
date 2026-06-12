// Minimal WhatsApp Cloud API client.
// All calls go to POST /v23.0/{phone_number_id}/messages with a bearer token.
// Helpers here never log secrets.

const GRAPH_BASE = "https://graph.facebook.com/v23.0";

export type GraphCreds = {
  accessToken: string;
  phoneNumberId: string;
};

export type QuickReplyButton = {
  index: number; // 0-based index matching the template button position
  payload: string; // <= 128 chars
};

export type SendTemplateInput = {
  to: string; // E.164 digits, no +
  templateName: string;
  languageCode: "es";
  bodyVariables?: string[];
  buttons?: QuickReplyButton[];
};

export type SendTextInput = {
  to: string;
  body: string;
};

export type GraphSendResult =
  | { ok: true; wamid: string }
  | { ok: false; error: string };

function buildTemplatePayload(input: SendTemplateInput): unknown {
  const components: unknown[] = [];

  if (input.bodyVariables && input.bodyVariables.length > 0) {
    components.push({
      type: "body",
      parameters: input.bodyVariables.map((v) => ({ type: "text", text: v })),
    });
  }

  if (input.buttons && input.buttons.length > 0) {
    for (const b of input.buttons) {
      components.push({
        type: "button",
        sub_type: "quick_reply",
        index: b.index,
        parameters: [{ type: "payload", payload: b.payload }],
      });
    }
  }

  const template: Record<string, unknown> = {
    name: input.templateName,
    language: { code: input.languageCode },
  };
  if (components.length > 0) template.components = components;

  return {
    messaging_product: "whatsapp",
    to: input.to,
    type: "template",
    template,
  };
}

async function postGraph(
  creds: GraphCreds,
  body: unknown,
): Promise<GraphSendResult> {
  const url = `${GRAPH_BASE}/${creds.phoneNumberId}/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        (data as { error?: { message?: string } })?.error?.message ||
        `Graph API HTTP ${res.status}`;
      return { ok: false, error: msg };
    }
    const wamid = (data as { messages?: { id: string }[] })?.messages?.[0]?.id;
    if (!wamid) return { ok: false, error: "Graph API: missing wamid" };
    return { ok: true, wamid };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Graph API: network error";
    return { ok: false, error: msg };
  }
}

export function sendTemplate(
  creds: GraphCreds,
  input: SendTemplateInput,
): Promise<GraphSendResult> {
  return postGraph(creds, buildTemplatePayload(input));
}

export function sendText(
  creds: GraphCreds,
  input: SendTextInput,
): Promise<GraphSendResult> {
  return postGraph(creds, {
    messaging_product: "whatsapp",
    to: input.to,
    type: "text",
    text: { body: input.body },
  });
}

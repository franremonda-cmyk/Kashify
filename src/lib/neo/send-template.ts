interface TemplateMessage {
  to: string;
  templateName: string;
  languageCode: string;
  components?: object[];
}

const BASE_URL = "https://graph.facebook.com/v22.0";

// WhatsApp manda los números argentinos de celular con un "9" tras el código de
// país (549...), pero la Cloud API exige enviar SIN ese 9 (54...). Sin esto, los
// envíos a números AR fallan con "Recipient not in allowed list" / no entregan.
function normalizeRecipient(to: string): string {
  const digits = to.replace(/\D/g, "");
  if (digits.startsWith("549") && digits.length === 13) return "54" + digits.slice(3);
  return digits;
}

export async function sendTemplate(msg: TemplateMessage): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const token = process.env.WHATSAPP_ACCESS_TOKEN!;

  const res = await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizeRecipient(msg.to),
      type: "template",
      template: {
        name: msg.templateName,
        language: { code: msg.languageCode },
        components: msg.components ?? [],
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp template send failed: ${err}`);
  }
}

export async function sendTextMessage(to: string, text: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const token = process.env.WHATSAPP_ACCESS_TOKEN!;

  await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizeRecipient(to),
      type: "text",
      text: { body: text },
    }),
  });
}

// Reacciona con un emoji al mensaje del usuario (👀 recibido, ✅ listo, etc.).
// WhatsApp solo permite una reacción a la vez por mensaje: una nueva reemplaza la anterior.
export async function sendReaction(to: string, messageId: string, emoji: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const token = process.env.WHATSAPP_ACCESS_TOKEN!;
  await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizeRecipient(to),
      type: "reaction",
      reaction: { message_id: messageId, emoji },
    }),
  }).catch(() => {});
}

// Marca el mensaje como leído y muestra el indicador "escribiendo…" en el chat
// (se mantiene hasta ~25s o hasta que se envía la respuesta).
export async function sendTypingIndicator(messageId: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const token = process.env.WHATSAPP_ACCESS_TOKEN!;
  await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
      typing_indicator: { type: "text" },
    }),
  }).catch(() => {});
}

// Templates pre-aprobados (los nombres deben coincidir con los aprobados en Meta)
export async function sendBudgetAlert(
  to: string,
  categoryName: string,
  spent: number,
  limit: number,
  percent: number
): Promise<void> {
  await sendTemplate({
    to,
    templateName: "neo_budget_alert",
    languageCode: "es_AR",
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: categoryName },
          { type: "text", text: `${percent}%` },
          { type: "text", text: spent.toLocaleString("es-AR") },
          { type: "text", text: limit.toLocaleString("es-AR") },
        ],
      },
    ],
  });
}

export async function sendGoalMilestone(
  to: string,
  goalName: string,
  percent: number
): Promise<void> {
  await sendTemplate({
    to,
    templateName: "neo_goal_milestone",
    languageCode: "es_AR",
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: goalName },
          { type: "text", text: `${percent}%` },
        ],
      },
    ],
  });
}

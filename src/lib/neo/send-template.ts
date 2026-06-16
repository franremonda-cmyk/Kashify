interface TemplateMessage {
  to: string;
  templateName: string;
  languageCode: string;
  components?: object[];
}

const BASE_URL = "https://graph.facebook.com/v18.0";

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
      to: msg.to,
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
      to,
      type: "text",
      text: { body: text },
    }),
  });
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

// Meta saca el número de prueba por su cuenta (26/10 y 27/10/2026: PHONE_NUMBER_REMOVED
// + ACCOUNT_DELETED sin que hiciéramos nada). Cada hora el worker mira el estado y, si
// quedó PENDING, lo vuelve a registrar con el PIN y repone la foto, que se pierde con él.
// ponytail: solo reacciona a PENDING, el único estado visto; Meta permite 10 registros
// cada 72 h. Con número propio esto deja de hacer falta.

const API = "https://graph.facebook.com/v21.0";
const APP_ID = "1532555355247997";

export interface KeepAliveEnv {
  WHATSAPP_PHONE_NUMBER_ID: string;
  WHATSAPP_ACCESS_TOKEN: string;
  WHATSAPP_TWO_STEP_PIN: string;
}

export async function keepNumberAlive(env: KeepAliveEnv, photo: ArrayBuffer): Promise<string> {
  const bearer = { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` };
  const id = env.WHATSAPP_PHONE_NUMBER_ID;

  const state = await (await fetch(`${API}/${id}?fields=status`, { headers: bearer })).json() as { status?: string };
  if (state.status !== "PENDING") return `ok (${state.status})`;

  const reg = await fetch(`${API}/${id}/register`, {
    method: "POST",
    headers: { ...bearer, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", pin: env.WHATSAPP_TWO_STEP_PIN }),
  });
  if (!reg.ok) throw new Error(`register falló: ${reg.status} ${await reg.text()}`);

  // Foto: sesión de subida → bytes (devuelve handle) → handle al perfil. Mismo flujo que
  // scripts/subir-foto-perfil-neo.sh.
  const oauth = { Authorization: `OAuth ${env.WHATSAPP_ACCESS_TOKEN}` };
  const session = await (await fetch(
    `${API}/${APP_ID}/uploads?file_length=${photo.byteLength}&file_type=image/png`,
    { method: "POST", headers: oauth },
  )).json() as { id: string };
  const { h } = await (await fetch(`${API}/${session.id}`, {
    method: "POST",
    headers: { ...oauth, file_offset: "0" },
    body: photo,
  })).json() as { h: string };
  const pic = await fetch(`${API}/${id}/whatsapp_business_profile`, {
    method: "POST",
    headers: { ...bearer, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", profile_picture_handle: h }),
  });
  if (!pic.ok) throw new Error(`registrado, pero la foto falló: ${pic.status} ${await pic.text()}`);

  return "re-registrado y foto repuesta";
}

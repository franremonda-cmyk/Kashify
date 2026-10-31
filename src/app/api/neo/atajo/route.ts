import { createServiceClient } from "@/lib/supabase/server";
import { responderAtajo, tokenValido } from "@/lib/neo/atajo";

const texto = (body: string, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

// Adaptador del Atajo de iPhone: anota en Kashify sin pasar por WhatsApp. Contesta
// texto plano para que el Atajo lo muestre tal cual.
// Usa service role porque el Atajo no tiene sesión: es la excepción a la regla de
// chequeo-seguridad, y el usuario sale del entorno, nunca del pedido. Si la clave se
// filtra, se cambia ATAJO_TOKEN en Vercel y el Atajo viejo deja de andar.
// ponytail: un solo usuario por variables de entorno; con más gente, una tabla de tokens.
export async function POST(req: Request) {
  const userId = process.env.ATAJO_USER_ID;
  if (!userId || !tokenValido(req.headers.get("authorization"), process.env.ATAJO_TOKEN)) {
    return texto("No autorizado", 401);
  }

  const body = await req.json().catch(() => null);
  const message: unknown = body?.message;
  if (typeof message !== "string") return texto("Falta el mensaje", 400);

  try {
    const supabase = await createServiceClient();
    return texto(await responderAtajo(supabase, userId, message));
  } catch (err) {
    console.error("atajo:", err);
    return texto("Algo falló y no sé si se anotó. Revisalo en Kashify antes de repetirlo.", 500);
  }
}

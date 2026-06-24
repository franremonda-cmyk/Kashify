import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendTemplate } from "@/lib/neo/send-template";

// Manda el template de bienvenida por WhatsApp al número recién registrado.
// Requiere un template "neo_welcome" aprobado en Meta. Si no está aprobado o
// el número no está habilitado, falla en silencio (no rompe el onboarding).
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: phones } = await supabase
    .from("user_phones")
    .select("phone_number")
    .eq("user_id", user.id)
    .eq("verified", true)
    .limit(1);

  const phone = phones?.[0]?.phone_number;
  if (!phone) return NextResponse.json({ ok: false, reason: "no_phone" });

  try {
    await sendTemplate({ to: phone, templateName: "neo_welcome", languageCode: "es_AR", components: [] });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("welcome template send failed:", err);
    return NextResponse.json({ ok: false });
  }
}

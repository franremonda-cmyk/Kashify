// Normaliza un teléfono al formato exacto que WhatsApp manda en `message.from`
// para celulares argentinos: 549 + área + número. El worker hace el lookup por
// ese valor (y por su variante sin 9), así que guardamos canónico para que
// coincida siempre, sin importar cómo lo haya tipeado el usuario.
// (App AR-only por ahora — el usuario ingresa su número sin el 9.)
export function toWhatsappFrom(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);        // prefijo internacional 00
  if (d.startsWith("0")) d = d.slice(1);         // trunk nacional AR (0)
  if (d.startsWith("549")) return d;             // ya canónico
  if (d.startsWith("54")) return "549" + d.slice(2);
  return "549" + d;                              // número local sin código de país
}

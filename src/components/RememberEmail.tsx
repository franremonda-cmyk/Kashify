"use client";
import { useEffect } from "react";

/** Guarda el mail de la sesión para preseleccionar la cuenta de Google en el
 *  próximo login (login_hint). En nav privada no persiste: ahí sirve /login?hint=email. */
export default function RememberEmail({ email }: { email?: string }) {
  useEffect(() => {
    if (email) localStorage.setItem("kashify_last_email", email);
  }, [email]);
  return null;
}

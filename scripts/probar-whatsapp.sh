#!/bin/bash
# Prueba que el número de WhatsApp de Kashify puede mandar mensajes.
#
# Con el número de PRUEBA de Meta la conversación la tiene que abrir el negocio: el
# teléfono no puede escribirle primero. Esto manda la plantilla `hello_world`, que es la
# única que existe sin pedir aprobación, y abre la ventana de 24 h para poder responder.
#
# Antes de correrlo, el teléfono destino tiene que estar cargado en la lista de
# destinatarios de prueba del panel de Meta (máximo 5).
#
# Uso:  ./scripts/probar-whatsapp.sh 5493511234567
#       (código de país + 9 + área sin 0 + número sin 15, todo junto y sin +)
set -euo pipefail

cd "$(dirname "$0")/.."
set -a && . ./.env.local && set +a

DESTINO="${1:-}"
[ -n "$DESTINO" ] || { echo "Falta el número. Ej: ./scripts/probar-whatsapp.sh 5493511234567"; exit 1; }

echo "Mandando hello_world a $DESTINO desde el número de Kashify..."
curl -s -X POST \
  "https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages" \
  -H "Authorization: Bearer ${WHATSAPP_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"messaging_product\": \"whatsapp\",
    \"to\": \"$DESTINO\",
    \"type\": \"template\",
    \"template\": { \"name\": \"hello_world\", \"language\": { \"code\": \"en_US\" } }
  }"
echo
echo "---"
echo "Si ves \"messages\":[{\"id\":\"wamid...\"}]  → salió. Mirá el teléfono."
echo "Si ves el error 131030           → falta cargar ese número en la lista de"
echo "                                    destinatarios de prueba del panel de Meta."

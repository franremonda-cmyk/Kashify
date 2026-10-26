#!/bin/bash
# Sube la foto de perfil de Neo al número de WhatsApp de Kashify.
#
# Hacen falta tres llamadas a Meta: abrir una sesión de subida, mandar el archivo
# (devuelve un "handle"), y pegar ese handle en el perfil del número.
#
# Uso:  ./scripts/subir-foto-perfil-neo.sh [ruta-de-la-imagen]
# Default: planes/arte-neo/perfil-whatsapp-idle.png
set -euo pipefail

cd "$(dirname "$0")/.."
set -a && . ./.env.local && set +a

FOTO="${1:-planes/arte-neo/perfil-whatsapp-idle.png}"
APP_ID="1532555355247997"
API="https://graph.facebook.com/v21.0"

[ -f "$FOTO" ] || { echo "No existe: $FOTO"; exit 1; }
BYTES=$(wc -c < "$FOTO" | tr -d ' ')
echo "Subiendo $FOTO ($BYTES bytes)"

# 1 · abrir la sesión de subida
SESION=$(curl -s -X POST "$API/$APP_ID/uploads" \
  -H "Authorization: OAuth $WHATSAPP_ACCESS_TOKEN" \
  -d "file_length=$BYTES" -d "file_type=image/png" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')
echo "1/3 sesión: $SESION"

# 2 · mandar los bytes; devuelve el handle
HANDLE=$(curl -s -X POST "$API/$SESION" \
  -H "Authorization: OAuth $WHATSAPP_ACCESS_TOKEN" \
  -H "file_offset: 0" \
  --data-binary "@$FOTO" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["h"])')
echo "2/3 handle recibido"

# 3 · pegarlo en el perfil del número
curl -s -X POST "$API/$WHATSAPP_PHONE_NUMBER_ID/whatsapp_business_profile" \
  -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"messaging_product\":\"whatsapp\",\"profile_picture_handle\":\"$HANDLE\"}"
echo
echo "3/3 listo. Verificá con:"
echo "  curl -s \"$API/\$WHATSAPP_PHONE_NUMBER_ID/whatsapp_business_profile?fields=profile_picture_url\" -H \"Authorization: Bearer \$WHATSAPP_ACCESS_TOKEN\""

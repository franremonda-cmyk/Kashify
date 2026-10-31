# Atajo de iPhone para Neo

Anota en Kashify sin pasar por WhatsApp ni por Meta. Tocás el atajo, escribís o dictás `café 1200`, y Neo te
contesta ahí mismo. Es el mismo motor que WhatsApp: entiende lo mismo y aprende lo mismo.

Los nombres de los botones pueden variar un poco según la versión de iOS.

## Armarlo (10 min)

1. App **Atajos** → **+** → nombre: **Neo**.
2. Agregá **Solicitar entrada**: tipo **Texto**, pregunta `¿Qué anoto?`.
3. Agregá **Obtener contenido de URL**:
   - URL: `https://kashify.vercel.app/api/neo/atajo`
   - Método: **POST**
   - Encabezado: clave `Authorization`, valor `Bearer ` (con el espacio) seguido de la clave del Atajo.
   - Cuerpo: **JSON** → **Agregar nuevo campo** → **Texto**. Clave `message`; en el valor elegí la variable
     **Entrada proporcionada**.
4. Agregá **Mostrar resultado** y elegí **Contenido de la URL**.
5. Probalo con `hola`: tiene que contestar la bienvenida de Neo.
6. En el atajo, tocá el nombre → **Agregar a pantalla de inicio**.

## Cómo se usa

- **Si Neo te repregunta**, tocá el atajo otra vez y contestá ahí. Recuerda la pregunta durante 15 minutos.
- **Si dice «Algo falló»**, no lo repitas sin mirar: revisá en Kashify si quedó anotado.
- **«No autorizado»** quiere decir que la clave está mal copiada o cambió.

## La clave

Da acceso a tu cuenta de Kashify. **No compartas este atajo con nadie**, porque la clave viaja adentro.
Si se filtra, se cambia `ATAJO_TOKEN` en Vercel y el atajo viejo deja de andar.

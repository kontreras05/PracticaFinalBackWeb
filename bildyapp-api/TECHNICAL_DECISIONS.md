# Decisiones Técnicas

Documento de referencia que explica por qué se eligió cada tecnología y patrón de diseño.

---

## ¿Por qué JWT en lugar de sesiones?

Las **sesiones** guardan el estado del usuario en el servidor (memoria o Redis). Si el servidor se reinicia o hay múltiples instancias, la sesión se pierde.

**JWT** es *stateless*: toda la información necesaria está en el propio token firmado. El servidor no guarda nada; solo verifica la firma criptográfica con el secreto. Ventajas:
- Escala horizontalmente sin compartir estado entre instancias.
- Funciona en entornos serverless.
- El token puede transportar datos del usuario (`id`, `companyId`, `role`) evitando una query a BD en cada petición.

El **refresh token** resuelve el problema de la expiración corta: el access token dura 15 minutos (ventana de ataque pequeña si se roba), y el refresh token dura 7 días pero solo se usa para renovar, no para acceder a recursos.

---

## ¿Por qué Mongoose en lugar de SQL?

Los albaranes tienen **estructura variable** — un albarán de horas tiene campos distintos a uno de materiales. En SQL habría que crear tablas separadas o columnas nullable. MongoDB permite documentos con forma diferente en la misma colección, lo que encaja naturalmente con `discriminatedUnion`.

Además, los datos de dirección son subdocumentos embebidos (no necesitan tabla propia), y los arrays de trabajadores (`workers: [{ name, hours }]`) son nativos en MongoDB sin necesidad de tabla intermedia.

---

## ¿Por qué Zod para validación?

Alternativas: Joi, express-validator, validación manual.

**Zod** se eligió porque:
1. **TypeScript-first**: los schemas generan tipos automáticamente (`z.infer<typeof schema>`). No hay que definir interfaces por separado.
2. **discriminatedUnion**: valida schemas condicionales según un campo, exactamente lo que necesitan los albaranes.
3. **coerce**: convierte strings de query (`"true"`, `"42"`) a booleans y números sin código extra.
4. **Mensajes claros**: los errores de validación incluyen el campo exacto y el mensaje personalizable.

---

## ¿Por qué Soft Delete en lugar de borrado físico?

Los albaranes son documentos legales. Si un usuario borra un albarán por error, debe poder recuperarlo. Además, puede ser necesario auditar qué existía aunque ya esté "borrado".

**Implementación**: campo `deleted: Boolean` + hook `pre(/^find/)` en Mongoose que automáticamente añade `{ deleted: { $ne: true } }` a todas las queries. Los documentos borrados son invisibles para todas las consultas normales sin necesidad de cambiar ningún controlador.

Para el caso de las **partial unique indexes** (unicidad de CIF solo entre no-borrados):
```js
clientSchema.index(
  { company: 1, cif: 1 },
  { unique: true, partialFilterExpression: { deleted: { $ne: true } } }
)
```
Así dos clientes de la misma empresa no pueden tener el mismo CIF si ninguno está borrado, pero si uno está borrado, sí se permite crear uno nuevo con ese CIF.

---

## ¿Por qué EventEmitter para notificaciones?

El controlador podría llamar directamente a `socketService.emitToCompany()`. Pero eso crea acoplamiento: el controlador necesita saber que existe Socket.IO.

Con **EventEmitter** el controlador solo emite un evento nombrado (`'client:new'`) y no sabe quién lo escucha. El listener en `notification.service.js` decide qué hacer (loguear en consola, emitir por socket, enviar email, etc.). Esto sigue el **principio de abierto/cerrado**: para añadir una nueva acción (p.ej. push notification), solo hay que añadir un listener, sin tocar el controlador.

---

## ¿Por qué Sharp antes de Cloudinary?

Cloudinary puede transformar imágenes, pero eso requiere pasar por su CDN. Sharp lo hace **en el servidor antes de subir**, reduciendo:
- **Tamaño del archivo subido**: menos ancho de banda y tiempo de subida.
- **Coste de almacenamiento**: la imagen ya está optimizada.
- **Tiempo de respuesta**: el cliente recibe antes la confirmación de firma.

El resultado: firma redimensionada a ≤800px ancho y convertida a WebP (~30% más ligera que JPEG).

---

## ¿Por qué PDFKit para PDFs?

Alternativas: puppeteer (renderiza HTML), LibreOffice (pesado), reportlab (Python).

**PDFKit** genera PDFs programáticamente desde Node.js, sin dependencias externas ni necesidad de navegador. Crea el PDF como stream/Buffer que puede enviarse directamente como respuesta HTTP o subirse a Cloudinary. Es suficiente para un documento estructurado como un albarán.

---

## ¿Por qué Multi-stage build en Docker?

Una imagen con todas las devDependencies (Jest, tsx, TypeScript, mongodb-memory-server) pesaría ~1 GB. Con multi-stage:

```
Stage 1 (deps): node:22-alpine + npm ci --omit=dev → node_modules de producción
Stage 2 (runtime): imagen limpia + copia node_modules + src/ → ~200 MB
```

Ventajas:
- **Imagen más pequeña**: sin devDependencies ni código de tests.
- **Más segura**: superficie de ataque menor, usuario no-root.
- **Construcción reproducible**: cada stage es independiente.

---

## ¿Por qué Graceful Shutdown?

Cuando un servidor recibe `SIGTERM` (señal de Docker, Kubernetes) o `SIGINT` (Ctrl+C), sin graceful shutdown mataría el proceso inmediatamente, interrumpiendo:
- Peticiones HTTP en vuelo (respuestas parciales, datos corruptos).
- Transacciones de MongoDB abiertas.
- Conexiones Socket.IO activas.

Con graceful shutdown:
1. `httpServer.close()` → deja de aceptar nuevas conexiones pero termina las activas.
2. `socketService.close()` → cierra Socket.IO ordenadamente.
3. `mongoose.disconnect()` → cierra la conexión a MongoDB limpiamente.
4. `process.exit(0)` → salida limpia.

Un timeout de 10 segundos fuerza la salida si algo se cuelga.

---

## ¿Por qué TypeScript parcial y no total?

Migrar todos los controladores y rutas a TypeScript habría requerido añadir tipos para `req`, `res`, Express middlewares, etc., lo que triplica el esfuerzo con poco valor añadido para el proyecto.

La estrategia elegida (modelos + validadores + utils en TS) aporta el máximo valor con mínimo esfuerzo:
- Los **modelos** son los más beneficiados: los tipos de Mongoose (`Model<IClient>`) dan autocompletado completo en VS Code al escribir queries.
- Los **validadores** Zod exportan tipos inferidos usados en toda la app.
- **AppError** tipado evita llamadas incorrectas a los métodos estáticos.

El runner **tsx** permite coexistencia sin configuración extra: los `.js` importan desde `.js` pero tsx resuelve los `.ts` transparentemente.

---

## ¿Por qué Aggregation Pipeline para el dashboard?

La alternativa sería hacer múltiples queries separadas y agrupar en JavaScript. El **aggregation pipeline** de MongoDB procesa todo en el servidor con una sola llamada de red, usando operadores nativos optimizados (`$group`, `$match`, `$lookup`). Con `Promise.all` las tres queries (por mes, por cliente, por proyecto) se ejecutan en paralelo, minimizando la latencia total.

---

## ¿Por qué `mongodb-memory-server` en los tests?

Las alternativas son mockear Mongoose o usar una BD de tests compartida. Mockear Mongoose da tests frágiles que no prueban la lógica real de MongoDB (índices, virtuals, hooks). Una BD compartida genera interferencias entre tests paralelos.

`mongodb-memory-server` descarga un binario real de MongoDB y lo ejecuta en RAM. Los tests son completamente aislados, rápidos y no necesitan un MongoDB externo en CI.

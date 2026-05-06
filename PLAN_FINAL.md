# Plan — Práctica Final BildyApp (Albaranes)

## Context

La práctica intermedia (módulo de usuarios) está terminada y funcional en `bildyapp-api/`: existen `User`, `Company`, autenticación JWT (access + refresh), Helmet, rate limit, mongo‑sanitize, Multer en disco para el logo, AppError con factorías, validación Zod (incluida `.refine` y `discriminatedUnion`), notificaciones por `EventEmitter` y los 10 endpoints `/api/user/*`.

La práctica final (`final.md`) construye encima: añade **Clientes, Proyectos y Albaranes** con sus CRUD completos (paginación, filtros, archivado/restauración, firma con upload a la nube y PDF), más los requisitos transversales **Swagger, Jest, Socket.IO, Docker + CI, email, logging a Slack**. Objetivo: **10/10 + bonus**.

Antes de empezar a desarrollar nada nuevo, hay que **arreglar deuda de la intermedia** que penalizaría la nota final (los requisitos técnicos generales se siguen evaluando):

- `controllers/user.controller.js:15,23,284` firma/verifica con `process.env.JWT_SECRET || 'secret'` mientras que `config/index.js` define `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`. Hay que unificar y usar `config.jwt.accessSecret` para access y `config.jwt.refreshSecret` para refresh (también en `middleware/auth.middleware.js:23`).
- Falta `.env.example`, `README.md` y `.gitignore` en `bildyapp-api/`.
- En `controllers/user.controller.js:332`, el hard delete con `findByIdAndDelete` no aplica al `req.user` ya cargado y, sobre todo, no borra la `Company` huérfana ni los recursos asociados (relevante cuando metamos Client/Project/DeliveryNote).
- `config/index.js` no expone variables nuevas que vamos a necesitar (Mongo URI ya existe; faltan Slack webhook, Cloudinary/R2, SMTP, frontend URL CORS, Socket.IO cors).

---

## Fase 0 — Saneamiento de la intermedia (sin nota nueva, evita penalizaciones)

1. Reescribir `signToken` y `refreshToken` en `controllers/user.controller.js` para usar `config.jwt.accessSecret`/`refreshSecret` y `accessExpires`/`refreshExpires`. Igual en `middleware/auth.middleware.js`.
2. Crear `bildyapp-api/.env.example`, `bildyapp-api/.gitignore` (`node_modules`, `uploads/`, `.env`, `coverage/`) y `bildyapp-api/README.md` (instalación, scripts, docker, swagger, tests).
3. Hacer un commit de saneamiento ("chore: align JWT config and add env example").

---

## Fase 1 — Modelos nuevos

Crear en `src/models/`:

- `Client.js` — campos según `final.md` líneas 71‑89; índices `{ company: 1, cif: 1 }` único parcial (solo no borrados), `{ company: 1, deleted: 1 }`, `{ name: 'text' }`. Reusar el subdocumento `address` (mismo shape que en `User`/`Company`).
- `Project.js` — campos según líneas 94‑114; refs `user`, `company`, `client`. Índice único parcial `{ company: 1, projectCode: 1 }` (solo no borrados). Índices `{ company: 1, client: 1 }`, `{ active: 1 }`.
- `DeliveryNote.js` — campos según líneas 120‑146. Validación condicional de Mongoose: si `format === 'material'` ⇒ `material`, `quantity`, `unit` requeridos; si `format === 'hours'` ⇒ `hours` requerido (y/o `workers[]`). Una vez `signed: true`, bloquear `save` con un `pre('save')` si el doc ya estaba firmado.
- En todos: `timestamps: true`, `toJSON: { virtuals: true }`, campo `deleted: { type: Boolean, default: false, index: true }`.

Crear `src/utils/softDelete.js` con un mini‑helper que aplique `find({ deleted: { $ne: true } })` por defecto en queries y un método estático `findDeleted` (o aplicar `pre(/^find/)` middleware en cada schema). Reusarlo en los tres modelos nuevos.

---

## Fase 2 — Validadores Zod

Crear en `src/validators/`:

- `client.validator.js` — `createClientSchema`, `updateClientSchema` (parcial), `listClientsQuerySchema` (page/limit/name/sort), `idParamSchema` (Mongo ObjectId regex).
- `project.validator.js` — `createProjectSchema`, `updateProjectSchema`, `listProjectsQuerySchema` (page/limit/client/name/active/sort).
- `deliverynote.validator.js` — `createDeliveryNoteSchema` con `z.discriminatedUnion('format', [materialSchema, hoursSchema])`, `listDeliveryNotesQuerySchema` (page/limit/project/client/format/signed/from/to/sort), `signDeliveryNoteSchema` (no body, valida `id` param). Coerciones con `z.coerce.number()` para query y `z.coerce.boolean()` para `active`/`signed`.

Reutilizar el `validate` middleware existente (`middleware/validate.js`).

---

## Fase 3 — Servicios de soporte (singleton stateless)

Crear en `src/services/`:

- `pagination.service.js` — `paginate(model, filter, { page, limit, sort, populate })` → `{ items, totalPages, totalItems, currentPage }`. Reusable en clients/projects/deliverynotes.
- `storage.service.js` — abstracción cloud. Función `uploadBuffer(buffer, key, mimetype)` → URL pública. Implementación con **Cloudinary** (más sencillo: SDK `cloudinary` v2, `uploader.upload_stream`). Variable `STORAGE_PROVIDER` en `.env` con default `cloudinary`. Antes de subir imágenes, optimizar con **Sharp** (resize 800px máx, WebP). PDFs se suben tal cual.
- `pdf.service.js` — `generateDeliveryNotePDF(deliveryNote)` con **pdfkit**. Cabecera con logo de la company (descarga la URL si existe), datos de cliente/proyecto, tabla de horas o materiales, firma incrustada (descargada de la URL) si está firmado. Devuelve `Buffer`.
- `mail.service.js` — **Nodemailer**. Función `sendVerificationCode(email, code)`. Configurable con SMTP (Mailtrap por defecto en dev). Si faltan credenciales, log a consola en lugar de fallar.
- `logger.service.js` — wrapper sobre `console` con un listener de errores que envía 5XX a **Slack** mediante `fetch` (sin SDK) al `SLACK_WEBHOOK_URL`. Payload: timestamp, ruta, método, mensaje, stack.
- `socket.service.js` — instancia singleton de Socket.IO. Función `init(httpServer)` que monta el server, `authMiddleware` que verifica JWT del handshake (`socket.handshake.auth.token`) y mete al socket en la room `company:<companyId>`. Función `emitToCompany(companyId, event, payload)`.

Ampliar `services/notification.service.js` con los nuevos eventos (`deliverynote:new`, `deliverynote:signed`, `client:new`, `project:new`) que disparen tanto `console.log` como `socketService.emitToCompany`.

---

## Fase 4 — Middleware nuevo

- `middleware/upload.js` ya existe para logo. Crear `middleware/upload-memory.js` con `multer.memoryStorage()` para firmas (necesitamos el buffer para Sharp + cloud). Filtro: solo imágenes ≤ 5 MB.
- `middleware/scope.middleware.js` — helper opcional `requireCompany` que rechaza con 400 si `req.user.company` no existe (varias rutas lo necesitan).

---

## Fase 5 — Controllers + Routes

### Clientes (1 pt) — `src/controllers/client.controller.js`, `src/routes/client.routes.js`

Endpoints (`final.md` líneas 157‑166):
- `POST /api/client` — valida unicidad por `(company, cif)` excluyendo borrados. Crea con `user`/`company` del token. Emite `client:new` (Socket.IO + EventEmitter).
- `PUT /api/client/:id` — solo si pertenece a la company del usuario.
- `GET /api/client` — usa `pagination.service`, filtros `name` (regex `i`), `sort`. Devuelve `{ items, totalItems, totalPages, currentPage }`.
- `GET /api/client/archived` — lista solo `deleted: true` de la company. **Definir antes que `/:id`**.
- `GET /api/client/:id` — populate ligero si hace falta.
- `DELETE /api/client/:id?soft=true|false`.
- `PATCH /api/client/:id/restore` — `deleted = false`.

### Proyectos (1,5 pt) — análogo a clients

Endpoints (líneas 178‑187):
- Mismo patrón que clients + valida que `client` referenciado pertenece a la misma company.
- Filtros `client`, `name`, `active`, `sort`.
- `GET /api/project/archived` antes que `/:id`.
- Emite `project:new`.

### Albaranes (2 pt) — `deliverynote.controller.js`, `deliverynote.routes.js`

Endpoints (líneas 198‑234):
- `POST /api/deliverynote` — valida que `client` y `project` pertenecen a la company. Emite `deliverynote:new`.
- `GET /api/deliverynote` — paginación + filtros (`project`, `client`, `format`, `signed`, `from`/`to` sobre `workDate`, `sort`).
- `GET /api/deliverynote/:id` — `populate('user client project')`.
- `GET /api/deliverynote/pdf/:id` — si ya tiene `pdfUrl` (firmado), redirige/descarga desde la nube. Si no, genera PDF on‑the‑fly con `pdf.service` y responde `Content-Type: application/pdf`.
- `PATCH /api/deliverynote/:id/sign` — Multer memory + Sharp + storage. Sube firma → guarda `signatureUrl`, `signed=true`, `signedAt`. Genera PDF, sube a nube → guarda `pdfUrl`. Emite `deliverynote:signed`. Si ya estaba firmado: 409.
- `DELETE /api/deliverynote/:id` — bloquea si `signed`. Soft delete por defecto.

Registrar las tres rutas en `app.js` y crear `src/routes/index.js` que las agregue (limpieza opcional).

---

## Fase 6 — Documentación Swagger (T8 — 1,5 pt)

- Instalar `swagger-jsdoc` y `swagger-ui-express`.
- Crear `src/config/swagger.js` con la definición OpenAPI 3.0: info, servers, `securitySchemes.bearerAuth`, `components.schemas` para `User`, `Company`, `Client`, `Project`, `DeliveryNote`, `Address`, `PaginatedResponse`, `Error`.
- Anotar **todos** los endpoints con bloques `@openapi` (incluidos los de `user.routes.js`). Documentar parámetros, body, responses 200/400/401/404/409/429.
- Montar UI en `app.js`: `app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec))`.

---

## Fase 7 — Testing (T8 — 1,5 pt)

- Instalar dev: `jest`, `supertest`, `mongodb-memory-server`, `cross-env`.
- `jest.config.js` con `testEnvironment: 'node'`, `setupFilesAfterEach`, `transform: {}` (ESM nativo). Scripts según `final.md` líneas 252‑259.
- `tests/setup.js` — arranca `MongoMemoryServer`, conecta mongoose, limpia colecciones entre tests, cierra al final. Setea `process.env.JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `NODE_ENV=test`. **Mockear** `services/storage.service.js`, `services/mail.service.js`, `services/socket.service.js`, `services/logger.service.js` para evitar I/O externa.
- Refactor menor: `app.js` ya exporta `app` (perfecto para Supertest); `index.js` arranca el server. Asegurarse de que `index.js` no se ejecuta al importar `app.js` (ya está bien separado).
- Suites:
  - `tests/auth.test.js` — register, validate, login, refresh, password, delete, invite.
  - `tests/client.test.js` — CRUD, paginación, filtros, archivado/restore, aislamiento por company.
  - `tests/project.test.js` — análogo + validación cruzada de `client`.
  - `tests/deliverynote.test.js` — creación de hours/material, firmado (mock storage devuelve URL fake), bloqueo de borrado tras firma, descarga PDF.
- Objetivo cobertura ≥ 70 % global.

---

## Fase 8 — WebSockets Socket.IO (T10 — 1 pt)

- `socket.service.js` (Fase 3) hace casi todo. En `index.js`, crear `httpServer = http.createServer(app)`; pasarlo a `socketService.init(httpServer)` y a `app.listen` (usar `httpServer.listen` directo).
- Auth handshake: `io.use((socket, next) => { verify JWT → join 'company:'+companyId })`.
- Emitir: ya cubierto desde controllers vía `notification.service` → `socket.service`.
- CORS: `cors: { origin: process.env.CORS_ORIGIN || '*' }`.

---

## Fase 9 — Docker + CI + Health + Graceful Shutdown (T11 — 1 pt)

- `Dockerfile` multi‑stage:
  - Stage `deps`: `node:22-alpine`, `npm ci --omit=dev`.
  - Stage `runtime`: copia `node_modules` y `src/`, expone 3000, `CMD ["node", "src/index.js"]`. Crea usuario no‑root.
- `docker-compose.yml`:
  - Service `app` (build local, env_file `.env`, depends_on `mongo`, port 3000).
  - Service `mongo` (`mongo:7`, volumen `mongo-data`, port 27017 solo interno).
- `.github/workflows/test.yml`:
  - Trigger: `push`, `pull_request`.
  - Job: checkout → setup-node 22 → `npm ci` → `npm test`.
- Health: `app.get('/health', ...)` con status, `mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'`, `process.uptime()`, `new Date().toISOString()`. Excluir de auth y rate‑limit.
- Graceful shutdown en `index.js`: `SIGTERM`/`SIGINT` → `httpServer.close()` → `socketService.close()` → `mongoose.disconnect()` → `process.exit(0)`. Timeout de 10 s por seguridad.

---

## Fase 10 — Email + Slack (1 pt total)

- `mail.service.js` (Fase 3): se llama en `register` (después de crear usuario y código) y en `inviteUser` (envía email con código inicial).
- `logger.service.js` + integración en `error-handler.js`: si `error.statusCode >= 500`, dispara webhook a Slack (no bloqueante: `void fetch(...)`).

---

## Fase 11 — Bonus

- **Aggregation dashboard** (+0,5): `GET /api/dashboard` con pipeline `$match company → $group por mes / por client / por project`. Devuelve totales de albaranes, horas y materiales.
- **TypeScript parcial** (+1): migrar `models/`, `validators/`, `utils/AppError.ts` a TS. Añadir `tsconfig.json` con `"allowJs": true` y `"strict": true`. Mantener controllers/routes en JS para no reescribir todo.
- **PostgreSQL + Prisma** (+1): puede saltarse — alto coste en tiempo, puntúa lo mismo que aggregation + TypeScript.

Recomendación: ir a **aggregation + TypeScript parcial** (=+1,5 bonus) y dejar Prisma fuera.

---

## Variables de entorno (`.env.example`)

```
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/bildyapp_dev
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
CORS_ORIGIN=*
SLACK_WEBHOOK_URL=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=BildyApp <no-reply@bildyapp.com>
STORAGE_PROVIDER=cloudinary
CLOUDINARY_URL=
```

---

## Archivos críticos a crear / modificar

**Nuevos**
- `src/models/Client.js`, `Project.js`, `DeliveryNote.js`
- `src/controllers/client.controller.js`, `project.controller.js`, `deliverynote.controller.js`
- `src/routes/client.routes.js`, `project.routes.js`, `deliverynote.routes.js`, `index.js`
- `src/validators/client.validator.js`, `project.validator.js`, `deliverynote.validator.js`
- `src/services/pagination.service.js`, `storage.service.js`, `pdf.service.js`, `mail.service.js`, `logger.service.js`, `socket.service.js`
- `src/middleware/upload-memory.js`
- `src/config/swagger.js`
- `src/utils/softDelete.js`
- `tests/setup.js`, `tests/auth.test.js`, `tests/client.test.js`, `tests/project.test.js`, `tests/deliverynote.test.js`
- `Dockerfile`, `docker-compose.yml`, `jest.config.js`, `.dockerignore`
- `.github/workflows/test.yml`
- `bildyapp-api/.env.example`, `.gitignore`, `README.md`
- `requests-client.http`, `requests-project.http`, `requests-deliverynote.http`

**Modificar**
- `src/app.js` — montar `/api-docs`, `/health`, las 3 rutas nuevas, error logging Slack.
- `src/index.js` — `http.createServer`, init socket, graceful shutdown.
- `src/config/index.js` — añadir `cors`, `slack`, `smtp`, `storage`.
- `src/controllers/user.controller.js` — alinear secrets JWT, llamar `mail.service` en register/invite.
- `src/middleware/auth.middleware.js` — usar `config.jwt.accessSecret`.
- `src/services/notification.service.js` — añadir 4 listeners nuevos que emitan por Socket.IO.

---

## Plan de commits progresivos (sugerido)

1. `chore: align JWT config, add env.example & README`
2. `feat(models): add Client, Project, DeliveryNote with soft delete`
3. `feat(client): CRUD + pagination + archive/restore`
4. `feat(project): CRUD + pagination + filtros`
5. `feat(deliverynote): CRUD + filtros + populate`
6. `feat(storage): cloudinary uploader + sharp optimization`
7. `feat(deliverynote): sign + PDF generation + cloud upload`
8. `feat(realtime): Socket.IO con rooms por company`
9. `feat(mail): nodemailer en registro e invitación`
10. `feat(logging): slack webhook para errores 5XX`
11. `docs(swagger): documentación OpenAPI completa`
12. `test: jest + supertest + memory-server (cobertura 70 %)`
13. `feat(ops): docker + compose + healthcheck + graceful shutdown`
14. `ci: github actions test pipeline`
15. `feat(bonus): dashboard aggregation`
16. `refactor(bonus): typescript parcial en models/validators`

---

## Verificación end‑to‑end

1. `npm install` desde cero, `cp .env.example .env`, rellenar secrets de prueba, `npm run dev` → server arranca, `/health` responde 200 con `db: connected`.
2. Ejecutar `requests-*.http` en orden: register → validate → login → company → create client → create project → create deliverynote → sign deliverynote → list con filtros → download PDF firmado.
3. Conectar un cliente Socket.IO (script Node o navegador) con el JWT como `auth.token`; al firmar un albarán, llega `deliverynote:signed` solo a sockets de la misma company.
4. `npm test` → 4 suites verdes, cobertura ≥ 70 %.
5. `docker compose up --build` → `app` y `mongo` levantan; `/health` responde desde el contenedor.
6. Forzar un error 5XX (lanzar throw en una ruta de prueba protegida) → llega notificación al Slack channel.
7. Abrir `http://localhost:3000/api-docs` → UI Swagger con todos los endpoints, esquemas y "Try it out" usando bearer token.
8. `git push` → GitHub Actions ejecuta `npm test` y queda verde.
9. `Ctrl+C` en `npm start` → ver logs de cierre ordenado (Mongo desconectado, Socket cerrado, exit 0).

# Plan — Cobertura real de testing (dashboard, error-handler, rol, CI)

## Context

El examen mide cobertura **real** sobre flujos previamente sin test:
- `getDashboard` (`bildyapp-api/src/controllers/dashboard.controller.js:14`) no tiene test E2E.
- `errorHandler` (`bildyapp-api/src/middleware/error-handler.js:12`) no se prueba directamente; sus ramas Zod / 11000 / 5xx + `notifyError` están sin cubrir.
- `restrictTo` (`bildyapp-api/src/middleware/role.middleware.js:7`) sólo se usa hoy en `POST /api/user/invite` y no hay test que verifique el 403 para `guest`.
- El workflow CI (`.github/workflows/test.yml`) ejecuta `npm test` (sin `--coverage`), por lo que el `coverageThreshold` 70/50/70/70 de `bildyapp-api/jest.config.js:14` **no está aplicándose** y la cobertura puede caer sin que CI falle.

Resultado esperado: tests nuevos verdes, CI rojo si la cobertura cae <70%, un test de rol que demuestre RBAC, y `EXAMEN.md` con respuestas socráticas + proceso.

---

## Cambios

### 1. `bildyapp-api/tests/dashboard.test.js` (nuevo)

Patrón calcado de `tests/deliverynote.test.js:1-60` (MongoMemoryServer + supertest + reset por test):

- `beforeAll` / `afterAll` / `beforeEach`: arrancar/parar `MongoMemoryServer`, conectar mongoose, limpiar colecciones.
- En `beforeEach`: registrar admin (`POST /api/user/register`), crear empresa (`PATCH /api/user/company`), crear cliente (`POST /api/client`) y proyecto (`POST /api/project`). Reusar exactamente los helpers/datos de `tests/deliverynote.test.js:32-59`.
- Crear ≥2 albaranes vía `POST /api/deliverynote` con `format: 'hours'` (`hours: 8`) y `format: 'material'` (`quantity: 5`) — datos calcados de `hoursNoteData` / `materialNoteData` en `tests/deliverynote.test.js:66-83`.
- Tests:
  - `GET /api/dashboard` sin token → 401.
  - `GET /api/dashboard` con admin sin empresa (registrar otro user, no asignar empresa) → 400 (`AppError.badRequest` en `dashboard.controller.js:20`).
  - `GET /api/dashboard` con datos sembrados → 200, body con `data.byMonth`, `data.byClient`, `data.byProject` (arrays). Verificar que en `byMonth` el documento agrupado tiene `totalAlbaranes >= 2`, `totalHoras === 8`, `totalMaterial === 5`. Verificar que `byClient[0].clientName === 'Cliente Test'` y `byProject[0].projectCode === 'PRJ-001'`.

### 2. `bildyapp-api/tests/services.test.js` (ampliar)

Añadir un nuevo bloque `describe('errorHandler', ...)` al final del fichero. **Sin** `MongoMemoryServer`: se invoca el middleware con dummies de `req/res/next`. Importar `errorHandler` desde `../src/middleware/error-handler.js` y `logger` desde `../src/services/logger.service.js`.

Helper local:
```js
function fakeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}
```

Casos:
- **ZodError → 400**: pasar `{ name: 'ZodError', issues: [{ message: 'email inválido' }] }`. Asserts: `res.status` llamado con `400`, `res.json` con `message` que contiene `'Validation Error'`.
- **Duplicate key 11000 → 409**: pasar `{ code: 11000, errmsg: 'E11000 duplicate key error: "admin@test.com"' }`. Asserts: `res.status(409)`, `message` contiene el valor entrecomillado.
- **5xx → notifyError**: `jest.spyOn(logger, 'notifyError').mockImplementation(() => {})`; pasar `new Error('boom')` (sin `statusCode` → defaultea a 500 en `error-handler.js:13`); assert que `notifyError` fue llamado una vez con el error y `req`. `afterEach` restaura el spy.

### 3. `.github/workflows/test.yml` (modificar)

Reemplazar el step *Run tests*:
```yaml
- name: Run tests with coverage
  run: npm run test:coverage
  working-directory: bildyapp-api
```
El script `test:coverage` ya existe (`bildyapp-api/package.json:11`) y dispara Jest con `--coverage`, por lo que el `coverageThreshold` (70/50/70/70 en `jest.config.js:14`) hará exit ≠0 → job falla.

### 4. Test de rol (guest → 403 al crear cliente)

**Bloqueador previo**: `client.routes.js:83` (`POST /`) sólo aplica `requireAuth` + `requireCompany`; un guest pasa los dos. Para que `restrictTo` cause el 403 hace falta añadirlo.

Cambio mínimo en `bildyapp-api/src/routes/client.routes.js`:
- Importar `restrictTo` desde `../middleware/role.middleware.js`.
- Insertar `restrictTo('admin')` en las rutas de escritura: `POST /`, `PUT /:id`, `DELETE /:id`, `PATCH /:id/restore` (lectura sigue libre para guest, coherente con el resto del proyecto).

Test (añadir bloque `describe('RBAC')` dentro de `tests/client.test.js`):
- En el `beforeEach` extendido: tras crear admin+empresa, crear un guest directamente sembrando en BD para evitar el flujo de invitación (más rápido y autosuficiente):
  ```js
  import { User } from '../src/models/User.ts';
  import { signAccessToken } from '../src/services/jwt.service.js'; // verificar nombre real
  const guest = await User.create({ email: 'guest@test.com', password: 'Password123!', role: 'guest', company: <companyIdAdmin>, isVerified: true });
  guestToken = signAccessToken(guest);
  ```
  *Si el helper de firma no existe con ese nombre, leer `src/services/` y usar el real; alternativa robusta: invitar al guest vía `POST /api/user/invite` desde el admin y completar `verify`/`login` igual que en `auth.test.js`.*
- Test: `POST /api/client` con `Authorization: Bearer ${guestToken}` y body válido → status `403`, `body.message` contiene `'No tienes permiso'` (mensaje de `role.middleware.js:11`).

### 5. `EXAMEN.md` (nuevo, en raíz del repo)

Estructura:
- **Fundamento**: por qué la cobertura real importa (ramas críticas no cubiertas = bugs silenciosos en prod).
- **Respuestas socráticas** a las preguntas implícitas del enunciado: ¿Qué demuestra un test del dashboard E2E que no demuestra un unit test del aggregation pipeline? ¿Por qué probar `errorHandler` por separado además del flujo HTTP? ¿Qué garantiza `coverageThreshold` que no garantiza `npm test`? ¿Por qué el RBAC necesita un test aunque el middleware sea trivial?
- **Proceso**: bitácora de pasos seguidos (exploración → diseño → implementación → verificación), ficheros tocados con rutas, comandos ejecutados (`npm run test:coverage`), resultado de cobertura observado.

---

## Ficheros tocados

| Ruta | Acción |
|---|---|
| `bildyapp-api/tests/dashboard.test.js` | crear |
| `bildyapp-api/tests/services.test.js` | ampliar (nuevo `describe('errorHandler')`) |
| `bildyapp-api/tests/client.test.js` | ampliar (nuevo `describe('RBAC')`) |
| `bildyapp-api/src/routes/client.routes.js` | añadir `restrictTo('admin')` a rutas de escritura |
| `.github/workflows/test.yml` | cambiar step a `npm run test:coverage` |
| `EXAMEN.md` | crear |

## Reutilización (no reinventar)

- Patrón MongoMemoryServer + supertest: `tests/deliverynote.test.js:1-21`.
- Helpers de seed admin+empresa+cliente+proyecto: `tests/deliverynote.test.js:30-59`.
- Datos albarán hours/material: `tests/deliverynote.test.js:66-90`.
- Spy sobre `logger`: patrón ya usado en `tests/services.test.js:36-53`.

## Verificación end-to-end

Desde `bildyapp-api/`:
1. `npm run test:coverage` — todos los tests verdes; tabla de cobertura ≥70/50/70/70 en global.
2. Verificar visualmente que el reporte incluye líneas de `dashboard.controller.js` y `error-handler.js` cubiertas (>0%).
3. Forzar regresión local: comentar una rama de `error-handler.js` y reejecutar → Jest debe fallar con `Jest: "global" coverage threshold for branches/lines not met`.
4. Push a rama y comprobar en Actions que el job *Tests* corre `Run tests with coverage` y que un PR que baje cobertura pone el check en rojo.
5. Revisar `EXAMEN.md` renderizado.

## Riesgos / decisiones tomadas

- **Añadir `restrictTo('admin')` a rutas de escritura de cliente** es un cambio de comportamiento (antes un guest podía crear clientes). Se justifica por el criterio explícito del enunciado y es consistente con `POST /api/user/invite`.
- **Sembrar guest directamente vs. flujo de invitación**: se prefiere siembra directa por velocidad de test; si `signAccessToken` no se exporta con ese nombre, se cambia a flujo de invitación completo (precedente: `auth.test.js`).
- **Umbral 70%**: ya configurado, no se modifica. El plan únicamente lo activa en CI.

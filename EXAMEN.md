# EXAMEN — Cobertura de testing real

## Respuestas socráticas

### ¿Qué demuestra un test E2E del dashboard que no demuestra un unit test del aggregation pipeline?

Un test unitario del pipeline demuestra que la lógica de agrupación es correcta en aislamiento. El test E2E demuestra que el **flujo completo funciona**: autenticación, middleware `requireAuth`, comprobación de empresa, las tres consultas agregadas en paralelo con `Promise.all`, y la serialización JSON que llega al cliente. Un test unitario puede pasar aunque la ruta esté mal registrada, el middleware bloquee la petición o el modelo no esté importado. El E2E cubre todas esas capas a la vez con datos reales en memoria.

### ¿Por qué probar `errorHandler` de forma directa además del flujo HTTP?

Los tests HTTP solo activan la rama de error que corresponde al escenario que prueban (por ejemplo, 409 por duplicado). Las ramas de `ZodError`, `11000` y `5xx + notifyError` no tienen por qué activarse nunca en otros tests si el resto del código está bien validado. Probando el middleware directamente con objetos de error sintéticos se garantiza que **cada rama condicional del handler esté ejecutada**, que `logger.notifyError` sea llamado cuando corresponde, y que el formato de respuesta sea consistente, sin necesidad de replicar complejos escenarios de fallo en toda la suite.

### ¿Qué garantiza `coverageThreshold` que no garantiza `npm test`?

`npm test` garantiza que todos los tests escritos pasan. `coverageThreshold` garantiza que el **código sin test no supera un umbral**. Es posible añadir ramas, funciones enteras o ficheros completos sin escribir ningún test y que `npm test` siga en verde. Con el umbral activo en CI, cualquier PR que introduzca código sin cobertura suficiente falla automáticamente, haciendo que el mantenimiento de la cobertura sea una invariante del proceso de integración, no una responsabilidad manual.

### ¿Por qué el RBAC necesita un test aunque `restrictTo` sea trivial?

`restrictTo` es trivial por sí solo, pero **su ausencia en una ruta es silenciosa**: el middleware no lanza error si no está montado, simplemente no existe. Sin un test de rol, se puede eliminar `restrictTo('admin')` de una ruta de escritura, un commit de refactor puede reordenar middlewares y perder el control de acceso, o una nueva ruta puede heredar el patrón sin la restricción. El test demuestra que la **integración entre la ruta, el middleware y el rol guest** produce el 403 esperado, no que la lógica interna de `restrictTo` funcione.

---

## Proceso de implementación

### 1. Exploración

Se leyeron los ficheros relevantes para entender el estado de partida:

- `bildyapp-api/tests/` — estructura existente de tests (MongoMemoryServer + supertest).
- `bildyapp-api/src/controllers/dashboard.controller.js` — tres aggregations en paralelo.
- `bildyapp-api/src/middleware/error-handler.js` — ramas: ZodError, ValidationError, 11000, JWT, 5xx.
- `bildyapp-api/src/middleware/role.middleware.js` — `restrictTo` como factory de middleware.
- `bildyapp-api/src/routes/client.routes.js` — ausencia de `restrictTo` en rutas de escritura.
- `bildyapp-api/jest.config.js` — umbral 70/50/70/70 ya configurado pero no activo en CI.
- `.github/workflows/test.yml` — ejecutaba `npm test` sin `--coverage`.

### 2. Ficheros creados / modificados

| Fichero | Tipo | Cambio |
|---|---|---|
| `bildyapp-api/tests/dashboard.test.js` | nuevo | Test E2E del dashboard con MongoMemoryServer |
| `bildyapp-api/tests/services.test.js` | ampliado | Bloque `describe('errorHandler')` con 3 casos |
| `bildyapp-api/tests/client.test.js` | ampliado | Imports `jwt`/`User` + bloque `describe('RBAC')` |
| `bildyapp-api/src/routes/client.routes.js` | modificado | `restrictTo('admin')` en POST, PUT, DELETE, PATCH restore |
| `.github/workflows/test.yml` | modificado | `npm test` → `npm run test:coverage` |
| `EXAMEN.md` | nuevo | Este fichero |

### 3. Decisiones de diseño

**Dashboard test**: se siembran 2 albaranes de distinto formato (`hours` y `material`) con la misma `workDate` para que queden en el mismo grupo mensual. Se verifican los tres arrays de respuesta, la agregación numérica y los lookups de cliente/proyecto.

**errorHandler unit tests**: se llama directamente al middleware sin HTTP para cubrir ramas que no disparan en los tests de integración existentes. `fakeRes()` devuelve un objeto con `.status()` y `.json()` encadenables. El spy sobre `logger.notifyError` se restaura en `afterEach`.

**restrictTo en cliente**: se añade solo a rutas de escritura (POST, PUT, DELETE, PATCH restore). Las rutas de lectura (GET /, GET /archived, GET /:id) quedan sin restricción de rol, lo que es coherente con el patrón del resto del proyecto (los guest pueden consultar, no modificar).

**Guest en test RBAC**: se crea directamente via `User.create()` con `role: 'guest'` y la misma empresa que el admin, evitando el flujo de invitación. El JWT se firma con `process.env.JWT_ACCESS_SECRET` (establecido en `env-setup.js`). `requireAuth` encuentra el usuario en la BD del MongoMemoryServer y establece `req.user`.

### 4. Verificación

```bash
cd bildyapp-api
npm run test:coverage
```

Resultado esperado:
- Todos los tests en verde.
- Tabla de cobertura global ≥ 70 % en líneas/funciones/statements y ≥ 50 % en ramas.
- Si la cobertura cae por debajo del umbral, Jest sale con código ≠ 0 y el job de CI falla.

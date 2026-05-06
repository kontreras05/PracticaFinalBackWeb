# Arquitectura de BildyApp API

## Patrón MVC aplicado a una API REST

La app sigue el patrón **Modelo-Vista-Controlador** adaptado a APIs (sin vistas HTML):

```
HTTP Request
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ MIDDLEWARES GLOBALES (app.js)                                   │
│  Helmet → RateLimit → JSON parser → mongoSanitize              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ ROUTER (src/routes/)                                            │
│  /api/user → user.routes.js                                    │
│  /api/client → client.routes.js                                │
│  /api/project → project.routes.js                              │
│  /api/deliverynote → deliverynote.routes.js                    │
│  /api/dashboard → dashboard.routes.js                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ MIDDLEWARES DE RUTA                                             │
│  requireAuth (verifica JWT → pone req.user)                    │
│  restrictTo('admin') (verifica rol)                            │
│  validate(zodSchema) (valida body/query/params)                │
│  uploadMemory (Multer para archivos en firma)                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ CONTROLADORES (src/controllers/)                                │
│  Lógica de negocio:                                            │
│  - Consultar/modificar modelos Mongoose                        │
│  - Llamar servicios (storage, pdf, mail)                       │
│  - Emitir eventos de notificación                              │
│  - Construir y enviar la respuesta JSON                        │
└────────┬──────────────────────────────────────────┬────────────┘
         │                                          │
         ▼                                          ▼
┌─────────────────┐                    ┌────────────────────────┐
│ MODELOS (.ts)   │                    │ SERVICIOS (src/services)│
│ Mongoose schemas│                    │ pdf.service.js         │
│ IUser, IClient  │                    │ storage.service.js     │
│ IProject, etc.  │                    │ mail.service.js        │
│ Soft delete hook│                    │ logger.service.js      │
│ Pre-save hooks  │                    │ socket.service.js      │
└─────────────────┘                    │ notification.service.js│
                                       │ pagination.service.js  │
                                       └────────────────────────┘
                                                   │
                                                   ▼
                                       ┌────────────────────────┐
                                       │ RECURSOS EXTERNOS      │
                                       │ MongoDB (Mongoose)     │
                                       │ Cloudinary             │
                                       │ SMTP (Nodemailer)      │
                                       │ Slack Webhook          │
                                       └────────────────────────┘
```

## Capas de la aplicación

### 1. Capa de entrada — `src/app.js`
Configura Express con los middlewares de seguridad globales y monta los routers. Exporta `app` sin arrancar el servidor (para que los tests puedan importarlo sin efectos secundarios).

### 2. Punto de arranque — `src/index.js`
Crea el `http.Server`, inicializa Socket.IO sobre él, conecta a MongoDB y arranca el servidor. También registra los manejadores de señales POSIX para graceful shutdown.

### 3. Rutas — `src/routes/`
Solo definen **qué middlewares y controlador** se aplican a cada combinación `[método, URL]`. No contienen lógica de negocio. Incluyen anotaciones `@openapi` para Swagger.

### 4. Middlewares — `src/middleware/`
| Archivo | Función |
|---------|---------|
| `auth.middleware.js` | Verifica JWT y puebla `req.user` |
| `role.middleware.js` | Verifica que `req.user.role` sea el requerido |
| `validate.js` | Ejecuta `schema.parse()` de Zod y pasa el control o lanza 400 |
| `upload.js` | Multer en disco para logo de empresa |
| `upload-memory.js` | Multer en memoria para firma digital |
| `scope.middleware.js` | Verifica que el usuario tiene empresa asociada |
| `error-handler.js` | Captura todos los errores, normaliza la respuesta y llama al logger |

### 5. Controladores — `src/controllers/`
Reciben `(req, res, next)`, orquestan la lógica y devuelven la respuesta. Principio: **thin controllers** — la lógica compleja se delega a services.

### 6. Modelos — `src/models/` (TypeScript)
Definen el schema de MongoDB con validaciones, índices y hooks. La interfaz TypeScript (`IUser`, `IClient`, etc.) describe la forma del documento y permite autocompletado en los controladores.

### 7. Servicios — `src/services/`
Funciones reutilizables sin estado que encapsulan I/O externo:
- **`pagination.service`**: aplica `skip/limit/sort` genérico a cualquier modelo.
- **`storage.service`**: abstrae la subida a Cloudinary (fácil de cambiar a S3/R2).
- **`pdf.service`**: genera el PDF como Buffer usando PDFKit.
- **`mail.service`**: envía emails via SMTP con Nodemailer.
- **`logger.service`**: wrapper de `console` que además manda errores 5XX a Slack.
- **`socket.service`**: singleton de Socket.IO con `init(server)` y `emitToCompany()`.
- **`notification.service`**: EventEmitter que desacopla los controladores de Socket.IO.

### 8. Validadores — `src/validators/` (TypeScript)
Schemas Zod que validan la forma exacta de `req.body`, `req.query` y `req.params`. Exportan también los tipos TypeScript inferidos (`z.infer<>`) para usarlos en controladores sin repetir definiciones.

### 9. Utilidades — `src/utils/` (TypeScript)
- **`AppError.ts`**: extiende `Error` con `statusCode` y métodos estáticos (`AppError.notFound()`, `AppError.conflict()`, etc.). Permite lanzar errores tipados desde cualquier punto.
- **`softDelete.ts`**: helper que, dado un Schema de Mongoose, añade el hook `pre(/^find/)` y el método estático `findDeleted()`.

## Manejo de errores centralizado

```
throw AppError.notFound('Cliente no encontrado')
         │
         ▼
  error-handler.js
         │
         ├─ ZodError → 400 con lista de campos inválidos
         ├─ ValidationError (Mongoose) → 400
         ├─ Duplicate key (código 11000) → 409
         ├─ JsonWebTokenError → 401
         ├─ TokenExpiredError → 401
         └─ statusCode >= 500 → logger.notifyError() → Slack Webhook
```

Todos los errores terminan en el mismo middleware `errorHandler`, que normaliza la respuesta:
```json
{
  "status": "fail",
  "message": "El cliente con CIF B12345678 ya existe."
}
```

## Sistema de notificaciones desacoplado

```
Controller
    │ notificationService.emit('client:new', { companyId, name })
    ▼
NotificationService (EventEmitter)
    │ listener registrado en notification.service.js
    ▼
socketService.emitToCompany(companyId, 'client:new', data)
    │
    ▼
Socket.IO → io.to('company:<companyId>').emit(...)
    │
    ▼
Todos los sockets conectados de esa empresa reciben el evento
```

El controlador no sabe nada de Socket.IO; solo emite un evento. El listener puede cambiarse (añadir email, push notifications, etc.) sin tocar el controlador.

## TypeScript parcial

```
src/
├── models/*.ts      ← TypeScript con interfaces (IUser, IClient, ...)
├── validators/*.ts  ← TypeScript con tipos exportados (z.infer<>)
├── utils/*.ts       ← TypeScript puro (AppError, softDelete)
└── controllers/*.js ← JavaScript (permanecen en JS)
    routes/*.js      ← JavaScript
    services/*.js    ← JavaScript
    app.js           ← JavaScript
    index.js         ← JavaScript
```

Los archivos `.js` importan desde `'../models/Client.js'`. El runner `tsx` (registrado via `--import tsx/esm`) intercepta esa importación, busca `Client.ts` y la transpila al vuelo. Los controladores obtienen tipos sin necesidad de migrarlos.

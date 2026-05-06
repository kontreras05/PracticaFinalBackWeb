# BildyApp API — Gestión de Albaranes

API REST para digitalizar albaranes (partes de horas y materiales) entre empresas, clientes y proyectos. Construida con Node.js, Express y MongoDB, con autenticación JWT, tiempo real via Socket.IO, almacenamiento en la nube (Cloudinary), generación de PDFs y notificaciones por Slack y email.

---

## Índice

1. [¿Qué hace la aplicación?](#qué-hace-la-aplicación)
2. [Tecnologías y por qué se usan](#tecnologías-y-por-qué-se-usan)
3. [Arquitectura y estructura](#arquitectura-y-estructura)
4. [Modelos de datos](#modelos-de-datos)
5. [Autenticación JWT](#autenticación-jwt)
6. [Validación con Zod](#validación-con-zod)
7. [Borrado lógico (Soft Delete)](#borrado-lógico-soft-delete)
8. [Notificaciones en tiempo real](#notificaciones-en-tiempo-real)
9. [Subida de archivos y firma digital](#subida-de-archivos-y-firma-digital)
10. [Generación de PDFs](#generación-de-pdfs)
11. [Dashboard con Aggregation Pipeline](#dashboard-con-aggregation-pipeline)
12. [Seguridad HTTP](#seguridad-http)
13. [Testing](#testing)
14. [Variables de entorno](#variables-de-entorno)
15. [Instalación y desarrollo](#instalación-y-desarrollo)
16. [Docker](#docker)
17. [CI/CD con GitHub Actions](#cicd-con-github-actions)
18. [Endpoints](#endpoints)

---

## ¿Qué hace la aplicación?

BildyApp permite a empresas de construcción/servicios gestionar su trabajo diario:

1. **Usuarios**: Un administrador se registra, verifica su email con un código de 6 dígitos, y configura su empresa. Puede invitar a compañeros como "guest".
2. **Clientes**: La empresa da de alta a sus clientes (con CIF único por empresa).
3. **Proyectos**: Cada proyecto pertenece a un cliente y tiene un código único.
4. **Albaranes**: Un albarán documenta un trabajo realizado en un proyecto. Puede ser de *horas* (quién trabajó y cuánto) o de *materiales* (qué se entregó, cantidad y unidad). Una vez firmado digitalmente (con imagen de firma), no puede modificarse ni borrarse, y se genera un PDF que queda guardado en la nube.

El objetivo es digitalizar el proceso en papel: el trabajador crea el albarán, el cliente lo firma en el móvil, y queda registrado con PDF permanente.

---

## Tecnologías y por qué se usan

### Node.js + Express 5
**Node.js** permite manejar muchas conexiones simultáneas con un solo hilo gracias a su modelo asíncrono basado en eventos (ideal para APIs con I/O intensivo como llamadas a base de datos o subidas de archivos). **Express 5** es el framework web minimalista estándar: gestiona las rutas, middlewares y el ciclo petición-respuesta.

### MongoDB + Mongoose 9
**MongoDB** es una base de datos NoSQL orientada a documentos. Se eligió porque los albaranes tienen estructura variable (horas vs materiales) que encaja naturalmente en documentos flexibles. **Mongoose** añade esquemas, validaciones, referencias entre colecciones (`ref`) y middlewares de ciclo de vida (`pre('save')`).

### JWT — JSON Web Tokens
La autenticación **no guarda sesión en el servidor** (stateless). En su lugar, al hacer login se generan dos tokens firmados criptográficamente:
- **Access token** (15 minutos): se envía en cada petición en la cabecera `Authorization: Bearer <token>`. El servidor solo necesita verificar la firma para saber quién es el usuario.
- **Refresh token** (7 días): permite obtener un nuevo access token cuando caduca, sin volver a hacer login.

Ventaja frente a sesiones: el servidor no tiene que almacenar nada; cualquier instancia puede verificar el token solo con el secreto.

### Zod — Validación de schemas
**Zod** valida los datos de entrada (body, query, params) antes de que lleguen al controlador. Si la validación falla, devuelve un error 400 con mensaje detallado. Ventaja clave: los schemas de Zod también generan **tipos TypeScript automáticamente** (`z.infer<typeof schema>`), evitando duplicar código.

Se usa `discriminatedUnion` para los albaranes: si `format === 'hours'`, exige el campo `hours`; si `format === 'material'`, exige `material`, `quantity` y `unit`. Zod selecciona el schema correcto según ese campo discriminador.

### Socket.IO — Tiempo real
**Socket.IO** implementa WebSockets con fallback automático a polling si el navegador no los soporta. Permite emitir eventos al instante a los usuarios conectados.

Funcionamiento: cuando un usuario conecta, el servidor verifica su JWT en el handshake y lo une a una **room** con el nombre `company:<id_empresa>`. Cuando se crea un albarán, el servidor llama a `io.to('company:abc123').emit('deliverynote:new', datos)` y el evento llega solo a los sockets de esa empresa.

### Multer — Subida de archivos
**Multer** es un middleware que procesa peticiones `multipart/form-data` (el formato estándar para subir archivos desde HTML). Se usa en dos modos:
- **Disco** (`upload.js`): para el logo de empresa, que se guarda en `/uploads/`.
- **Memoria** (`upload-memory.js`): para la firma del albarán, que se mantiene en memoria (Buffer) para procesarla con Sharp antes de subirla a la nube.

### Sharp — Optimización de imágenes
**Sharp** es una librería de procesamiento de imágenes de alto rendimiento (usa libvips bajo el capó). Antes de subir la firma a Cloudinary, la redimensiona a 800px de ancho máximo y la convierte a **WebP** (formato moderno, ~30% más ligero que JPEG/PNG). Reduce el ancho de banda y el coste de almacenamiento.

### Cloudinary — Almacenamiento en la nube
**Cloudinary** es un servicio cloud para almacenar y transformar imágenes y archivos. Recibe el Buffer de la imagen procesada por Sharp y devuelve una URL pública permanente. También se usa para guardar el PDF del albarán firmado. En el entorno de test, `uploadBuffer()` devuelve una URL falsa para no hacer llamadas externas.

### PDFKit — Generación de PDFs
**PDFKit** genera PDFs desde código JavaScript en el servidor, sin necesidad de navegador ni LibreOffice. Construye el documento añadiendo texto, tablas e imágenes programáticamente. El resultado es un `Buffer` que se puede enviar como respuesta HTTP (`Content-Type: application/pdf`) o subir a Cloudinary.

### Nodemailer — Envío de emails
**Nodemailer** es la librería estándar de Node.js para SMTP. Envía el código de verificación al registrarse y las credenciales al invitar a un compañero. Si no hay credenciales SMTP configuradas (entorno de desarrollo), el código se imprime en consola en lugar de fallar.

### Helmet — Cabeceras de seguridad HTTP
**Helmet** añade automáticamente unas 15 cabeceras HTTP de seguridad: `X-Frame-Options` (evita clickjacking), `X-XSS-Protection`, `Content-Security-Policy`, `Strict-Transport-Security`, etc. Con una sola línea `app.use(helmet())` se mitigan múltiples ataques comunes.

### express-rate-limit — Limitación de peticiones
Limita a **100 peticiones por IP cada 15 minutos**. Si se supera, responde 429 (Too Many Requests). Protege contra ataques de fuerza bruta (intentar passwords) y abuso de la API.

### express-mongo-sanitize — Prevención de NoSQL Injection
Elimina los caracteres `$` y `.` de los campos del body y query antes de que lleguen a MongoDB. Sin esto, un atacante podría enviar `{ "email": { "$gt": "" } }` para saltarse la autenticación.

### Swagger / OpenAPI 3.0
Genera una **documentación interactiva** accesible en `/api-docs`. Define los schemas de todos los modelos y documenta cada endpoint con sus parámetros, cuerpo, respuestas posibles y códigos de error. Permite probar la API directamente desde el navegador con "Try it out".

### Jest + Supertest + MongoDB Memory Server
- **Jest**: framework de testing de JavaScript. Ejecuta los tests en paralelo (o en banda con `--runInBand`), mide cobertura y muestra diferencias claras en los fallos.
- **Supertest**: hace peticiones HTTP reales a la app Express sin necesitar un servidor levantado.
- **mongodb-memory-server**: lanza una instancia de MongoDB real en memoria RAM durante los tests. Los tests no tocan la base de datos de desarrollo ni necesitan un MongoDB externo.

### Docker + Docker Compose
**Docker** empaqueta la app con todas sus dependencias en una imagen. El `Dockerfile` usa **multi-stage build**: un primer stage instala las dependencias (`npm ci --omit=dev`) y un segundo stage solo copia `node_modules` y `src/`, sin el código fuente innecesario, resultando en una imagen más pequeña y segura. Se crea un usuario no-root para ejecutar el proceso.

**Docker Compose** levanta la app y MongoDB juntos con un solo comando, conectados en la misma red interna.

### TypeScript (migración parcial)
Los **modelos** (`src/models/*.ts`), **validadores** (`src/validators/*.ts`) y **utilidades** (`AppError.ts`, `softDelete.ts`) se migraron a TypeScript con interfaces tipadas (`IUser`, `IClient`, etc.). Los controladores y rutas se mantienen en JavaScript para no reescribir todo. El runner **tsx** carga archivos TypeScript transparentemente: cuando un archivo `.js` importa `'./Client.js'`, tsx encuentra `Client.ts` y lo transpila al vuelo.

---

## Arquitectura y estructura

La app sigue el patrón **MVC** (Modelo-Vista-Controlador), aunque sin vistas (es una API REST):

```
src/
├── config/          # Configuración centralizada (variables de entorno, Swagger)
├── controllers/     # Lógica de negocio — reciben req, llaman a models, envían res
├── middleware/      # Funciones intermedias: auth JWT, validación Zod, manejo de errores, uploads
├── models/          # Schemas de Mongoose — definen la estructura de los documentos
├── routes/          # Definen las URLs y qué middleware/controlador aplica a cada una
├── services/        # Lógica reutilizable sin estado (PDF, email, storage, socket, logger)
├── utils/           # Clases de utilidad (AppError, softDelete)
├── validators/      # Schemas Zod para validar peticiones
├── app.js           # Configura Express, middlewares, rutas
└── index.js         # Punto de entrada: conecta DB, inicia Socket.IO, arranca servidor
```

**Flujo de una petición:**
```
Request → Helmet/RateLimit → mongoSanitize → Router → requireAuth → validate(Zod) → Controller → Model → Response
                                                                                                        ↓
                                                                                               notificationService.emit()
                                                                                                        ↓
                                                                                               socketService.emitToCompany()
```

---

## Modelos de datos

```
User ──────────── Company
  │  (owner)          │
  │                   │──── Client
  │                   │──── Project ──── Client
  │                   └──── DeliveryNote ──── Client + Project
  └─────────────────────────── (user que creó cada recurso)
```

Todos los recursos (Client, Project, DeliveryNote) tienen dos campos de referencia:
- `user`: quién lo creó (para auditoría)
- `company`: a qué empresa pertenece (para aislamiento — un usuario de empresa A nunca ve datos de empresa B)

---

## Autenticación JWT

### Registro y verificación
1. `POST /api/user/register` → crea usuario con `status: 'pending'`, genera código de 6 dígitos, envía email.
2. `PUT /api/user/validation` (con Bearer token) → verifica el código; si es correcto, pone `status: 'verified'`. Tiene límite de 3 intentos.

### Login y tokens
`POST /api/user/login` → verifica email + password (bcrypt); devuelve:
- **accessToken**: válido 15 min, se envía en cada petición.
- **refreshToken**: válido 7 días, solo para renovar el access token.

### Renovar tokens
`POST /api/user/refresh` con el refreshToken → devuelve un nuevo par de tokens. Así el usuario nunca tiene que volver a hacer login si el refresh no ha caducado.

### Middleware `requireAuth`
Lee la cabecera `Authorization: Bearer <token>`, verifica la firma JWT con `JWT_ACCESS_SECRET`, busca el usuario en BD y lo pone en `req.user`. Si el token es inválido o ha caducado, responde 401.

---

## Validación con Zod

El middleware `validate(schema)` ejecuta `schema.parse({ body, query, params })` antes del controlador. Si falla, lanza un ZodError que el `error-handler` centralizado convierte en una respuesta 400 con los mensajes de error de cada campo.

**Ejemplo clave — `discriminatedUnion` en albaranes:**
```js
z.discriminatedUnion('format', [
  z.object({ format: z.literal('material'), material: z.string(), quantity: z.number(), unit: z.string(), ... }),
  z.object({ format: z.literal('hours'),   hours: z.number(), workers: z.array(...).optional(), ... })
])
```
Zod mira el campo `format` primero y aplica el schema correcto. Si llega `format: 'hours'` sin el campo `hours`, falla con "Las horas son obligatorias".

---

## Borrado lógico (Soft Delete)

En lugar de eliminar documentos de MongoDB, se marca `deleted: true`. La función `applySoftDelete(schema)` en `utils/softDelete.ts` registra un hook `pre(/^find/)` que automáticamente añade `{ deleted: { $ne: true } }` a todas las queries `find`, `findOne`, `findById`, etc. Resultado: los documentos borrados son invisibles para todas las consultas normales.

Para listar los borrados: `Model.findDeleted(filter)` (método estático añadido por el mismo helper).

Para restaurar: `PATCH /api/client/:id/restore` → pone `deleted = false`.

Ventaja: los datos nunca se pierden; se pueden recuperar o auditar.

---

## Notificaciones en tiempo real

El sistema usa dos capas:
1. **EventEmitter** (Node.js nativo): los controladores emiten eventos (`notificationService.emit('client:new', data)`) sin saber quién los escucha. Esto desacopla la lógica de negocio de la lógica de notificación.
2. **Socket.IO**: los listeners del `notificationService` llaman a `socketService.emitToCompany(companyId, evento, payload)`, que emite el evento solo a la room de esa empresa.

**Eventos emitidos:**
| Evento | Cuándo |
|--------|--------|
| `client:new` | Al crear un cliente |
| `project:new` | Al crear un proyecto |
| `deliverynote:new` | Al crear un albarán |
| `deliverynote:signed` | Al firmar un albarán |

**Autenticación WebSocket:** al conectar, el cliente envía su JWT en `socket.handshake.auth.token`. El servidor lo verifica y une el socket a `company:<companyId>`. Sin JWT válido, la conexión se rechaza.

---

## Subida de archivos y firma digital

Flujo del endpoint `PATCH /api/deliverynote/:id/sign`:

```
Petición multipart/form-data
        ↓
Multer (memory storage) → req.file.buffer
        ↓
Sharp → redimensionar a ≤800px ancho + convertir a WebP
        ↓
Cloudinary (uploadBuffer) → signatureUrl guardada en BD
        ↓
PDFKit → generar PDF del albarán con la firma incrustada
        ↓
Cloudinary (uploadBuffer) → pdfUrl guardada en BD
        ↓
Respuesta con el albarán firmado (signed: true, signedAt, signatureUrl, pdfUrl)
```

Una vez `signed: true`, el modelo bloquea cualquier modificación via hook `pre('save')`: si el documento ya estaba firmado y no se está cambiando el propio campo `signed`, lanza un error 409.

---

## Generación de PDFs

`GET /api/deliverynote/pdf/:id`:
- Si el albarán **ya está firmado** y tiene `pdfUrl`, redirige a esa URL de Cloudinary (el PDF está guardado en la nube).
- Si **no está firmado**, genera el PDF en el momento con PDFKit, y lo envía como stream con `Content-Type: application/pdf` sin guardarlo.

El PDF incluye: nombre y logo de la empresa, datos del cliente, datos del proyecto, tabla de horas o materiales, y la imagen de la firma si está firmado.

---

## Dashboard con Aggregation Pipeline

`GET /api/dashboard` ejecuta 3 queries de agregación en paralelo (`Promise.all`):

**Por mes** (`$group` sobre `workDate`):
```js
{ $group: { _id: { year: { $year: '$workDate' }, month: { $month: '$workDate' } }, totalAlbaranes: { $sum: 1 }, ... } }
```

**Por cliente** (`$group` + `$lookup`):
Agrupa albaranes por cliente, luego hace un JOIN (`$lookup`) con la colección `clients` para traer el nombre.

**Por proyecto** (igual): agrupa por proyecto y hace JOIN con `projects`.

El `$match` inicial filtra solo los albaranes de la empresa del usuario y excluye los borrados. Devuelve totales de albaranes, horas y materiales para cada agrupación.

---

## Seguridad HTTP

| Mecanismo | Qué protege |
|-----------|-------------|
| **Helmet** | 15+ cabeceras HTTP (XSS, clickjacking, MIME sniffing...) |
| **Rate Limit** | Fuerza bruta y abuso (100 req/15 min por IP) |
| **mongo-sanitize** | NoSQL Injection (elimina `$` y `.` de inputs) |
| **Zod validation** | Datos malformados llegan como 400 antes del controlador |
| **JWT** | Solo usuarios autenticados acceden a recursos protegidos |
| **Aislamiento por company** | Un usuario nunca ve recursos de otra empresa |
| **Firma bloqueante** | Un albarán firmado no puede modificarse ni borrarse |

---

## Testing

```bash
npm test              # Ejecutar todos los tests
npm run test:coverage # Tests + informe de cobertura (objetivo: ≥70%)
```

**Suites de tests:**
| Archivo | Qué prueba |
|---------|------------|
| `auth.test.js` | Registro, validación, login, refresh, cambio de password, delete, invitación |
| `client.test.js` | CRUD de clientes, paginación, filtros, soft/hard delete, restore, aislamiento |
| `project.test.js` | CRUD de proyectos, validación de cliente cruzado, filtros, archivado |
| `deliverynote.test.js` | Crear horas/materiales, firmar, PDF, bloqueos, borrado |
| `services.test.js` | Logger, mail, pdf, storage, pagination, socket |

**Configuración de tests:**
- `mongodb-memory-server` inicia un MongoDB real en RAM. Cada suite crea su propia instancia y la destruye al terminar.
- Los servicios externos (Cloudinary, Slack, SMTP, Socket.IO) están mockeados en `tests/env-setup.js`.
- Los tests usan `--experimental-vm-modules` de Node.js para compatibilidad con ESM.

---

## Variables de entorno

Ver `.env.example` para la lista completa. Las variables principales:

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto del servidor (default: 3000) |
| `MONGODB_URI` | URI de conexión a MongoDB |
| `JWT_ACCESS_SECRET` | Secreto para firmar access tokens (15 min) |
| `JWT_REFRESH_SECRET` | Secreto para firmar refresh tokens (7 días) |
| `CLOUDINARY_URL` | URL con credenciales de Cloudinary |
| `SLACK_WEBHOOK_URL` | URL del Incoming Webhook de Slack para alertas 5XX |
| `SMTP_HOST/USER/PASS` | Credenciales SMTP (Mailtrap en desarrollo) |
| `CORS_ORIGIN` | Origen permitido para CORS y Socket.IO |

---

## Instalación y desarrollo

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con valores reales

# 3. Arrancar en modo desarrollo (recarga automática)
npm run dev

# 4. Verificar que el servidor funciona
curl http://localhost:3000/health

# 5. Abrir documentación Swagger
# http://localhost:3000/api-docs
```

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Desarrollo con `node --watch` (recarga al cambiar archivos) |
| `npm start` | Producción |
| `npm test` | Tests con Jest + Supertest |
| `npm run test:coverage` | Tests con informe de cobertura |
| `npm run build` | Compilar TypeScript a `dist/` |

---

## Docker

```bash
# Levantar app + MongoDB
docker compose up --build

# Solo en background
docker compose up -d --build

# Parar
docker compose down

# Ver logs
docker compose logs -f app
```

El `Dockerfile` usa **multi-stage build**:
- **Stage `deps`**: instala solo dependencias de producción (`npm ci --omit=dev`)
- **Stage `runtime`**: imagen limpia que copia `node_modules` + `src/`, crea usuario no-root, expone puerto 3000

Resultado: imagen más pequeña (sin devDependencies, sin código de tests) y más segura (proceso no corre como root).

---

## CI/CD con GitHub Actions

El fichero `.github/workflows/test.yml` se ejecuta en cada `push` y `pull_request`:

1. Checkout del código
2. Instalar Node.js 22
3. `npm ci` (instalación limpia)
4. `npm test` (todos los tests deben pasar)

Si algún test falla, el CI bloquea el merge. MongoDB Memory Server no necesita un MongoDB externo, por lo que los tests funcionan directamente en el runner de GitHub.

---

## Endpoints

### Usuarios (`/api/user`)
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/register` | No | Registro — devuelve tokens + envía código por email |
| PUT | `/validation` | Sí | Verificar email con código de 6 dígitos |
| POST | `/login` | No | Login — devuelve access + refresh token |
| POST | `/refresh` | No | Renovar tokens con refresh token |
| PUT | `/register` | Sí | Actualizar datos personales (nombre, NIF) |
| PATCH | `/company` | Sí | Crear/actualizar empresa (freelance o empresa) |
| PATCH | `/logo` | Sí | Subir logo de empresa |
| GET | `/` | Sí | Obtener perfil del usuario autenticado |
| PUT | `/password` | Sí | Cambiar contraseña |
| DELETE | `/` | Sí | Eliminar cuenta (`?soft=true\|false`) |
| POST | `/invite` | Admin | Invitar usuario a la empresa |
| POST | `/logout` | Sí | Cerrar sesión |

### Clientes (`/api/client`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/` | Crear cliente (CIF único por empresa) |
| GET | `/` | Listar con paginación (`?page&limit&name&sort`) |
| GET | `/archived` | Listar borrados lógicamente |
| GET | `/:id` | Obtener cliente concreto |
| PUT | `/:id` | Actualizar |
| DELETE | `/:id` | Archivar o borrar (`?soft=true\|false`) |
| PATCH | `/:id/restore` | Restaurar archivado |

### Proyectos (`/api/project`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/` | Crear proyecto (código único por empresa, cliente de la misma empresa) |
| GET | `/` | Listar (`?page&limit&name&client&active&sort`) |
| GET | `/archived` | Listar archivados |
| GET | `/:id` | Obtener proyecto concreto |
| PUT | `/:id` | Actualizar |
| DELETE | `/:id` | Archivar o borrar |
| PATCH | `/:id/restore` | Restaurar |

### Albaranes (`/api/deliverynote`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/` | Crear albarán (horas o materiales) |
| GET | `/` | Listar (`?page&limit&project&client&format&signed&from&to&sort`) |
| GET | `/pdf/:id` | Descargar PDF (genera on-the-fly o desde Cloudinary si ya firmado) |
| GET | `/:id` | Obtener con populate (usuario, cliente, proyecto) |
| PATCH | `/:id/sign` | Firmar (multipart/form-data con imagen `signature`) |
| DELETE | `/:id` | Borrar (bloqueado si está firmado) |

### Otros
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado del servidor y MongoDB (sin autenticación) |
| GET | `/api/dashboard` | Estadísticas: albaranes por mes, cliente y proyecto |
| GET | `/api-docs` | Documentación Swagger interactiva |

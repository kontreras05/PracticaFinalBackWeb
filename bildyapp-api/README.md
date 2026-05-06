# BildyApp API

API REST para gestión de albaranes, clientes y proyectos. Construida con Node.js, Express, MongoDB y Socket.IO.

## Requisitos

- Node.js 22+
- MongoDB 7+
- (Opcional) Docker & Docker Compose

## Instalación

```bash
npm install
cp .env.example .env
# Edita .env con tus valores reales
```

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor en modo desarrollo con `--watch` |
| `npm start` | Servidor en producción |
| `npm test` | Tests con Jest + Supertest |
| `npm run test:coverage` | Tests con reporte de cobertura |

## Docker

```bash
docker compose up --build
```

Levanta `app` (puerto 3000) y `mongo` (puerto 27017 interno).

## Endpoints principales

- `POST /api/user/register` — Registro
- `POST /api/user/login` — Login
- `GET /health` — Estado del servidor y BD
- `GET /api-docs` — Documentación Swagger

## Variables de entorno

Ver `.env.example` para la lista completa de variables necesarias.

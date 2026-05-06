import swaggerJsdoc from 'swagger-jsdoc';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BildyApp API',
      version: '1.0.0',
      description:
        'API REST para la gestión de albaranes, clientes y proyectos. ' +
        'La mayoría de endpoints requieren autenticación JWT (Bearer token).',
      contact: { name: 'Fernando Contreras' }
    },
    servers: [{ url: 'http://localhost:3000/api', description: 'Servidor de desarrollo' }],
    tags: [
      { name: 'Auth', description: 'Registro, inicio de sesión y tokens' },
      { name: 'User', description: 'Perfil, contraseña, logo e invitaciones' },
      { name: 'Client', description: 'Gestión de clientes (CRUD + archivado)' },
      { name: 'Project', description: 'Gestión de proyectos (CRUD + archivado)' },
      { name: 'DeliveryNote', description: 'Gestión de albaranes (CRUD + firma + PDF)' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtenido en /user/register o /user/login'
        }
      },
      schemas: {
        Address: {
          type: 'object',
          properties: {
            street:   { type: 'string', example: 'Calle Mayor' },
            number:   { type: 'string', example: '10' },
            postal:   { type: 'string', example: '28001' },
            city:     { type: 'string', example: 'Madrid' },
            province: { type: 'string', example: 'Madrid' }
          }
        },
        Company: {
          type: 'object',
          properties: {
            _id:         { type: 'string', example: '664000000000000000000001' },
            name:        { type: 'string', example: 'Mi Empresa S.L.' },
            cif:         { type: 'string', example: 'B12345678' },
            address:     { $ref: '#/components/schemas/Address' },
            logo:        { type: 'string', example: 'uploads/logo.jpg' },
            isFreelance: { type: 'boolean', example: false }
          }
        },
        User: {
          type: 'object',
          properties: {
            _id:       { type: 'string', example: '664000000000000000000002' },
            email:     { type: 'string', format: 'email', example: 'usuario@ejemplo.com' },
            name:      { type: 'string', example: 'Fernando' },
            lastName:  { type: 'string', example: 'Contreras' },
            nif:       { type: 'string', example: '12345678A' },
            role:      { type: 'string', enum: ['admin', 'guest'], example: 'admin' },
            status:    { type: 'string', enum: ['pending', 'active'], example: 'active' },
            logo:      { type: 'string', example: 'uploads/user-logo.jpg' },
            deleted:   { type: 'boolean', example: false },
            company:   { $ref: '#/components/schemas/Company' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Client: {
          type: 'object',
          properties: {
            _id:       { type: 'string', example: '664000000000000000000003' },
            name:      { type: 'string', example: 'Constructora S.A.' },
            cif:       { type: 'string', example: 'A87654321' },
            email:     { type: 'string', format: 'email', example: 'info@constructora.com' },
            phone:     { type: 'string', example: '912345678' },
            address:   { $ref: '#/components/schemas/Address' },
            user:      { type: 'string', example: '664000000000000000000002' },
            company:   { type: 'string', example: '664000000000000000000001' },
            deleted:   { type: 'boolean', example: false },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Project: {
          type: 'object',
          properties: {
            _id:         { type: 'string', example: '664000000000000000000004' },
            name:        { type: 'string', example: 'Reforma Oficina Central' },
            projectCode: { type: 'string', example: 'PRJ-001' },
            address:     { $ref: '#/components/schemas/Address' },
            email:       { type: 'string', format: 'email', example: 'obra@cliente.com' },
            notes:       { type: 'string', example: 'Acceso por puerta lateral' },
            active:      { type: 'boolean', example: true },
            user:        { type: 'string', example: '664000000000000000000002' },
            company:     { type: 'string', example: '664000000000000000000001' },
            client:      { type: 'string', example: '664000000000000000000003' },
            deleted:     { type: 'boolean', example: false },
            createdAt:   { type: 'string', format: 'date-time' },
            updatedAt:   { type: 'string', format: 'date-time' }
          }
        },
        Worker: {
          type: 'object',
          properties: {
            name:  { type: 'string', example: 'Juan García' },
            hours: { type: 'number', example: 8 }
          }
        },
        DeliveryNote: {
          type: 'object',
          properties: {
            _id:          { type: 'string', example: '664000000000000000000005' },
            format:       { type: 'string', enum: ['hours', 'material'], example: 'hours' },
            description:  { type: 'string', example: 'Jornada de instalación' },
            workDate:     { type: 'string', format: 'date', example: '2024-06-15' },
            hours:        { type: 'number', example: 8, description: 'Solo para format=hours' },
            workers:      { type: 'array', items: { $ref: '#/components/schemas/Worker' } },
            material:     { type: 'string', example: 'Cemento Portland', description: 'Solo para format=material' },
            quantity:     { type: 'number', example: 50, description: 'Solo para format=material' },
            unit:         { type: 'string', example: 'kg', description: 'Solo para format=material' },
            signed:       { type: 'boolean', example: false },
            signedAt:     { type: 'string', format: 'date-time' },
            signatureUrl: { type: 'string', example: 'https://res.cloudinary.com/demo/firma.png' },
            pdfUrl:       { type: 'string', example: 'https://res.cloudinary.com/demo/albaran.pdf' },
            user:         { type: 'string', example: '664000000000000000000002' },
            company:      { type: 'string', example: '664000000000000000000001' },
            client:       { type: 'string', example: '664000000000000000000003' },
            project:      { type: 'string', example: '664000000000000000000004' },
            deleted:      { type: 'boolean', example: false },
            createdAt:    { type: 'string', format: 'date-time' },
            updatedAt:    { type: 'string', format: 'date-time' }
          }
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'success' },
            data: {
              type: 'object',
              properties: {
                items:       { type: 'array', items: { type: 'object' } },
                totalItems:  { type: 'integer', example: 42 },
                totalPages:  { type: 'integer', example: 5 },
                currentPage: { type: 'integer', example: 1 }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            status:  { type: 'string', example: 'error' },
            message: { type: 'string', example: 'Mensaje de error descriptivo' }
          }
        }
      },
      responses: {
        Unauthorized: {
          description: 'Token JWT ausente o inválido',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
        },
        Forbidden: {
          description: 'Sin permisos suficientes (se requiere rol admin)',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
        },
        NotFound: {
          description: 'Recurso no encontrado',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
        },
        ValidationError: {
          description: 'Datos de entrada inválidos',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
        },
        RateLimitError: {
          description: 'Demasiadas peticiones — espera 15 minutos',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
        },
        Conflict: {
          description: 'Conflicto con el estado actual del recurso',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
        }
      }
    }
  },
  apis: [join(__dirname, '../routes/*.js')]
};

export const spec = swaggerJsdoc(options);

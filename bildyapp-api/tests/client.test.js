import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';

let mongod;
let token; // admin token with company

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  const cols = Object.values(mongoose.connection.collections);
  await Promise.all(cols.map(c => c.deleteMany({})));

  // Create fresh admin user with company before each test
  const regRes = await request(app)
    .post('/api/user/register')
    .send({ email: 'admin@test.com', password: 'Password123!' });
  token = regRes.body.data.accessToken;

  await request(app)
    .patch('/api/user/company')
    .set('Authorization', `Bearer ${token}`)
    .send({
      isFreelance: false,
      name: 'Test Company',
      cif: 'B12345678',
      address: { street: 'Calle Test', number: '1', postal: '28001', city: 'Madrid', province: 'Madrid' },
    });
});

// ── helpers ────────────────────────────────────────────────────────────────────

const BASE = '/api/client';
const CLIENT_DATA = { name: 'Constructora S.A.', cif: 'A87654321', email: 'info@obra.com', phone: '912345678' };

async function createClient(data = CLIENT_DATA, tok = token) {
  return request(app).post(BASE).set('Authorization', `Bearer ${tok}`).send(data);
}

// ── POST /api/client ──────────────────────────────────────────────────────────

describe('POST /api/client', () => {
  it('crea un cliente correctamente (201)', async () => {
    const res = await createClient();
    expect(res.status).toBe(201);
    expect(res.body.data.client.name).toBe(CLIENT_DATA.name);
    expect(res.body.data.client.cif).toBe(CLIENT_DATA.cif);
  });

  it('rechaza CIF duplicado dentro de la misma empresa (409)', async () => {
    await createClient();
    const res = await createClient();
    expect(res.status).toBe(409);
  });

  it('permite mismo CIF en empresa diferente (201)', async () => {
    // Second company
    const regRes = await request(app)
      .post('/api/user/register')
      .send({ email: 'other@test.com', password: 'Password123!' });
    const otherToken = regRes.body.data.accessToken;
    await request(app)
      .patch('/api/user/company')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        isFreelance: false,
        name: 'Otra Empresa S.L.',
        cif: 'B99999999',
        address: { street: 'Av', number: '2', postal: '28002', city: 'Madrid', province: 'Madrid' },
      });

    await createClient(CLIENT_DATA, token);
    const res = await createClient(CLIENT_DATA, otherToken);
    expect(res.status).toBe(201);
  });

  it('rechaza sin nombre (400)', async () => {
    const res = await createClient({ cif: 'A11111111' });
    expect(res.status).toBe(400);
  });

  it('rechaza sin autenticación (401)', async () => {
    const res = await request(app).post(BASE).send(CLIENT_DATA);
    expect(res.status).toBe(401);
  });
});

// ── GET /api/client ────────────────────────────────────────────────────────────

describe('GET /api/client', () => {
  beforeEach(async () => {
    await createClient({ name: 'Alpha S.A.', cif: 'A11111111' });
    await createClient({ name: 'Beta S.L.', cif: 'B22222222' });
    await createClient({ name: 'Gamma Corp', cif: 'G33333333' });
  });

  it('lista clientes activos paginados (200)', async () => {
    const res = await request(app).get(BASE).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(3);
    expect(res.body.data.totalItems).toBe(3);
  });

  it('filtra por nombre (200)', async () => {
    const res = await request(app)
      .get(BASE)
      .set('Authorization', `Bearer ${token}`)
      .query({ name: 'alpha' });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].name).toBe('Alpha S.A.');
  });

  it('pagina correctamente (200)', async () => {
    const res = await request(app)
      .get(BASE)
      .set('Authorization', `Bearer ${token}`)
      .query({ page: 1, limit: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.totalPages).toBe(2);
    expect(res.body.data.currentPage).toBe(1);
  });

  it('rechaza sin autenticación (401)', async () => {
    const res = await request(app).get(BASE);
    expect(res.status).toBe(401);
  });
});

// ── GET /api/client/archived ───────────────────────────────────────────────────

describe('GET /api/client/archived', () => {
  it('lista solo los clientes borrados lógicamente (200)', async () => {
    const { body: { data: { client } } } = await createClient();
    await request(app)
      .delete(`${BASE}/${client._id}`)
      .set('Authorization', `Bearer ${token}`)
      .query({ soft: 'true' });

    const res = await request(app).get(`${BASE}/archived`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.clients).toHaveLength(1);
    expect(res.body.data.clients[0]._id).toBe(client._id);
  });

  it('no incluye clientes activos (200)', async () => {
    await createClient();
    const res = await request(app).get(`${BASE}/archived`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.clients).toHaveLength(0);
  });
});

// ── GET /api/client/:id ────────────────────────────────────────────────────────

describe('GET /api/client/:id', () => {
  it('devuelve el cliente por ID (200)', async () => {
    const { body: { data: { client } } } = await createClient();
    const res = await request(app)
      .get(`${BASE}/${client._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.client.cif).toBe(CLIENT_DATA.cif);
  });

  it('devuelve 404 para ID inexistente', async () => {
    const res = await request(app)
      .get(`${BASE}/000000000000000000000000`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('devuelve 404 para cliente de otra empresa (aislamiento)', async () => {
    const { body: { data: { client } } } = await createClient();

    const regRes = await request(app)
      .post('/api/user/register')
      .send({ email: 'spy@test.com', password: 'Password123!' });
    const spyToken = regRes.body.data.accessToken;
    await request(app)
      .patch('/api/user/company')
      .set('Authorization', `Bearer ${spyToken}`)
      .send({
        isFreelance: false, name: 'Spy Co', cif: 'Z00000000',
        address: { street: 'X', number: '0', postal: '11111', city: 'Sevilla', province: 'Sevilla' },
      });

    const res = await request(app)
      .get(`${BASE}/${client._id}`)
      .set('Authorization', `Bearer ${spyToken}`);
    expect(res.status).toBe(404);
  });
});

// ── PUT /api/client/:id ────────────────────────────────────────────────────────

describe('PUT /api/client/:id', () => {
  it('actualiza nombre y email del cliente (200)', async () => {
    const { body: { data: { client } } } = await createClient();
    const res = await request(app)
      .put(`${BASE}/${client._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nuevo Nombre', email: 'nuevo@empresa.com' });
    expect(res.status).toBe(200);
    expect(res.body.data.client.name).toBe('Nuevo Nombre');
  });

  it('devuelve 404 para cliente inexistente', async () => {
    const res = await request(app)
      .put(`${BASE}/000000000000000000000000`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/client/:id ────────────────────────────────────────────────────

describe('DELETE /api/client/:id', () => {
  it('borrado lógico devuelve 204 y excluye de listado activo', async () => {
    const { body: { data: { client } } } = await createClient();
    const delRes = await request(app)
      .delete(`${BASE}/${client._id}`)
      .set('Authorization', `Bearer ${token}`)
      .query({ soft: 'true' });
    expect(delRes.status).toBe(204);

    const listRes = await request(app).get(BASE).set('Authorization', `Bearer ${token}`);
    expect(listRes.body.data.items).toHaveLength(0);
  });

  it('borrado físico elimina el registro definitivamente (204)', async () => {
    const { body: { data: { client } } } = await createClient();
    const delRes = await request(app)
      .delete(`${BASE}/${client._id}`)
      .set('Authorization', `Bearer ${token}`)
      .query({ soft: 'false' });
    expect(delRes.status).toBe(204);

    const getRes = await request(app)
      .get(`${BASE}/${client._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(404);
  });

  it('devuelve 404 para cliente inexistente', async () => {
    const res = await request(app)
      .delete(`${BASE}/000000000000000000000000`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ── PATCH /api/client/:id/restore ─────────────────────────────────────────────

describe('PATCH /api/client/:id/restore', () => {
  it('restaura un cliente archivado (200)', async () => {
    const { body: { data: { client } } } = await createClient();
    await request(app)
      .delete(`${BASE}/${client._id}`)
      .set('Authorization', `Bearer ${token}`)
      .query({ soft: 'true' });

    const res = await request(app)
      .patch(`${BASE}/${client._id}/restore`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.client.deleted).toBe(false);

    const listRes = await request(app).get(BASE).set('Authorization', `Bearer ${token}`);
    expect(listRes.body.data.items).toHaveLength(1);
  });

  it('devuelve 404 si el cliente no está archivado', async () => {
    const { body: { data: { client } } } = await createClient();
    const res = await request(app)
      .patch(`${BASE}/${client._id}/restore`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';

let mongod;
let token;
let clientId; // client belonging to the test company

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

  // Admin user + company
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
      address: { street: 'Calle', number: '1', postal: '28001', city: 'Madrid', province: 'Madrid' },
    });

  // Client for this company
  const clientRes = await request(app)
    .post('/api/client')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Cliente Test', cif: 'A11111111' });
  clientId = clientRes.body.data.client._id;
});

// ── helpers ────────────────────────────────────────────────────────────────────

const BASE = '/api/project';

function projectData(overrides = {}) {
  return { name: 'Proyecto Test', projectCode: 'PRJ-001', client: clientId, ...overrides };
}

async function createProject(data, tok = token) {
  return request(app)
    .post(BASE)
    .set('Authorization', `Bearer ${tok}`)
    .send(data ?? projectData());
}

// ── POST /api/project ─────────────────────────────────────────────────────────

describe('POST /api/project', () => {
  it('crea un proyecto correctamente (201)', async () => {
    const res = await createProject();
    expect(res.status).toBe(201);
    expect(res.body.data.project.name).toBe('Proyecto Test');
    expect(res.body.data.project.projectCode).toBe('PRJ-001');
  });

  it('rechaza código de proyecto duplicado en la misma empresa (409)', async () => {
    await createProject();
    const res = await createProject(projectData({ name: 'Otro' }));
    expect(res.status).toBe(409);
  });

  it('rechaza si el cliente no pertenece a la empresa (404)', async () => {
    const res = await createProject(projectData({ client: '000000000000000000000000' }));
    expect(res.status).toBe(404);
  });

  it('rechaza sin nombre (400)', async () => {
    const res = await createProject({ projectCode: 'X', client: clientId });
    expect(res.status).toBe(400);
  });

  it('rechaza sin autenticación (401)', async () => {
    const res = await request(app).post(BASE).send(projectData());
    expect(res.status).toBe(401);
  });
});

// ── GET /api/project ──────────────────────────────────────────────────────────

describe('GET /api/project', () => {
  beforeEach(async () => {
    await createProject(projectData({ name: 'Alpha', projectCode: 'A001' }));
    await createProject(projectData({ name: 'Beta', projectCode: 'B002', active: false }));
    await createProject(projectData({ name: 'Gamma', projectCode: 'C003' }));
  });

  it('lista todos los proyectos activos (200)', async () => {
    const res = await request(app).get(BASE).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalItems).toBe(3);
  });

  it('filtra por nombre (200)', async () => {
    const res = await request(app)
      .get(BASE)
      .set('Authorization', `Bearer ${token}`)
      .query({ name: 'gamma' });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].name).toBe('Gamma');
  });

  it('filtra por cliente (200)', async () => {
    const res = await request(app)
      .get(BASE)
      .set('Authorization', `Bearer ${token}`)
      .query({ client: clientId });
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  it('pagina resultados correctamente (200)', async () => {
    const res = await request(app)
      .get(BASE)
      .set('Authorization', `Bearer ${token}`)
      .query({ page: 1, limit: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.totalPages).toBe(2);
  });
});

// ── GET /api/project/archived ─────────────────────────────────────────────────

describe('GET /api/project/archived', () => {
  it('lista solo proyectos archivados (200)', async () => {
    const { body: { data: { project } } } = await createProject();
    await request(app)
      .delete(`${BASE}/${project._id}`)
      .set('Authorization', `Bearer ${token}`)
      .query({ soft: 'true' });

    const res = await request(app).get(`${BASE}/archived`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.projects).toHaveLength(1);
  });

  it('lista vacía si no hay proyectos archivados (200)', async () => {
    await createProject();
    const res = await request(app).get(`${BASE}/archived`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.projects).toHaveLength(0);
  });
});

// ── GET /api/project/:id ──────────────────────────────────────────────────────

describe('GET /api/project/:id', () => {
  it('devuelve el proyecto con populate de cliente (200)', async () => {
    const { body: { data: { project } } } = await createProject();
    const res = await request(app)
      .get(`${BASE}/${project._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.project._id).toBe(project._id);
    expect(res.body.data.project.client).toBeDefined();
  });

  it('devuelve 404 para ID inexistente', async () => {
    const res = await request(app)
      .get(`${BASE}/000000000000000000000000`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('aislamiento: otra empresa no puede ver el proyecto (404)', async () => {
    const { body: { data: { project } } } = await createProject();

    const regRes = await request(app)
      .post('/api/user/register')
      .send({ email: 'spy@test.com', password: 'Password123!' });
    const spyToken = regRes.body.data.accessToken;
    await request(app)
      .patch('/api/user/company')
      .set('Authorization', `Bearer ${spyToken}`)
      .send({
        isFreelance: false, name: 'Spy Co', cif: 'Z00000000',
        address: { street: 'X', number: '0', postal: '11111', city: 'Barcelona', province: 'Barcelona' },
      });

    const res = await request(app)
      .get(`${BASE}/${project._id}`)
      .set('Authorization', `Bearer ${spyToken}`);
    expect(res.status).toBe(404);
  });
});

// ── PUT /api/project/:id ──────────────────────────────────────────────────────

describe('PUT /api/project/:id', () => {
  it('actualiza nombre y notas del proyecto (200)', async () => {
    const { body: { data: { project } } } = await createProject();
    const res = await request(app)
      .put(`${BASE}/${project._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Proyecto Actualizado', notes: 'Nuevas notas' });
    expect(res.status).toBe(200);
    expect(res.body.data.project.name).toBe('Proyecto Actualizado');
  });

  it('rechaza actualización con cliente de otra empresa (404)', async () => {
    const { body: { data: { project } } } = await createProject();
    const res = await request(app)
      .put(`${BASE}/${project._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ client: '000000000000000000000000' });
    expect(res.status).toBe(404);
  });

  it('devuelve 404 para proyecto inexistente', async () => {
    const res = await request(app)
      .put(`${BASE}/000000000000000000000000`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/project/:id ───────────────────────────────────────────────────

describe('DELETE /api/project/:id', () => {
  it('borrado lógico (204) — excluye de listado activo', async () => {
    const { body: { data: { project } } } = await createProject();
    const delRes = await request(app)
      .delete(`${BASE}/${project._id}`)
      .set('Authorization', `Bearer ${token}`)
      .query({ soft: 'true' });
    expect(delRes.status).toBe(204);

    const listRes = await request(app).get(BASE).set('Authorization', `Bearer ${token}`);
    expect(listRes.body.data.items).toHaveLength(0);
  });

  it('borrado físico (204)', async () => {
    const { body: { data: { project } } } = await createProject();
    const res = await request(app)
      .delete(`${BASE}/${project._id}`)
      .set('Authorization', `Bearer ${token}`)
      .query({ soft: 'false' });
    expect(res.status).toBe(204);
  });

  it('devuelve 404 para proyecto inexistente', async () => {
    const res = await request(app)
      .delete(`${BASE}/000000000000000000000000`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ── PATCH /api/project/:id/restore ───────────────────────────────────────────

describe('PATCH /api/project/:id/restore', () => {
  it('restaura un proyecto archivado (200)', async () => {
    const { body: { data: { project } } } = await createProject();
    await request(app)
      .delete(`${BASE}/${project._id}`)
      .set('Authorization', `Bearer ${token}`)
      .query({ soft: 'true' });

    const res = await request(app)
      .patch(`${BASE}/${project._id}/restore`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.project.deleted).toBe(false);
  });

  it('devuelve 404 si el proyecto no está archivado', async () => {
    const { body: { data: { project } } } = await createProject();
    const res = await request(app)
      .patch(`${BASE}/${project._id}/restore`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

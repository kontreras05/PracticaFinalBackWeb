import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';

let mongod;
let token;
let clientId;
let projectId;

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

  const clientRes = await request(app)
    .post('/api/client')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Cliente Test', cif: 'A11111111' });
  clientId = clientRes.body.data.client._id;

  const projectRes = await request(app)
    .post('/api/project')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Proyecto Test', projectCode: 'PRJ-001', client: clientId });
  projectId = projectRes.body.data.project._id;
});

const BASE = '/api/dashboard';

async function seedNotes() {
  await request(app)
    .post('/api/deliverynote')
    .set('Authorization', `Bearer ${token}`)
    .send({
      format: 'hours',
      workDate: '2024-06-15',
      description: 'Jornada de trabajo',
      client: clientId,
      project: projectId,
      hours: 8,
      workers: [{ name: 'Juan García', hours: 8 }],
    });

  await request(app)
    .post('/api/deliverynote')
    .set('Authorization', `Bearer ${token}`)
    .send({
      format: 'material',
      workDate: '2024-06-15',
      description: 'Suministro de cemento',
      client: clientId,
      project: projectId,
      material: 'Cemento Portland',
      quantity: 50,
      unit: 'kg',
    });
}

// ── GET /api/dashboard ────────────────────────────────────────────────────────

describe('GET /api/dashboard', () => {
  it('rechaza sin token (401)', async () => {
    const res = await request(app).get(BASE);
    expect(res.status).toBe(401);
  });

  it('devuelve 400 si el usuario no tiene empresa', async () => {
    const regRes = await request(app)
      .post('/api/user/register')
      .send({ email: 'nocompany@test.com', password: 'Password123!' });
    const noCompanyToken = regRes.body.data.accessToken;

    const res = await request(app)
      .get(BASE)
      .set('Authorization', `Bearer ${noCompanyToken}`);
    expect(res.status).toBe(400);
  });

  it('devuelve estructura byMonth / byClient / byProject con datos reales (200)', async () => {
    await seedNotes();

    const res = await request(app)
      .get(BASE)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    const { byMonth, byClient, byProject } = res.body.data;

    expect(Array.isArray(byMonth)).toBe(true);
    expect(Array.isArray(byClient)).toBe(true);
    expect(Array.isArray(byProject)).toBe(true);

    expect(byMonth).toHaveLength(1);
    expect(byMonth[0].totalAlbaranes).toBe(2);
    expect(byMonth[0].totalHoras).toBe(8);
    expect(byMonth[0].totalMaterial).toBe(50);

    expect(byClient).toHaveLength(1);
    expect(byClient[0].clientName).toBe('Cliente Test');

    expect(byProject).toHaveLength(1);
    expect(byProject[0].projectCode).toBe('PRJ-001');
  });

  it('devuelve arrays vacíos si no hay albaranes (200)', async () => {
    const res = await request(app)
      .get(BASE)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.byMonth).toHaveLength(0);
    expect(res.body.data.byClient).toHaveLength(0);
    expect(res.body.data.byProject).toHaveLength(0);
  });
});

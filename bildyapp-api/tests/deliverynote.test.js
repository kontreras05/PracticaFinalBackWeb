import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';

// Minimal valid PNG (1×1 pixel) for signature upload
const FAKE_SIGNATURE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

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

  // Client
  const clientRes = await request(app)
    .post('/api/client')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Cliente Test', cif: 'A11111111' });
  clientId = clientRes.body.data.client._id;

  // Project
  const projectRes = await request(app)
    .post('/api/project')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Proyecto Test', projectCode: 'PRJ-001', client: clientId });
  projectId = projectRes.body.data.project._id;
});

// ── helpers ────────────────────────────────────────────────────────────────────

const BASE = '/api/deliverynote';

function hoursNoteData(overrides = {}) {
  return {
    format: 'hours',
    workDate: '2024-06-15',
    description: 'Jornada de trabajo',
    client: clientId,
    project: projectId,
    hours: 8,
    workers: [{ name: 'Juan García', hours: 8 }],
    ...overrides,
  };
}

function materialNoteData(overrides = {}) {
  return {
    format: 'material',
    workDate: '2024-06-15',
    description: 'Suministro de cemento',
    client: clientId,
    project: projectId,
    material: 'Cemento Portland',
    quantity: 50,
    unit: 'kg',
    ...overrides,
  };
}

async function createNote(data) {
  return request(app)
    .post(BASE)
    .set('Authorization', `Bearer ${token}`)
    .send(data ?? hoursNoteData());
}

// ── POST /api/deliverynote ────────────────────────────────────────────────────

describe('POST /api/deliverynote', () => {
  it('crea albarán de horas correctamente (201)', async () => {
    const res = await createNote(hoursNoteData());
    expect(res.status).toBe(201);
    expect(res.body.data.deliveryNote.format).toBe('hours');
    expect(res.body.data.deliveryNote.hours).toBe(8);
  });

  it('crea albarán de material correctamente (201)', async () => {
    const res = await createNote(materialNoteData());
    expect(res.status).toBe(201);
    expect(res.body.data.deliveryNote.format).toBe('material');
    expect(res.body.data.deliveryNote.material).toBe('Cemento Portland');
    expect(res.body.data.deliveryNote.unit).toBe('kg');
  });

  it('rechaza si el cliente no existe en la empresa (404)', async () => {
    const res = await createNote(hoursNoteData({ client: '000000000000000000000000' }));
    expect(res.status).toBe(404);
  });

  it('rechaza si el proyecto no existe en la empresa (404)', async () => {
    const res = await createNote(hoursNoteData({ project: '000000000000000000000000' }));
    expect(res.status).toBe(404);
  });

  it('rechaza formato inválido (400)', async () => {
    const res = await createNote({ format: 'invalid', workDate: '2024-06-15', client: clientId, project: projectId });
    expect(res.status).toBe(400);
  });

  it('rechaza albarán de horas sin campo hours (400)', async () => {
    const { hours: _h, ...noHours } = hoursNoteData();
    const res = await createNote(noHours);
    expect(res.status).toBe(400);
  });

  it('rechaza albarán de material sin quantity (400)', async () => {
    const { quantity: _q, ...noQty } = materialNoteData();
    const res = await createNote(noQty);
    expect(res.status).toBe(400);
  });

  it('rechaza sin autenticación (401)', async () => {
    const res = await request(app).post(BASE).send(hoursNoteData());
    expect(res.status).toBe(401);
  });
});

// ── GET /api/deliverynote ─────────────────────────────────────────────────────

describe('GET /api/deliverynote', () => {
  beforeEach(async () => {
    await createNote(hoursNoteData());
    await createNote(materialNoteData());
  });

  it('lista todos los albaranes de la empresa (200)', async () => {
    const res = await request(app).get(BASE).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalItems).toBe(2);
  });

  it('filtra por formato (200)', async () => {
    const res = await request(app)
      .get(BASE)
      .set('Authorization', `Bearer ${token}`)
      .query({ format: 'hours' });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].format).toBe('hours');
  });

  it('filtra por proyecto (200)', async () => {
    const res = await request(app)
      .get(BASE)
      .set('Authorization', `Bearer ${token}`)
      .query({ project: projectId });
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  it('filtra por rango de fechas (200)', async () => {
    const res = await request(app)
      .get(BASE)
      .set('Authorization', `Bearer ${token}`)
      .query({ from: '2024-01-01', to: '2024-12-31' });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
  });

  it('filtra albaranes no firmados (200)', async () => {
    const res = await request(app)
      .get(BASE)
      .set('Authorization', `Bearer ${token}`)
      .query({ signed: false });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
  });

  it('pagina resultados (200)', async () => {
    const res = await request(app)
      .get(BASE)
      .set('Authorization', `Bearer ${token}`)
      .query({ page: 1, limit: 1 });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.totalPages).toBe(2);
  });
});

// ── GET /api/deliverynote/:id ─────────────────────────────────────────────────

describe('GET /api/deliverynote/:id', () => {
  it('devuelve el albarán con populate (200)', async () => {
    const { body: { data: { deliveryNote } } } = await createNote();
    const res = await request(app)
      .get(`${BASE}/${deliveryNote._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.deliveryNote._id).toBe(deliveryNote._id);
    expect(res.body.data.deliveryNote.client).toBeDefined();
    expect(res.body.data.deliveryNote.project).toBeDefined();
  });

  it('devuelve 404 para ID inexistente', async () => {
    const res = await request(app)
      .get(`${BASE}/000000000000000000000000`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ── GET /api/deliverynote/pdf/:id ─────────────────────────────────────────────

describe('GET /api/deliverynote/pdf/:id', () => {
  it('genera PDF on-the-fly para albarán no firmado (200)', async () => {
    const { body: { data: { deliveryNote } } } = await createNote();
    const res = await request(app)
      .get(`${BASE}/pdf/${deliveryNote._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
  });

  it('devuelve 404 para albarán inexistente', async () => {
    const res = await request(app)
      .get(`${BASE}/pdf/000000000000000000000000`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ── PATCH /api/deliverynote/:id/sign ─────────────────────────────────────────

describe('PATCH /api/deliverynote/:id/sign', () => {
  it('firma el albarán correctamente (200)', async () => {
    const { body: { data: { deliveryNote } } } = await createNote();
    const res = await request(app)
      .patch(`${BASE}/${deliveryNote._id}/sign`)
      .set('Authorization', `Bearer ${token}`)
      .attach('signature', FAKE_SIGNATURE, { filename: 'firma.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.data.deliveryNote.signed).toBe(true);
    expect(res.body.data.deliveryNote.signatureUrl).toMatch(/fake\.cloudinary/);
    expect(res.body.data.deliveryNote.pdfUrl).toMatch(/fake\.cloudinary/);
  });

  it('rechaza firma duplicada (409)', async () => {
    const { body: { data: { deliveryNote } } } = await createNote();
    await request(app)
      .patch(`${BASE}/${deliveryNote._id}/sign`)
      .set('Authorization', `Bearer ${token}`)
      .attach('signature', FAKE_SIGNATURE, { filename: 'firma.png', contentType: 'image/png' });
    const res = await request(app)
      .patch(`${BASE}/${deliveryNote._id}/sign`)
      .set('Authorization', `Bearer ${token}`)
      .attach('signature', FAKE_SIGNATURE, { filename: 'firma.png', contentType: 'image/png' });
    expect(res.status).toBe(409);
  });

  it('rechaza sin archivo adjunto (400)', async () => {
    const { body: { data: { deliveryNote } } } = await createNote();
    const res = await request(app)
      .patch(`${BASE}/${deliveryNote._id}/sign`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('devuelve 404 para albarán inexistente', async () => {
    const res = await request(app)
      .patch(`${BASE}/000000000000000000000000/sign`)
      .set('Authorization', `Bearer ${token}`)
      .attach('signature', FAKE_SIGNATURE, { filename: 'firma.png', contentType: 'image/png' });
    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/deliverynote/:id ──────────────────────────────────────────────

describe('DELETE /api/deliverynote/:id', () => {
  it('borrado lógico (204)', async () => {
    const { body: { data: { deliveryNote } } } = await createNote();
    const res = await request(app)
      .delete(`${BASE}/${deliveryNote._id}`)
      .set('Authorization', `Bearer ${token}`)
      .query({ soft: 'true' });
    expect(res.status).toBe(204);
  });

  it('borrado físico (204)', async () => {
    const { body: { data: { deliveryNote } } } = await createNote();
    const res = await request(app)
      .delete(`${BASE}/${deliveryNote._id}`)
      .set('Authorization', `Bearer ${token}`)
      .query({ soft: 'false' });
    expect(res.status).toBe(204);
  });

  it('bloquea el borrado de un albarán firmado (409)', async () => {
    const { body: { data: { deliveryNote } } } = await createNote();
    await request(app)
      .patch(`${BASE}/${deliveryNote._id}/sign`)
      .set('Authorization', `Bearer ${token}`)
      .attach('signature', FAKE_SIGNATURE, { filename: 'firma.png', contentType: 'image/png' });

    const res = await request(app)
      .delete(`${BASE}/${deliveryNote._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });

  it('devuelve 404 para albarán inexistente', async () => {
    const res = await request(app)
      .delete(`${BASE}/000000000000000000000000`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

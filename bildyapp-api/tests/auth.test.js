import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';

let mongod;

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
});

// ── helpers ────────────────────────────────────────────────────────────────────

const BASE = '/api/user';
const CREDS = { email: 'admin@test.com', password: 'Password123!' };

async function register(creds = CREDS) {
  return request(app).post(`${BASE}/register`).send(creds);
}

async function loginAndGetTokens(creds = CREDS) {
  const res = await register(creds);
  return res.body.data;
}

async function setupUserWithCompany(creds = CREDS) {
  const { accessToken } = await loginAndGetTokens(creds);
  await request(app)
    .put(`${BASE}/register`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name: 'Admin', lastName: 'Test', nif: '12345678A' });
  await request(app)
    .patch(`${BASE}/company`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      isFreelance: false,
      name: 'Test Company S.L.',
      cif: 'B12345678',
      address: { street: 'Calle Test', number: '1', postal: '28001', city: 'Madrid', province: 'Madrid' },
    });
  return accessToken;
}

// ── POST /api/user/register ────────────────────────────────────────────────────

describe('POST /api/user/register', () => {
  it('crea usuario y devuelve tokens (200)', async () => {
    const res = await register();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.email).toBe(CREDS.email);
  });

  it('rechaza email duplicado (409)', async () => {
    await register();
    const res = await register();
    expect(res.status).toBe(409);
  });

  it('rechaza email inválido (400)', async () => {
    const res = await register({ email: 'not-an-email', password: 'Password123!' });
    expect(res.status).toBe(400);
  });

  it('rechaza contraseña corta (400)', async () => {
    const res = await register({ email: 'short@test.com', password: '123' });
    expect(res.status).toBe(400);
  });
});

// ── POST /api/user/login ───────────────────────────────────────────────────────

describe('POST /api/user/login', () => {
  beforeEach(async () => {
    await register();
  });

  it('inicia sesión correctamente (200)', async () => {
    const res = await request(app).post(`${BASE}/login`).send(CREDS);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('rechaza contraseña incorrecta (401)', async () => {
    const res = await request(app).post(`${BASE}/login`).send({ ...CREDS, password: 'WrongPass1!' });
    expect(res.status).toBe(401);
  });

  it('rechaza email inexistente (401)', async () => {
    const res = await request(app).post(`${BASE}/login`).send({ email: 'noexiste@test.com', password: 'Password123!' });
    expect(res.status).toBe(401);
  });
});

// ── POST /api/user/refresh ────────────────────────────────────────────────────

describe('POST /api/user/refresh', () => {
  it('devuelve nuevos tokens con refresh válido (200)', async () => {
    const { refreshToken } = await loginAndGetTokens();
    const res = await request(app).post(`${BASE}/refresh`).send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  it('rechaza refresh token inválido (401)', async () => {
    const res = await request(app).post(`${BASE}/refresh`).send({ refreshToken: 'invalid.token.here' });
    expect(res.status).toBe(401);
  });

  it('rechaza petición sin token (401)', async () => {
    const res = await request(app).post(`${BASE}/refresh`).send({});
    expect(res.status).toBe(401);
  });
});

// ── PUT /api/user/validation ──────────────────────────────────────────────────

describe('PUT /api/user/validation', () => {
  it('verifica cuenta con código correcto (200)', async () => {
    const { accessToken } = await loginAndGetTokens();
    // Recuperar el código del usuario directamente de la DB
    const user = await mongoose.connection.collection('users').findOne({ email: CREDS.email });
    const code = user.verificationCode;

    const res = await request(app)
      .put(`${BASE}/validation`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  it('rechaza código incorrecto (400)', async () => {
    const { accessToken } = await loginAndGetTokens();
    const res = await request(app)
      .put(`${BASE}/validation`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: '000000' });
    expect(res.status).toBe(400);
  });

  it('rechaza petición sin token (401)', async () => {
    const res = await request(app).put(`${BASE}/validation`).send({ code: '123456' });
    expect(res.status).toBe(401);
  });
});

// ── PUT /api/user/register (datos personales) ─────────────────────────────────

describe('PUT /api/user/register (datos personales)', () => {
  it('actualiza nombre, apellidos y NIF (200)', async () => {
    const { accessToken } = await loginAndGetTokens();
    const res = await request(app)
      .put(`${BASE}/register`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Fernando', lastName: 'Contreras', nif: '12345678A' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('Fernando');
  });

  it('rechaza campos vacíos (400)', async () => {
    const { accessToken } = await loginAndGetTokens();
    const res = await request(app)
      .put(`${BASE}/register`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '', lastName: 'C', nif: 'X' });
    expect(res.status).toBe(400);
  });
});

// ── PATCH /api/user/company ───────────────────────────────────────────────────

describe('PATCH /api/user/company', () => {
  it('crea empresa correctamente (200)', async () => {
    const { accessToken } = await loginAndGetTokens();
    await request(app)
      .put(`${BASE}/register`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'A', lastName: 'B', nif: '11111111A' });

    const res = await request(app)
      .patch(`${BASE}/company`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        isFreelance: false,
        name: 'Empresa S.L.',
        cif: 'B99999999',
        address: { street: 'Calle', number: '1', postal: '28001', city: 'Madrid', province: 'Madrid' },
      });
    expect(res.status).toBe(200);
    expect(res.body.data.company.cif).toBe('B99999999');
  });

  it('registra como freelance sin datos de empresa (200)', async () => {
    const { accessToken } = await loginAndGetTokens({ email: 'free@test.com', password: 'Password123!' });
    await request(app)
      .put(`${BASE}/register`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Free', lastName: 'Lancer', nif: '99999999Z' });

    const res = await request(app)
      .patch(`${BASE}/company`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ isFreelance: true });
    expect(res.status).toBe(200);
  });
});

// ── GET /api/user/ ────────────────────────────────────────────────────────────

describe('GET /api/user/', () => {
  it('devuelve perfil del usuario autenticado (200)', async () => {
    const { accessToken } = await loginAndGetTokens();
    const res = await request(app)
      .get(`${BASE}/`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(CREDS.email);
  });

  it('rechaza sin token (401)', async () => {
    const res = await request(app).get(`${BASE}/`);
    expect(res.status).toBe(401);
  });
});

// ── PUT /api/user/password ────────────────────────────────────────────────────

describe('PUT /api/user/password', () => {
  it('cambia la contraseña y devuelve nuevos tokens (200)', async () => {
    const { accessToken } = await loginAndGetTokens();
    const res = await request(app)
      .put(`${BASE}/password`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: CREDS.password, newPassword: 'NewPassword456!' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('rechaza contraseña actual incorrecta (401)', async () => {
    const { accessToken } = await loginAndGetTokens();
    const res = await request(app)
      .put(`${BASE}/password`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'WrongPass!1', newPassword: 'NewPassword456!' });
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/user/ ─────────────────────────────────────────────────────────

describe('DELETE /api/user/', () => {
  it('borra lógicamente al usuario autenticado (204)', async () => {
    const { accessToken } = await loginAndGetTokens();
    const res = await request(app)
      .delete(`${BASE}/`)
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ soft: 'true' });
    expect(res.status).toBe(204);
  });

  it('borrado físico elimina el registro (204)', async () => {
    const { accessToken } = await loginAndGetTokens({ email: 'hard@test.com', password: 'Password123!' });
    const res = await request(app)
      .delete(`${BASE}/`)
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ soft: 'false' });
    expect(res.status).toBe(204);
  });
});

// ── POST /api/user/logout ─────────────────────────────────────────────────────

describe('POST /api/user/logout', () => {
  it('cierra sesión correctamente (200)', async () => {
    const { accessToken } = await loginAndGetTokens();
    const res = await request(app)
      .post(`${BASE}/logout`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ── POST /api/user/invite ─────────────────────────────────────────────────────

describe('POST /api/user/invite', () => {
  it('admin con empresa invita usuario correctamente (201)', async () => {
    const adminToken = await setupUserWithCompany();
    const res = await request(app)
      .post(`${BASE}/invite`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'invitado@test.com', name: 'Invitado', lastName: 'User' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('invitado@test.com');
    expect(res.body.data.user.role).toBe('guest');
  });

  it('rechaza invitación si el email ya existe (409)', async () => {
    const adminToken = await setupUserWithCompany();
    await request(app)
      .post(`${BASE}/invite`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'invitado2@test.com', name: 'A', lastName: 'B' });
    const res = await request(app)
      .post(`${BASE}/invite`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'invitado2@test.com', name: 'A', lastName: 'B' });
    expect(res.status).toBe(409);
  });

  it('rechaza sin token (401)', async () => {
    const res = await request(app)
      .post(`${BASE}/invite`)
      .send({ email: 'x@test.com', name: 'X', lastName: 'Y' });
    expect(res.status).toBe(401);
  });
});

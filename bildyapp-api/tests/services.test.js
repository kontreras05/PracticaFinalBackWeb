import { jest } from '@jest/globals';
import http from 'http';
import { logger } from '../src/services/logger.service.js';
import { socketService } from '../src/services/socket.service.js';
import { sendVerificationCode, sendInvitationCode } from '../src/services/mail.service.js';
import { generateDeliveryNotePDF } from '../src/services/pdf.service.js';
import { paginate } from '../src/services/pagination.service.js';
import { uploadBuffer } from '../src/services/storage.service.js';

// ── logger.service ────────────────────────────────────────────────────────────

describe('logger.service', () => {
  const ORIGINAL_FETCH = global.fetch;
  const ORIGINAL_WEBHOOK = process.env.SLACK_WEBHOOK_URL;

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    process.env.SLACK_WEBHOOK_URL = ORIGINAL_WEBHOOK;
    jest.restoreAllMocks();
  });

  it('info/warn/error escriben en consola', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    logger.info('hello');
    logger.warn('careful');
    logger.error('boom');
    expect(log).toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    expect(err).toHaveBeenCalled();
  });

  it('notifyError sin webhook configurado no llama a fetch', () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    jest.spyOn(console, 'error').mockImplementation(() => {});
    logger.notifyError(new Error('500 ish'), { method: 'GET', originalUrl: '/x' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('notifyError con webhook envía POST a Slack', async () => {
    // config.slack.webhookUrl is captured at import time, so we re-import after env change
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/fake';
    jest.resetModules();
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { logger: freshLogger } = await import('../src/services/logger.service.js?reload=1');
    freshLogger.notifyError(new Error('boom'), { method: 'POST', originalUrl: '/y' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://hooks.slack.com/fake');
  });
});

// ── mail.service ─────────────────────────────────────────────────────────────

describe('mail.service', () => {
  it('sendVerificationCode sin SMTP loguea en consola', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    await sendVerificationCode('a@b.com', '123456');
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('sendInvitationCode sin SMTP loguea en consola', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    await sendInvitationCode('a@b.com', 'Ana', '654321');
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

// ── pdf.service ──────────────────────────────────────────────────────────────

describe('pdf.service', () => {
  it('generateDeliveryNotePDF devuelve un Buffer en NODE_ENV=test', async () => {
    const buf = await generateDeliveryNotePDF({});
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.toString('utf8').startsWith('%PDF')).toBe(true);
  });
});

// ── storage.service ──────────────────────────────────────────────────────────

describe('storage.service', () => {
  it('uploadBuffer devuelve URL fake en NODE_ENV=test', async () => {
    const url = await uploadBuffer(Buffer.from('x'), 'signatures/abc', 'image/png');
    expect(url).toMatch(/fake\.cloudinary/);
    expect(url).toMatch(/signatures\/abc/);
  });
});

// ── pagination.service ──────────────────────────────────────────────────────

describe('pagination.service', () => {
  it('aplica defaults y devuelve estructura paginada', async () => {
    const fakeDocs = [{ _id: '1' }, { _id: '2' }];
    const fakeQuery = {
      sort() { return this; },
      skip() { return this; },
      limit() { return this; },
      populate() { return this; },
      exec() { return Promise.resolve(fakeDocs); },
    };
    const fakeModel = {
      find: jest.fn(() => fakeQuery),
      countDocuments: jest.fn(() => Promise.resolve(2)),
    };
    const result = await paginate(fakeModel, { foo: 'bar' }, {});
    expect(result.totalItems).toBe(2);
    expect(result.totalPages).toBe(1);
    expect(result.currentPage).toBe(1);
    expect(result.items).toEqual(fakeDocs);
    expect(fakeModel.find).toHaveBeenCalledWith({ foo: 'bar' });
  });
});

// ── socket.service ──────────────────────────────────────────────────────────

describe('socket.service', () => {
  it('init monta Socket.IO sobre un httpServer y close() lo cierra', async () => {
    const httpServer = http.createServer();
    const io = socketService.init(httpServer);
    expect(io).toBeDefined();
    // emitToCompany no debe lanzar aunque no haya clientes
    expect(() => socketService.emitToCompany('abc', 'evt', { ok: true })).not.toThrow();
    await socketService.close();
  });

  it('emitToCompany sin init no hace nada', () => {
    // close() ya puso io en null en el test anterior — pero por seguridad lo invocamos
    expect(() => socketService.emitToCompany('xyz', 'evt', {})).not.toThrow();
  });
});

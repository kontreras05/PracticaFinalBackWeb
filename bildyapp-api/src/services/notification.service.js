import { EventEmitter } from 'events';
import { socketService } from './socket.service.js';

class NotificationService extends EventEmitter {}

export const notificationService = new NotificationService();

// ── Usuarios ──────────────────────────────────────────────────────────────────

notificationService.on('user:registered', (data) => {
  console.log(`[EVENT: user:registered] Usuario registrado. Email: ${data.email}`);
});

notificationService.on('user:verified', (data) => {
  console.log(`[EVENT: user:verified] Email verificado para: ${data.email}`);
});

notificationService.on('user:invited', (data) => {
  console.log(`[EVENT: user:invited] Usuario invitado: ${data.email} — empresa: ${data.company}`);
});

notificationService.on('user:deleted', (data) => {
  console.log(`[EVENT: user:deleted] Cuenta eliminada para: ${data.email}`);
});

// ── Clientes ──────────────────────────────────────────────────────────────────

notificationService.on('client:new', (data) => {
  console.log(`[EVENT: client:new] Nuevo cliente "${data.name}" (empresa: ${data.companyId})`);
  socketService.emitToCompany(data.companyId, 'client:new', data);
});

// ── Proyectos ─────────────────────────────────────────────────────────────────

notificationService.on('project:new', (data) => {
  console.log(`[EVENT: project:new] Nuevo proyecto "${data.name}" (empresa: ${data.companyId})`);
  socketService.emitToCompany(data.companyId, 'project:new', data);
});

// ── Albaranes ─────────────────────────────────────────────────────────────────

notificationService.on('deliverynote:new', (data) => {
  console.log(`[EVENT: deliverynote:new] Nuevo albarán ID: ${data.id} (empresa: ${data.companyId})`);
  socketService.emitToCompany(data.companyId, 'deliverynote:new', data);
});

notificationService.on('deliverynote:signed', (data) => {
  console.log(`[EVENT: deliverynote:signed] Albarán firmado ID: ${data.id} (empresa: ${data.companyId})`);
  socketService.emitToCompany(data.companyId, 'deliverynote:signed', data);
});

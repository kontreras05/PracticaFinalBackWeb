import { EventEmitter } from 'events';

class NotificationService extends EventEmitter {}

export const notificationService = new NotificationService();

// Listener de registro de usuario
notificationService.on('user:registered', (data) => {
  console.log(`[EVENT: user:registered] Usuario registrado exitosamente. Email: ${data.email}`);
});

// Listener de verificación del email
notificationService.on('user:verified', (data) => {
  console.log(`[EVENT: user:verified] Email verificado para el usuario: ${data.email}`);
});

// Listener para invitaciones a compañeros
notificationService.on('user:invited', (data) => {
  console.log(`[EVENT: user:invited] Usuario invitado: ${data.email} vinculado a la empresa ID: ${data.company}`);
});

// Listener para eliminación del usuario
notificationService.on('user:deleted', (data) => {
  console.log(`[EVENT: user:deleted] Cuenta eliminada lógicamente para el usuario: ${data.email}`);
});

import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

let io = null;

export const socketService = {
  /**
   * Initialises Socket.IO on top of an existing http.Server.
   * Must be called once from index.js before httpServer.listen().
   */
  init(httpServer) {
    io = new Server(httpServer, {
      cors: { origin: config.cors.origin },
    });

    io.use((socket, next) => {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Token requerido'));
      try {
        const payload = jwt.verify(token, config.jwt.accessSecret);
        socket.userId = payload.id;
        socket.companyId = String(payload.companyId ?? '');
        next();
      } catch {
        next(new Error('Token inválido'));
      }
    });

    io.on('connection', (socket) => {
      if (socket.companyId) {
        socket.join(`company:${socket.companyId}`);
      }
      console.log(`[SOCKET] Conectado: ${socket.id} (usuario: ${socket.userId})`);

      socket.on('disconnect', () => {
        console.log(`[SOCKET] Desconectado: ${socket.id}`);
      });
    });

    return io;
  },

  emitToCompany(companyId, event, payload) {
    if (!io) return;
    io.to(`company:${String(companyId)}`).emit(event, payload);
  },

  close() {
    return new Promise((resolve) => {
      if (!io) return resolve();
      io.close(() => resolve());
    });
  },
};

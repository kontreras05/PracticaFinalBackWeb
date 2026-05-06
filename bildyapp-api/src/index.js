import http from 'http';
import mongoose from 'mongoose';
import app from './app.js';
import { config } from './config/index.js';
import { socketService } from './services/socket.service.js';

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

const httpServer = http.createServer(app);
socketService.init(httpServer);

mongoose
  .connect(config.db.uri)
  .then(() => console.log('Conexión a la base de datos establecida con éxito'))
  .catch((err) => {
    console.error('Error al conectar a la base de datos', err);
    process.exit(1);
  });

httpServer.listen(config.port, () => {
  console.log(`Servidor corriendo en el puerto ${config.port} en entorno de ${config.env}...`);
});

const gracefulShutdown = (signal) => {
  console.log(`\n[${signal}] Iniciando cierre ordenado...`);
  const forceExit = setTimeout(() => {
    console.log('Timeout de cierre alcanzado. Forzando salida.');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  httpServer.close(async () => {
    console.log('Servidor HTTP cerrado.');
    await socketService.close();
    console.log('Socket.IO cerrado.');
    await mongoose.disconnect();
    console.log('MongoDB desconectado. Saliendo.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! Shutting down...');
  console.log(err.name, err.message);
  gracefulShutdown('unhandledRejection');
});

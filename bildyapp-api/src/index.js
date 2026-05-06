/**
 * Punto de arranque del servidor Node.js.
 * Conecta con la base de datos y lanza el listener de Express.
 */
import mongoose from 'mongoose';
import app from './app.js';
import { config } from './config/index.js';

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

// Conexión a la base de datos
mongoose
  .connect(config.db.uri)
  .then(() => console.log('Conexión a la base de datos establecida con éxito'))
  .catch((err) => {
    console.error('Error al conectar a la base de datos', err);
    process.exit(1);
  });

const server = app.listen(config.port, () => {
  console.log(`Servidor corriendo en el puerto ${config.port} en entorno de ${config.env}...`);
});

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

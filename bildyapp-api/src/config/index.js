/**
 * Variables de entorno y configuración centralizada
 */
export const config = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  db: {
    uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bildyapp_dev'
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'secret_access_fallback',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'secret_refresh_fallback',
    accessExpires: '15m',
    refreshExpires: '7d'
  }
};

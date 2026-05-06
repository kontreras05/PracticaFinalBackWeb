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
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*'
  },
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL || ''
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'BildyApp <no-reply@bildyapp.com>'
  },
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'cloudinary',
    cloudinaryUrl: process.env.CLOUDINARY_URL || ''
  }
};

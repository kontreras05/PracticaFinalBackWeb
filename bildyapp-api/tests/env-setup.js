// Runs before each test file's module is loaded — sets env vars consumed by config/index.js
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-must-be-32chars-long!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-must-be-32chars-long!';
process.env.PORT = '0';
// MONGODB_URI will be overridden per-test by MongoMemoryServer
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/bildyapp_test_placeholder';
// Disable external services in tests
process.env.SLACK_WEBHOOK_URL = '';
process.env.SMTP_HOST = '';
process.env.CLOUDINARY_URL = '';

export default {
  testEnvironment: 'node',
  transform: {},
  setupFiles: ['./tests/env-setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/index.js',
  ],
  coverageThreshold: {
    global: { lines: 70, branches: 50, functions: 70, statements: 70 },
  },
  testTimeout: 30000,
};

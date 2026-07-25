module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/db.js'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/migrations/'
  ],
  testTimeout: 10000,
  verbose: true
};

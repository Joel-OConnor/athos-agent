/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  clearMocks: true,
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'CommonJS', noEmit: false } }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/index.ts', // barrels
    '!src/cli.ts', // one process.argv read and a print; exercised by `npm run case`
  ],
  coverageThreshold: {
    global: { statements: 95, branches: 85, functions: 95, lines: 95 },
  },
};

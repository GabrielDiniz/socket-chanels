// jest.backend.config.ts — Config Jest backend only (node, no coverage or ignore test files to avoid instrumentation conflict)

import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: false,
  collectCoverage: true,
  coverageDirectory: 'coverage-backend',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageProvider: 'v8',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.next/', 'test-utils.ts'],
  testMatch: [
    '<rootDir>/src/server/**/__tests__/**/*.ts',
    '<rootDir>/src/server/**/?(*.)+(spec|test).ts',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.jest.json',
    }],
  },
};

export default config;
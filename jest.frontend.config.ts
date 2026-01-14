// jest.frontend.config.ts — Config Jest frontend only (jsdom, coverage true, ignore test files instrumentation conflict)

import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  verbose: false,
  collectCoverage: true,
  coverageDirectory: 'coverage-frontend',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageProvider: 'v8',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.next/', 'test-utils.ts'],
  testMatch: [
    '<rootDir>/src/hooks/**/__tests__/**/*.tsx',
    '<rootDir>/src/app/**/?(*.)+(spec|test).tsx',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.jest.json',
    }],
  },
};

export default config;
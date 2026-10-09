/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.(ts|tsx)'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          target: 'ES2022',
          types: ['jest', 'node'],
          rootDir: '.',
          isolatedModules: true,
        },
      },
    ],
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  collectCoverageFrom: [
    'services/groundReportService.ts',
    'services/offlineQueueService.ts',
    'services/photoUploadService.ts',
    'services/offlineSyncManager.ts',
    'constants/reportPermissions.ts',
    'constants/observationTypes.ts',
  ],
};

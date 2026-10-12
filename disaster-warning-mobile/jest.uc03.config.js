const base = require('./jest.config');

module.exports = {
  ...base,
  testMatch: ['**/__tests__/uc03/**/*.test.ts'],
  collectCoverageFrom: [
    'services/shelterService.ts',
    'services/rescueTeamService.ts',
    'services/reliefSupplyService.ts',
    'services/resourceAuthorization.ts',
    'constants/resourcePermissions.ts',
    'utils/resourceValidation.ts',
    'utils/resourceOverview.ts',
    'utils/rescueTeamDirectory.ts',
    'utils/shelterDirectory.ts',
  ],
  coverageDirectory: '.expo/uc03-coverage',
  coverageReporters: ['text', 'json-summary', 'html'],
  coverageThreshold: { global: { statements: 90, branches: 80, functions: 90, lines: 90 } },
};

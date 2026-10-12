const base = require('./jest.config');
module.exports = {
  ...base,
  testMatch: ['**/__tests__/uc04/**/*.test.ts'],
  collectCoverageFrom: [
    'services/postEventReportService.ts',
    'services/postEventFileService.ts',
    'services/workflowAuthorization.ts',
    'utils/postEventMetrics.ts',
    'utils/postEventExport.ts',
  ],
  coverageDirectory: 'coverage/uc04',
};

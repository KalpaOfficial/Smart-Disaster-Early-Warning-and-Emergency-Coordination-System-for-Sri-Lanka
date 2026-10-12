const base = require('./jest.config');
module.exports = {
  ...base,
  testMatch: ['**/__tests__/uc01/**/*.test.ts', '**/__tests__/uc02/**/*.test.ts'],
  collectCoverageFrom: [
    'services/warningService.ts',
    'services/hazardEventService.ts',
    'services/recipientService.ts',
    'services/deliveryService.ts',
    'services/workflowAuthorization.ts',
    'services/groundReportService.ts',
    'services/offlineQueueService.ts',
    'services/offlineSyncManager.ts',
    'services/photoUploadService.ts',
    'services/reportLocationService.ts',
    'services/reportNotificationService.ts',
    'utils/reportForm.ts',
    'utils/hazardEventForm.ts',
    'utils/warningValidation.ts',
    'constants/reportPermissions.ts',
  ],
  coverageDirectory: 'coverage/uc0102',
};

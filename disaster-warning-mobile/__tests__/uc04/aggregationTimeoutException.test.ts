import { generatePostEventReport } from '@/services/postEventReportService';
import { getDocs, addDoc } from 'firebase/firestore';
import { event, setupReporting } from './fixtures';
it('preserves successful metrics when another source fails', async () => {
  setupReporting();
  (getDocs as jest.Mock).mockRejectedValueOnce(new Error('Warning source unavailable'));
  const report = await generatePostEventReport(
    event,
    { selectedMetrics: ['alert_timeline', 'resource_distribution'] },
    'dmc'
  );
  expect(report.overallStatus).toBe('PARTIAL_SUCCESS');
  expect(report.failedMetrics).toEqual(['alert_timeline']);
  expect(report.metrics.alerts).toBe('Incomplete/Timeout');
});
it('times out pending reads and refuses an entirely failed report', async () => {
  setupReporting();
  jest.useFakeTimers();
  try {
    (getDocs as jest.Mock).mockImplementation(() => new Promise(() => {}));
    const pending = generatePostEventReport(event, { selectedMetrics: ['alert_timeline'] }, 'dmc');
    const assertion = expect(pending).rejects.toThrow('Report generation failed');
    await jest.advanceTimersByTimeAsync(15000);
    await assertion;
    expect(addDoc).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

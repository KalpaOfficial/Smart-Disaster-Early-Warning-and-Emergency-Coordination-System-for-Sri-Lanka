import { Platform } from 'react-native';
import { saveReportFile } from '@/services/postEventFileService';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: 'cache' } }));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));
const artifact = {
  fileName: 'response.csv',
  format: 'csv' as const,
  mimeType: 'text/csv',
  base64: btoa('actual file bytes'),
};
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
afterEach(() => {
  jest.restoreAllMocks();
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
  else Reflect.deleteProperty(globalThis, 'document');
  jest.useRealTimers();
});
it('downloads actual bytes in the browser and releases the object URL', async () => {
  jest.useFakeTimers();
  const anchor = { href: '', download: '', click: jest.fn(), remove: jest.fn() };
  Object.assign(globalThis, {
    document: { createElement: () => anchor, body: { appendChild: jest.fn() } },
  });
  const create = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:download');
  const revoke = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  await saveReportFile(artifact);
  expect(anchor.download).toBe('response.csv');
  expect(anchor.click).toHaveBeenCalledTimes(1);
  expect(await (create.mock.calls[0][0] as Blob).text()).toBe('actual file bytes');
  await jest.advanceTimersByTimeAsync(1000);
  expect(revoke).toHaveBeenCalledWith('blob:download');
});
it('writes the native file and opens the file share sheet with its MIME type', async () => {
  Object.assign(Platform, { OS: 'android' });
  const file = { uri: 'file:///response.csv', create: jest.fn(), write: jest.fn() };
  (File as unknown as jest.Mock).mockImplementation(() => file);
  await saveReportFile(artifact);
  expect(file.write).toHaveBeenCalledWith(new TextEncoder().encode('actual file bytes'));
  expect(Sharing.shareAsync).toHaveBeenCalledWith(
    file.uri,
    expect.objectContaining({ mimeType: 'text/csv' })
  );
});
it('shows an actionable error when native sharing is unavailable', async () => {
  Object.assign(Platform, { OS: 'ios' });
  (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
  await expect(saveReportFile(artifact)).rejects.toThrow('unavailable');
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
});

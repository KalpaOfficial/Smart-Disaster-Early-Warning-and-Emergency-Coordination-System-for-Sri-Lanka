import {
  uploadGroundReportPhoto,
  deleteGroundReportPhoto,
} from '@/services/photoUploadService';

describe('UC02: Photo Upload Service', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Mock global fetch for local URI conversion to blob
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      blob: async () => ({ size: 1024, type: 'image/jpeg' }),
    })) as unknown as typeof fetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('uploads a local photograph and returns photoUrl and storage photoPath', async () => {
    const result = await uploadGroundReportPhoto(
      'file:///data/user/0/cache/photo-abc.jpg',
      'report-temp-123',
    );

    expect(result).toBeDefined();
    expect(result.photoUrl).toBe('https://mockstorage.firebase/report.jpg');
    expect(result.photoPath).toContain('ground-reports/report-temp-123/evidence_');
    expect(result.photoPath).toMatch(/\.jpg$/);
  });

  it('throws an error if no photograph URI is provided', async () => {
    await expect(uploadGroundReportPhoto('', 'report-123')).rejects.toThrow(
      'No photograph URI was provided for upload.',
    );
  });

  it('handles local file read errors gracefully', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      status: 404,
    })) as unknown as typeof fetch;

    await expect(
      uploadGroundReportPhoto('file:///invalid/path.jpg', 'report-123'),
    ).rejects.toThrow(/Failed to read photograph from local device storage/);
  });

  it('safely attempts deletion of an uploaded photograph without crashing on missing path', async () => {
    await expect(deleteGroundReportPhoto('')).resolves.toBeUndefined();
    await expect(
      deleteGroundReportPhoto('ground-reports/report_123/evidence_123.jpg'),
    ).resolves.toBeUndefined();
  });
});

import { addDoc, getDoc } from 'firebase/firestore';
import { submitGroundReport, getReportById } from '@/services/groundReportService';
import {
  clearOfflineQueue,
  queueOfflineReport,
  syncSingleQueuedReport,
} from '@/services/offlineQueueService';
import { uploadGroundReportPhoto } from '@/services/photoUploadService';
import { validateReportForm } from '@/utils/reportForm';
import type { CreateGroundReportData } from '@/types/groundReport';
jest.mock('@/services/photoUploadService', () => ({
  uploadGroundReportPhoto: jest.fn(async (uri: string, id: string) => ({
    photoUrl: 'https://photos/' + uri,
    photoPath: id,
  })),
}));
const actor = { id: 'citizen-photos', fullName: 'Test Citizen', role: 'citizen' as const };
const data: CreateGroundReportData = {
  observationType: 'blocked_road',
  description: 'Fallen tree is blocking the main road.',
  photoUri: 'photo-1',
  photoUris: ['photo-1', 'photo-2', 'photo-3'],
  location: { latitude: 6.9, longitude: 79.9 },
  locationName: 'Main road',
  district: 'Colombo',
  isManualLocation: false,
  captureTime: '2026-10-11T10:00:00Z',
};
beforeEach(async () => {
  await clearOfflineQueue();
  jest.clearAllMocks();
});
it('saves all photos and keeps the first photo for existing report cards', async () => {
  const photos = data.photoUris!.map((uri, index) => ({
    photoUrl: 'https://photos/' + uri,
    photoPath: 'path-' + index,
  }));
  const result = await submitGroundReport(
    data,
    photos[0].photoUrl,
    photos[0].photoPath,
    actor,
    photos
  );
  expect(addDoc).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      photoUrl: photos[0].photoUrl,
      photoUrls: photos.map(p => p.photoUrl),
      photoPaths: photos.map(p => p.photoPath),
    })
  );
  (getDoc as jest.Mock).mockResolvedValueOnce({
    id: result.id,
    exists: () => true,
    data: () => (addDoc as jest.Mock).mock.calls[0][1],
  });
  const report = await getReportById(result.id);
  expect(report?.photoUrls).toHaveLength(3);
});
it('retains every photo through offline saving and synchronization', async () => {
  const queued = await queueOfflineReport(data, actor);
  expect(queued.localPhotoUris).toEqual(data.photoUris);
  expect((await syncSingleQueuedReport(queued)).success).toBe(true);
  expect(uploadGroundReportPhoto).toHaveBeenCalledTimes(3);
  expect(addDoc).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ photoUrls: data.photoUris!.map(uri => 'https://photos/' + uri) })
  );
});
it('syncs old single-photo queued reports', async () => {
  const queued = await queueOfflineReport({ ...data, photoUris: undefined }, actor);
  delete queued.localPhotoUris;
  expect((await syncSingleQueuedReport(queued)).success).toBe(true);
  expect(uploadGroundReportPhoto).toHaveBeenCalledTimes(1);
});
it('validates the five-photo maximum before saving', async () => {
  const tooMany = { ...data, photoUris: Array(6).fill('photo') };
  expect(validateReportForm(tooMany, true).photo).toBeDefined();
  await expect(submitGroundReport(tooMany, 'photo', 'path', actor)).rejects.toThrow(
    'between 1 and 5'
  );
});
it('counts both the cover photo and gallery copy against the Firestore document size limit', async () => {
  await expect(
    submitGroundReport(data, 'data:image/jpeg;base64,' + 'a'.repeat(500000), 'path', actor, [
      { photoUrl: 'data:image/jpeg;base64,' + 'a'.repeat(500000), photoPath: 'path' },
    ])
  ).rejects.toThrow('too large');
  expect(addDoc).not.toHaveBeenCalled();
});

/**
 * Jest Global Test Environment Setup for UC02 Ground Report.
 * Mocks React Native native modules, AsyncStorage, NetInfo, and Firebase services.
 */

// In-Memory AsyncStorage Mock
const asyncStorageStore: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => asyncStorageStore[key] ?? null),
  setItem: jest.fn(async (key: string, val: string) => {
    asyncStorageStore[key] = val;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete asyncStorageStore[key];
  }),
  clear: jest.fn(async () => {
    Object.keys(asyncStorageStore).forEach((k) => delete asyncStorageStore[k]);
  }),
  getAllKeys: jest.fn(async () => Object.keys(asyncStorageStore)),
}));

// NetInfo Mock
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
  addEventListener: jest.fn(() => jest.fn()),
}));

// Expo FileSystem Mock
jest.mock(
  'expo-file-system',
  () => ({
    getInfoAsync: jest.fn(async (uri: string) => ({
      exists: true,
      size: 1024 * 500, // 500KB
      uri,
    })),
    deleteAsync: jest.fn(async () => {}),
  }),
  { virtual: true },
);

// Expo ImageManipulator Mock
jest.mock(
  'expo-image-manipulator',
  () => ({
    manipulateAsync: jest.fn(async (uri: string) => ({
      uri: `${uri}-compressed.jpg`,
      width: 1200,
      height: 900,
    })),
    SaveFormat: {
      JPEG: 'jpeg',
      PNG: 'png',
    },
  }),
  { virtual: true },
);

// Firebase Services Mock
jest.mock('@/services/firebase', () => ({
  app: {},
  auth: {},
  db: {},
  storage: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  doc: jest.fn(() => ({})),
  getDoc: jest.fn(async () => ({ exists: () => false, data: () => null })),
  getDocs: jest.fn(async () => ({ docs: [] })),
  addDoc: jest.fn(async () => ({ id: 'mock-doc-id-123' })),
  updateDoc: jest.fn(async () => {}),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  serverTimestamp: jest.fn(() => '2026-10-09T08:00:00.000Z'),
  arrayUnion: jest.fn((...args: unknown[]) => args),
  onSnapshot: jest.fn((_q: unknown, callback: (snap: { docs: unknown[] }) => void) => {
    callback({ docs: [] });
    return jest.fn();
  }),
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn(() => ({})),
  uploadBytes: jest.fn(async (storageRef: unknown) => ({ ref: storageRef })),
  getDownloadURL: jest.fn(async () => 'https://mockstorage.firebase/report.jpg'),
  deleteObject: jest.fn(async () => {}),
}));

// Global fetch mock for image blob conversions
globalThis.fetch = jest.fn(async () => ({
  ok: true,
  status: 200,
  blob: async () => ({ size: 1024, type: 'image/jpeg' }),
})) as unknown as typeof fetch;

// Clean storage between tests
beforeEach(() => {
  Object.keys(asyncStorageStore).forEach((k) => delete asyncStorageStore[k]);
  jest.clearAllMocks();
});

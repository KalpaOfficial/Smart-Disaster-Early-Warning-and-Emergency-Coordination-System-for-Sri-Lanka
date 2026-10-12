import type { uploadGroundReportPhoto as Upload } from '@/services/photoUploadService';

const globalKeys = ['window', 'document', 'FileReader'] as const;
const globals = globalKeys.map(
  key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const
);
const compressed = 'data:image/jpeg;base64,valid-compressed-evidence';
let upload: typeof Upload;
let imageFails: boolean;
let dimensions: { width: number; height: number };
let readerResult: unknown;
let readerFails: boolean;
let canvas: {
  width: number;
  height: number;
  getContext: jest.Mock;
  toDataURL: jest.Mock;
};
let drawImage: jest.Mock;
let createUrl: jest.SpyInstance;
let revokeUrl: jest.SpyInstance;

beforeEach(() => {
  imageFails = false;
  readerFails = false;
  readerResult = compressed;
  dimensions = { width: 1600, height: 1200 };
  drawImage = jest.fn();
  canvas = {
    width: 0,
    height: 0,
    getContext: jest.fn(() => ({ drawImage })),
    toDataURL: jest.fn(() => compressed),
  };
  class PreviewImage {
    get width() {
      return dimensions.width;
    }
    get height() {
      return dimensions.height;
    }
    onload?: () => void;
    onerror?: () => void;
    set src(_value: string) {
      queueMicrotask(() => {
        if (imageFails) this.onerror?.();
        else this.onload?.();
      });
    }
  }
  class PreviewReader {
    result: unknown;
    onloadend?: () => void;
    onerror?: () => void;
    readAsDataURL() {
      queueMicrotask(() => {
        this.result = readerResult;
        if (readerFails) this.onerror?.();
        else this.onloadend?.();
      });
    }
  }
  Object.assign(globalThis, {
    window: { Image: PreviewImage },
    document: { createElement: () => canvas },
    FileReader: PreviewReader,
  });
  createUrl = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
  revokeUrl = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  (globalThis.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    blob: async () => new Blob(['evidence']),
  });
  jest.isolateModules(() => {
    upload = jest.requireActual('@/services/photoUploadService').uploadGroundReportPhoto;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  for (const [key, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

it('compresses a landscape photo while preserving aspect ratio and avoids fetching data URLs', async () => {
  const result = await upload(compressed, 'report / 1');
  expect(result.photoUrl).toBe(compressed);
  expect(result.photoPath).toMatch(/^web-local\/report___1\/evidence_\d+\.jpg$/);
  expect(canvas.width).toBe(800);
  expect(canvas.height).toBe(600);
  expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 800, 600);
  expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.6);
  expect(fetch).not.toHaveBeenCalled();
});

it.each([
  [600, 1800, 267, 800],
  [320, 240, 320, 240],
  [0, 0, 1, 1],
])('sizes %s x %s evidence safely', async (width, height, expectedWidth, expectedHeight) => {
  dimensions = { width, height };
  await upload(compressed, 'report');
  expect(canvas.width).toBe(expectedWidth);
  expect(canvas.height).toBe(expectedHeight);
});

it('converts fetched blob evidence to a durable URL and releases its preview URL', async () => {
  const result = await upload('blob:camera-session', 'report');
  expect(fetch).toHaveBeenCalledWith('blob:camera-session');
  expect(result.photoUrl).toBe(compressed);
  expect(createUrl).toHaveBeenCalledWith(expect.any(Blob));
  expect(revokeUrl).toHaveBeenCalledTimes(1);
  expect(revokeUrl).toHaveBeenCalledWith('blob:preview');
});

it('rejects expired blob URLs instead of fabricating evidence', async () => {
  (globalThis.fetch as jest.Mock).mockRejectedValueOnce(new Error('Blob expired'));
  await expect(upload('blob:expired-session', 'report')).rejects.toThrow(
    'Failed to read photograph'
  );
  expect(createUrl).not.toHaveBeenCalled();
});

it('rejects unreadable image data', async () => {
  imageFails = true;
  await expect(upload(compressed, 'report')).rejects.toThrow('Could not read the photograph');
});

it('releases the preview URL when decoding a blob fails', async () => {
  imageFails = true;
  await expect(upload('blob:corrupt', 'report')).rejects.toThrow('Could not read the photograph');
  expect(revokeUrl).toHaveBeenCalledWith('blob:preview');
});

it.each(['draw', 'encode'])(
  'rejects asynchronous canvas %s failures instead of leaving upload pending',
  async failure => {
    if (failure === 'draw')
      drawImage.mockImplementation(() => {
        throw new Error('Canvas failed');
      });
    else
      canvas.toDataURL.mockImplementation(() => {
        throw new Error('Canvas failed');
      });
    await expect(upload('blob:camera', 'report')).rejects.toThrow(
      'Could not process the photograph'
    );
    expect(revokeUrl).toHaveBeenCalledTimes(1);
  }
);

it('keeps a safe data URL when canvas rendering is unavailable', async () => {
  canvas.getContext.mockReturnValue(null);
  expect((await upload(compressed, 'report')).photoUrl).toBe(compressed);
});

it('uses FileReader to preserve blob evidence when canvas rendering is unavailable', async () => {
  canvas.getContext.mockReturnValue(null);
  expect((await upload('blob:camera', 'report')).photoUrl).toBe(compressed);
});

it.each(['missing', 'error', 'invalid', 'oversized'])(
  'rejects unsafe FileReader fallback: %s',
  async failure => {
    canvas.getContext.mockReturnValue(null);
    if (failure === 'missing') Reflect.deleteProperty(globalThis, 'FileReader');
    if (failure === 'error') readerFails = true;
    if (failure === 'invalid') readerResult = null;
    if (failure === 'oversized') readerResult = 'data:image/jpeg;base64,' + 'a'.repeat(800001);
    await expect(upload('blob:camera', 'report')).rejects.toThrow(/photograph/i);
  }
);

it('rejects oversized uncompressed data URLs', async () => {
  canvas.getContext.mockReturnValue(null);
  await expect(upload('data:image/jpeg;base64,' + 'a'.repeat(800001), 'report')).rejects.toThrow(
    'too large'
  );
});

it('rejects oversized canvas output', async () => {
  canvas.toDataURL.mockReturnValue('data:image/jpeg;base64,' + 'a'.repeat(800001));
  await expect(upload(compressed, 'report')).rejects.toThrow('too large');
});

it('rejects empty canvas output for a fetched photo', async () => {
  canvas.toDataURL.mockReturnValue('');
  await expect(upload('blob:camera', 'report')).rejects.toThrow('could not be read');
});

it('preserves evidence through FileReader if browser image initialization is unsupported', async () => {
  createUrl.mockImplementation(() => {
    throw new Error('Unsupported');
  });
  expect((await upload('blob:camera', 'report')).photoUrl).toBe(compressed);
});

it('releases a created URL if assigning the image source throws', async () => {
  Object.assign(globalThis, {
    window: {
      Image: class {
        set src(_value: string) {
          throw new Error('Unsupported');
        }
      },
    },
  });
  expect((await upload('blob:camera', 'report')).photoUrl).toBe(compressed);
  expect(revokeUrl).toHaveBeenCalledWith('blob:preview');
});

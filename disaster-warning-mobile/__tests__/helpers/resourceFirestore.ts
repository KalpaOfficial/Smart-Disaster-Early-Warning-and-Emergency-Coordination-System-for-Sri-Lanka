import { addDoc, collection, doc, getDoc, runTransaction, updateDoc } from 'firebase/firestore';

type Data = Record<string, unknown>;
type Ref = { path: string; id: string };
/** Stateful, atomic test adapter. This tests service workflows, not Firestore rules/SDK internals. */
export const transactionSet = jest.fn();
export function installResourceFirestore(initial: Record<string, Data> = {}) {
  for (const mock of [addDoc, collection, doc, getDoc, runTransaction, updateDoc])
    (mock as jest.Mock).mockReset();
  const records = new Map(
    Object.entries(initial).map(([path, data]) => [path, structuredClone(data)])
  );
  let nextId = 0;
  let commitError: Error | undefined;
  let queue = Promise.resolve();
  (collection as jest.Mock).mockImplementation((_db, path) => ({ path }));
  (doc as jest.Mock).mockImplementation((source, path, id) => {
    const fullPath = id ? `${path}/${id}` : `${source.path}/generated-${++nextId}`;
    return { path: fullPath, id: fullPath.split('/').pop() };
  });
  (getDoc as jest.Mock).mockImplementation(async (ref: Ref) => {
    const data = records.get(ref.path);
    return {
      id: ref.id,
      exists: () => data !== undefined,
      data: () => data && structuredClone(data),
    };
  });
  (updateDoc as jest.Mock).mockImplementation(async (ref: Ref, data: Data) => {
    const current = records.get(ref.path);
    if (!current) throw new Error('Document not found');
    const next = { ...current, ...data };
    for (const field of ['occupancyHistory', 'timeline']) {
      if (Array.isArray(data[field]))
        next[field] = [...(Array.isArray(current[field]) ? current[field] : []), ...data[field]];
    }
    records.set(ref.path, next);
  });
  (addDoc as jest.Mock).mockImplementation(async (ref: Ref, data: Data) => {
    const id = `generated-${++nextId}`;
    records.set(`${ref.path}/${id}`, structuredClone(data));
    return { id };
  });
  transactionSet.mockReset();
  transactionSet.mockImplementation((ref: Ref, data: Data) =>
    records.set(ref.path, structuredClone(data))
  );
  (runTransaction as jest.Mock).mockImplementation((_db, callback) => {
    const execute = async () => {
      const writes: Array<() => unknown> = [];
      const result = await callback({
        get: async (ref: Ref) => {
          const snapshot = await getDoc(ref as never);
          // Explicit per-test snapshot overrides also supply the persisted fixture.
          if (snapshot.exists()) records.set(ref.path, structuredClone(snapshot.data()) as Data);
          return snapshot;
        },
        set: (ref: Ref, data: Data) => writes.push(() => transactionSet(ref, data)),
        update: (ref: Ref, data: Data) => writes.push(() => (updateDoc as jest.Mock)(ref, data)),
      });
      if (commitError) {
        const error = commitError;
        commitError = undefined;
        throw error;
      }
      for (const write of writes) await write();
      return result;
    };
    const result = queue.then(execute);
    queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  });
  return {
    records,
    seed: (path: string, data: Data) => records.set(path, structuredClone(data)),
    failNextCommit: (error: Error) => {
      commitError = error;
    },
  };
}

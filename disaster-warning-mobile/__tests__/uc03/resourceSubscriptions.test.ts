import { onSnapshot, where, getDocs } from 'firebase/firestore';
import { onSheltersChanged, getShelters } from '@/services/shelterService';
import { onTeamsChanged } from '@/services/rescueTeamService';
import { onSuppliesChanged, getSupplies } from '@/services/reliefSupplyService';

it.each([
  ['shelters', onSheltersChanged],
  ['rescue teams', onTeamsChanged],
  ['supplies', onSuppliesChanged],
] as const)(
  'delivers initial and changed %s snapshots and exposes unsubscribe',
  (_name, subscribe) => {
    type Snapshot = { docs: { id: string; data: () => Record<string, unknown> }[] };
    let emit: (snapshot: Snapshot) => void = () => {};
    const stop = jest.fn();
    (onSnapshot as jest.Mock).mockImplementationOnce((_query, callback) => {
      emit = callback;
      return stop;
    });
    const callback = jest.fn();
    const unsubscribe = subscribe('event', callback);
    expect(where).toHaveBeenCalledWith('hazardEventId', '==', 'event');
    emit({
      docs: [
        {
          id: 'resource',
          data: () => ({
            name: 'Central College',
            currentOccupancy: 10,
            remainingQuantity: 0,
            availability: 'withdrawn',
          }),
        },
      ],
    });
    expect(callback).toHaveBeenLastCalledWith([expect.objectContaining({ id: 'resource' })]);
    emit({ docs: [] });
    expect(callback).toHaveBeenLastCalledWith([]);
    unsubscribe();
    expect(stop).toHaveBeenCalledTimes(1);
  }
);

it('maps current and legacy occupancy history without losing zero headcounts', async () => {
  (getDocs as jest.Mock).mockResolvedValueOnce({
    docs: [
      {
        id: 's',
        data: () => ({
          capacity: 100,
          occupancyHistory: [
            {
              timestamp: '2026-10-12T10:00:00Z',
              occupancy: 0,
              capacity: 100,
              recordedBy: 'officer',
            },
            { date: '2026-10-11T10:00:00Z', occupancyCount: 85 },
          ],
        }),
      },
    ],
  });
  expect((await getShelters())[0].occupancyHistory).toEqual([
    { timestamp: '2026-10-12T10:00:00Z', occupancy: 0, capacity: 100, recordedBy: 'officer' },
    { timestamp: '2026-10-11T10:00:00Z', occupancy: 85, capacity: 100, recordedBy: undefined },
  ]);
});
it('preserves exhausted balances and maps legacy stock as available', async () => {
  (getDocs as jest.Mock).mockResolvedValueOnce({
    docs: [
      { id: 'legacy', data: () => ({ totalQuantity: 100, remainingQuantity: 0 }) },
      {
        id: 'withdrawn',
        data: () => ({ totalQuantity: 100, remainingQuantity: 50, availability: 'withdrawn' }),
      },
    ],
  });
  const supplies = await getSupplies();
  expect(supplies.find(item => item.id === 'legacy')).toMatchObject({
    availability: 'available',
    remainingQuantity: 0,
  });
  expect(supplies.find(item => item.id === 'withdrawn')).toMatchObject({
    availability: 'withdrawn',
    remainingQuantity: 50,
  });
});

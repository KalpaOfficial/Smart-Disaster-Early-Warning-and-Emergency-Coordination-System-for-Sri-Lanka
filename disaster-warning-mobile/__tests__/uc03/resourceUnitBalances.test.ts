import { resourceOverview } from '@/utils/resourceOverview';
import type { ReliefSupply } from '@/types/resources';
it('keeps incompatible stock units separate, including withdrawn stock distribution', () => {
  const supplies = [
    { unit: 'litres', totalQuantity: 100, remainingQuantity: 80 },
    { unit: 'packs', totalQuantity: 20, remainingQuantity: 5 },
    { unit: 'packs', totalQuantity: 10, remainingQuantity: 0, availability: 'withdrawn' },
    { unit: 'packs', totalQuantity: 5, remainingQuantity: 9 },
  ].map(s => ({ ...s, district: 'Ratnapura' }) as ReliefSupply);
  const result = resourceOverview({ shelters: [], teams: [], supplies });
  expect(result.supplyBalances).toEqual([
    { unit: 'litres', stocked: 100, remaining: 80, distributed: 20 },
    { unit: 'packs', stocked: 20, remaining: 5, distributed: 25 },
  ]);
  expect(result.invalidStockRecords).toBe(1);
});
it('rejects nonnumeric and negative balances and uses a safe unit label for older records', () => {
  const supplies = [
    { totalQuantity: 1, remainingQuantity: 1 },
    { totalQuantity: NaN, remainingQuantity: 0 },
    { totalQuantity: 1, remainingQuantity: -1 },
  ].map(s => ({ ...s, district: 'Ratnapura' }) as ReliefSupply);
  expect(resourceOverview({ shelters: [], teams: [], supplies })).toMatchObject({
    invalidStockRecords: 2,
    supplyBalances: [{ unit: 'units', stocked: 1, remaining: 1, distributed: 0 }],
  });
});

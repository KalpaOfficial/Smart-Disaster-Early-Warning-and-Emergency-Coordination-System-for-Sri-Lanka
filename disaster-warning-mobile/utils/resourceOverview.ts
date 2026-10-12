import type { HazardEvent, Shelter, RescueTeam, ReliefSupply } from '@/types/resources';

export function resourceOverview(
  resources: { shelters: Shelter[]; teams: RescueTeam[]; supplies: ReliefSupply[] },
  event?: HazardEvent | null
) {
  const relevant = (resource: { district: string; hazardEventId?: string }) =>
    !event ||
    (resource.hazardEventId
      ? resource.hazardEventId === event.id
      : event.affectedDistricts.includes(resource.district));
  const shelters = resources.shelters.filter(relevant);
  const teams = resources.teams.filter(relevant);
  const supplies = resources.supplies.filter(relevant);
  const activeShelters = shelters.filter(s => ['active', 'over_capacity'].includes(s.status));
  const totalCapacity = activeShelters.reduce((total, shelter) => total + shelter.capacity, 0);
  const totalOccupancy = activeShelters.reduce(
    (total, shelter) => total + shelter.currentOccupancy,
    0
  );
  const availableSupplies = supplies.filter(supply => supply.availability !== 'withdrawn');
  const supplyBalances = new Map<
    string,
    { unit: string; stocked: number; remaining: number; distributed: number }
  >();
  let invalidStockRecords = 0;
  for (const supply of supplies) {
    if (
      !Number.isFinite(supply.totalQuantity) ||
      !Number.isFinite(supply.remainingQuantity) ||
      supply.totalQuantity < 0 ||
      supply.remainingQuantity < 0 ||
      supply.remainingQuantity > supply.totalQuantity
    ) {
      invalidStockRecords++;
      continue;
    }
    const unit = supply.unit?.trim() || 'units';
    const group = supplyBalances.get(unit) || { unit, stocked: 0, remaining: 0, distributed: 0 };
    if (supply.availability !== 'withdrawn') {
      group.stocked += supply.totalQuantity;
      group.remaining += supply.remainingQuantity;
    }
    group.distributed += supply.totalQuantity - supply.remainingQuantity;
    supplyBalances.set(unit, group);
  }
  return {
    shelters,
    teams,
    supplies,
    activeShelters,
    availableSupplyRecords: availableSupplies.length,
    supplyBalances: [...supplyBalances.values()],
    invalidStockRecords,
    totalCapacity,
    totalOccupancy,
    occupancyPercentage: totalCapacity > 0 ? Math.round((totalOccupancy / totalCapacity) * 100) : 0,
    deployedTeams: teams.filter(team =>
      ['dispatched', 'en_route', 'on_site'].includes(team.status)
    ),
    availableTeams: teams.filter(team => team.status === 'available'),
    totalSupplyItems: availableSupplies.reduce((total, supply) => total + supply.totalQuantity, 0),
    remainingSupplyItems: availableSupplies.reduce(
      (total, supply) => total + supply.remainingQuantity,
      0
    ),
    distributedSupplyItems: supplies.reduce(
      (total, supply) => total + supply.totalQuantity - supply.remainingQuantity,
      0
    ),
  };
}

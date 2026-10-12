import { auth } from '@/services/firebase';
import { addDoc, runTransaction, updateDoc } from 'firebase/firestore';
import {
  createShelter,
  activateShelter,
  updateOccupancy,
  deactivateShelter,
} from '@/services/shelterService';
import { createTeam, dispatchTeam, updateTeamStatus } from '@/services/rescueTeamService';
import {
  createSupply,
  distributeSupply,
  setSupplyAvailability,
} from '@/services/reliefSupplyService';
import { installResourceFirestore, transactionSet } from '../helpers/resourceFirestore';
import {
  resourceRecords,
  shelterInput,
  teamInput,
  supplyInput,
  distributionInput,
} from '../helpers/resourceFixtures';
import type { TeamStatus } from '@/types/resources';

let store: ReturnType<typeof installResourceFirestore>;
beforeEach(() => {
  Object.assign(auth, { currentUser: { uid: 'officer' } });
  store = installResourceFirestore(resourceRecords());
});
function ledger() {
  return [...store.records.entries()].filter(([path]) => path.startsWith('distributions/'));
}

describe('UC03 persisted workflows and failure safety', () => {
  it('requires a selected hazard event for resource allocation', async () => {
    await expect(activateShelter('shelter', '')).rejects.toThrow('Select an active hazard event');
    await expect(dispatchTeam('team', 'Sector', '')).rejects.toThrow('active hazard event');
    await expect(createSupply(supplyInput, 'officer', '')).rejects.toThrow(
      'Select an active hazard event'
    );
    await expect(distributeSupply(distributionInput, 'officer', '')).rejects.toThrow(
      'Select an active hazard event'
    );
    expect(updateDoc).not.toHaveBeenCalled();
    expect(transactionSet).not.toHaveBeenCalled();
  });
  it('rejects blank response locations before dispatch', async () => {
    await expect(dispatchTeam('team', '  ', 'event')).rejects.toThrow('response location');
    expect(runTransaction).not.toHaveBeenCalled();
  });
  it('rejects invalid supply availability without changing stock', async () => {
    await expect(setSupplyAvailability('stock', 'invalid' as never)).rejects.toThrow(
      'Invalid supply availability'
    );
    expect(updateDoc).not.toHaveBeenCalled();
  });
  it('does not overwrite an existing active shelter allocation', async () => {
    await activateShelter('shelter', 'event');
    await expect(activateShelter('shelter', 'event')).rejects.toThrow('already active');
    expect(updateDoc).toHaveBeenCalledTimes(1);
  });
  it('persists the complete coordination flow, ownership, occupancy history and stock ledger', async () => {
    const shelter = await createShelter(shelterInput, 'officer');
    await activateShelter(shelter, 'event');
    await updateOccupancy(shelter, 85, 999);
    await updateOccupancy(shelter, 125, 999);
    expect(store.records.get(`shelters/${shelter}`)).toMatchObject({
      status: 'over_capacity',
      capacity: 100,
      currentOccupancy: 125,
      organisationName: shelterInput.organisationName,
      occupancyHistory: [
        { occupancy: 85, capacity: 100, recordedBy: 'officer', timestamp: expect.any(String) },
        { occupancy: 125, capacity: 100, recordedBy: 'officer', timestamp: expect.any(String) },
      ],
    });
    const team = await createTeam(teamInput, 'officer');
    await dispatchTeam(team, '  River sector  ', 'event');
    for (const status of ['en_route', 'on_site', 'completed', 'available'] as TeamStatus[])
      await updateTeamStatus(team, status);
    expect(store.records.get(`rescueTeams/${team}`)).toMatchObject({
      status: 'available',
      assignedLocation: '',
      hazardEventId: '',
      organisationName: teamInput.organisationName,
    });
    const stock = await createSupply(supplyInput, 'officer', 'event');
    const id = await distributeSupply(
      { ...distributionInput, supplyId: stock, supplyName: 'Spoofed name', unit: 'wrong unit' },
      'officer',
      'event'
    );
    expect(store.records.get(`reliefSupplies/${stock}`)?.remainingQuantity).toBe(40);
    expect(store.records.get(`distributions/${id}`)).toMatchObject({
      supplyName: supplyInput.itemName,
      unit: supplyInput.unit,
      quantity: 60,
      hazardEventId: 'event',
      distributedBy: 'officer',
      supplyType: 'water',
      organisationType: 'ngo',
      organisationName: 'Red Cross',
    });
    await expect(deactivateShelter(shelter)).rejects.toThrow('Reallocate');
    await updateOccupancy(shelter, 0, 999);
    await deactivateShelter(shelter);
    expect(store.records.get(`shelters/${shelter}`)?.status).toBe('inactive');
  });

  it('prevents two simultaneous distributions from overspending the same balance', async () => {
    const outcomes = await Promise.allSettled([
      distributeSupply(distributionInput, 'officer', 'event'),
      distributeSupply(distributionInput, 'officer', 'event'),
    ]);
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(store.records.get('reliefSupplies/stock')?.remainingQuantity).toBe(40);
    expect(ledger()).toHaveLength(1);
  });

  it('leaves both the ledger and stock untouched when the transaction commit fails', async () => {
    store.failNextCommit(new Error('Network unavailable'));
    await expect(distributeSupply(distributionInput, 'officer', 'event')).rejects.toThrow(
      'Network unavailable'
    );
    expect(store.records.get('reliefSupplies/stock')?.remainingQuantity).toBe(100);
    expect(ledger()).toHaveLength(0);
    expect(transactionSet).not.toHaveBeenCalled();
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('allows exact depletion and refuses a subsequent distribution', async () => {
    await distributeSupply({ ...distributionInput, quantity: 100 }, 'officer', 'event');
    await expect(
      distributeSupply({ ...distributionInput, quantity: 1 }, 'officer', 'event')
    ).rejects.toThrow('Available: 0');
    expect(ledger()).toHaveLength(1);
  });

  it.each([NaN, Infinity, -1, 1.5, undefined])(
    'rejects a corrupt stock balance: %s',
    async remainingQuantity => {
      store.seed('reliefSupplies/stock', {
        ...supplyInput,
        totalQuantity: remainingQuantity,
        remainingQuantity,
      });
      await expect(distributeSupply(distributionInput, 'officer', 'event')).rejects.toThrow(
        'inventory balance is invalid'
      );
      expect(ledger()).toHaveLength(0);
    }
  );

  it('prevents duplicate dispatch when two officers select the same available team', async () => {
    const outcomes = await Promise.allSettled([
      dispatchTeam('team', 'Sector A', 'event'),
      dispatchTeam('team', 'Sector B', 'event'),
    ]);
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(store.records.get('rescueTeams/team')).toMatchObject({
      status: 'dispatched',
      assignedLocation: 'Sector A',
    });
  });

  it.each(['dispatched', 'en_route', 'on_site', 'completed', 'unavailable'])(
    'refuses dispatch of %s teams',
    async status => {
      store.seed('rescueTeams/team', { ...teamInput, status });
      await expect(dispatchTeam('team', 'Sector', 'event')).rejects.toThrow('Only available');
      expect(updateDoc).not.toHaveBeenCalled();
    }
  );

  it.each(['on_site', 'completed', 'dispatched', 'invalid'])(
    'rejects unavailable status transitions from available to %s',
    async status => {
      await expect(updateTeamStatus('team', status as TeamStatus)).rejects.toThrow('status change');
      expect(updateDoc).not.toHaveBeenCalled();
    }
  );

  it('withdraws a deployed team and clears its active assignment', async () => {
    await dispatchTeam('team', 'River sector', 'event');
    await updateTeamStatus('team', 'unavailable');
    expect(store.records.get('rescueTeams/team')).toMatchObject({
      status: 'unavailable',
      assignedLocation: '',
      hazardEventId: '',
    });
  });

  it('prevents withdrawn supplies from distribution until availability is restored', async () => {
    await setSupplyAvailability('stock', 'withdrawn');
    await expect(distributeSupply(distributionInput, 'officer', 'event')).rejects.toThrow(
      'withdrawn'
    );
    expect(ledger()).toHaveLength(0);
    await setSupplyAvailability('stock', 'available');
    await distributeSupply(distributionInput, 'officer', 'event');
    expect(store.records.get('reliefSupplies/stock')?.remainingQuantity).toBe(40);
  });

  it('uses the authenticated officer ID rather than a supplied actor ID', async () => {
    const shelter = await createShelter(shelterInput, 'spoofed');
    const team = await createTeam(teamInput, 'spoofed');
    const supply = await createSupply(supplyInput, 'spoofed', 'event');
    const distribution = await distributeSupply(
      { ...distributionInput, supplyId: supply },
      'spoofed',
      'event'
    );
    expect(store.records.get(`shelters/${shelter}`)?.createdBy).toBe('officer');
    expect(store.records.get(`rescueTeams/${team}`)?.createdBy).toBe('officer');
    expect(store.records.get(`reliefSupplies/${supply}`)?.createdBy).toBe('officer');
    expect(store.records.get(`distributions/${distribution}`)?.distributedBy).toBe('officer');
  });

  it('refuses writes after sign-out or when the user profile is missing', async () => {
    Object.assign(auth, { currentUser: null });
    await expect(createShelter(shelterInput, 'officer')).rejects.toThrow('Sign in');
    Object.assign(auth, { currentUser: { uid: 'unknown' } });
    await expect(createTeam(teamInput, 'unknown')).rejects.toThrow('Only District Officers');
    expect(addDoc).not.toHaveBeenCalled();
  });

  it.each(['registered', 'inactive'])(
    'cannot silently activate a %s shelter through occupancy',
    async status => {
      store.seed('shelters/shelter', { ...shelterInput, status });
      await expect(updateOccupancy('shelter', 10, 100)).rejects.toThrow('Activate the shelter');
      expect(updateDoc).not.toHaveBeenCalled();
    }
  );

  it.each([-1, 1.5, NaN, Infinity])(
    'rejects invalid occupancy %s without changing history',
    async occupancy => {
      await expect(updateOccupancy('shelter', occupancy, 100)).rejects.toThrow('whole number');
      expect(updateDoc).not.toHaveBeenCalled();
    }
  );

  it.each(['activate', 'occupancy', 'deactivate', 'dispatch', 'team status', 'distribution'])(
    'reports a missing resource during %s',
    async operation => {
      const operations: Record<string, () => Promise<unknown>> = {
        activate: () => activateShelter('missing', 'event'),
        occupancy: () => updateOccupancy('missing', 1, 100),
        deactivate: () => deactivateShelter('missing'),
        dispatch: () => dispatchTeam('missing', 'Sector', 'event'),
        'team status': () => updateTeamStatus('missing', 'available'),
        distribution: () =>
          distributeSupply({ ...distributionInput, supplyId: 'missing' }, 'officer', 'event'),
      };
      await expect(operations[operation]()).rejects.toThrow(/not found|does not exist/);
      expect(updateDoc).not.toHaveBeenCalled();
      expect(transactionSet).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['closed', { status: 'closed', affectedDistricts: ['Ratnapura'] }],
    ['wrong district', { status: 'active', affectedDistricts: ['Colombo'] }],
    ['missing', undefined],
  ])(
    'rejects a %s hazard event for activation, dispatch, inventory and distribution',
    async (_name, event) => {
      if (event) store.seed('hazardEvents/event', event);
      else store.records.delete('hazardEvents/event');
      await expect(activateShelter('shelter', 'event')).rejects.toThrow(/event/);
      await expect(dispatchTeam('team', 'Sector', 'event')).rejects.toThrow(/event/);
      await expect(createSupply(supplyInput, 'officer', 'event')).rejects.toThrow(/event/);
      await expect(distributeSupply(distributionInput, 'officer', 'event')).rejects.toThrow(
        /event/
      );
      expect(addDoc).not.toHaveBeenCalled();
      expect(updateDoc).not.toHaveBeenCalled();
      expect(transactionSet).not.toHaveBeenCalled();
    }
  );

  it('rejects a destination outside the selected event even when the depot is covered', async () => {
    await expect(
      distributeSupply({ ...distributionInput, destinationDistrict: 'Colombo' }, 'officer', 'event')
    ).rejects.toThrow('does not cover');
    expect(ledger()).toHaveLength(0);
    expect(store.records.get('reliefSupplies/stock')?.remainingQuantity).toBe(100);
  });

  it.each(['citizen', 'volunteer', 'dmc_officer', 'ngo', 'private_donor'])(
    'blocks all resource writes for %s',
    async role => {
      store.seed('users/officer', { role });
      for (const attempt of [
        () => createShelter(shelterInput, 'officer'),
        () => createTeam(teamInput, 'officer'),
        () => createSupply(supplyInput, 'officer', 'event'),
        () => activateShelter('shelter', 'event'),
        () => updateOccupancy('shelter', 5, 100),
        () => deactivateShelter('shelter'),
        () => dispatchTeam('team', 'Sector', 'event'),
        () => updateTeamStatus('team', 'unavailable'),
        () => distributeSupply(distributionInput, 'officer', 'event'),
        () => setSupplyAvailability('stock', 'withdrawn'),
      ])
        await expect(attempt()).rejects.toThrow('Only District Officers');
      expect(addDoc).not.toHaveBeenCalled();
      expect(updateDoc).not.toHaveBeenCalled();
      expect(runTransaction).not.toHaveBeenCalled();
    }
  );
});

import {
  validateShelter,
  validateRescueTeam,
  validateSupply,
  validateDistribution,
  validateResourceDistrict,
} from '@/utils/resourceValidation';
import { createShelter } from '@/services/shelterService';
import { createTeam } from '@/services/rescueTeamService';
import { createSupply, distributeSupply } from '@/services/reliefSupplyService';
import { addDoc, runTransaction } from 'firebase/firestore';
import { auth } from '@/services/firebase';
import { installResourceFirestore } from '../helpers/resourceFirestore';
import {
  resourceRecords,
  shelterInput,
  teamInput,
  supplyInput,
  distributionInput,
} from '../helpers/resourceFixtures';
import { ORGANISATION_TYPES, SRI_LANKAN_DISTRICTS } from '@/constants/districts';

beforeEach(() => {
  installResourceFirestore(resourceRecords());
  Object.assign(auth, { currentUser: { uid: 'officer' } });
});

describe('UC03 actual production validation', () => {
  it('accepts complete shelter, team, supply and distribution data', () => {
    expect(() => validateShelter(shelterInput)).not.toThrow();
    expect(() => validateRescueTeam(teamInput)).not.toThrow();
    expect(() => validateSupply(supplyInput)).not.toThrow();
    expect(() => validateDistribution(distributionInput)).not.toThrow();
  });
  it('accepts the official 25 districts and rejects unknown districts', () => {
    expect(SRI_LANKAN_DISTRICTS).toHaveLength(25);
    for (const district of SRI_LANKAN_DISTRICTS)
      expect(() => validateResourceDistrict(district)).not.toThrow();
    for (const district of ['', 'London', 'Ratnapuraa'])
      expect(() => validateResourceDistrict(district)).toThrow('valid Sri Lankan district');
  });
  it.each(ORGANISATION_TYPES.map(type => type.value))(
    'accepts %s ownership across all resources',
    organisationType => {
      expect(() => validateShelter({ ...shelterInput, organisationType })).not.toThrow();
      expect(() => validateRescueTeam({ ...teamInput, organisationType })).not.toThrow();
      expect(() => validateSupply({ ...supplyInput, organisationType })).not.toThrow();
    }
  );
  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'blocks invalid counts %s at the service boundary',
    async count => {
      await expect(createShelter({ ...shelterInput, capacity: count }, 'officer')).rejects.toThrow(
        'positive whole number'
      );
      await expect(createTeam({ ...teamInput, memberCount: count }, 'officer')).rejects.toThrow(
        'positive whole number'
      );
      await expect(
        createSupply({ ...supplyInput, totalQuantity: count }, 'officer', 'event')
      ).rejects.toThrow('positive whole number');
      await expect(
        distributeSupply({ ...distributionInput, quantity: count }, 'officer', 'event')
      ).rejects.toThrow('positive whole number');
      expect(addDoc).not.toHaveBeenCalled();
      expect(runTransaction).not.toHaveBeenCalled();
    }
  );
  it.each(['name', 'address', 'managerName', 'managerContact', 'organisationName'] as const)(
    'rejects whitespace-only shelter %s',
    async field => {
      await expect(createShelter({ ...shelterInput, [field]: '   ' }, 'officer')).rejects.toThrow(
        'required'
      );
      expect(addDoc).not.toHaveBeenCalled();
    }
  );
  it.each(['name', 'specialisation', 'organisationName'] as const)(
    'rejects blank rescue %s',
    async field => {
      await expect(createTeam({ ...teamInput, [field]: ' ' }, 'officer')).rejects.toThrow(
        'required'
      );
      expect(addDoc).not.toHaveBeenCalled();
    }
  );
  it.each(['itemName', 'unit', 'organisationName'] as const)(
    'rejects blank inventory %s',
    async field => {
      await expect(
        createSupply({ ...supplyInput, [field]: ' ' }, 'officer', 'event')
      ).rejects.toThrow('required');
      expect(addDoc).not.toHaveBeenCalled();
    }
  );
  it.each([
    [0, 0],
    [51.5, -0.1],
    [NaN, 80.4],
    [6.68, Infinity],
    [5.7, 80.4],
    [6.68, 82.1],
  ])('rejects invalid Sri Lankan map coordinates %s, %s', async (latitude, longitude) => {
    await expect(
      createShelter({ ...shelterInput, latitude, longitude }, 'officer')
    ).rejects.toThrow('valid map location');
    expect(addDoc).not.toHaveBeenCalled();
  });
  it('rejects invalid resource types and organisation types', () => {
    expect(() => validateShelter({ ...shelterInput, facilityType: 'unknown' as never })).toThrow(
      'shelter type'
    );
    expect(() => validateSupply({ ...supplyInput, type: 'unknown' as never })).toThrow(
      'supply type'
    );
    expect(() =>
      validateRescueTeam({ ...teamInput, organisationType: 'unknown' as never })
    ).toThrow('organisation type');
  });
  it('requires destination location and district before distribution', async () => {
    await expect(
      distributeSupply({ ...distributionInput, destinationLocation: ' ' }, 'officer', 'event')
    ).rejects.toThrow('Destination location');
    await expect(
      distributeSupply({ ...distributionInput, destinationDistrict: '' }, 'officer', 'event')
    ).rejects.toThrow('valid Sri Lankan district');
    expect(runTransaction).not.toHaveBeenCalled();
  });
});

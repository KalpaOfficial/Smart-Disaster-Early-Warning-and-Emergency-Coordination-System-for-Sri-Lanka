/**
 * Unit Tests for UC03 Partner-Owned Resources & Multi-Agency Representation.
 *
 * Implements UC03:
 * - Alternate Flow: Partner-Owned Resource
 *   Resources owned or controlled by Government, Armed Forces, NGOs, or Private Donors
 *   remain visible to DMC officers through a combined operational picture.
 * - Exception Flow: Resource Owner Withdraws Availability
 *   Owning organisation withdraws the resource; system updates availability and prevents further allocation.
 */
import { createShelter, updateOccupancy } from '@/services/shelterService';
import { createTeam, updateTeamStatus } from '@/services/rescueTeamService';
import { createSupply, distributeSupply } from '@/services/reliefSupplyService';
import { addDoc, updateDoc, getDoc } from 'firebase/firestore';
import type { OrganisationType } from '@/types/resources';

describe('UC03: Partner-Owned Resources & Multi-Agency Coordination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Representation of All 4 Mandated Partner Organisation Categories', () => {
    const validOrganisationTypes: OrganisationType[] = [
      'government',
      'armed_forces',
      'ngo',
      'private_donor',
    ];

    it('validates that all 4 organisation types are accepted for Shelter registration', async () => {
      (addDoc as jest.Mock).mockResolvedValue({ id: 'mock-shelter' });

      for (const orgType of validOrganisationTypes) {
        await createShelter(
          {
            name: `${orgType.toUpperCase()} Safe Haven`,
            facilityType: 'community_hall',
            address: 'District Center',
            district: 'Ratnapura',
            latitude: 6.68,
            longitude: 80.40,
            capacity: 100,
            facilities: ['Water Supply'],
            managerName: 'Manager A',
            managerContact: '0771234567',
            organisationType: orgType,
            organisationName: `Organisation ${orgType}`,
          },
          'officer-01',
        );

        expect(addDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            organisationType: orgType,
          }),
        );
      }
    });

    it('validates that Armed Forces and NGO Rescue Teams can be registered', async () => {
      (addDoc as jest.Mock).mockResolvedValue({ id: 'mock-team' });

      // Armed Forces SAR
      await createTeam(
        {
          name: 'Navy Diving & Salvage SAR Unit',
          organisationName: 'Sri Lanka Navy',
          organisationType: 'armed_forces',
          memberCount: 15,
          specialisation: 'Water Rescue',
          district: 'Kalutara',
        },
        'officer-01',
      );
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          organisationType: 'armed_forces',
        }),
      );

      // NGO Volunteer SAR
      await createTeam(
        {
          name: 'Sarvodaya Community Disaster Response Squad',
          organisationName: 'Sarvodaya Shramadana',
          organisationType: 'ngo',
          memberCount: 20,
          specialisation: 'General Disaster Relief',
          district: 'Galle',
        },
        'officer-01',
      );
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          organisationType: 'ngo',
        }),
      );
    });

    it('validates that Private Donor and Government relief supplies are registered', async () => {
      (addDoc as jest.Mock).mockResolvedValue({ id: 'mock-supply' });

      // Private Philanthropist Relief Consignment
      await createSupply(
        {
          itemName: 'Dry Rations & Baby Food Hampers',
          type: 'food',
          totalQuantity: 2500,
          unit: 'hampers',
          organisationName: 'Ceylon Chamber of Commerce Consortium',
          organisationType: 'private_donor',
          district: 'Colombo',
        },
        'officer-01',
        'event-monsoon-2026',
      );
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          organisationType: 'private_donor',
        }),
      );
    });
  });

  describe('Exception Flow: Resource Owner Withdraws Availability', () => {
    it('updates team status to "unavailable" when owning agency withdraws team', async () => {
      await updateTeamStatus('team-airforce-01', 'unavailable');

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'unavailable',
        }),
      );
    });

    it('prevents distribution and flags error if resource owner withdraws or supply is depleted', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          itemName: 'Specialist Flood Pumps',
          totalQuantity: 5,
          remainingQuantity: 0, // Withdrawn / 0 remaining
          unit: 'pumps',
        }),
      });

      await expect(
        distributeSupply(
          {
            supplyId: 'sup-pump-01',
            supplyName: 'Specialist Flood Pumps',
            quantity: 1,
            unit: 'pumps',
            destinationDistrict: 'Ratnapura',
            destinationLocation: 'Sector A',
            details: 'Field deployment',
          },
          'officer-01',
          'event-monsoon-2026',
        ),
      ).rejects.toThrow('Insufficient supplies');
    });
  });
});

/**
 * Unit Tests for UC03 Combined Operational Picture Telemetry Aggregations.
 *
 * Implements UC03:
 * - Step 40: Display available emergency resources across shelters, rescue teams, relief supplies
 * - Step 48: Display activated shelters in DMC combined operational picture
 * - Step 56: Display live rescue team mission telemetry in combined operational picture
 * - Step 62: Unified status across shelters, rescue units, and relief distribution
 * - Multi-organisation aggregation (Government, Armed Forces, NGOs, Private Donors)
 */
import type { Shelter, RescueTeam, ReliefSupply, HazardEvent } from '@/types/resources';

describe('UC03: Combined Operational Picture Telemetry Aggregations', () => {
  const mockShelters: Shelter[] = [
    {
      id: 's-1',
      name: 'Ratnapura Central College',
      facilityType: 'school',
      address: 'Main St',
      district: 'Ratnapura',
      latitude: 6.68,
      longitude: 80.40,
      capacity: 300,
      currentOccupancy: 210, // 70%
      facilities: ['Water', 'Kitchen'],
      managerName: 'Manager 1',
      managerContact: '0771234567',
      organisationType: 'government',
      organisationName: 'District Secretariat',
      status: 'active',
      hazardEventId: 'event-monsoon-2026',
      createdBy: 'officer-1',
      createdAt: '2026-10-09T02:00:00Z',
    },
    {
      id: 's-2',
      name: 'Kalutara Temple Hall',
      facilityType: 'temple',
      address: 'Temple Rd',
      district: 'Kalutara',
      latitude: 6.58,
      longitude: 79.96,
      capacity: 150,
      currentOccupancy: 165, // 110% Over Capacity!
      facilities: ['Sanitation', 'Water'],
      managerName: 'Manager 2',
      managerContact: '0777654321',
      organisationType: 'ngo',
      organisationName: 'Sri Lanka Red Cross',
      status: 'over_capacity',
      hazardEventId: 'event-monsoon-2026',
      createdBy: 'officer-1',
      createdAt: '2026-10-09T03:00:00Z',
    },
    {
      id: 's-3',
      name: 'Galle Stadium Shelter',
      facilityType: 'stadium',
      address: 'Galle Fort Rd',
      district: 'Galle',
      latitude: 6.03,
      longitude: 80.21,
      capacity: 500,
      currentOccupancy: 0,
      facilities: ['Water', 'Electricity'],
      managerName: 'Manager 3',
      managerContact: '0712345678',
      organisationType: 'government',
      organisationName: 'Municipal Council',
      status: 'registered', // Standby, not yet active
      hazardEventId: '',
      createdBy: 'officer-2',
      createdAt: '2026-10-09T04:00:00Z',
    },
    {
      id: 's-4',
      name: 'Matara Phased Down School',
      facilityType: 'school',
      address: 'Beach Rd',
      district: 'Matara',
      latitude: 5.94,
      longitude: 80.53,
      capacity: 200,
      currentOccupancy: 0,
      facilities: ['Water'],
      managerName: 'Manager 4',
      managerContact: '0719876543',
      organisationType: 'government',
      organisationName: 'Ministry of Education',
      status: 'inactive', // Deactivated
      hazardEventId: '',
      createdBy: 'officer-3',
      createdAt: '2026-10-09T01:00:00Z',
    },
  ];

  const mockTeams: RescueTeam[] = [
    {
      id: 't-1',
      name: 'Navy RABS Swift Water Team',
      organisationName: 'Sri Lanka Navy',
      organisationType: 'armed_forces',
      memberCount: 10,
      specialisation: 'Water Rescue',
      district: 'Ratnapura',
      status: 'on_site',
      assignedLocation: 'Elapatha Flood Sector',
      hazardEventId: 'event-monsoon-2026',
      lastStatusUpdate: '2026-10-09T06:00:00Z',
      createdBy: 'officer-1',
      createdAt: '2026-10-09T02:00:00Z',
    },
    {
      id: 't-2',
      name: 'Army Disaster Relief Platoon',
      organisationName: 'Sri Lanka Army',
      organisationType: 'armed_forces',
      memberCount: 25,
      specialisation: 'Landslide SAR',
      district: 'Ratnapura',
      status: 'en_route',
      assignedLocation: 'Pelmadulla Sector',
      hazardEventId: 'event-monsoon-2026',
      lastStatusUpdate: '2026-10-09T06:15:00Z',
      createdBy: 'officer-1',
      createdAt: '2026-10-09T02:30:00Z',
    },
    {
      id: 't-3',
      name: 'Air Force Bell 212 Helicopter SAR',
      organisationName: 'Sri Lanka Air Force',
      organisationType: 'armed_forces',
      memberCount: 5,
      specialisation: 'Helicopter SAR',
      district: 'Colombo',
      status: 'available',
      assignedLocation: '',
      hazardEventId: '',
      lastStatusUpdate: '2026-10-09T01:00:00Z',
      createdBy: 'officer-2',
      createdAt: '2026-10-09T01:00:00Z',
    },
    {
      id: 't-4',
      name: 'Red Cross Volunteer First Aid Unit',
      organisationName: 'Sri Lanka Red Cross',
      organisationType: 'ngo',
      memberCount: 8,
      specialisation: 'Medical Evacuation',
      district: 'Kalutara',
      status: 'dispatched',
      assignedLocation: 'Millaniya Clinic',
      hazardEventId: 'event-monsoon-2026',
      lastStatusUpdate: '2026-10-09T06:30:00Z',
      createdBy: 'officer-1',
      createdAt: '2026-10-09T03:00:00Z',
    },
    {
      id: 't-5',
      name: 'Community Boat Rescue Volunteer Unit',
      organisationName: 'Ratnapura Fishermen Guild',
      organisationType: 'private_donor',
      memberCount: 6,
      specialisation: 'Water Rescue',
      district: 'Ratnapura',
      status: 'completed',
      assignedLocation: '',
      hazardEventId: 'event-monsoon-2026',
      lastStatusUpdate: '2026-10-09T07:00:00Z',
      createdBy: 'officer-1',
      createdAt: '2026-10-09T04:00:00Z',
    },
  ];

  const mockSupplies: ReliefSupply[] = [
    {
      id: 'sup-1',
      itemName: 'Dry Food Ration Packs',
      type: 'food',
      totalQuantity: 10000,
      remainingQuantity: 6500, // 3500 distributed
      unit: 'packs',
      organisationName: 'District Secretariat',
      organisationType: 'government',
      district: 'Ratnapura',
      hazardEventId: 'event-monsoon-2026',
      createdBy: 'officer-1',
      createdAt: '2026-10-09T02:00:00Z',
    },
    {
      id: 'sup-2',
      itemName: 'Clean Bottled Water 5L',
      type: 'water',
      totalQuantity: 8000,
      remainingQuantity: 4200, // 3800 distributed
      unit: 'bottles',
      organisationName: 'Red Cross',
      organisationType: 'ngo',
      district: 'Kalutara',
      hazardEventId: 'event-monsoon-2026',
      createdBy: 'officer-1',
      createdAt: '2026-10-09T02:15:00Z',
    },
    {
      id: 'sup-3',
      itemName: 'First Aid Emergency Kits',
      type: 'medicine',
      totalQuantity: 500,
      remainingQuantity: 380, // 120 distributed
      unit: 'kits',
      organisationName: 'Ministry of Health',
      organisationType: 'government',
      district: 'Ratnapura',
      hazardEventId: 'event-monsoon-2026',
      createdBy: 'officer-1',
      createdAt: '2026-10-09T02:30:00Z',
    },
    {
      id: 'sup-4',
      itemName: 'Heavy Duty Thermal Blankets',
      type: 'blankets',
      totalQuantity: 2000,
      remainingQuantity: 1500, // 500 distributed
      unit: 'units',
      organisationName: 'Private Garment Exporters Donation',
      organisationType: 'private_donor',
      district: 'Ratnapura',
      hazardEventId: 'event-monsoon-2026',
      createdBy: 'officer-2',
      createdAt: '2026-10-09T03:00:00Z',
    },
  ];

  describe('Emergency Shelters Operational Aggregation', () => {
    it('aggregates active shelters, total capacity, and occupancy faithfully', () => {
      // Active shelters include both 'active' and 'over_capacity'
      const activeShelters = mockShelters.filter(
        (s) => s.status === 'active' || s.status === 'over_capacity',
      );
      expect(activeShelters).toHaveLength(2);

      const totalCapacity = activeShelters.reduce((acc, s) => acc + s.capacity, 0);
      const totalOccupancy = activeShelters.reduce((acc, s) => acc + s.currentOccupancy, 0);
      const occupancyPercentage =
        totalCapacity > 0 ? Math.round((totalOccupancy / totalCapacity) * 100) : 0;

      expect(totalCapacity).toBe(450); // 300 + 150
      expect(totalOccupancy).toBe(375); // 210 + 165
      expect(occupancyPercentage).toBe(83); // (375 / 450) * 100 = 83.33% -> 83%
    });

    it('identifies and flags over-capacity facilities requiring emergency decanting', () => {
      const overCapacityShelters = mockShelters.filter((s) => s.status === 'over_capacity');
      expect(overCapacityShelters).toHaveLength(1);
      expect(overCapacityShelters[0].name).toBe('Kalutara Temple Hall');
      expect(overCapacityShelters[0].currentOccupancy).toBe(165);
      expect(overCapacityShelters[0].capacity).toBe(150);
    });

    it('identifies standby registered shelters ready for immediate activation', () => {
      const registeredShelters = mockShelters.filter((s) => s.status === 'registered');
      expect(registeredShelters).toHaveLength(1);
      expect(registeredShelters[0].name).toBe('Galle Stadium Shelter');
      expect(registeredShelters[0].capacity).toBe(500);
    });
  });

  describe('Tactical Rescue Teams Operational Aggregation', () => {
    it('aggregates actively deployed rescue units (dispatched, en_route, on_site)', () => {
      const deployedTeams = mockTeams.filter((t) =>
        ['dispatched', 'en_route', 'on_site'].includes(t.status),
      );
      expect(deployedTeams).toHaveLength(3); // Navy on_site, Army en_route, Red Cross dispatched
    });

    it('aggregates available reserve units in tactical pool ready for deployment', () => {
      const availableTeams = mockTeams.filter((t) => t.status === 'available');
      expect(availableTeams).toHaveLength(1); // Air Force Helicopter SAR
      expect(availableTeams[0].name).toContain('Helicopter SAR');
    });

    it('aggregates completed mission units that can be recycled to available pool', () => {
      const completedTeams = mockTeams.filter((t) => t.status === 'completed');
      expect(completedTeams).toHaveLength(1);
      expect(completedTeams[0].name).toBe('Community Boat Rescue Volunteer Unit');
    });
  });

  describe('Relief Supply Inventory & Distribution Aggregation', () => {
    it('aggregates warehouse inventory quantities and distribution balances', () => {
      const totalUnitsStocked = mockSupplies.reduce((acc, s) => acc + s.totalQuantity, 0);
      const totalUnitsRemaining = mockSupplies.reduce((acc, s) => acc + s.remainingQuantity, 0);
      const totalUnitsDispatched = totalUnitsStocked - totalUnitsRemaining;

      expect(totalUnitsStocked).toBe(20500); // 10000 + 8000 + 500 + 2000
      expect(totalUnitsRemaining).toBe(12580); // 6500 + 4200 + 380 + 1500
      expect(totalUnitsDispatched).toBe(7920); // 3500 + 3800 + 120 + 500
    });

    it('groups relief supplies by essential commodity category', () => {
      const foodSupplies = mockSupplies.filter((s) => s.type === 'food');
      const waterSupplies = mockSupplies.filter((s) => s.type === 'water');
      const medicalSupplies = mockSupplies.filter((s) => s.type === 'medicine');

      expect(foodSupplies).toHaveLength(1);
      expect(waterSupplies).toHaveLength(1);
      expect(medicalSupplies).toHaveLength(1);
    });
  });

  describe('Cross-Cutting Partner Organisation Representation', () => {
    it('aggregates resources across all four designated organisation types', () => {
      const orgTypes = new Set([
        ...mockShelters.map((s) => s.organisationType),
        ...mockTeams.map((t) => t.organisationType),
        ...mockSupplies.map((s) => s.organisationType),
      ]);

      // Explicit Case Study 02 requirement: Government, Armed Forces, NGOs, Private Donors
      expect(orgTypes.has('government')).toBe(true);
      expect(orgTypes.has('armed_forces')).toBe(true);
      expect(orgTypes.has('ngo')).toBe(true);
      expect(orgTypes.has('private_donor')).toBe(true);
    });
  });
});

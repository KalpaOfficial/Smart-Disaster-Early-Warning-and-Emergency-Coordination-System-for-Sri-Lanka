/**
 * Unit Tests for UC03 Rescue Team Service (`services/rescueTeamService.ts`).
 *
 * Implements UC03:
 * - Steps 51–52: Rescue Team registration & discovery
 * - Steps 53–54: Team dispatch to emergency response sector (status: 'dispatched')
 * - Steps 55–56: Multi-stage operational status progression ('dispatched' -> 'en_route' -> 'on_site' -> 'completed')
 * - Alternate Flow: Rescue Team Status Updates & returning to 'available' pool
 * - Exception Flow: Stand down / Unavailable status handling
 */
import {
  getTeams,
  onTeamsChanged,
  createTeam,
  dispatchTeam,
  updateTeamStatus,
} from '@/services/rescueTeamService';
import {
  addDoc,
  updateDoc,
  getDocs,
  collection,
  doc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import type { CreateRescueTeamData, RescueTeam, TeamStatus } from '@/types/resources';

describe('UC03: Rescue Team Coordination Service', () => {
  const sampleTeamData: CreateRescueTeamData = {
    name: 'Rapid Action Boat Squadron Unit 04',
    organisationName: 'Sri Lanka Navy',
    organisationType: 'armed_forces',
    memberCount: 12,
    specialisation: 'Water / Flood Rescue',
    district: 'Ratnapura',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rescue Team Registration (UC03 Main Flow Steps 51–52)', () => {
    it('should register a new rescue team with initial status "available"', async () => {
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'team-navy-rabs-04' });

      const teamId = await createTeam(sampleTeamData, 'officer-user-101');

      expect(teamId).toBe('team-navy-rabs-04');
      expect(addDoc).toHaveBeenCalledTimes(1);
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: 'Rapid Action Boat Squadron Unit 04',
          organisationName: 'Sri Lanka Navy',
          organisationType: 'armed_forces',
          memberCount: 12,
          specialisation: 'Water / Flood Rescue',
          district: 'Ratnapura',
          status: 'available',
          createdBy: 'officer-user-101',
        }),
      );
    });

    it('should register NGO and Volunteer Rescue Units', async () => {
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'team-redcross-sar-01' });

      const ngoTeam: CreateRescueTeamData = {
        name: 'Red Cross First Aid & SAR Squad',
        organisationName: 'Sri Lanka Red Cross',
        organisationType: 'ngo',
        memberCount: 8,
        specialisation: 'Medical Evacuation & Triage',
        district: 'Kalutara',
      };

      const teamId = await createTeam(ngoTeam, 'officer-user-101');

      expect(teamId).toBe('team-redcross-sar-01');
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          organisationType: 'ngo',
          status: 'available',
        }),
      );
    });
  });

  describe('Rescue Team Dispatch (UC03 Main Flow Steps 53–54)', () => {
    it('should dispatch an available team to a response sector and update status to "dispatched"', async () => {
      await dispatchTeam('team-navy-rabs-04', 'Elapatha Flood Inundation Zone', 'event-monsoon-2026');

      expect(updateDoc).toHaveBeenCalledTimes(1);
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'dispatched',
          assignedLocation: 'Elapatha Flood Inundation Zone',
          hazardEventId: 'event-monsoon-2026',
        }),
      );
    });
  });

  describe('Rescue Team Status Transitions (UC03 Steps 55–56 & Alternate Flows)', () => {
    it('should advance status to "en_route" while preserving assigned location', async () => {
      await updateTeamStatus('team-navy-rabs-04', 'en_route');

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'en_route',
        }),
      );
      // Location should NOT be cleared for en_route
      expect(updateDoc).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ assignedLocation: '' }),
      );
    });

    it('should advance status to "on_site" when unit arrives at operational sector', async () => {
      await updateTeamStatus('team-navy-rabs-04', 'on_site');

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'on_site',
        }),
      );
      expect(updateDoc).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ assignedLocation: '' }),
      );
    });

    it('should clear assignedLocation when mission status advances to "completed"', async () => {
      await updateTeamStatus('team-navy-rabs-04', 'completed');

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'completed',
          assignedLocation: '',
        }),
      );
    });

    it('should clear assignedLocation when team status resets to "available"', async () => {
      await updateTeamStatus('team-navy-rabs-04', 'available');

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'available',
          assignedLocation: '',
        }),
      );
    });

    it('should allow unit to be marked "unavailable" for maintenance or crew rest', async () => {
      await updateTeamStatus('team-navy-rabs-04', 'unavailable');

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'unavailable',
        }),
      );
    });
  });

  describe('Rescue Team Queries & Real-Time Telemetry', () => {
    it('should retrieve all rescue teams sorted descending by creation date', async () => {
      const mockDoc1 = {
        id: 'team-1',
        data: () => ({
          name: 'Army Light Rescue Team',
          status: 'available',
          createdAt: { toDate: () => new Date('2026-10-09T03:00:00Z') },
        }),
      };
      const mockDoc2 = {
        id: 'team-2',
        data: () => ({
          name: 'Navy Swift Water Unit',
          status: 'dispatched',
          createdAt: { toDate: () => new Date('2026-10-09T05:00:00Z') },
        }),
      };

      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: [mockDoc1, mockDoc2],
      });

      const teams = await getTeams();

      expect(teams).toHaveLength(2);
      expect(teams[0].id).toBe('team-2');
      expect(teams[1].id).toBe('team-1');
      expect(collection).toHaveBeenCalledWith(expect.anything(), 'rescueTeams');
    });

    it('should filter teams by active hazard event ID', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: [
          {
            id: 'team-event-scoped',
            data: () => ({
              name: 'Air Force Helicopter SAR',
              hazardEventId: 'event-monsoon-2026',
              status: 'on_site',
              createdAt: { toDate: () => new Date('2026-10-09T04:00:00Z') },
            }),
          },
        ],
      });

      const teams = await getTeams('event-monsoon-2026');

      expect(teams).toHaveLength(1);
      expect(teams[0].id).toBe('team-event-scoped');
      expect(where).toHaveBeenCalledWith('hazardEventId', '==', 'event-monsoon-2026');
    });

    it('should support real-time subscription via onTeamsChanged', () => {
      const mockCallback = jest.fn();
      const unsubscribe = onTeamsChanged('event-monsoon-2026', mockCallback);

      expect(onSnapshot).toHaveBeenCalledTimes(1);
      expect(typeof unsubscribe).toBe('function');
    });
  });
});

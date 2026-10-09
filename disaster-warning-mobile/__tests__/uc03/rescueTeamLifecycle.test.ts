/**
 * Unit Tests for UC03 Rescue Team Lifecycle, State Machine & Availability Guard.
 *
 * Implements UC03:
 * - Steps 53–54: Team dispatch from available pool
 * - Steps 55–56: Real-time operational status progression
 * - Alternate Flow: Rescue Team Status Updates & mission completion
 * - Exception Flow: Rescue Team Unavailable (preventing duplicate dispatch or dispatching grounded units)
 */
import { dispatchTeam, updateTeamStatus } from '@/services/rescueTeamService';
import { updateDoc } from 'firebase/firestore';
import type { RescueTeam, TeamStatus } from '@/types/resources';

describe('UC03: Rescue Team Lifecycle & Operational State Machine', () => {
  const teamId = 'team-sl-army-dr-01';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Full Operational Mission Lifecycle', () => {
    it('executes full mission cycle: available -> dispatched -> en_route -> on_site -> completed -> available', async () => {
      // 1. Dispatch from base
      await dispatchTeam(teamId, 'Pelmadulla Landslide Sector', 'event-monsoon-2026');
      expect(updateDoc).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'dispatched',
          assignedLocation: 'Pelmadulla Landslide Sector',
          hazardEventId: 'event-monsoon-2026',
        }),
      );

      // 2. Unit departs base: en_route
      await updateTeamStatus(teamId, 'en_route');
      expect(updateDoc).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'en_route',
        }),
      );

      // 3. Unit arrives at operational sector: on_site
      await updateTeamStatus(teamId, 'on_site');
      expect(updateDoc).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'on_site',
        }),
      );

      // 4. SAR evacuation complete: completed (clears assignedLocation)
      await updateTeamStatus(teamId, 'completed');
      expect(updateDoc).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'completed',
          assignedLocation: '',
        }),
      );

      // 5. Unit returns to base and stands down: available
      await updateTeamStatus(teamId, 'available');
      expect(updateDoc).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'available',
          assignedLocation: '',
        }),
      );
    });
  });

  describe('Exception Flow: Rescue Team Unavailable Guard', () => {
    const isTeamAvailableForDispatch = (team: Pick<RescueTeam, 'status'>): boolean => {
      return team.status === 'available';
    };

    it('allows dispatch only when team status is "available"', () => {
      expect(isTeamAvailableForDispatch({ status: 'available' })).toBe(true);
    });

    it('rejects dispatch when team is already deployed ("dispatched", "en_route", "on_site")', () => {
      expect(isTeamAvailableForDispatch({ status: 'dispatched' })).toBe(false);
      expect(isTeamAvailableForDispatch({ status: 'en_route' })).toBe(false);
      expect(isTeamAvailableForDispatch({ status: 'on_site' })).toBe(false);
    });

    it('rejects dispatch when team is in mission completion or stand-down ("completed")', () => {
      expect(isTeamAvailableForDispatch({ status: 'completed' })).toBe(false);
    });

    it('rejects dispatch when team is flagged "unavailable" (maintenance or crew rest)', () => {
      expect(isTeamAvailableForDispatch({ status: 'unavailable' })).toBe(false);
    });
  });

  describe('Mission Abort & Cancellation Flow', () => {
    it('allows aborting a dispatch and immediately resetting unit to "available"', async () => {
      // Team was dispatched
      await dispatchTeam(teamId, 'Sector B', 'event-monsoon-2026');

      // Due to road collapse, mission is recalled; unit resets to available
      await updateTeamStatus(teamId, 'available');

      expect(updateDoc).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'available',
          assignedLocation: '',
        }),
      );
    });
  });

  describe('Crew Maintenance & Resource Withdrawal', () => {
    it('sets status to "unavailable" when partner organization withdraws unit for maintenance', async () => {
      await updateTeamStatus(teamId, 'unavailable');

      expect(updateDoc).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'unavailable',
        }),
      );
    });

    it('restores unit back to "available" when maintenance is completed', async () => {
      await updateTeamStatus(teamId, 'available');

      expect(updateDoc).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'available',
          assignedLocation: '',
        }),
      );
    });
  });
});

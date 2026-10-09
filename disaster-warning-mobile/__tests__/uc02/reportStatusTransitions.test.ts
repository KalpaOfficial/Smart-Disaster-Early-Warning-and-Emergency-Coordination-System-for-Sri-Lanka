import type { ReportStatus } from '@/types/groundReport';

/**
 * Validates state transition lifecycle according to UC02:
 * pending_verification -> verified (terminal)
 * pending_verification -> rejected (terminal)
 * pending_verification -> info_requested -> pending_verification (re-evaluation loop)
 */
function isValidStatusTransition(current: ReportStatus, next: ReportStatus): boolean {
  switch (current) {
    case 'pending_verification':
      return next === 'verified' || next === 'rejected' || next === 'info_requested';
    case 'info_requested':
      // Submitter clarifies -> returns to pending_verification
      // Or officer overrides directly
      return next === 'pending_verification' || next === 'rejected';
    case 'verified':
      // Terminal state
      return false;
    case 'rejected':
      // Terminal state
      return false;
    default:
      return false;
  }
}

describe('UC02: Ground Report Status Transitions Lifecycle', () => {
  describe('Valid Forward Transitions', () => {
    it('allows pending_verification to transition to verified upon DMC approval', () => {
      expect(isValidStatusTransition('pending_verification', 'verified')).toBe(true);
    });

    it('allows pending_verification to transition to rejected upon DMC rejection', () => {
      expect(isValidStatusTransition('pending_verification', 'rejected')).toBe(true);
    });

    it('allows pending_verification to transition to info_requested for clarification', () => {
      expect(isValidStatusTransition('pending_verification', 'info_requested')).toBe(true);
    });

    it('allows info_requested to return to pending_verification when submitter replies', () => {
      expect(isValidStatusTransition('info_requested', 'pending_verification')).toBe(true);
    });

    it('allows info_requested to transition directly to rejected if clarification times out', () => {
      expect(isValidStatusTransition('info_requested', 'rejected')).toBe(true);
    });
  });

  describe('Disallowed / Terminal Transitions', () => {
    it('prevents verified reports from transitioning back to pending_verification', () => {
      expect(isValidStatusTransition('verified', 'pending_verification')).toBe(false);
    });

    it('prevents verified reports from transitioning directly to rejected', () => {
      expect(isValidStatusTransition('verified', 'rejected')).toBe(false);
    });

    it('prevents rejected reports from transitioning to verified', () => {
      expect(isValidStatusTransition('rejected', 'verified')).toBe(false);
    });

    it('prevents rejected reports from transitioning back to pending_verification', () => {
      expect(isValidStatusTransition('rejected', 'pending_verification')).toBe(false);
    });
  });
});

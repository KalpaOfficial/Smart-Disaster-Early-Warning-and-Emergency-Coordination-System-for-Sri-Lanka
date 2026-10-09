/**
 * Unit Tests for UC03 Relief Supply Distribution & Inventory Invariant Rules.
 *
 * Implements UC03:
 * - Steps 59–61: Relief supply distribution logging & remaining quantity decrement
 * - Exception Flow: Insufficient Relief Supply (overdraft guard)
 * - Multi-commodity inventory tracking (food, water, medicine, blankets, tents)
 * - Multi-stage distribution ledger reconciliation
 */
import { distributeSupply } from '@/services/reliefSupplyService';
import { getDoc, addDoc, updateDoc } from 'firebase/firestore';
import type { CreateDistributionData } from '@/types/resources';

describe('UC03: Relief Supply Distribution Ledger & Invariant Safeguards', () => {
  const supplyId = 'supply-food-dry-rations-01';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Sequential Distribution Reconciliation', () => {
    it('accurately decrements remaining stock across multiple successive dispatches', async () => {
      // Dispatch 1: 3,000 packs out of initial 10,000
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          itemName: 'Dry Ration Food Packs (Rice, Dhal, Canned Fish)',
          totalQuantity: 10000,
          remainingQuantity: 10000,
          unit: 'packs',
        }),
      });
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'dist-01' });

      await distributeSupply(
        {
          supplyId,
          supplyName: 'Dry Ration Food Packs',
          quantity: 3000,
          unit: 'packs',
          destinationDistrict: 'Ratnapura',
          destinationLocation: 'Ratnapura Central College Safe Haven',
          details: 'Convoy Alpha',
        },
        'officer-01',
        'event-monsoon-2026',
      );

      expect(updateDoc).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ remainingQuantity: 7000 }),
      );

      // Dispatch 2: 4,500 packs out of remaining 7,000
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          itemName: 'Dry Ration Food Packs',
          totalQuantity: 10000,
          remainingQuantity: 7000,
          unit: 'packs',
        }),
      });
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'dist-02' });

      await distributeSupply(
        {
          supplyId,
          supplyName: 'Dry Ration Food Packs',
          quantity: 4500,
          unit: 'packs',
          destinationDistrict: 'Ratnapura',
          destinationLocation: 'Kuruwita Maha Vidyalaya Camp',
          details: 'Convoy Bravo',
        },
        'officer-01',
        'event-monsoon-2026',
      );

      expect(updateDoc).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ remainingQuantity: 2500 }),
      );

      // Dispatch 3: Remaining 2,500 packs down to 0
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          itemName: 'Dry Ration Food Packs',
          totalQuantity: 10000,
          remainingQuantity: 2500,
          unit: 'packs',
        }),
      });
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'dist-03' });

      await distributeSupply(
        {
          supplyId,
          supplyName: 'Dry Ration Food Packs',
          quantity: 2500,
          unit: 'packs',
          destinationDistrict: 'Kalutara',
          destinationLocation: 'Palinda Nuwara Community Center',
          details: 'Convoy Charlie Final',
        },
        'officer-01',
        'event-monsoon-2026',
      );

      expect(updateDoc).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ remainingQuantity: 0 }),
      );
    });
  });

  describe('Exception Flow: Insufficient Relief Supply Protection', () => {
    it('rejects distribution request when depot balance is completely exhausted (0 remaining)', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          itemName: 'Dry Ration Food Packs',
          totalQuantity: 10000,
          remainingQuantity: 0,
          unit: 'packs',
        }),
      });

      const request: CreateDistributionData = {
        supplyId,
        supplyName: 'Dry Ration Food Packs',
        quantity: 100,
        unit: 'packs',
        destinationDistrict: 'Ratnapura',
        destinationLocation: 'Relief Camp',
        details: 'Attempt on depleted inventory',
      };

      await expect(
        distributeSupply(request, 'officer-01', 'event-monsoon-2026'),
      ).rejects.toThrow('Insufficient supplies. Requested: 100, Available: 0');

      expect(addDoc).not.toHaveBeenCalled();
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('rejects partial overdraft where requested quantity exceeds available by even 1 unit', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          itemName: 'Tents',
          totalQuantity: 50,
          remainingQuantity: 10,
          unit: 'units',
        }),
      });

      const request: CreateDistributionData = {
        supplyId,
        supplyName: 'Tents',
        quantity: 11, // 11 > 10
        unit: 'units',
        destinationDistrict: 'Kalutara',
        destinationLocation: 'Field Camp',
        details: 'Tents request',
      };

      await expect(
        distributeSupply(request, 'officer-01', 'event-monsoon-2026'),
      ).rejects.toThrow('Insufficient supplies. Requested: 11, Available: 10');

      expect(addDoc).not.toHaveBeenCalled();
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });

  describe('Distribution Across Essential Commodities', () => {
    it('handles medicine distribution with proper units and destinations', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          itemName: 'Oral Rehydration Salts (ORS) Sachets',
          totalQuantity: 5000,
          remainingQuantity: 4000,
          unit: 'sachets',
        }),
      });
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'dist-ors-01' });

      await distributeSupply(
        {
          supplyId: 'sup-ors-01',
          supplyName: 'ORS Sachets',
          quantity: 1500,
          unit: 'sachets',
          destinationDistrict: 'Ratnapura',
          destinationLocation: 'Ayagama Mobile Medical Clinic',
          details: 'Dispatched with medical team',
        },
        'health-officer-02',
        'event-monsoon-2026',
      );

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ remainingQuantity: 2500 }),
      );
    });
  });
});

/**
 * Unit Tests for UC03 Relief Supply Service (`services/reliefSupplyService.ts`).
 *
 * Implements UC03:
 * - Steps 57–58: Relief supplies inventory listing & categorization (food, water, medicine, blankets, tents)
 * - Steps 59–61: Relief supply distribution logging & remaining quantity decrement
 * - Step 62: Inventory tracking across partner organisations
 * - Exception Flow: Insufficient Relief Supply (overdraft guard)
 * - Exception Flow: Non-existent supply item error
 */
import {
  getSupplies,
  getSuppliesByType,
  onSuppliesChanged,
  createSupply,
  distributeSupply,
  getDistributions,
} from '@/services/reliefSupplyService';
import {
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  collection,
  doc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import type {
  CreateReliefSupplyData,
  CreateDistributionData,
  ReliefSupply,
  Distribution,
} from '@/types/resources';

describe('UC03: Relief Supply Service & Distribution Workflow', () => {
  const sampleSupplyData: CreateReliefSupplyData = {
    itemName: 'Bottled Mineral Water 5L Packs',
    type: 'water',
    totalQuantity: 5000,
    unit: 'bottles',
    organisationName: 'Sri Lanka Red Cross Society',
    organisationType: 'ngo',
    district: 'Ratnapura',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Relief Supply Inventory Registration (UC03 Steps 57–58)', () => {
    it('should register a new relief supply item with initial remainingQuantity equal to totalQuantity', async () => {
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'supply-water-5000' });

      const supplyId = await createSupply(sampleSupplyData, 'officer-user-101', 'event-monsoon-2026');

      expect(supplyId).toBe('supply-water-5000');
      expect(addDoc).toHaveBeenCalledTimes(1);
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          itemName: 'Bottled Mineral Water 5L Packs',
          type: 'water',
          totalQuantity: 5000,
          remainingQuantity: 5000,
          unit: 'bottles',
          organisationName: 'Sri Lanka Red Cross Society',
          organisationType: 'ngo',
          district: 'Ratnapura',
          hazardEventId: 'event-monsoon-2026',
          createdBy: 'officer-user-101',
        }),
      );
    });

    it('should register government and private donor supplies across different commodity categories', async () => {
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'supply-med-01' });

      const medicalSupply: CreateReliefSupplyData = {
        itemName: 'Emergency First Aid & Antibiotic Kits',
        type: 'medicine',
        totalQuantity: 300,
        unit: 'kits',
        organisationName: 'Ministry of Health',
        organisationType: 'government',
        district: 'Ratnapura',
      };

      const supplyId = await createSupply(medicalSupply, 'officer-user-101', 'event-monsoon-2026');

      expect(supplyId).toBe('supply-med-01');
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'medicine',
          totalQuantity: 300,
          remainingQuantity: 300,
          organisationType: 'government',
        }),
      );
    });
  });

  describe('Relief Supply Distribution Workflow (UC03 Main Flow Steps 59–61)', () => {
    const validDistribution: CreateDistributionData = {
      supplyId: 'supply-water-5000',
      supplyName: 'Bottled Mineral Water 5L Packs',
      quantity: 1200,
      unit: 'bottles',
      destinationDistrict: 'Ratnapura',
      destinationLocation: 'Ratnapura Central College Safe Haven',
      details: 'Priority delivery for flood evacuees',
    };

    it('should successfully record distribution and decrement remainingQuantity', async () => {
      // Mock existing supply document with remainingQuantity 5000
      const mockSupplyDoc = {
        exists: () => true,
        data: () => ({
          itemName: 'Bottled Mineral Water 5L Packs',
          totalQuantity: 5000,
          remainingQuantity: 5000,
          unit: 'bottles',
        }),
      };
      (getDoc as jest.Mock).mockResolvedValueOnce(mockSupplyDoc);
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'dist-txn-001' });

      const distId = await distributeSupply(
        validDistribution,
        'officer-user-101',
        'event-monsoon-2026',
      );

      expect(distId).toBe('dist-txn-001');

      // 1. Verifies distribution record written to 'distributions' collection
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          supplyId: 'supply-water-5000',
          supplyName: 'Bottled Mineral Water 5L Packs',
          quantity: 1200,
          unit: 'bottles',
          destinationDistrict: 'Ratnapura',
          destinationLocation: 'Ratnapura Central College Safe Haven',
          distributedBy: 'officer-user-101',
          hazardEventId: 'event-monsoon-2026',
        }),
      );

      // 2. Verifies supply document updated with decremented remainingQuantity: 5000 - 1200 = 3800
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          remainingQuantity: 3800,
        }),
      );
    });

    it('should allow distributing the exact remaining quantity down to 0', async () => {
      const mockSupplyDoc = {
        exists: () => true,
        data: () => ({
          itemName: 'Bottled Mineral Water 5L Packs',
          totalQuantity: 5000,
          remainingQuantity: 1200,
          unit: 'bottles',
        }),
      };
      (getDoc as jest.Mock).mockResolvedValueOnce(mockSupplyDoc);
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'dist-txn-002' });

      const distId = await distributeSupply(
        validDistribution,
        'officer-user-101',
        'event-monsoon-2026',
      );

      expect(distId).toBe('dist-txn-002');
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          remainingQuantity: 0,
        }),
      );
    });

    it('should fallback to totalQuantity if remainingQuantity is undefined on doc', async () => {
      const mockSupplyDoc = {
        exists: () => true,
        data: () => ({
          itemName: 'Bottled Mineral Water 5L Packs',
          totalQuantity: 2000,
          // remainingQuantity omitted
          unit: 'bottles',
        }),
      };
      (getDoc as jest.Mock).mockResolvedValueOnce(mockSupplyDoc);
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'dist-txn-003' });

      await distributeSupply(
        { ...validDistribution, quantity: 500 },
        'officer-user-101',
        'event-monsoon-2026',
      );

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          remainingQuantity: 1500, // 2000 - 500
        }),
      );
    });
  });

  describe('Distribution Exception Flows (UC03 Exception Handling)', () => {
    it('should throw an error when requested quantity exceeds available quantity (Insufficient Relief Supply)', async () => {
      const mockSupplyDoc = {
        exists: () => true,
        data: () => ({
          itemName: 'Bottled Mineral Water 5L Packs',
          totalQuantity: 5000,
          remainingQuantity: 800, // Only 800 available
          unit: 'bottles',
        }),
      };
      (getDoc as jest.Mock).mockResolvedValueOnce(mockSupplyDoc);

      const excessRequest: CreateDistributionData = {
        supplyId: 'supply-water-5000',
        supplyName: 'Bottled Mineral Water 5L Packs',
        quantity: 1500, // Requesting 1500 > 800
        unit: 'bottles',
        destinationDistrict: 'Ratnapura',
        destinationLocation: 'Kalu Ganga Evacuation Camp',
        details: 'Urgent convoy',
      };

      await expect(
        distributeSupply(excessRequest, 'officer-user-101', 'event-monsoon-2026'),
      ).rejects.toThrow('Insufficient supplies. Requested: 1500, Available: 800');

      // Verifies no distribution document was added and no update occurred
      expect(addDoc).not.toHaveBeenCalled();
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('should throw an error when supply item does not exist in inventory', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => false,
      });

      const invalidItemRequest: CreateDistributionData = {
        supplyId: 'non-existent-supply-id',
        supplyName: 'Ghost Item',
        quantity: 100,
        unit: 'packs',
        destinationDistrict: 'Ratnapura',
        destinationLocation: 'Camp 1',
        details: 'Test',
      };

      await expect(
        distributeSupply(invalidItemRequest, 'officer-user-101', 'event-monsoon-2026'),
      ).rejects.toThrow('Supply item does not exist in inventory');

      expect(addDoc).not.toHaveBeenCalled();
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });

  describe('Relief Supply Queries & Transaction Logs', () => {
    it('should retrieve all relief supplies sorted descending by creation time', async () => {
      const mockDoc1 = {
        id: 'sup-1',
        data: () => ({
          itemName: 'Cooked Rice Packs',
          type: 'food',
          totalQuantity: 1000,
          remainingQuantity: 600,
          createdAt: { toDate: () => new Date('2026-10-09T03:00:00Z') },
        }),
      };
      const mockDoc2 = {
        id: 'sup-2',
        data: () => ({
          itemName: 'Water Purification Tablets',
          type: 'water',
          totalQuantity: 2000,
          remainingQuantity: 2000,
          createdAt: { toDate: () => new Date('2026-10-09T05:00:00Z') },
        }),
      };

      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: [mockDoc1, mockDoc2],
      });

      const supplies = await getSupplies();

      expect(supplies).toHaveLength(2);
      expect(supplies[0].id).toBe('sup-2');
      expect(supplies[1].id).toBe('sup-1');
      expect(collection).toHaveBeenCalledWith(expect.anything(), 'reliefSupplies');
    });

    it('should filter relief supplies by commodity category via getSuppliesByType', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: [
          {
            id: 'sup-med',
            data: () => ({
              itemName: 'Paracetamol & Antiseptics',
              type: 'medicine',
              totalQuantity: 500,
              remainingQuantity: 450,
              createdAt: { toDate: () => new Date('2026-10-09T04:00:00Z') },
            }),
          },
        ],
      });

      const medicalSupplies = await getSuppliesByType('medicine', 'event-monsoon-2026');

      expect(medicalSupplies).toHaveLength(1);
      expect(medicalSupplies[0].type).toBe('medicine');
      expect(where).toHaveBeenCalledWith('type', '==', 'medicine');
    });

    it('should retrieve distribution transaction logs for audit trail via getDistributions', async () => {
      const distDoc1 = {
        id: 'dist-1',
        data: () => ({
          supplyId: 'sup-1',
          supplyName: 'Cooked Rice Packs',
          quantity: 200,
          distributedAt: { toDate: () => new Date('2026-10-09T04:30:00Z') },
        }),
      };
      const distDoc2 = {
        id: 'dist-2',
        data: () => ({
          supplyId: 'sup-1',
          supplyName: 'Cooked Rice Packs',
          quantity: 200,
          distributedAt: { toDate: () => new Date('2026-10-09T05:30:00Z') },
        }),
      };

      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: [distDoc1, distDoc2],
      });

      const distributions = await getDistributions('sup-1');

      expect(distributions).toHaveLength(2);
      expect(distributions[0].id).toBe('dist-2');
      expect(distributions[1].id).toBe('dist-1');
    });

    it('should support real-time supply inventory subscription via onSuppliesChanged', () => {
      const mockCallback = jest.fn();
      const unsubscribe = onSuppliesChanged('event-monsoon-2026', mockCallback);

      expect(onSnapshot).toHaveBeenCalledTimes(1);
      expect(typeof unsubscribe).toBe('function');
    });
  });
});

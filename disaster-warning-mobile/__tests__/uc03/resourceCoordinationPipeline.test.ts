/**
 * End-to-End Orchestration & Lifecycle Pipeline Test for UC03:
 * Coordinate Shelters, Rescue Teams and Relief Supplies.
 *
 * Simulates the complete chronological response workflow during
 * Southwest Monsoon Severe Flooding in Ratnapura District:
 * 1. Open Resource Coordination dashboard
 * 2. Register emergency safe haven shelter
 * 3. Activate shelter for active hazard event
 * 4. Record progressive evacuee arrival and capacity utilization
 * 5. Handle approaching-capacity alert
 * 6. Dispatch multi-agency rescue team (Sri Lanka Navy RABS)
 * 7. Track rescue team real-time status progression to completion
 * 8. Distribute multi-commodity relief supplies (food and clean water)
 * 9. Enforce inventory overdraft guard (Exception Flow)
 * 10. Handle over-capacity surge (Exception Flow: truthful recording)
 * 11. Decant and reallocate evacuees
 * 12. Deactivate shelter as flood hazard recedes
 */
import {
  createShelter,
  activateShelter,
  updateOccupancy,
  deactivateShelter,
} from '@/services/shelterService';
import {
  createTeam,
  dispatchTeam,
  updateTeamStatus,
} from '@/services/rescueTeamService';
import {
  createSupply,
  distributeSupply,
} from '@/services/reliefSupplyService';
import { addDoc, updateDoc, getDoc } from 'firebase/firestore';

describe('UC03: Resource Coordination End-to-End Mission Pipeline', () => {
  const hazardEventId = 'event-southwest-monsoon-2026';
  const officerUid = 'officer-ratnapura-dmc-01';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('executes the complete unified emergency coordination pipeline successfully', async () => {
    // -------------------------------------------------------------
    // Phase 1: Shelter Registration & Activation (UC03 Steps 41–48)
    // -------------------------------------------------------------
    (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'shelter-ratnapura-01' });

    const shelterId = await createShelter(
      {
        name: 'Ratnapura Central College Safe Haven',
        facilityType: 'school',
        address: '100 Main Road, Ratnapura',
        district: 'Ratnapura',
        latitude: 6.6828,
        longitude: 80.4035,
        capacity: 250,
        facilities: ['Water Supply', 'Sanitation', 'Kitchen', 'Medical Aid'],
        managerName: 'K. B. Wickramasinghe',
        managerContact: '+94771234567',
        organisationType: 'government',
        organisationName: 'District Secretariat Ratnapura',
      },
      officerUid,
    );

    expect(shelterId).toBe('shelter-ratnapura-01');
    expect(addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'registered',
        currentOccupancy: 0,
        capacity: 250,
      }),
    );

    // Officer activates shelter for active monsoon event
    await activateShelter(shelterId, hazardEventId);
    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'active',
        hazardEventId,
      }),
    );

    // -------------------------------------------------------------
    // Phase 2: Progressive Evacuee Arrival & Approaching Capacity (UC03 Steps 49–50)
    // -------------------------------------------------------------
    // Step 2a: Initial arrival of 100 evacuees (40% capacity)
    await updateOccupancy(shelterId, 100, 250);
    expect(updateDoc).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        currentOccupancy: 100,
        status: 'active',
      }),
    );

    // Step 2b: Additional evacuees arrive: headcount rises to 215 (86% - Approaching Capacity!)
    await updateOccupancy(shelterId, 215, 250);
    expect(updateDoc).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        currentOccupancy: 215,
        status: 'active',
      }),
    );

    // -------------------------------------------------------------
    // Phase 3: Tactical Rescue Team Dispatch & Telemetry (UC03 Steps 51–56)
    // -------------------------------------------------------------
    (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'team-navy-rabs-01' });

    const teamId = await createTeam(
      {
        name: 'Sri Lanka Navy RABS Unit 01',
        organisationName: 'Sri Lanka Navy',
        organisationType: 'armed_forces',
        memberCount: 12,
        specialisation: 'Water Rescue',
        district: 'Ratnapura',
      },
      officerUid,
    );

    expect(teamId).toBe('team-navy-rabs-01');

    // Dispatch unit to flood-marooned village
    await dispatchTeam(teamId, 'Elapatha Low-Lying Sector', hazardEventId);
    expect(updateDoc).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'dispatched',
        assignedLocation: 'Elapatha Low-Lying Sector',
      }),
    );

    // Unit advances mission status: en_route -> on_site -> completed -> available
    await updateTeamStatus(teamId, 'en_route');
    expect(updateDoc).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'en_route' }),
    );

    await updateTeamStatus(teamId, 'on_site');
    expect(updateDoc).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'on_site' }),
    );

    await updateTeamStatus(teamId, 'completed');
    expect(updateDoc).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'completed', assignedLocation: '' }),
    );

    // -------------------------------------------------------------
    // Phase 4: Relief Supplies Distribution & Overdraft Protection (UC03 Steps 57–61)
    // -------------------------------------------------------------
    (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'supply-rations-01' });

    const supplyId = await createSupply(
      {
        itemName: 'Emergency Food Ration Packs',
        type: 'food',
        totalQuantity: 2000,
        unit: 'packs',
        organisationName: 'Sri Lanka Red Cross',
        organisationType: 'ngo',
        district: 'Ratnapura',
      },
      officerUid,
      hazardEventId,
    );

    expect(supplyId).toBe('supply-rations-01');

    // Normal distribution: 500 packs to safe haven shelter
    (getDoc as jest.Mock).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        itemName: 'Emergency Food Ration Packs',
        totalQuantity: 2000,
        remainingQuantity: 2000,
        unit: 'packs',
      }),
    });
    (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'dist-record-01' });

    const distTxnId = await distributeSupply(
      {
        supplyId,
        supplyName: 'Emergency Food Ration Packs',
        quantity: 500,
        unit: 'packs',
        destinationDistrict: 'Ratnapura',
        destinationLocation: 'Ratnapura Central College Safe Haven',
        details: 'First relief convoy',
      },
      officerUid,
      hazardEventId,
    );

    expect(distTxnId).toBe('dist-record-01');
    expect(updateDoc).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ remainingQuantity: 1500 }),
    );

    // Exception Flow: Attempted overdraft (requesting 3000 packs when only 1500 remain)
    (getDoc as jest.Mock).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        itemName: 'Emergency Food Ration Packs',
        totalQuantity: 2000,
        remainingQuantity: 1500,
        unit: 'packs',
      }),
    });

    await expect(
      distributeSupply(
        {
          supplyId,
          supplyName: 'Emergency Food Ration Packs',
          quantity: 3000,
          unit: 'packs',
          destinationDistrict: 'Ratnapura',
          destinationLocation: 'Secondary Camp',
          details: 'Overdraft attempt',
        },
        officerUid,
        hazardEventId,
      ),
    ).rejects.toThrow('Insufficient supplies. Requested: 3000, Available: 1500');

    // -------------------------------------------------------------
    // Phase 5: Over-Capacity Exception & Evacuee Reallocation
    // -------------------------------------------------------------
    // Surge headcount: 280 evacuees arrive at the 250-capacity shelter
    await updateOccupancy(shelterId, 280, 250);
    expect(updateDoc).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        currentOccupancy: 280,
        status: 'over_capacity', // Faithful truth logging
      }),
    );

    // Decanting: 50 evacuees moved to another facility; headcount falls to 230
    await updateOccupancy(shelterId, 230, 250);
    expect(updateDoc).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        currentOccupancy: 230,
        status: 'active', // Status restored
      }),
    );

    // -------------------------------------------------------------
    // Phase 6: Post-Hazard Deactivation (UC03 Alternate Flow)
    // -------------------------------------------------------------
    // Flood subsides, citizens safely return home
    await updateOccupancy(shelterId, 0, 250);
    await deactivateShelter(shelterId);

    expect(updateDoc).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'inactive',
        hazardEventId: '',
      }),
    );
  });
});

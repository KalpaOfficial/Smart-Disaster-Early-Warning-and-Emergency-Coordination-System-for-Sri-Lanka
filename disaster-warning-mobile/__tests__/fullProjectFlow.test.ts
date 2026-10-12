import { auth } from '@/services/firebase';
import { doc, getDocs } from 'firebase/firestore';
import {
  createHazardEvent,
  getHazardEvent,
  setHazardEventStatus,
} from '@/services/hazardEventService';
import { executeWarningDispatchPipeline } from '@/services/warningService';
import { submitGroundReport, verifyReport } from '@/services/groundReportService';
import { createShelter, activateShelter, updateOccupancy } from '@/services/shelterService';
import { createSupply, distributeSupply } from '@/services/reliefSupplyService';
import { createTeam, dispatchTeam, updateTeamStatus } from '@/services/rescueTeamService';
import {
  generatePostEventReport,
  exportReport,
  distributeReportToDonor,
} from '@/services/postEventReportService';
import { allCriteria, setupReporting } from './uc04/fixtures';

it('preserves UC01/02/03 records through event closure, UC04 aggregation and donor audit', async () => {
  const records = setupReporting();
  for (const key of [...records.keys()])
    if (!key.startsWith('users/') && !key.startsWith('donorOrganisations/')) records.delete(key);
  records.set('users/citizen', { role: 'citizen', district: 'Ratnapura', fullName: 'Citizen' });
  records.set('users/district', { role: 'district_officer', district: 'Ratnapura' });
  let nextId = 0;
  (doc as jest.Mock).mockImplementation((source, ...parts: string[]) => {
    const path = source?.path
      ? [source.path, ...(parts.length ? parts : [`flow-${++nextId}`])].join('/')
      : parts.join('/');
    return { path, id: path.split('/').pop() };
  });
  (getDocs as jest.Mock).mockImplementation(async ({ path, filters = [] }) => ({
    docs: [...records.entries()]
      .filter(
        ([key, data]) =>
          key.startsWith(path + '/') &&
          key.split('/').length === path.split('/').length + 1 &&
          filters.every((f: { field: string; operator: string; value: unknown }) =>
            f.operator === 'in'
              ? (f.value as unknown[]).includes(data[f.field])
              : data[f.field] === f.value
          )
      )
      .map(([key, data]) => ({ id: key.split('/').pop(), data: () => structuredClone(data) })),
  }));
  const eventId = await createHazardEvent({
    title: 'Flood response',
    description: 'Water rising around the town.',
    hazardType: 'flood',
    affectedDistricts: ['Ratnapura'],
    status: 'active',
  });
  const warning = await executeWarningDispatchPipeline(
    {
      eventId,
      hazardEventTitle: 'Flood response',
      resolvedDistricts: ['Ratnapura'],
      recipientCount: 1,
      hazardType: 'flood',
      severity: 'warning',
      targetMode: 'district',
      targetAreas: ['Ratnapura'],
      headline: 'River flood warning',
      instructions: 'Move to safe ground.',
      channels: ['push'],
    },
    'dmc',
    'DMC officer'
  );
  expect(warning.recipientCount).toBe(1);
  expect(warning.finalStatus).toBe('delivered');
  Object.assign(auth, { currentUser: { uid: 'citizen' } });
  const observation = await submitGroundReport(
    {
      observationType: 'rising_water',
      description: 'Water is rising near the road.',
      photoUri: 'https://example.org/photo.jpg',
      location: { latitude: 6.7, longitude: 80.4 },
      locationName: 'Town road',
      district: 'Ratnapura',
      isManualLocation: false,
      captureTime: new Date().toISOString(),
    },
    'https://example.org/photo.jpg',
    null,
    { id: 'citizen', role: 'citizen', fullName: 'Citizen' }
  );
  Object.assign(auth, { currentUser: { uid: 'dmc' } });
  await verifyReport(
    observation.id,
    { uid: 'dmc', name: 'DMC officer' },
    { hazardEventId: eventId, decisionNote: 'Evidence checked.' }
  );
  expect(records.get(`groundReports/${observation.id}`)).toMatchObject({
    status: 'verified',
    hazardEventId: eventId,
  });
  Object.assign(auth, { currentUser: { uid: 'district' } });
  const owner = {
    district: 'Ratnapura',
    organisationType: 'government' as const,
    organisationName: 'District office',
  };
  const teamId = await createTeam(
    { ...owner, name: 'Rescue unit', memberCount: 12, specialisation: 'Water rescue' },
    'district'
  );
  await dispatchTeam(teamId, 'Town road', eventId);
  await updateTeamStatus(teamId, 'en_route');
  await updateTeamStatus(teamId, 'on_site');
  await updateTeamStatus(teamId, 'completed');
  expect(records.get(`rescueTeams/${teamId}`)).toMatchObject({
    status: 'completed',
    hazardEventId: eventId,
  });
  await updateTeamStatus(teamId, 'available');
  expect(records.get(`rescueTeams/${teamId}`)).toMatchObject({
    status: 'available',
    hazardEventId: '',
  });
  const shelterId = await createShelter(
    {
      ...owner,
      name: 'Town shelter',
      address: 'Town centre',
      facilityType: 'school',
      latitude: 6.7,
      longitude: 80.4,
      capacity: 100,
      managerName: 'Officer',
      managerContact: '0711234567',
      facilities: ['water'],
    },
    'district'
  );
  await activateShelter(shelterId, eventId);
  await updateOccupancy(shelterId, 20, 100);
  const supplyId = await createSupply(
    { ...owner, itemName: 'Food packs', type: 'food', unit: 'packs', totalQuantity: 30 },
    'district',
    eventId
  );
  await distributeSupply(
    {
      supplyId,
      supplyName: 'Food packs',
      unit: 'packs',
      details: 'Supplies delivered to the shelter.',
      quantity: 5,
      destinationDistrict: 'Ratnapura',
      destinationLocation: 'Town shelter',
    },
    'district',
    eventId
  );
  expect(records.get(`reliefSupplies/${supplyId}`)?.remainingQuantity).toBe(25);
  Object.assign(auth, { currentUser: { uid: 'dmc' } });
  await setHazardEventStatus(eventId, 'closed');
  const event = await getHazardEvent(eventId);
  expect(event?.status).toBe('closed');
  const report = await generatePostEventReport(event!, allCriteria, 'dmc');
  expect(report.metrics.alerts).toMatchObject({ totalAlertsIssued: 1 });
  expect(report.metrics.citizenReach).toMatchObject({ totalCitizensReached: 1 });
  expect(report.metrics.shelterOccupancy).toMatchObject({
    totalCapacitiesOccupied: 20,
    peakOccupancyPercentage: 20,
  });
  expect(report.metrics.resourceDistribution).toMatchObject({
    distributionByDistrict: {
      Ratnapura: { items: [{ name: 'Food packs', quantity: 5, unit: 'packs' }] },
    },
  });
  const exported = await exportReport(report.id, 'csv');
  const audit = await distributeReportToDonor(
    report.id,
    eventId,
    'donor',
    '',
    'csv',
    exported.exportUrl,
    'dmc'
  );
  expect(audit).toMatchObject({
    reportId: report.id,
    eventId,
    status: 'SHARED',
    donorName: 'Relief Partner',
  });
}, 10000);

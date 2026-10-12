/** Fictional Sri Lankan demo scenarios matching the current Firestore schemas. */
import type { HazardEvent, Shelter, RescueTeam, ReliefSupply } from '@/types/resources';
import type { User } from '@/types/auth';
import type { GroundReport, ObservationType, ReportStatus } from '@/types/groundReport';
import type { HazardWarning, ChannelResult, DeliveryLog } from '@/types/warning';
import type { EventTimelineEntry } from '@/services/hazardEventService';
import type { Distribution } from '@/types/resources';
import type { PostEventReport, DonorDistributionRecord } from '@/types/postEventReport';
import { resolveDistrictsFromTargetAreas } from '@/services/recipientService';

type SeedShelter = Omit<Shelter, 'createdBy' | 'createdAt'> & { organisationId?: string };
type SeedTeam = Omit<RescueTeam, 'createdBy' | 'createdAt' | 'lastStatusUpdate'>;
type SeedSupply = Omit<ReliefSupply, 'createdBy' | 'createdAt'>;

const BASE_DATA = {
  hazardEvents: [
    {
      id: 'event-monsoon-2026',
      title: 'Demo: Southwest Monsoon Flooding — Kalu & Kelani River Basins',
      hazardType: 'flood',
      warningLevel: 'Level 4 Alert',
      status: 'active',
      affectedDistricts: ['Ratnapura', 'Kalutara', 'Colombo', 'Gampaha'],
      affectedRiverBasins: ['Kalu River Basin', 'Kelani River Basin'],
      description:
        'Continuous torrential rains exceeding 200mm have triggered critical flood levels in Kalu, Kelani, and Nilwala rivers. Evacuations in progress.',
    },
    {
      id: 'event-landslide-2026',
      title: 'Demo: Central Highlands Landslide — Kegalle & Badulla',
      hazardType: 'landslide',
      warningLevel: 'Level 3 Warning',
      status: 'active',
      affectedDistricts: ['Kegalle', 'Badulla', 'Nuwara Eliya', 'Kandy'],
      affectedRiverBasins: ['Mahaweli River Basin'],
      description:
        'NBRO Red Alert issued for high-risk mountain slopes and catchment corridors following 48 hours of uninterrupted precipitation.',
    },
    {
      id: 'event-cyclone-eastern-2026',
      title: 'Demo: Completed Eastern Coastal Depression Exercise',
      hazardType: 'cyclone',
      status: 'closed',
      affectedDistricts: ['Batticaloa', 'Ampara', 'Trincomalee'],
      description:
        'Coastal warning downgraded as tropical depression crossed into the Bay of Bengal without landfall damage.',
    },
  ],
  shelters: [
    {
      id: 'shelter-ratnapura-bodhiraja',
      name: 'Ratnapura Bodhiraja Maha Vidyalaya Emergency Shelter',
      facilityType: 'school',
      address: 'Main Street, Ratnapura Town',
      district: 'Ratnapura',
      latitude: 6.6828,
      longitude: 80.4035,
      capacity: 450,
      currentOccupancy: 310,
      facilities: ['water', 'electricity', 'medical', 'sanitation', 'kitchen'],
      managerName: 'K. Bandara (Grama Niladhari)',
      managerContact: '+94714528990',
      organisationId: 'gov-ratnapura-sec',
      organisationType: 'government',
      organisationName: 'District Secretariat Ratnapura',
      status: 'active',
      hazardEventId: 'event-monsoon-2026',
    },
    {
      id: 'shelter-kalutara-townhall',
      name: 'Kalutara South Town Hall Safe Haven',
      facilityType: 'community_hall',
      address: 'Nagoda Road, Kalutara South',
      district: 'Kalutara',
      latitude: 6.5854,
      longitude: 79.9607,
      capacity: 600,
      currentOccupancy: 420,
      facilities: ['water', 'electricity', 'medical', 'generator', 'sleeping_mats'],
      managerName: 'R. Perera (Relief Officer)',
      managerContact: '+94773124567',
      organisationId: 'gov-kalutara-uc',
      organisationType: 'government',
      organisationName: 'Kalutara Urban Council & DMC',
      status: 'active',
      hazardEventId: 'event-monsoon-2026',
    },
    {
      id: 'shelter-kelaniya-dharmaloka',
      name: 'Kelaniya Sri Dharmaloka College Evacuation Centre',
      facilityType: 'school',
      address: 'Peliyagoda, Kelaniya',
      district: 'Gampaha',
      latitude: 6.9538,
      longitude: 79.9145,
      capacity: 500,
      currentOccupancy: 215,
      facilities: ['water', 'electricity', 'kitchen', 'sanitation'],
      managerName: 'Sunil Weerakkody',
      managerContact: '+94702334455',
      organisationId: 'dmc-central',
      organisationType: 'government',
      organisationName: 'Disaster Management Centre (DMC)',
      status: 'active',
      hazardEventId: 'event-monsoon-2026',
    },
    {
      id: 'shelter-kolonnawa-terrence',
      name: 'Kolonnawa Terrence N. De Silva Primary Shelter',
      facilityType: 'school',
      address: 'Wellampitiya, Kolonnawa',
      district: 'Colombo',
      latitude: 6.9312,
      longitude: 79.8856,
      capacity: 350,
      currentOccupancy: 360, // Over capacity test case (UC03 Exception Flow)
      facilities: ['water', 'electricity', 'medical'],
      managerName: 'L. Jayasinghe (Red Cross Lead)',
      managerContact: '+94765432109',
      organisationId: 'ngo-redcross-colombo',
      organisationType: 'ngo',
      organisationName: 'Sri Lanka Red Cross Society',
      status: 'over_capacity',
      hazardEventId: 'event-monsoon-2026',
    },
    {
      id: 'shelter-badulla-stbedes',
      name: "Badulla St. Bede's Community Hall",
      facilityType: 'community_hall',
      address: 'Badulla Town Circle',
      district: 'Badulla',
      latitude: 6.9934,
      longitude: 81.055,
      capacity: 300,
      currentOccupancy: 0,
      facilities: ['water', 'electricity', 'generator'],
      managerName: 'P. Wickramasinghe',
      managerContact: '+94719876543',
      organisationId: 'ngo-sarvodaya',
      organisationType: 'ngo',
      organisationName: 'Sarvodaya Shramadana Movement',
      status: 'registered',
      hazardEventId: 'event-landslide-2026',
    },
  ],
  rescueTeams: [
    {
      id: 'team-army-58th-flood',
      name: 'Sri Lanka Army 58th Division Swift Flood Rescue Unit',
      organisationName: 'Sri Lanka Army (Search & Rescue)',
      organisationType: 'armed_forces',
      memberCount: 24,
      specialisation: 'Water / Flood Rescue',
      district: 'Ratnapura',
      status: 'on_site',
      assignedLocation: 'Kalu Ganga Basin - Ayagama Sector',
      hazardEventId: 'event-monsoon-2026',
    },
    {
      id: 'team-navy-rabs-4',
      name: 'Sri Lanka Navy Rapid Action Boat Squadron (RABS Unit 4)',
      organisationName: 'Sri Lanka Navy',
      organisationType: 'armed_forces',
      memberCount: 16,
      specialisation: 'Water / Flood Rescue',
      district: 'Kalutara',
      status: 'dispatched',
      assignedLocation: 'Millaniya River Crossing Corridor',
      hazardEventId: 'event-monsoon-2026',
    },
    {
      id: 'team-slaf-flight-1',
      name: 'SLAF Helo Air-Sea & Flood SAR Flight 1',
      organisationName: 'Sri Lanka Air Force (SLAF)',
      organisationType: 'armed_forces',
      memberCount: 8,
      specialisation: 'Medical Evacuation & Triage',
      district: 'Colombo',
      status: 'available',
      assignedLocation: '',
      hazardEventId: 'event-monsoon-2026',
    },
    {
      id: 'team-redcross-drt-ratnapura',
      name: 'Sri Lanka Red Cross Disaster Response Team (DRT Ratnapura)',
      organisationName: 'Sri Lanka Red Cross Society',
      organisationType: 'ngo',
      memberCount: 15,
      specialisation: 'Medical Evacuation & Triage',
      district: 'Ratnapura',
      status: 'en_route',
      assignedLocation: 'Nivitigala Flood Relief Base',
      hazardEventId: 'event-monsoon-2026',
    },
    {
      id: 'team-nbro-stf-landslide',
      name: 'NBRO / Special Task Force Mountain SAR Unit',
      organisationName: 'National Building Research Organisation (NBRO)',
      organisationType: 'government',
      memberCount: 12,
      specialisation: 'Landslide Search & Rescue',
      district: 'Kegalle',
      status: 'available',
      assignedLocation: '',
      hazardEventId: 'event-landslide-2026',
    },
    {
      id: 'team-sarvodaya-galle',
      name: 'Sarvodaya Volunteer Youth Rescue Team — South',
      organisationName: 'Sarvodaya Shramadana Movement',
      organisationType: 'ngo',
      memberCount: 20,
      specialisation: 'General Disaster Relief',
      district: 'Galle',
      status: 'completed',
      assignedLocation: '',
      hazardEventId: 'event-monsoon-2026',
    },
  ],
  reliefSupplies: [
    {
      id: 'supply-wfp-dryrations',
      type: 'food',
      itemName: 'WFP Emergency Dry Rations Family Kit (7-Day Pack)',
      totalQuantity: 3500,
      remainingQuantity: 2400,
      unit: 'packs',
      organisationName: 'UN World Food Programme (WFP)',
      organisationType: 'ngo',
      district: 'Ratnapura',
      hazardEventId: 'event-monsoon-2026',
    },
    {
      id: 'supply-drinking-water-5l',
      type: 'water',
      itemName: 'Bottled Drinking Water (5L Sealed Jerrycans)',
      totalQuantity: 10000,
      remainingQuantity: 6800,
      unit: 'litres',
      organisationName: 'Ceylon Beverage Consortium (Private Donor)',
      organisationType: 'private_donor',
      district: 'Colombo',
      hazardEventId: 'event-monsoon-2026',
    },
    {
      id: 'supply-first-aid-kits',
      type: 'medicine',
      itemName: 'First Aid & Emergency Trauma Triage Kits',
      totalQuantity: 800,
      remainingQuantity: 520,
      unit: 'kits',
      organisationName: 'Sri Lanka Red Cross Society',
      organisationType: 'ngo',
      district: 'Ratnapura',
      hazardEventId: 'event-monsoon-2026',
    },
    {
      id: 'supply-fleece-blankets',
      type: 'blankets',
      itemName: 'Thermal Fleece Blankets & Water-Resistant Mats',
      totalQuantity: 2500,
      remainingQuantity: 1850,
      unit: 'units',
      organisationName: 'Ministry of Disaster Management',
      organisationType: 'government',
      district: 'Kalutara',
      hazardEventId: 'event-monsoon-2026',
    },
    {
      id: 'supply-army-tents-6p',
      type: 'tents',
      itemName: 'All-Weather Family Evacuation Tents (6-Person)',
      totalQuantity: 300,
      remainingQuantity: 190,
      unit: 'tents',
      organisationName: 'Sri Lanka Army Engineer Services',
      organisationType: 'armed_forces',
      district: 'Kegalle',
      hazardEventId: 'event-landslide-2026',
    },
    {
      id: 'supply-unicef-water-purification',
      type: 'water',
      itemName: 'AquaTab Water Purification Tablets (50L strip)',
      totalQuantity: 50000,
      remainingQuantity: 42000,
      unit: 'tablets',
      organisationName: 'UNICEF Sri Lanka',
      organisationType: 'ngo',
      district: 'Colombo',
      hazardEventId: 'event-monsoon-2026',
    },
  ],
} satisfies {
  hazardEvents: Omit<HazardEvent, 'startDate'>[];
  shelters: SeedShelter[];
  rescueTeams: SeedTeam[];
  reliefSupplies: SeedSupply[];
};

export const SEED_VERSION = 2;
const FLOOD = 'event-monsoon-2026';
const LANDSLIDE = 'event-landslide-2026';
const CLOSED = 'event-cyclone-eastern-2026';

type SeedWarning = Pick<
  HazardWarning,
  | 'id'
  | 'eventId'
  | 'severity'
  | 'targetMode'
  | 'targetAreas'
  | 'headline'
  | 'instructions'
  | 'channels'
  | 'status'
  | 'previousWarningId'
> & { hoursAgo: number };

const warnings: SeedWarning[] = [
  {
    id: 'warning-kalu-advisory',
    eventId: FLOOD,
    severity: 'advisory',
    targetMode: 'river_basin',
    targetAreas: ['Kalu River Basin'],
    headline: 'Demo: Kalu River rainfall advisory',
    instructions: 'Monitor water levels and prepare an emergency bag.',
    channels: ['push', 'sms'],
    status: 'delivered',
    previousWarningId: null,
    hoursAgo: 36,
  },
  {
    id: 'warning-kalu-warning',
    eventId: FLOOD,
    severity: 'warning',
    targetMode: 'river_basin',
    targetAreas: ['Kalu River Basin'],
    headline: 'Demo: Kalu River flood warning',
    instructions: 'Prepare to move to a designated shelter.',
    channels: ['push', 'sms'],
    status: 'delivered',
    previousWarningId: 'warning-kalu-advisory',
    hoursAgo: 24,
  },
  {
    id: 'warning-kalu-river-red',
    eventId: FLOOD,
    severity: 'evacuation',
    targetMode: 'river_basin',
    targetAreas: ['Kalu River Basin'],
    headline: 'Demo: Kalu River evacuation scenario',
    instructions: 'Move to designated shelters using safe routes.',
    channels: ['push', 'sms', 'audible'],
    status: 'partially_failed',
    previousWarningId: 'warning-kalu-warning',
    hoursAgo: 12,
  },
  {
    id: 'warning-kelani-delivery-failed',
    eventId: FLOOD,
    severity: 'warning',
    targetMode: 'river_basin',
    targetAreas: ['Kelani River Basin'],
    headline: 'Demo: Kelani River delivery failure',
    instructions: 'Avoid flooded roads and river crossings.',
    channels: ['push', 'sms'],
    status: 'failed',
    previousWarningId: null,
    hoursAgo: 10,
  },
  {
    id: 'warning-kegalle-landslide-amber',
    eventId: LANDSLIDE,
    severity: 'warning',
    targetMode: 'district',
    targetAreas: ['Kegalle', 'Badulla', 'Nuwara Eliya'],
    headline: 'Demo: Central highlands landslide warning',
    instructions: 'Report slope cracks and prepare to evacuate.',
    channels: ['push', 'sms'],
    status: 'delivered',
    previousWarningId: null,
    hoursAgo: 18,
  },
  {
    id: 'warning-landslide-cancelled',
    eventId: LANDSLIDE,
    severity: 'advisory',
    targetMode: 'district',
    targetAreas: ['Kandy'],
    headline: 'Demo: Superseded slope advisory',
    instructions: 'Follow the latest district warning.',
    channels: ['push'],
    status: 'cancelled',
    previousWarningId: null,
    hoursAgo: 30,
  },
  {
    id: 'warning-cyclone-advisory',
    eventId: CLOSED,
    severity: 'advisory',
    targetMode: 'district',
    targetAreas: ['Batticaloa', 'Ampara', 'Trincomalee'],
    headline: 'Demo: Eastern coast depression advisory',
    instructions: 'Secure loose roofing and avoid coastal fishing.',
    channels: ['push', 'sms'],
    status: 'cancelled',
    previousWarningId: null,
    hoursAgo: 168,
  },
  {
    id: 'warning-cyclone-evacuation',
    eventId: CLOSED,
    severity: 'evacuation',
    targetMode: 'district',
    targetAreas: ['Batticaloa', 'Ampara', 'Trincomalee'],
    headline: 'Demo: Eastern coast evacuation exercise',
    instructions: 'Move to inland shelters via designated routes.',
    channels: ['push', 'sms', 'audible'],
    status: 'cancelled',
    previousWarningId: 'warning-cyclone-advisory',
    hoursAgo: 156,
  },
];

const shelters: SeedShelter[] = [
  ...BASE_DATA.shelters,
  {
    ...BASE_DATA.shelters[4],
    id: 'shelter-batticaloa-closed',
    name: 'Batticaloa Community Hall (completed exercise)',
    district: 'Batticaloa',
    address: 'Batticaloa town',
    latitude: 7.7102,
    longitude: 81.6924,
    status: 'inactive',
    hazardEventId: CLOSED,
    capacity: 200,
    currentOccupancy: 0,
  },
  {
    ...BASE_DATA.shelters[4],
    id: 'shelter-kegalle-empty',
    name: 'Kegalle Standby Shelter',
    district: 'Kegalle',
    address: 'Kegalle town',
    latitude: 7.2513,
    longitude: 80.3464,
    status: 'active',
    hazardEventId: LANDSLIDE,
    currentOccupancy: 0,
  },
];
const rescueTeams: SeedTeam[] = [
  ...BASE_DATA.rescueTeams,
  {
    ...BASE_DATA.rescueTeams[4],
    id: 'team-landslide-unavailable',
    name: 'Mountain SAR Reserve (maintenance)',
    status: 'unavailable',
  },
  {
    ...BASE_DATA.rescueTeams[0],
    id: 'team-eastern-completed',
    name: 'Eastern Response Exercise Team',
    district: 'Batticaloa',
    hazardEventId: CLOSED,
    status: 'completed',
    assignedLocation: '',
  },
];
const reliefSupplies: SeedSupply[] = [
  ...BASE_DATA.reliefSupplies,
  ...(['food', 'water', 'medicine', 'blankets'] as const).map(type => {
    const supply = BASE_DATA.reliefSupplies.find(s => s.type === type)!;
    return {
      ...supply,
      id: `supply-eastern-${type}`,
      ...(type === 'water' ? { itemName: 'Demo Water Purification Kits', unit: 'kits' } : {}),
      district: 'Batticaloa',
      hazardEventId: CLOSED,
      totalQuantity: 200,
      remainingQuantity: 0,
    };
  }),
];
const distributions = reliefSupplies.map((supply, index) => ({
  id: `seed-distribution-${supply.id}`,
  supplyId: supply.id,
  supplyName: supply.itemName,
  quantity: supply.totalQuantity - supply.remainingQuantity,
  unit: supply.unit,
  destinationDistrict: supply.district,
  destinationLocation:
    shelters.find(s => s.hazardEventId === supply.hazardEventId && s.district === supply.district)
      ?.name || `${supply.district} District Relief Centre`,
  details: 'Fictional demo distribution; no physical supplies were dispatched.',
  hazardEventId: supply.hazardEventId,
  hoursAgo: supply.hazardEventId === CLOSED ? 144 + index : 8 + index,
}));

const groundReportScenarios: {
  id: string;
  district: string;
  locationName: string;
  location: GroundReport['location'];
  observationType: ObservationType;
  status: ReportStatus;
  description: string;
  hazardEventId: string | null;
}[] = [
  {
    id: 'report-ratnapura-kalu-flood',
    district: 'Ratnapura',
    locationName: 'Kalu Ganga Bridge, Ratnapura',
    location: { latitude: 6.6828, longitude: 80.4035 },
    observationType: 'rising_water',
    status: 'pending_verification',
    description: 'Demo: water rising beside the bridge; nearby low-lying road is flooded.',
    hazardEventId: null,
  },
  {
    id: 'report-kegalle-roadblock',
    district: 'Kegalle',
    locationName: 'Kegalle relief access road',
    location: { latitude: 7.2513, longitude: 80.3464 },
    observationType: 'blocked_road',
    status: 'verified',
    description: 'Demo: fallen trees and debris block the relief access road.',
    hazardEventId: LANDSLIDE,
  },
  {
    id: 'report-kadugannawa-crack',
    district: 'Kandy',
    locationName: 'Kadugannawa railway slope',
    location: { latitude: 7.2554, longitude: 80.5234 },
    observationType: 'landslide_crack',
    status: 'info_requested',
    description: 'Demo: visible slope cracks require measurements and further evidence.',
    hazardEventId: null,
  },
  {
    id: 'report-colombo-lightning-rejected',
    district: 'Colombo',
    locationName: 'Galle Face Green, Colombo',
    location: { latitude: 6.9271, longitude: 79.8612 },
    observationType: 'other',
    status: 'rejected',
    description: 'Demo: distant lightning at sea with no local damage.',
    hazardEventId: null,
  },
  {
    id: 'report-kalutara-verified-flood',
    district: 'Kalutara',
    locationName: 'Kalutara river crossing',
    location: { latitude: 6.5854, longitude: 79.9607 },
    observationType: 'rising_water',
    status: 'verified',
    description: 'Demo: flood water has covered the river crossing approach.',
    hazardEventId: FLOOD,
  },
  {
    id: 'report-eastern-closed',
    district: 'Batticaloa',
    locationName: 'Batticaloa town',
    location: { latitude: 7.7102, longitude: 81.6924 },
    observationType: 'blocked_road',
    status: 'verified',
    description: 'Demo: coastal storm debris was cleared during the completed exercise.',
    hazardEventId: CLOSED,
  },
];

/** Manifest counts are static except the extra personal report for each existing submitter. */
export const SEED_DATA = {
  hazardEvents: BASE_DATA.hazardEvents,
  warnings,
  shelters,
  rescueTeams,
  reliefSupplies,
  distributions,
  groundReports: groundReportScenarios,
  deliveryLogs: warnings.flatMap(w =>
    w.channels.map(channel => ({ id: `seed-log-${w.id}-${channel}` }))
  ),
  timelines: [
    ...warnings.map(w => ({ id: `timeline-warn-${w.id}`, eventId: w.eventId })),
    ...groundReportScenarios
      .filter(r => r.status === 'verified')
      .map(r => ({ id: `timeline-report-${r.id}`, eventId: r.hazardEventId! })),
  ],
  postEventReports: [{ id: 'seed-post-event-eastern', eventId: CLOSED }],
  donorDistributions: [{ id: 'seed-donor-eastern-csv' }, { id: 'seed-donor-eastern-pdf' }],
};

export interface SeedDocument {
  path: string;
  data: Record<string, unknown>;
}
export interface SeedResult {
  events: number;
  warnings: number;
  users: number;
  shelters: number;
  teams: number;
  supplies: number;
  distributions: number;
  groundReports: number;
  deliveryLogs: number;
  timelines: number;
  postEventReports: number;
  donorDistributions: number;
}

/** Build one consistent, linked dataset without writing users or invoking delivery services. */
export function buildSeedDocuments(
  users: User[],
  now = new Date(),
  officerId?: string
): { documents: SeedDocument[]; result: SeedResult } {
  const orderedUsers = [...users].sort((a, b) => a.id.localeCompare(b.id));
  const officer = orderedUsers.find(
    u => u.role === 'dmc_officer' && (!officerId || u.id === officerId)
  );
  const submitters = orderedUsers.filter(u => u.role === 'citizen' || u.role === 'volunteer');
  if (!officer || !submitters.length) {
    throw new Error(
      'Seeding requires an existing DMC officer and at least one citizen or volunteer. Register these accounts first.'
    );
  }
  const coordinator = orderedUsers.find(u => u.role === 'district_officer') || officer;
  const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3600000).toISOString();
  const documents: SeedDocument[] = [];
  const add = (path: string, data: object) =>
    documents.push({ path, data: { ...data, seedVersion: SEED_VERSION, isDemo: true } });
  const event = (id: string) => BASE_DATA.hazardEvents.find(e => e.id === id)!;
  const timeline: EventTimelineEntry[] = [];

  const seededWarnings = warnings.map(w => {
    const resolvedDistricts = resolveDistrictsFromTargetAreas(w.targetMode, w.targetAreas);
    const recipients = orderedUsers.filter(u => resolvedDistricts.includes(u.district || ''));
    const recipientCount = recipients.length;
    const channelResults: ChannelResult[] = w.channels.map(channel => {
      const failedCount =
        w.status === 'failed'
          ? recipientCount
          : w.status === 'partially_failed' && channel === 'sms'
            ? Math.ceil(recipientCount / 2)
            : 0;
      return {
        channel,
        recipientCount,
        deliveredCount: recipientCount - failedCount,
        failedCount,
        status:
          recipientCount === 0
            ? 'Failed'
            : failedCount === 0
              ? 'Success'
              : failedCount === recipientCount
                ? 'Failed'
                : 'Partial',
        ...(recipientCount === 0
          ? { errorMessage: 'No registered recipients in the demo target districts.' }
          : failedCount > 0
            ? { errorMessage: 'Simulated demo channel failure.' }
            : {}),
      };
    });
    const { hoursAgo, ...warningFields } = w;
    const warning: HazardWarning = {
      ...warningFields,
      status: recipientCount === 0 && w.status !== 'cancelled' ? 'failed' : w.status,
      warningId: w.id,
      hazardEventId: w.eventId,
      hazardEventTitle: event(w.eventId).title,
      hazardType: event(w.eventId).hazardType,
      resolvedDistricts,
      recipientCount,
      deliveryChannels: w.channels,
      channelResults,
      issuedBy: officer.id,
      issuedByUid: officer.id,
      issuedByName: officer.fullName,
      createdAt: at(hoursAgo),
      dispatchedAt: at(hoursAgo - 0.05),
      updatedAt: at(hoursAgo - 0.1),
    };
    add(`warnings/${w.id}`, { ...warning, recipientUids: recipients.map(u => u.id) });
    for (const result of channelResults) {
      const log: DeliveryLog = {
        ...result,
        logId: `seed-log-${w.id}-${result.channel}`,
        warningId: w.id,
        timestamp: at(w.hoursAgo - 0.05),
      };
      add(`deliveryLogs/${log.logId}`, { ...log, eventId: w.eventId, hazardEventId: w.eventId });
    }
    timeline.push({
      id: `timeline-warn-${w.id}`,
      eventId: w.eventId,
      warningId: w.id,
      eventType: 'WARNING_ISSUED',
      type: 'WARNING_ISSUED',
      severity: w.severity,
      headline: w.headline,
      summary: w.headline,
      issuedBy: officer.id,
      timestamp: at(w.hoursAgo),
    });
    return warning;
  });

  const reportScenarios = [
    ...groundReportScenarios.map(scenario => ({
      scenario,
      submitter: submitters.find(u => u.district === scenario.district) || submitters[0],
    })),
    ...submitters.map((submitter, index) => ({
      submitter,
      scenario: {
        ...groundReportScenarios[index % 4],
        id: `seed-personal-report-${submitter.id}`,
        status: 'pending_verification' as const,
        hazardEventId: null,
      },
    })),
  ];
  for (const [index, { scenario: r, submitter }] of reportScenarios.entries()) {
    const hoursAgo = r.hazardEventId === CLOSED ? 150 : 6 + index / 4;
    const createdAt = at(hoursAgo);
    const reviewed = r.status !== 'pending_verification';
    const report: GroundReport = {
      ...r,
      referenceNumber: `GR-${createdAt.slice(0, 10).replace(/-/g, '')}-${String(index + 1).padStart(4, '0')}`,
      photoUrl:
        'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=800&q=80',
      photoPath: null,
      isManualLocation: true,
      captureTime: at(hoursAgo + 0.25),
      submitterId: submitter.id,
      submitterName: submitter.fullName,
      submitterRole: submitter.role,
      hazardEventTitle: r.hazardEventId ? event(r.hazardEventId).title : null,
      verifiedBy: reviewed ? officer.id : null,
      verifiedByName: reviewed ? officer.fullName : null,
      verificationDecision:
        r.status === 'verified'
          ? 'Demo observation confirmed by the verification desk.'
          : r.status === 'rejected'
            ? 'Demo report rejected: insufficient evidence of a local hazard.'
            : null,
      verificationTimestamp: reviewed ? at(hoursAgo - 0.5) : null,
      infoRequestedMessage:
        r.status === 'info_requested'
          ? 'Please provide the crack dimensions and distance from nearby homes.'
          : null,
      additionalInfo: null,
      createdAt,
      updatedAt: reviewed ? at(hoursAgo - 0.5) : createdAt,
    };
    add(`groundReports/${r.id}`, report);
    if (r.status === 'verified' && r.hazardEventId) {
      timeline.push({
        id: `timeline-report-${r.id}`,
        eventId: r.hazardEventId,
        reportId: r.id,
        eventType: 'ground_report_verified',
        type: 'ground_report_verified',
        headline: `Ground Report Verified: ${report.referenceNumber}`,
        summary: r.description,
        issuedBy: officer.id,
        timestamp: report.verificationTimestamp!,
      });
    }
  }

  for (const e of BASE_DATA.hazardEvents) {
    const entries = timeline.filter(t => t.eventId === e.id);
    add(`hazardEvents/${e.id}`, {
      ...e,
      startDate: at(e.status === 'closed' ? 180 : 48),
      createdAt: at(e.status === 'closed' ? 180 : 48),
      updatedAt: at(e.status === 'closed' ? 120 : 1),
      ...(e.status === 'closed' ? { closedAt: at(120) } : {}),
      timeline: entries,
    });
    for (const t of entries) add(`hazardEvents/${e.id}/timeline/${t.id}`, t);
  }
  const closedOccupancy = [
    { date: at(168).slice(0, 10), occupancyCount: 50 },
    { date: at(144).slice(0, 10), occupancyCount: 150 },
    { date: at(120).slice(0, 10), occupancyCount: 0 },
  ];
  for (const s of shelters)
    add(`shelters/${s.id}`, {
      ...s,
      createdBy: coordinator.id,
      createdAt: at(s.hazardEventId === CLOSED ? 174 : 40),
      updatedAt: at(s.hazardEventId === CLOSED ? 120 : 2),
      ...(s.hazardEventId === CLOSED ? { occupancyHistory: closedOccupancy } : {}),
    });
  for (const t of rescueTeams)
    add(`rescueTeams/${t.id}`, {
      ...t,
      createdBy: coordinator.id,
      createdAt: at(t.hazardEventId === CLOSED ? 174 : 40),
      lastStatusUpdate: at(t.hazardEventId === CLOSED ? 120 : 2),
      updatedAt: at(t.hazardEventId === CLOSED ? 120 : 2),
    });
  for (const s of reliefSupplies)
    add(`reliefSupplies/${s.id}`, {
      ...s,
      createdBy: coordinator.id,
      createdAt: at(s.hazardEventId === CLOSED ? 174 : 40),
      updatedAt: at(s.hazardEventId === CLOSED ? 120 : 2),
    });
  for (const d of distributions) {
    const { hoursAgo, ...distributionFields } = d;
    const distribution: Distribution = {
      ...distributionFields,
      distributedBy: coordinator.id,
      distributedAt: at(hoursAgo),
    };
    add(`distributions/${d.id}`, distribution);
  }

  const closedWarnings = seededWarnings.filter(w => w.eventId === CLOSED);
  const closedShelters = shelters.filter(s => s.hazardEventId === CLOSED);
  const closedDistributions = distributions.filter(d => d.hazardEventId === CLOSED);
  const reached = orderedUsers.filter(u =>
    event(CLOSED).affectedDistricts.includes(u.district || '')
  );
  const report: PostEventReport = {
    id: 'seed-post-event-eastern',
    eventId: CLOSED,
    eventTitle: event(CLOSED).title,
    generatedBy: officer.id,
    generatedAt: at(119),
    filterCriteria: {
      startDate: at(180),
      endDate: at(120),
      selectedMetrics: [
        'alert_timeline',
        'citizens_reached',
        'shelter_occupancy',
        'resource_distribution',
      ],
    },
    overallStatus: 'COMPLETE',
    summary: { totalMetricsCount: 4, successfulMetricsCount: 4, failedMetricsCount: 0 },
    failedMetrics: [],
    metrics: {
      alerts: {
        totalAlertsIssued: closedWarnings.length,
        escalationCount: closedWarnings.filter(w => w.previousWarningId).length,
        warningsBySeverity: { EXTREME: 1, SEVERE: 0, MODERATE: 0, MINOR: 1 },
        timeline: closedWarnings.map(w => ({
          timestamp: w.createdAt,
          level: w.severity === 'evacuation' ? 'EXTREME' : 'MINOR',
          message: w.headline,
          warningId: w.id,
          severity: w.severity,
        })),
      },
      citizenReach: {
        totalCitizensReached: reached.length,
        reachBySector: Object.fromEntries(
          event(CLOSED).affectedDistricts.map(district => [
            district,
            reached.filter(u => u.district === district).length,
          ])
        ),
        notificationDeliveryRate: reached.length ? 100 : 0,
        acknowledgedCount: 0,
      },
      shelterOccupancy: {
        totalSheltersActive: closedShelters.length,
        peakOccupancyPercentage:
          (Math.max(...closedOccupancy.map(p => p.occupancyCount)) /
            closedShelters.reduce((sum, s) => sum + s.capacity, 0)) *
          100,
        totalCapacitiesOccupied: Math.max(...closedOccupancy.map(p => p.occupancyCount)),
        timeSeriesOccupancy: closedOccupancy,
      },
      resourceDistribution: {
        totalPackagesDistributed: closedDistributions.reduce((sum, d) => sum + d.quantity, 0),
        distributionByDistrict: {
          Batticaloa: { foodKits: 200, medicalKits: 200, waterPurifiers: 200, blankets: 200 },
        },
      },
    },
  };
  add(`postEventReports/${report.id}`, { ...report, createdAt: report.generatedAt });
  // These are failure examples only: no export file or donor message is actually sent.
  for (const format of ['csv', 'pdf'] as const) {
    const donor: DonorDistributionRecord = {
      id: `seed-donor-eastern-${format}`,
      reportId: report.id,
      eventId: CLOSED,
      donorId: 'seed-demo-donor',
      donorName: 'Demo Relief Partner',
      format,
      fileUrl: '',
      distributedBy: officer.id,
      distributedAt: at(118),
      status: 'FAILED',
    };
    add(`donorDistributions/${donor.id}`, donor);
  }
  return {
    documents,
    result: {
      events: BASE_DATA.hazardEvents.length,
      warnings: warnings.length,
      users: users.length,
      shelters: shelters.length,
      teams: rescueTeams.length,
      supplies: reliefSupplies.length,
      distributions: distributions.length,
      groundReports: reportScenarios.length,
      deliveryLogs: SEED_DATA.deliveryLogs.length,
      timelines: timeline.length,
      postEventReports: 1,
      donorDistributions: 2,
    },
  };
}

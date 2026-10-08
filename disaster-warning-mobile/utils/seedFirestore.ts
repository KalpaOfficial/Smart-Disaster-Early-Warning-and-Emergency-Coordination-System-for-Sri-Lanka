/**
 * Real Sri Lankan Disaster Management Seed Data for Firestore.
 * Populates hazard events, emergency shelters, rescue teams, relief supplies, and distributions.
 */
import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/services/firebase';

export const SEED_DATA = {
  hazardEvents: [
    {
      id: 'event-monsoon-2026',
      title: 'Southwest Monsoon Severe Flooding — Kalu & Kelani River Basins 2026',
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
      title: 'Central Highlands Level 3 Landslide Warning — Kegalle & Badulla',
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
      title: 'Pre-Monsoon Deep Depression — Eastern Coastal Belt',
      hazardType: 'cyclone',
      status: 'closed',
      affectedDistricts: ['Batticaloa', 'Ampara', 'Trincomalee'],
      description:
        'Coastal warning downgraded as tropical depression crossed into the Bay of Bengal without landfall damage.',
    },
  ],

  warnings: [
    {
      id: 'warning-kalu-river-red',
      warningId: 'warning-kalu-river-red',
      eventId: 'event-monsoon-2026',
      hazardEventId: 'event-monsoon-2026',
      headline: 'RED EVACUATION ALERT: Kalu River Basin Critical Water Level',
      title: 'RED EVACUATION ALERT: Kalu River Basin Critical Water Level',
      hazardType: 'flood',
      severity: 'evacuation',
      targetMode: 'river_basin',
      targetAreas: ['Kalu River Basin'],
      resolvedDistricts: ['Ratnapura', 'Kalutara'],
      recipientCount: 1420,
      instructions:
        'Immediate evacuation ordered for residents in low-lying areas along Kalu River. Move immediately to designated emergency shelters.',
      channels: ['push', 'sms', 'audible'],
      status: 'delivered',
      issuedBy: 'seed-dmc-officer',
      issuedByUid: 'seed-dmc-officer',
      issuedByName: 'DMC National Command Centre',
    },
    {
      id: 'warning-kegalle-landslide-amber',
      warningId: 'warning-kegalle-landslide-amber',
      eventId: 'event-landslide-2026',
      hazardEventId: 'event-landslide-2026',
      headline: 'AMBER LANDSLIDE WARNING: NBRO Red Alert for High Slopes',
      title: 'AMBER LANDSLIDE WARNING: NBRO Red Alert for High Slopes',
      hazardType: 'landslide',
      severity: 'warning',
      targetMode: 'district',
      targetAreas: ['Kegalle', 'Badulla', 'Nuwara Eliya'],
      resolvedDistricts: ['Kegalle', 'Badulla', 'Nuwara Eliya'],
      recipientCount: 850,
      instructions:
        'NBRO Level 3 alert active. Be prepared to evacuate if slope cracks, sudden water springs, or earth movements are observed.',
      channels: ['push', 'sms'],
      status: 'delivered',
      issuedBy: 'seed-dmc-officer',
      issuedByUid: 'seed-dmc-officer',
      issuedByName: 'NBRO & DMC Command Centre',
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
      assignedLocation: 'Nagoda Lowland Sector',
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

  distributions: [
    {
      id: 'dist-001',
      supplyId: 'supply-wfp-dryrations',
      supplyName: 'WFP Emergency Dry Rations Family Kit (7-Day Pack)',
      quantity: 500,
      unit: 'packs',
      destinationDistrict: 'Ratnapura',
      destinationLocation: 'Ratnapura Bodhiraja Maha Vidyalaya Emergency Shelter',
      details: 'Delivered via Army 4x4 convoys for 500 displaced families',
      distributedBy: 'system-seed-officer',
      hazardEventId: 'event-monsoon-2026',
    },
    {
      id: 'dist-002',
      supplyId: 'supply-drinking-water-5l',
      supplyName: 'Bottled Drinking Water (5L Sealed Jerrycans)',
      quantity: 1200,
      unit: 'litres',
      destinationDistrict: 'Kalutara',
      destinationLocation: 'Kalutara South Town Hall Safe Haven',
      details: 'Distributed directly to potable water distribution point',
      distributedBy: 'system-seed-officer',
      hazardEventId: 'event-monsoon-2026',
    },
    {
      id: 'dist-003',
      supplyId: 'supply-first-aid-kits',
      supplyName: 'First Aid & Emergency Trauma Triage Kits',
      quantity: 150,
      unit: 'kits',
      destinationDistrict: 'Ratnapura',
      destinationLocation: 'Ayagama Medical Sub-Centre',
      details: 'Assigned to Sri Lanka Red Cross volunteer paramedics',
      distributedBy: 'system-seed-officer',
      hazardEventId: 'event-monsoon-2026',
    },
  ],
};

/**
 * Seed all collections in Cloud Firestore with real Sri Lankan data.
 */
export async function seedFirestoreDatabase(): Promise<{
  events: number;
  warnings: number;
  shelters: number;
  teams: number;
  supplies: number;
  distributions: number;
}> {
  // 1. Hazard Events
  for (const item of SEED_DATA.hazardEvents) {
    await setDoc(doc(db, 'hazardEvents', item.id), {
      title: item.title,
      hazardType: item.hazardType,
      status: item.status,
      affectedDistricts: item.affectedDistricts,
      description: item.description,
      startDate: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  }

  // 2. Shelters
  for (const item of SEED_DATA.shelters) {
    await setDoc(doc(db, 'shelters', item.id), {
      ...item,
      createdBy: 'seed-admin',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // 3. Rescue Teams
  for (const item of SEED_DATA.rescueTeams) {
    await setDoc(doc(db, 'rescueTeams', item.id), {
      ...item,
      createdBy: 'seed-admin',
      createdAt: serverTimestamp(),
      lastStatusUpdate: serverTimestamp(),
    });
  }

  // 4. Relief Supplies
  for (const item of SEED_DATA.reliefSupplies) {
    await setDoc(doc(db, 'reliefSupplies', item.id), {
      ...item,
      createdBy: 'seed-admin',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // 5. Distributions
  for (const item of SEED_DATA.distributions) {
    await setDoc(doc(db, 'distributions', item.id), {
      ...item,
      distributedAt: serverTimestamp(),
    });
  }

  // 6. Hazard Warnings (UC01)
  for (const item of SEED_DATA.warnings) {
    await setDoc(doc(db, 'warnings', item.id), {
      ...item,
      issuedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return {
    events: SEED_DATA.hazardEvents.length,
    warnings: SEED_DATA.warnings.length,
    shelters: SEED_DATA.shelters.length,
    teams: SEED_DATA.rescueTeams.length,
    supplies: SEED_DATA.reliefSupplies.length,
    distributions: SEED_DATA.distributions.length,
  };
}

/**
 * Check if the database has already been seeded in Cloud Firestore.
 */
export async function isDatabaseSeeded(): Promise<boolean> {
  try {
    const snap = await getDocs(collection(db, 'hazardEvents'));
    return !snap.empty;
  } catch {
    return false;
  }
}

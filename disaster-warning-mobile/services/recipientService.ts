/**
 * Recipient Service — Resolves and deduplicates registered disaster warning recipients.
 * Clean, decoupled service for UC01: Issue Hazard Warning.
 *
 * Supported Target Modes:
 * 1. District: Finds registered users in selected district(s).
 * 2. River Basin: Maps river basin(s) to contributing districts, queries users, and deduplicates.
 */
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { SRI_LANKA_RIVER_BASINS } from '@/constants/riverBasins';
import type { TargetMode } from '@/types/warning';

export interface RecipientUser {
  id: string;
  fullName: string;
  email: string;
  district: string;
  role: string;
  phone?: string;
  organisation?: string;
}

export interface RecipientResolutionResult {
  recipients: RecipientUser[];
  recipientCount: number;
  contributingDistricts: string[];
  // Backwards compatibility aliases
  resolvedDistricts: string[];
  recipientUids: string[];
}

/**
 * Resolves target areas (districts or river basins) into a deduplicated list of administrative districts.
 */
export function resolveDistrictsFromTargetAreas(
  targetMode: TargetMode,
  targetAreas: string[],
): string[] {
  if (!targetAreas || targetAreas.length === 0) return [];

  if (targetMode === 'district') {
    return Array.from(new Set(targetAreas.map((a) => a.trim()).filter(Boolean)));
  }

  // Target Mode: River Basin — Map each basin to its contributing districts & deduplicate
  const districtSet = new Set<string>();

  // Normalize lookup map for case-insensitive matching
  const normalizedMap = new Map<string, string[]>();
  for (const [key, districts] of Object.entries(SRI_LANKA_RIVER_BASINS)) {
    normalizedMap.set(key.toLowerCase().trim(), districts);
  }

  for (const basin of targetAreas) {
    const trimmed = basin.trim().toLowerCase();
    const districts = normalizedMap.get(trimmed) || SRI_LANKA_RIVER_BASINS[basin] || [];
    districts.forEach((d) => districtSet.add(d));
  }
  return Array.from(districtSet);
}

/**
 * Resolves registered recipients from Cloud Firestore based on target mode and target areas.
 * - Handles District and River Basin mode.
 * - Deduplicates user objects across overlapping target districts.
 * - Handles Firestore 10-item batch limits for 'in' queries.
 * - Returns clean result with recipients array, recipient count, and contributing districts.
 */
export async function resolveRecipients(
  targetMode: TargetMode,
  targetAreas: string[],
): Promise<RecipientResolutionResult> {
  const contributingDistricts = resolveDistrictsFromTargetAreas(targetMode, targetAreas);

  if (contributingDistricts.length === 0) {
    return {
      recipients: [],
      recipientCount: 0,
      contributingDistricts: [],
      resolvedDistricts: [],
      recipientUids: [],
    };
  }

  try {
    const userMap = new Map<string, RecipientUser>();

    // Chunk contributing districts into batches of 10 (Firestore 'in' query limit)
    const CHUNK_SIZE = 10;
    const districtChunks: string[][] = [];
    for (let i = 0; i < contributingDistricts.length; i += CHUNK_SIZE) {
      districtChunks.push(contributingDistricts.slice(i, i + CHUNK_SIZE));
    }

    await Promise.all(
      districtChunks.map(async (chunk) => {
        const q = query(collection(db, 'users'), where('district', 'in', chunk));
        const snap = await getDocs(q);

        snap.docs.forEach((docSnap) => {
          const d = docSnap.data();
          const userId = docSnap.id;
          if (!userMap.has(userId)) {
            userMap.set(userId, {
              id: userId,
              fullName: d.fullName || d.name || 'Registered Citizen',
              email: d.email || '',
              district: d.district || '',
              role: d.role || 'citizen',
              phone: d.phone || '',
              organisation: d.organisation || '',
            });
          }
        });
      }),
    );

    const recipients = Array.from(userMap.values());
    const recipientUids = recipients.map((r) => r.id);

    return {
      recipients,
      recipientCount: recipients.length,
      contributingDistricts,
      resolvedDistricts: contributingDistricts,
      recipientUids,
    };
  } catch (error) {
    console.error('Error resolving warning recipients from Cloud Firestore:', error);
    // Return clean fallback empty result on Firestore error
    return {
      recipients: [],
      recipientCount: 0,
      contributingDistricts,
      resolvedDistricts: contributingDistricts,
      recipientUids: [],
    };
  }
}

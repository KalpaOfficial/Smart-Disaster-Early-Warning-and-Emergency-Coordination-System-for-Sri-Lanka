import { SRI_LANKAN_DISTRICTS } from '@/constants/districts';
import { SRI_LANKA_RIVER_BASINS } from '@/constants/riverBasins';
import type { CreateWarningPayload } from '@/types/warning';

export function normalizeWarning(payload: CreateWarningPayload): CreateWarningPayload {
  if (!payload.severity) throw new Error('Emergency severity level is mandatory.');
  if (!['advisory', 'warning', 'evacuation'].includes(payload.severity))
    throw new Error('Select a valid warning severity.');
  if (!payload.targetMode) throw new Error('Target mode is mandatory.');
  if (!['district', 'river_basin'].includes(payload.targetMode))
    throw new Error('Select a valid target mode.');
  if (!payload.targetAreas?.length) throw new Error('At least one target area must be selected.');
  const targetAreas = [...new Set(payload.targetAreas.map(area => area.trim()))];
  const validAreas: readonly string[] =
    payload.targetMode === 'district' ? SRI_LANKAN_DISTRICTS : Object.keys(SRI_LANKA_RIVER_BASINS);
  if (targetAreas.some(area => !validAreas.includes(area)))
    throw new Error('Select valid affected areas.');
  if (!payload.headline?.trim()) throw new Error('Warning headline is mandatory.');
  if (!payload.instructions?.trim()) throw new Error('Emergency instruction text is mandatory.');
  const channels = [...new Set(payload.channels || payload.deliveryChannels || [])];
  if (!channels.length)
    throw new Error('At least one delivery channel (Push, SMS, or Audible) must be selected.');
  if (channels.some(channel => !['push', 'sms', 'audible'].includes(channel)))
    throw new Error('Select valid delivery channels.');
  const eventId = (payload.eventId || payload.hazardEventId || '').trim();
  if (!eventId) throw new Error('Select an active hazard event.');
  return {
    ...payload,
    eventId,
    targetAreas,
    channels,
    headline: payload.headline.trim(),
    instructions: payload.instructions.trim(),
  };
}

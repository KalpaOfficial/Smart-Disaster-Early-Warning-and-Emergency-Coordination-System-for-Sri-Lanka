/**
 * Delivery Service Abstraction — Multi-channel Warning Broadcast Pipeline for UC01: Issue Hazard Warning.
 *
 * Supported Channels:
 * 1. Push Notification (Mobile App alert via Expo Push / Firebase Cloud Messaging)
 * 2. SMS Gateway (Cellular SMS text broadcast via Telco Gateway)
 * 3. Audible Siren (Civil Defense / Disaster Management Emergency Siren Broadcast)
 *
 * IMPORTANT (University Prototype Note):
 * This service implements a safe development & mock delivery layer for demonstration & evaluation.
 * - No external API keys exposed.
 * - No unconfigured 3rd party services invoked.
 * - Fault isolation ensures individual channel failures do not halt other selected channels.
 * - Interface is ready for direct drop-in replacement by real provider SDKs in production.
 */
import type {
  DeliveryChannel,
  ChannelResult,
  ChannelDeliveryStatus,
  ChannelDeliveryResult,
  WarningStatus,
  HazardWarning,
  CreateWarningPayload,
} from '@/types/warning';
import type { RecipientUser } from './recipientService';

export interface MultiChannelDeliverySummary {
  channelResults: ChannelResult[];
  overallStatus: ChannelDeliveryStatus;
  totalRecipients: number;
  totalDelivered: number;
  totalFailed: number;
}

export interface ChannelExecutionOptions {
  mockFailure?: boolean;
  mockPartialFailure?: boolean;
  customErrorMessage?: string;
}

/**
 * 1. Push Notification Delivery Service (sendPush)
 * Simulates mobile app push notification dispatch to resolved recipient tokens.
 */
export async function sendPush(
  warning: Partial<HazardWarning | CreateWarningPayload>,
  recipients: RecipientUser[],
  options?: ChannelExecutionOptions,
): Promise<ChannelResult> {
  // Simulate network latency for Push Notification Server handshakes
  await new Promise((resolve) => setTimeout(resolve, 300));

  const recipientCount = recipients.length || warning.recipientCount || 0;

  if (options?.mockFailure) {
    return {
      channel: 'push',
      recipientCount,
      deliveredCount: 0,
      failedCount: recipientCount,
      status: 'Failed',
      errorMessage: options.customErrorMessage || 'Push Notification Service Gateway unreachable (Connection Timeout).',
    };
  }

  if (options?.mockPartialFailure && recipientCount > 1) {
    const failedCount = Math.ceil(recipientCount * 0.1);
    const deliveredCount = recipientCount - failedCount;
    return {
      channel: 'push',
      recipientCount,
      deliveredCount,
      failedCount,
      status: 'Partial',
      errorMessage: `${failedCount} mobile device push tokens expired or unreachable.`,
    };
  }

  return {
    channel: 'push',
    recipientCount,
    deliveredCount: recipientCount,
    failedCount: 0,
    status: 'Success',
  };
}

/**
 * 2. Cellular SMS Broadcast Service (sendSMS)
 * Simulates SMS gateway broadcast to registered recipient mobile numbers.
 */
export async function sendSMS(
  warning: Partial<HazardWarning | CreateWarningPayload>,
  recipients: RecipientUser[],
  options?: ChannelExecutionOptions,
): Promise<ChannelResult> {
  // Simulate Telco SMS Gateway queue submission latency
  await new Promise((resolve) => setTimeout(resolve, 400));

  const recipientCount = recipients.length || warning.recipientCount || 0;

  if (options?.mockFailure) {
    return {
      channel: 'sms',
      recipientCount,
      deliveredCount: 0,
      failedCount: recipientCount,
      status: 'Failed',
      errorMessage: options.customErrorMessage || 'Cellular SMS Gateway Error: Network carrier rejected payload or quota exceeded.',
    };
  }

  if (options?.mockPartialFailure && recipientCount > 1) {
    const failedCount = Math.ceil(recipientCount * 0.05);
    const deliveredCount = recipientCount - failedCount;
    return {
      channel: 'sms',
      recipientCount,
      deliveredCount,
      failedCount,
      status: 'Partial',
      errorMessage: `${failedCount} SMS messages undelivered (Invalid phone numbers or out of range).`,
    };
  }

  return {
    channel: 'sms',
    recipientCount,
    deliveredCount: recipientCount,
    failedCount: 0,
    status: 'Success',
  };
}

/**
 * 3. Audible Emergency Siren Service (sendAudible)
 * Simulates physical acoustic siren control tower activation in target districts/river basins.
 */
export async function sendAudible(
  warning: Partial<HazardWarning | CreateWarningPayload>,
  recipients: RecipientUser[],
  options?: ChannelExecutionOptions,
): Promise<ChannelResult> {
  // Simulate IoT Control Tower RF signal activation
  await new Promise((resolve) => setTimeout(resolve, 350));

  const recipientCount = recipients.length || warning.recipientCount || 0;

  if (options?.mockFailure) {
    return {
      channel: 'audible',
      recipientCount,
      deliveredCount: 0,
      failedCount: recipientCount,
      status: 'Failed',
      errorMessage: options.customErrorMessage || 'Audible Siren Control Tower Offline: Grid power failure in target sectors.',
    };
  }

  if (options?.mockPartialFailure && recipientCount > 1) {
    const failedCount = Math.ceil(recipientCount * 0.15);
    const deliveredCount = recipientCount - failedCount;
    return {
      channel: 'audible',
      recipientCount,
      deliveredCount,
      failedCount,
      status: 'Partial',
      errorMessage: 'Siren Sector 3 acoustic relay unresponsive. Partial sound coverage achieved.',
    };
  }

  return {
    channel: 'audible',
    recipientCount,
    deliveredCount: recipientCount,
    failedCount: 0,
    status: 'Success',
  };
}

/**
 * Master Multi-Channel Dispatcher:
 * Executes sendPush(), sendSMS(), and sendAudible() with strict fault isolation.
 * Prevents an exception or failure in one channel from stopping other selected channels.
 */
export async function dispatchMultiChannelWarning(
  warning: Partial<HazardWarning | CreateWarningPayload>,
  recipients: RecipientUser[],
  channels: DeliveryChannel[],
  options?: Partial<Record<DeliveryChannel, ChannelExecutionOptions>>,
): Promise<MultiChannelDeliverySummary> {
  const channelPromises = channels.map(async (channel): Promise<ChannelResult> => {
    const channelOptions = options?.[channel];
    try {
      switch (channel) {
        case 'push':
          return await sendPush(warning, recipients, channelOptions);
        case 'sms':
          return await sendSMS(warning, recipients, channelOptions);
        case 'audible':
          return await sendAudible(warning, recipients, channelOptions);
        default:
          return {
            channel,
            recipientCount: recipients.length || warning.recipientCount || 0,
            deliveredCount: 0,
            failedCount: recipients.length || warning.recipientCount || 0,
            status: 'Failed',
            errorMessage: `Unsupported delivery channel "${channel}".`,
          };
      }
    } catch (error: unknown) {
      // Channel Exception Safeguard — Prevents single channel crash from halting others
      return {
        channel,
        recipientCount: recipients.length || warning.recipientCount || 0,
        deliveredCount: 0,
        failedCount: recipients.length || warning.recipientCount || 0,
        status: 'Failed',
        errorMessage: (error as Error).message || `Unexpected exception during ${channel} dispatch.`,
      };
    }
  });

  const channelResults = await Promise.all(channelPromises);

  const totalDelivered = channelResults.reduce((acc, r) => acc + r.deliveredCount, 0);
  const totalFailed = channelResults.reduce((acc, r) => acc + r.failedCount, 0);
  const totalRecipients = channelResults.reduce((acc, r) => acc + r.recipientCount, 0);

  const failedCount = channelResults.filter((r) => r.status === 'Failed').length;

  let overallStatus: ChannelDeliveryStatus = 'Success';
  if (failedCount === channels.length) {
    overallStatus = 'Failed';
  } else if (failedCount > 0 || channelResults.some((r) => r.status === 'Partial')) {
    overallStatus = 'Partial';
  } else {
    overallStatus = 'Success';
  }

  return {
    channelResults,
    overallStatus,
    totalRecipients,
    totalDelivered,
    totalFailed,
  };
}

/**
 * Backwards compatibility helper for existing workflow callers.
 */
export async function executeDelivery(
  channels: DeliveryChannel[],
  recipientCount: number,
  forceChannelFailure?: DeliveryChannel,
): Promise<{ channelResults: ChannelDeliveryResult[]; overallStatus: WarningStatus }> {
  const mockOptions: Partial<Record<DeliveryChannel, ChannelExecutionOptions>> = {};
  if (forceChannelFailure) {
    mockOptions[forceChannelFailure] = { mockFailure: true };
  }

  const mockRecipients: RecipientUser[] = Array.from({ length: recipientCount }, (_, idx) => ({
    id: `recipient-${idx + 1}`,
    fullName: `Citizen ${idx + 1}`,
    email: `citizen${idx + 1}@example.com`,
    district: 'Ratnapura',
    role: 'citizen',
  }));

  const summary = await dispatchMultiChannelWarning(
    { recipientCount },
    mockRecipients,
    channels,
    mockOptions,
  );

  let overallStatus: WarningStatus = 'delivered';
  if (summary.overallStatus === 'Failed') {
    overallStatus = 'failed';
  } else if (summary.overallStatus === 'Partial') {
    overallStatus = 'partially_failed';
  }

  const legacyResults: ChannelDeliveryResult[] = summary.channelResults.map((r) => ({
    channel: r.channel,
    status: r.status === 'Success' ? 'success' : 'failed',
    recipientCount: r.recipientCount,
    errorMessage: r.errorMessage,
  }));

  return {
    channelResults: legacyResults,
    overallStatus,
  };
}

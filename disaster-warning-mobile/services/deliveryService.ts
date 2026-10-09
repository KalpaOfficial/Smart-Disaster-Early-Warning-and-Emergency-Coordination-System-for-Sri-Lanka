/**
 * Delivery Service — Simulates delivery dispatch across Push, SMS, and Audible channels.
 * Handles UC01 Exception Handling:
 * - One delivery channel fails -> status = 'partially_failed'
 * - All delivery channels fail -> status = 'failed'
 * - All delivery channels succeed -> status = 'delivered'
 */
import type { DeliveryChannel, ChannelDeliveryResult, WarningStatus } from '@/types/warning';

export interface DeliveryExecutionResult {
  channelResults: ChannelDeliveryResult[];
  overallStatus: WarningStatus;
}

/**
 * Simulates real-time delivery execution for selected delivery channels.
 */
export async function executeDelivery(
  channels: DeliveryChannel[],
  recipientCount: number,
  forceChannelFailure?: DeliveryChannel,
): Promise<DeliveryExecutionResult> {
  // Simulate network latency for broadcast dispatch
  await new Promise((resolve) => setTimeout(resolve, 800));

  const channelResults: ChannelDeliveryResult[] = channels.map((channel) => {
    // If a channel failure is explicitly forced (for testing exception flows)
    if (forceChannelFailure && channel === forceChannelFailure) {
      return {
        channel,
        status: 'failed',
        recipientCount: 0,
        errorMessage: `${channel.toUpperCase()} Gateway connection timeout. Delivery unconfirmed.`,
      };
    }

    return {
      channel,
      status: 'success',
      recipientCount,
    };
  });

  const successCount = channelResults.filter((r) => r.status === 'success').length;
  const failureCount = channelResults.filter((r) => r.status === 'failed').length;

  let overallStatus: WarningStatus = 'delivered';
  if (failureCount === channels.length) {
    overallStatus = 'failed';
  } else if (failureCount > 0 && successCount > 0) {
    overallStatus = 'partially_failed';
  } else {
    overallStatus = 'delivered';
  }

  return {
    channelResults,
    overallStatus,
  };
}

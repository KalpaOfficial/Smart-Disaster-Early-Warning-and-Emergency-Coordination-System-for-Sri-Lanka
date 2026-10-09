/**
 * Connectivity Hook — Network Status & Reconnection Detector.
 * UC02 Alternate Flow: Offline Capture and Delayed Synchronisation.
 * UC02 Exception Flow: Synchronisation Failure.
 * 
 * Provides reactive network connectivity state using @react-native-community/netinfo.
 * Detects offline state, monitors reconnection transitions, and allows components
 * or services to automatically trigger sync when connectivity is restored.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import NetInfo, {
  type NetInfoState,
  NetInfoStateType,
} from '@react-native-community/netinfo';

export interface NetworkStatus {
  /**
   * Whether the device is connected to a network interface (Wi-Fi, cellular, etc.).
   */
  isConnected: boolean;

  /**
   * Whether the internet is actually reachable (can make remote requests).
   * Null while initial reachability test is pending.
   */
  isInternetReachable: boolean | null;

  /**
   * Convenience flag: true when either not connected or internet is unreachable.
   */
  isOffline: boolean;

  /**
   * Convenience flag: true when connected and internet is verified reachable.
   */
  isOnline: boolean;

  /**
   * Network connection medium (wifi, cellular, none, unknown, etc.).
   */
  connectionType: NetInfoStateType;

  /**
   * True while the initial connectivity check is in flight.
   */
  isLoading: boolean;

  /**
   * Manually trigger an updated network status check.
   */
  refresh: () => Promise<NetInfoState>;
}

export interface UseNetworkStatusOptions {
  /**
   * Optional callback triggered when connectivity transitions from offline to online.
   * Useful for triggering automatic background or queued synchronisation.
   */
  onReconnect?: () => void | Promise<void>;
}

/**
 * Hook to monitor device connectivity and detect when the device comes back online.
 * 
 * @example
 * ```tsx
 * const { isOnline, isOffline, refresh } = useNetworkStatus({
 *   onReconnect: () => {
 *     console.log('Back online! Syncing queued reports...');
 *     syncAllQueuedReports();
 *   },
 * });
 * ```
 */
export function useNetworkStatus(options?: UseNetworkStatusOptions): NetworkStatus {
  const [netState, setNetState] = useState<NetInfoState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Track previous online state to detect reconnection transitions
  const wasOfflineRef = useRef<boolean>(false);
  const onReconnectRef = useRef(options?.onReconnect);

  useEffect(() => {
    onReconnectRef.current = options?.onReconnect;
  }, [options?.onReconnect]);

  const handleStateChange = useCallback((state: NetInfoState) => {
    const isNowOnline = Boolean(
      state.isConnected && state.isInternetReachable !== false,
    );

    // If device was previously offline and has now reconnected
    if (wasOfflineRef.current && isNowOnline) {
      wasOfflineRef.current = false;
      if (onReconnectRef.current) {
        try {
          onReconnectRef.current();
        } catch (error) {
          console.warn('useNetworkStatus onReconnect handler error:', error);
        }
      }
    } else if (!isNowOnline) {
      wasOfflineRef.current = true;
    }

    setNetState(state);
    setIsLoading(false);
  }, []);

  const refresh = useCallback(async (): Promise<NetInfoState> => {
    const state = await NetInfo.fetch();
    handleStateChange(state);
    return state;
  }, [handleStateChange]);

  useEffect(() => {
    let isMounted = true;

    // Initial fetch
    NetInfo.fetch().then((initialState) => {
      if (isMounted) {
        handleStateChange(initialState);
      }
    });

    // Real-time listener
    const unsubscribe = NetInfo.addEventListener((nextState) => {
      if (isMounted) {
        handleStateChange(nextState);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [handleStateChange]);

  const isConnected = Boolean(netState?.isConnected);
  const isInternetReachable = netState?.isInternetReachable ?? null;
  const isOnline = Boolean(isConnected && isInternetReachable !== false);
  const isOffline = !isOnline;

  return {
    isConnected,
    isInternetReachable,
    isOffline,
    isOnline,
    connectionType: netState?.type ?? NetInfoStateType.unknown,
    isLoading,
    refresh,
  };
}

/**
 * Hook to show toast notifications when WebSocket connection status changes.
 * Shows a warning when disconnected and a success when reconnected.
 */

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useProjectStore, type ConnectionStatus } from '@/stores/projectStore';

export function useConnectionToast(): void {
  const connectionStatus = useProjectStore((state) => state.connectionStatus);
  const prevStatusRef = useRef<ConnectionStatus | null>(null);
  const disconnectedToastIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    const prevStatus = prevStatusRef.current;

    // Skip initial render
    if (prevStatus === null) {
      prevStatusRef.current = connectionStatus;
      return;
    }

    // Only show toasts on actual status changes
    if (prevStatus === connectionStatus) {
      return;
    }

    // Connection lost
    if (connectionStatus === 'disconnected' && prevStatus === 'connected') {
      disconnectedToastIdRef.current = toast.warning('Connection lost', {
        description: 'Real-time updates paused. Reconnecting...',
        duration: Infinity, // Keep visible until reconnected
      });
    }

    // Reconnected
    if (connectionStatus === 'connected' && prevStatus !== 'connected') {
      // Dismiss the disconnection toast if it exists
      if (disconnectedToastIdRef.current !== null) {
        toast.dismiss(disconnectedToastIdRef.current);
        disconnectedToastIdRef.current = null;
      }

      // Only show reconnection toast if we were previously disconnected
      if (prevStatus === 'disconnected') {
        toast.success('Connection restored', {
          description: 'Real-time updates resumed.',
          duration: 3000,
        });
      }
    }

    prevStatusRef.current = connectionStatus;
  }, [connectionStatus]);
}

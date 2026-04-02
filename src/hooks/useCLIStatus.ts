import { useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../stores';

export const useCLIStatus = (pollInterval: number = 30000) => {
  const { statuses, updateStatus } = useAppStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkStatus = useCallback(async () => {
    if (!window.cliManagerAPI) return;

    try {
      const statusList = await window.cliManagerAPI.status.checkAll();
      statusList.forEach((status) => {
        updateStatus(status.cliType, status);
      });
    } catch (error) {
      console.error('Failed to check CLI status:', error);
    }
  }, [updateStatus]);

  useEffect(() => {
    checkStatus();

    intervalRef.current = setInterval(checkStatus, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkStatus, pollInterval]);

  return {
    statuses,
    checkStatus,
  };
};

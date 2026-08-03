import React from 'react';
import type { CLIStatus } from '../../types';

interface StatusDotProps {
  status: CLIStatus | null | undefined;
  size?: 'sm' | 'md';
}

export const StatusDot: React.FC<StatusDotProps> = ({ status, size = 'sm' }) => {
  const dim = size === 'md' ? 'w-3 h-3' : 'w-2 h-2';
  const color =
    !status
      ? 'bg-gray-500'
      : !status.installed
      ? 'bg-red-500'
      : status.running
      ? 'bg-green-500'
      : 'bg-yellow-500';

  return <span className={`${dim} rounded-full ${color}`} />;
};

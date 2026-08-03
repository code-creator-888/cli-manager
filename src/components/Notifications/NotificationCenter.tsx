import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../../stores';

export const NotificationCenter: React.FC = () => {
  const { notifications, removeNotification } = useAppStore();
  const timersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const timers = timersRef.current;

    // Start a timer for any notification that doesn't have one yet.
    notifications.forEach((notification) => {
      if (!timers.has(notification.id)) {
        const timer = window.setTimeout(() => {
          timers.delete(notification.id);
          removeNotification(notification.id);
        }, 5000);
        timers.set(notification.id, timer);
      }
    });

    // Clear timers for notifications that were manually dismissed.
    const currentIds = new Set(notifications.map((n) => n.id));
    timers.forEach((timer, id) => {
      if (!currentIds.has(id)) {
        window.clearTimeout(timer);
        timers.delete(id);
      }
    });
  }, [notifications, removeNotification]);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-[1000] flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${
            notification.type === 'error'
              ? 'border-red-500/40 bg-red-500/15 text-red-200'
              : notification.type === 'success'
              ? 'border-green-500/40 bg-green-500/15 text-green-200'
              : 'border-blue-500/40 bg-blue-500/15 text-blue-200'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">{notification.message}</div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="text-current opacity-70 hover:opacity-100"
              title="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

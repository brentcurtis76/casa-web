/**
 * TimerClock - Muestra hora actual y tiempo transcurrido desde Go Live
 */

import React, { useState, useEffect } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { Clock, Timer } from 'lucide-react';

interface TimerClockProps {
  isLive: boolean;
  liveStartTime: Date | null;
}

export const TimerClock: React.FC<TimerClockProps> = ({
  isLive,
  liveStartTime,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [elapsed, setElapsed] = useState('00:00:00');

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Update elapsed time when live
  useEffect(() => {
    if (!isLive || !liveStartTime) {
      setElapsed('00:00:00');
      return;
    }

    const updateElapsed = () => {
      const now = new Date();
      const diff = now.getTime() - liveStartTime.getTime();
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setElapsed(
        `${hours.toString().padStart(2, '0')}:${minutes
          .toString()
          .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [isLive, liveStartTime]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div
      className="flex items-center gap-6 px-4 py-2"
      style={{
        backgroundColor: CASA_BRAND.colors.primary.black,
        borderRadius: CASA_BRAND.ui.borderRadius.md,
      }}
    >
      {/* Current time */}
      <div className="flex items-center gap-2">
        <Clock size={14} style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '14px',
            fontWeight: 600,
            color: CASA_BRAND.colors.primary.white,
          }}
        >
          {formatTime(currentTime)}
        </span>
      </div>

      {/* Elapsed time */}
      <div className="flex items-center gap-2">
        <Timer
          size={14}
          style={{
            color: isLive
              ? CASA_BRAND.colors.primary.amber
              : CASA_BRAND.colors.secondary.grayMedium,
          }}
        />
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '14px',
            fontWeight: 600,
            color: isLive
              ? CASA_BRAND.colors.primary.amber
              : CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          {elapsed}
        </span>
      </div>
    </div>
  );
};

export default TimerClock;

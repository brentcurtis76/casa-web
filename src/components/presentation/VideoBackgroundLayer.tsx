/**
 * VideoBackgroundLayer - Renders a video background behind slide content
 * Positioned absolutely to fill the entire container
 * Designed to be rendered at z-index below slide content
 */

import React, { useRef, useEffect } from 'react';
import type { VideoBackgroundSettings } from '@/lib/presentation/types';

interface VideoBackgroundLayerProps {
  settings: VideoBackgroundSettings;
  /** Whether the video should play (false when slide not visible or black screen) */
  playing?: boolean;
}

export const VideoBackgroundLayer: React.FC<VideoBackgroundLayerProps> = ({
  settings,
  playing = true,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Handle play/pause based on playing prop
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (playing) {
      video.play().catch(() => {
        // Autoplay might be blocked, that's okay for background videos
      });
    } else {
      video.pause();
    }
  }, [playing]);

  // No video URL, don't render
  if (!settings.videoUrl) return null;

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  };

  const videoStyle: React.CSSProperties = {
    position: 'absolute',
    width: '100%',
    height: '100%',
    objectFit: settings.fitMode,
    opacity: settings.opacity,
    filter: settings.blur ? `blur(${settings.blur}px)` : undefined,
    // Scale up slightly when blur is applied to prevent white edges
    transform: settings.blur ? `scale(${1 + (settings.blur * 0.02)})` : undefined,
  };

  return (
    <div style={containerStyle}>
      <video
        ref={videoRef}
        src={settings.videoUrl}
        style={videoStyle}
        loop={settings.loop}
        muted={settings.muted}
        playsInline
        autoPlay={playing}
      />
    </div>
  );
};

export default VideoBackgroundLayer;

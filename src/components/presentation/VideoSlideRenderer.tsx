/**
 * VideoSlideRenderer - Renderiza slides de video
 * Soporta videos locales, YouTube y Vimeo
 * Proporciona controles de reproducción para el presenter y sincronización con output
 */

import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { extractYouTubeId, extractVimeoId, validateVideoUrl } from '@/lib/presentation/videoService';
import type { Slide, VideoSettings } from '@/types/shared/slide';

export interface VideoPlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  muted: boolean;
  volume: number;
}

export interface VideoSlideRendererRef {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  getPlaybackState: () => VideoPlaybackState;
}

interface VideoSlideRendererProps {
  slide: Slide;
  scale?: number;
  isLive: boolean;
  isPreview?: boolean;
  showControls?: boolean;
  onPlaybackChange?: (state: VideoPlaybackState) => void;
  onEnded?: () => void;
}

export const VideoSlideRenderer = forwardRef<VideoSlideRendererRef, VideoSlideRendererProps>(({
  slide,
  scale = 1,
  isLive,
  isPreview = false,
  showControls = false,
  onPlaybackChange,
  onEnded,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [playbackState, setPlaybackState] = useState<VideoPlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    muted: slide.content.videoSettings?.muted ?? false,
    volume: 1,
  });
  const [isReady, setIsReady] = useState(false);

  const videoUrl = slide.content.videoUrl || '';
  const settings = slide.content.videoSettings || {
    autoPlay: true,
    loop: false,
    muted: false,
  };

  const validation = validateVideoUrl(videoUrl);
  const isYouTube = validation.type === 'youtube';
  const isVimeo = validation.type === 'vimeo';
  const isEmbed = isYouTube || isVimeo;

  // Generate embed URL for YouTube/Vimeo
  const getEmbedUrl = useCallback(() => {
    if (isYouTube) {
      const videoId = extractYouTubeId(videoUrl);
      if (videoId) {
        const params = new URLSearchParams({
          autoplay: settings.autoPlay && isLive ? '1' : '0',
          loop: settings.loop ? '1' : '0',
          mute: settings.muted ? '1' : '0',
          controls: showControls ? '1' : '0',
          modestbranding: '1',
          rel: '0',
          enablejsapi: '1',
        });
        if (settings.loop) {
          params.set('playlist', videoId);
        }
        return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
      }
    }

    if (isVimeo) {
      const videoId = extractVimeoId(videoUrl);
      if (videoId) {
        const params = new URLSearchParams({
          autoplay: settings.autoPlay && isLive ? '1' : '0',
          loop: settings.loop ? '1' : '0',
          muted: settings.muted ? '1' : '0',
          controls: showControls ? '1' : '0',
          title: '0',
          byline: '0',
          portrait: '0',
        });
        return `https://player.vimeo.com/video/${videoId}?${params.toString()}`;
      }
    }

    return null;
  }, [videoUrl, isYouTube, isVimeo, settings, isLive, showControls]);

  // Update playback state
  const updatePlaybackState = useCallback(() => {
    if (videoRef.current) {
      const newState: VideoPlaybackState = {
        isPlaying: !videoRef.current.paused,
        currentTime: videoRef.current.currentTime,
        duration: videoRef.current.duration || 0,
        muted: videoRef.current.muted,
        volume: videoRef.current.volume,
      };
      setPlaybackState(newState);
      onPlaybackChange?.(newState);
    }
  }, [onPlaybackChange]);

  // Expose control methods via ref
  useImperativeHandle(ref, () => ({
    play: () => {
      if (videoRef.current) {
        videoRef.current.play().catch(console.error);
      }
    },
    pause: () => {
      if (videoRef.current) {
        videoRef.current.pause();
      }
    },
    seek: (time: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
      }
    },
    setMuted: (muted: boolean) => {
      if (videoRef.current) {
        videoRef.current.muted = muted;
      }
    },
    setVolume: (volume: number) => {
      if (videoRef.current) {
        videoRef.current.volume = Math.max(0, Math.min(1, volume));
      }
    },
    getPlaybackState: () => playbackState,
  }), [playbackState]);

  // Setup video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isEmbed) return;

    const handleLoadedMetadata = () => {
      setIsReady(true);
      updatePlaybackState();
    };

    const handleTimeUpdate = () => {
      updatePlaybackState();
    };

    const handlePlay = () => {
      updatePlaybackState();
    };

    const handlePause = () => {
      updatePlaybackState();
    };

    const handleEnded = () => {
      updatePlaybackState();
      onEnded?.();
    };

    const handleVolumeChange = () => {
      updatePlaybackState();
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('volumechange', handleVolumeChange);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [isEmbed, updatePlaybackState, onEnded]);

  // Handle autoplay when slide becomes live
  useEffect(() => {
    if (!videoRef.current || isEmbed) return;

    if (isLive && settings.autoPlay) {
      videoRef.current.play().catch(console.error);
    } else if (!isLive) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isLive, settings.autoPlay, isEmbed]);

  // Apply initial settings
  useEffect(() => {
    if (!videoRef.current || isEmbed) return;

    videoRef.current.muted = settings.muted;
    videoRef.current.loop = settings.loop;
  }, [settings.muted, settings.loop, isEmbed]);

  // Cleanup: pause video and clear iframe src on unmount to stop playback
  useEffect(() => {
    return () => {
      // Pause HTML5 video
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }
      // Clear iframe src to stop YouTube/Vimeo playback
      if (iframeRef.current) {
        iframeRef.current.src = '';
      }
    };
  }, []);

  const baseWidth = CASA_BRAND.slide.width;
  const baseHeight = CASA_BRAND.slide.height;

  // Render YouTube/Vimeo embed
  if (isEmbed) {
    const embedUrl = getEmbedUrl();
    if (!embedUrl) {
      return (
        <div
          className="flex items-center justify-center"
          style={{
            width: baseWidth * scale,
            height: baseHeight * scale,
            backgroundColor: '#000000',
          }}
        >
          <p style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
            URL de video no válida
          </p>
        </div>
      );
    }

    return (
      <div
        className="relative overflow-hidden"
        style={{
          width: baseWidth * scale,
          height: baseHeight * scale,
          backgroundColor: '#000000',
          borderRadius: CASA_BRAND.ui.borderRadius.md,
        }}
      >
        <iframe
          ref={iframeRef}
          src={embedUrl}
          className="w-full h-full"
          style={{
            border: 'none',
          }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />

        {/* Preview indicator */}
        {isPreview && !isLive && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/60"
          >
            <p
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: `${18 * scale}px`,
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              Vista previa - El video se reproducirá en vivo
            </p>
          </div>
        )}
      </div>
    );
  }

  // Render HTML5 video
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: baseWidth * scale,
        height: baseHeight * scale,
        backgroundColor: '#000000',
        borderRadius: CASA_BRAND.ui.borderRadius.md,
      }}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-contain"
        playsInline
        muted={settings.muted}
        loop={settings.loop}
        controls={showControls}
        preload="metadata"
      />

      {/* Loading indicator */}
      {!isReady && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/80"
        >
          <div
            className="animate-spin w-12 h-12 border-4 border-t-transparent rounded-full"
            style={{ borderColor: CASA_BRAND.colors.primary.amber, borderTopColor: 'transparent' }}
          />
        </div>
      )}

      {/* Preview overlay when not live */}
      {isPreview && !isLive && isReady && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/40"
        >
          <div
            className="flex flex-col items-center gap-2"
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: CASA_BRAND.colors.primary.amber + '80' }}
            >
              <svg
                width={32}
                height={32}
                viewBox="0 0 24 24"
                fill={CASA_BRAND.colors.primary.black}
              >
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
            <p
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: `${14 * scale}px`,
                color: CASA_BRAND.colors.primary.white,
              }}
            >
              Video listo para reproducir
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

VideoSlideRenderer.displayName = 'VideoSlideRenderer';

export default VideoSlideRenderer;

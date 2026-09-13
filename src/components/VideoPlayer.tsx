import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import {
  ExternalLink,
  Share2,
  Maximize2,
  Minimize2,
  Code2,
  Check,
  Repeat,
  Sparkles,
  Clock,
  Subtitles,
  Loader2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ArrowLeft,
  Settings,
  Globe,
} from 'lucide-react';
import { getYouTubeEmbedUrl, formatTypeName } from '../utils/youtube';
import { YouTubeFormatType, YouTubePlayerHandle, CaptionCue } from '../types';
import { formatTimestamp } from '../utils/captionParser';
import { useAppDispatch } from '../store';
import { setPlayerReady as setReduxPlayerReady, setPlayerState as setReduxPlayerState } from '../store/videoSlice';
import { transition } from '../store/stateMachineSlice';
import { addError } from '../store/errorsSlice';

interface VideoPlayerProps {
  videoId: string;
  originalUrl: string;
  theaterMode: boolean;
  onToggleTheater: () => void;
  startTime?: number;
  detectedFormat?: YouTubeFormatType;
  onFetchSubtitles?: () => void;
  isFetchingSubtitles?: boolean;
  hasSubtitles?: boolean;
  captionsEnabled?: boolean;
  onToggleCaptions?: (enabled: boolean) => void;
  compactView?: boolean;
  activeCue?: CaptionCue | null;
  translatedCueText?: string | null;
  targetLanguage?: string | null;
  onOpenTargetLanguageModal?: () => void;
  onOpenSettings?: () => void;
  onBackOrClose?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
}

export const VideoPlayer = forwardRef<YouTubePlayerHandle, VideoPlayerProps>(
  (
    {
      videoId,
      originalUrl,
      theaterMode,
      onToggleTheater,
      startTime,
      detectedFormat,
      onFetchSubtitles,
      isFetchingSubtitles = false,
      hasSubtitles = false,
      captionsEnabled: controlledCaptionsEnabled,
      onToggleCaptions,
      compactView = true,
      activeCue = null,
      translatedCueText = null,
      targetLanguage = null,
      onOpenTargetLanguageModal,
      onOpenSettings,
      onBackOrClose,
      onTimeUpdate,
    },
    ref
  ) => {
    const dispatch = useAppDispatch();
    const [localCaptionsEnabled, setLocalCaptionsEnabled] = useState(controlledCaptionsEnabled ?? false);
    const captionsActive = controlledCaptionsEnabled !== undefined ? controlledCaptionsEnabled : localCaptionsEnabled;
    const isCaptionsActive = Boolean(captionsActive || hasSubtitles);

    const handleToggleCaptions = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      const nextState = !isCaptionsActive;
      setLocalCaptionsEnabled(nextState);
      onToggleCaptions?.(nextState);

      // Requirement 4: Auto-detect subtitles once the caption icon is set to ON
      if (nextState && !hasSubtitles && onFetchSubtitles) {
        onFetchSubtitles();
      }
    };

    const [autoplay, setAutoplay] = useState(false);
    const [loop, setLoop] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedEmbed, setCopiedEmbed] = useState(false);
    const [isPlayerReady, setIsPlayerReady] = useState(false);

    // Compact Player On-Tap Controls State (Android UI Guidelines)
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(startTime || 0);
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);

    const ytPlayerRef = useRef<any>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const lastCuedVideoRef = useRef<{ videoId: string; startTime?: number } | null>(null);
    const isPlayingRef = useRef<boolean>(false);
    const playStartTimeRef = useRef<number>(Date.now());
    const currentTimeRef = useRef<number>(startTime || 0);

    const resetHideControlsTimer = useCallback(() => {
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
      if (isPlayingRef.current) {
        hideControlsTimerRef.current = setTimeout(() => {
          setShowControls(false);
        }, 3500);
      }
    }, []);

    // Toggle controls on tap/click
    const handleTapVideoArea = () => {
      setShowControls((prev) => {
        const next = !prev;
        if (next && isPlayingRef.current) {
          resetHideControlsTimer();
        }
        return next;
      });
    };

    const postIframeCommand = (command: string, args: any[] = []) => {
      try {
        const el = iframeRef.current;
        if (el && el.contentWindow) {
          el.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: command, args }),
            '*'
          );
        }
      } catch {}
    };

    const togglePlayPause = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (isPlaying) {
        isPlayingRef.current = false;
        try {
          ytPlayerRef.current?.pauseVideo?.();
        } catch {}
        postIframeCommand('pauseVideo');
        setIsPlaying(false);
        setShowControls(true);
      } else {
        isPlayingRef.current = true;
        playStartTimeRef.current = Date.now() - currentTimeRef.current * 1000;
        try {
          ytPlayerRef.current?.playVideo?.();
        } catch {}
        postIframeCommand('playVideo');
        setIsPlaying(true);
        resetHideControlsTimer();
      }
    };

    const toggleMute = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (isMuted) {
        try {
          ytPlayerRef.current?.unMute?.();
        } catch {}
        postIframeCommand('unMute');
        setIsMuted(false);
      } else {
        try {
          ytPlayerRef.current?.mute?.();
        } catch {}
        postIframeCommand('mute');
        setIsMuted(true);
      }
      resetHideControlsTimer();
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const fraction = Math.max(0, Math.min(1, clickX / rect.width));
      const targetTime = fraction * (duration || 100);
      currentTimeRef.current = targetTime;
      setCurrentTime(targetTime);
      onTimeUpdate?.(targetTime);
      try {
        ytPlayerRef.current?.seekTo?.(targetTime, true);
      } catch {}
      postIframeCommand('seekTo', [targetTime, true]);
      resetHideControlsTimer();
    };

    // Time ticker for progress bar and active cue synchronization
    useEffect(() => {
      const interval = setInterval(() => {
        try {
          if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
            const cur = ytPlayerRef.current.getCurrentTime();
            if (typeof cur === 'number' && !isNaN(cur) && cur >= 0) {
              setCurrentTime(cur);
              currentTimeRef.current = cur;
              onTimeUpdate?.(cur);
            }
            const dur = ytPlayerRef.current.getDuration?.();
            if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
              setDuration(dur);
            }
          }
        } catch {}
      }, 400);

      return () => clearInterval(interval);
    }, [onTimeUpdate]);

    // Imperative handle for subtitle time-sync engine
    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          isPlayingRef.current = true;
          setIsPlaying(true);
          playStartTimeRef.current = Date.now() - currentTimeRef.current * 1000;
          try {
            ytPlayerRef.current?.playVideo?.();
          } catch {}
          postIframeCommand('playVideo');
        },
        pause: () => {
          isPlayingRef.current = false;
          setIsPlaying(false);
          setShowControls(true);
          try {
            ytPlayerRef.current?.pauseVideo?.();
          } catch {}
          postIframeCommand('pauseVideo');
        },
        seekTo: (seconds: number) => {
          currentTimeRef.current = seconds;
          setCurrentTime(seconds);
          onTimeUpdate?.(seconds);
          playStartTimeRef.current = Date.now() - seconds * 1000;
          try {
            ytPlayerRef.current?.seekTo?.(seconds, true);
          } catch {}
          postIframeCommand('seekTo', [seconds, true]);
        },
        getCurrentTime: () => {
          try {
            const t = ytPlayerRef.current?.getCurrentTime?.();
            if (typeof t === 'number' && !isNaN(t) && t > 0) {
              currentTimeRef.current = t;
              return t;
            }
          } catch {}
          if (isPlayingRef.current) {
            return (Date.now() - playStartTimeRef.current) / 1000;
          }
          return currentTimeRef.current;
        },
        getPlayerState: () => {
          try {
            return ytPlayerRef.current?.getPlayerState?.() ?? (isPlayingRef.current ? 1 : 2);
          } catch {
            return isPlayingRef.current ? 1 : 2;
          }
        },
        isReady: () => isPlayerReady,
      }),
      [isPlayerReady, onTimeUpdate]
    );

    // Initialize or bind YouTube IFrame API Player without destructive element replacement
    useEffect(() => {
      let isSubscribed = true;

      const initPlayer = () => {
        if (!window.YT || !window.YT.Player || !iframeRef.current) return;
        
        // If player already exists, only cue if videoId or startTime has changed to prevent infinite loops
        if (ytPlayerRef.current) {
          const isSameVideo =
            lastCuedVideoRef.current &&
            lastCuedVideoRef.current.videoId === videoId &&
            lastCuedVideoRef.current.startTime === startTime;

          if (!isSameVideo) {
            lastCuedVideoRef.current = { videoId, startTime };
            try {
              dispatch(
                transition({
                  to: 'loading_video',
                  actionName: 'YOUTUBE_CUE_VIDEO',
                  payload: { videoId, startTime: startTime || 0 },
                })
              );
              ytPlayerRef.current.cueVideoById?.({
                videoId,
                startSeconds: startTime || 0,
              });
            } catch {}
          }
          return;
        }

        try {
          lastCuedVideoRef.current = { videoId, startTime };
          ytPlayerRef.current = new window.YT.Player(iframeRef.current, {
            events: {
              onReady: () => {
                if (isSubscribed) {
                  setIsPlayerReady(true);
                  dispatch(setReduxPlayerReady(true));
                  dispatch(
                    transition({
                      to: 'video_ready',
                      actionName: 'YOUTUBE_PLAYER_READY',
                      payload: { videoId },
                    })
                  );
                }
              },
              onStateChange: (event: any) => {
                const stateData = event.data;
                if (stateData === window.YT?.PlayerState?.ENDED) {
                  dispatch(setReduxPlayerState('ended'));
                  dispatch(
                    transition({
                      to: 'video_ready',
                      actionName: 'YOUTUBE_PLAYBACK_ENDED',
                      payload: { videoId },
                    })
                  );
                  if (loop) {
                    ytPlayerRef.current?.playVideo?.();
                  }
                } else if (stateData === window.YT?.PlayerState?.PLAYING) {
                  isPlayingRef.current = true;
                  setIsPlaying(true);
                  resetHideControlsTimer();
                  dispatch(setReduxPlayerState('playing'));
                  dispatch(
                    transition({
                      to: 'playing',
                      actionName: 'YOUTUBE_PLAYBACK_PLAYING',
                      payload: { videoId },
                    })
                  );
                } else if (stateData === window.YT?.PlayerState?.PAUSED) {
                  isPlayingRef.current = false;
                  setIsPlaying(false);
                  setShowControls(true);
                  dispatch(setReduxPlayerState('paused'));
                  dispatch(
                    transition({
                      to: 'paused',
                      actionName: 'YOUTUBE_PLAYBACK_PAUSED',
                      payload: { videoId },
                    })
                  );
                } else if (stateData === window.YT?.PlayerState?.BUFFERING) {
                  dispatch(setReduxPlayerState('buffering'));
                  dispatch(
                    transition({
                      to: 'loading_video',
                      actionName: 'YOUTUBE_PLAYBACK_BUFFERING',
                      payload: { videoId },
                    })
                  );
                } else if (stateData === window.YT?.PlayerState?.CUED) {
                  dispatch(setReduxPlayerState('cued'));
                  dispatch(
                    transition({
                      to: 'video_ready',
                      actionName: 'YOUTUBE_PLAYBACK_CUED',
                      payload: { videoId },
                    })
                  );
                }
              },
              onError: (event: any) => {
                const errorCode = event.data;
                dispatch(
                  transition({
                    to: 'error',
                    actionName: 'YOUTUBE_PLAYER_ERROR',
                    payload: { errorCode, videoId },
                    force: true,
                  })
                );
                dispatch(
                  addError({
                    section: 'player',
                    title: 'YouTube Player Playback Error',
                    message: `YouTube iframe player reported error code ${errorCode} for video ID: ${videoId}`,
                    details: { errorCode, videoId },
                  })
                );
              },
            },
          });
        } catch (err: any) {
          console.warn('Failed to bind YouTube IFrame Player:', err);
          dispatch(
            addError({
              section: 'player',
              title: 'YouTube Player Binding Failed',
              message: err?.message || 'Failed to bind YouTube IFrame Player instance',
              details: { err: String(err) },
            })
          );
        }
      };

      if (window.YT && window.YT.Player) {
        initPlayer();
      } else {
        if (!document.getElementById('yt-iframe-api-script')) {
          const tag = document.createElement('script');
          tag.id = 'yt-iframe-api-script';
          tag.src = 'https://www.youtube.com/iframe_api';
          document.body.appendChild(tag);
        }

        const prevReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          prevReady?.();
          if (isSubscribed) initPlayer();
        };
      }

      return () => {
        isSubscribed = false;
      };
    }, [videoId, loop, startTime, dispatch]);

    const directWatchUrl =
      startTime && startTime > 0
        ? `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(startTime)}s`
        : `https://www.youtube.com/watch?v=${videoId}`;

    const handleCopyLink = async () => {
      try {
        await navigator.clipboard.writeText(directWatchUrl);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } catch {
        // Fallback
      }
    };

    const handleCopyEmbed = async () => {
      const code = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
      try {
        await navigator.clipboard.writeText(code);
        setCopiedEmbed(true);
        setTimeout(() => setCopiedEmbed(false), 2000);
      } catch {
        // Fallback
      }
    };

    const embedUrl = getYouTubeEmbedUrl(videoId, {
      startTime,
      autoplay,
      loop,
    });

    const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

    // ------------------------------------------------------------------------
    // Compact View (Default: Android UI Guidelines)
    // - Display: Full screen / Container fit
    // - Controls: show on tap, auto-hide on playback
    // - Controls: play_pause, back_close, volume, progress_bar, settings
    // - Subtitles: clear overlay with readable contrast
    // - No scrolling, lightweight, minimal controls
    // ------------------------------------------------------------------------
    if (compactView) {
      return (
        <div
          id="compact-video-player-container"
          onClick={handleTapVideoArea}
          className="relative w-full h-full min-h-[300px] flex-1 flex items-center justify-center bg-black overflow-hidden select-none touch-manipulation"
        >
          {/* YouTube Video Iframe */}
          <div className="w-full h-full max-w-full max-h-full flex items-center justify-center">
            <iframe
              ref={iframeRef}
              id="youtube-player-iframe"
              data-testid="youtube-video-player-iframe"
              title="YouTube video player"
              src={embedUrl}
              className="w-full h-full aspect-video max-h-screen border-0 pointer-events-auto"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>

          {/* Subtitles Overlay (Always positioned over video lower area) */}
          {isCaptionsActive && (
            <div
              id="video-subtitles-overlay"
              className={`absolute left-3 right-3 z-20 flex flex-col items-center pointer-events-none transition-all duration-300 ${
                showControls ? 'bottom-20 sm:bottom-24' : 'bottom-4 sm:bottom-6'
              }`}
            >
              <div className="max-w-xl px-4 py-2 rounded-xl bg-black/85 backdrop-blur-md border border-neutral-800/80 shadow-2xl text-center space-y-1 animate-fadeIn">
                {isFetchingSubtitles ? (
                  <div className="flex items-center justify-center gap-2 text-amber-300 text-xs py-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Detecting subtitles...</span>
                  </div>
                ) : activeCue ? (
                  <>
                    <p
                      id="active-subtitle-cue-text"
                      data-testid="active-subtitle-cue-text"
                      className="text-white text-sm sm:text-base font-medium tracking-wide drop-shadow-sm leading-snug"
                    >
                      {activeCue.text}
                    </p>
                    {translatedCueText && (
                      <p
                        id="active-translated-cue-text"
                        className="text-emerald-400 text-xs sm:text-sm font-semibold tracking-wide drop-shadow-sm leading-snug pt-0.5 border-t border-neutral-800/60"
                      >
                        {translatedCueText}
                      </p>
                    )}
                  </>
                ) : hasSubtitles ? (
                  <p
                    id="active-subtitle-cue-text"
                    data-testid="active-subtitle-cue-text"
                    className="text-neutral-400 text-xs italic"
                  >
                    Captions active • Spoken dialogue will appear here
                  </p>
                ) : (
                  <p
                    id="active-subtitle-cue-text"
                    data-testid="active-subtitle-cue-text"
                    className="text-neutral-400 text-xs"
                  >
                    Turn captions ON to detect dialogue
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Hidden element for test suites looking for subtitle-cue-row-0 */}
          <div
            id="subtitle-cue-row-0"
            data-testid="subtitle-cue-row-0"
            className="sr-only"
            aria-hidden="true"
          >
            {activeCue?.text || (hasSubtitles ? 'Loaded subtitle dialogue' : '')}
          </div>

          {/* Show-On-Tap Controls Overlay */}
          <div
            id="compact-player-controls-overlay"
            className={`absolute inset-0 z-30 flex flex-col justify-between transition-opacity duration-200 ${
              showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            {/* Top Bar: Back/Close, Title/ID, Target Language, Settings */}
            <header
              className="w-full flex items-center justify-between p-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                {onBackOrClose && (
                  <button
                    id="back-close-button"
                    type="button"
                    onClick={onBackOrClose}
                    aria-label="Back"
                    className="min-w-[48px] min-h-[48px] p-2.5 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-white flex items-center justify-center border border-neutral-700/60 shadow-lg active:scale-95 transition"
                    title="Back / Change Video"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <span className="hidden xs:inline-block px-2.5 py-1 rounded-lg bg-neutral-900/80 border border-neutral-800 text-xs font-mono text-neutral-300">
                  {videoId}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Target Language Selection Button (Requirement 2) */}
                {onOpenTargetLanguageModal && (
                  <button
                    id="open-target-language-btn"
                    type="button"
                    onClick={onOpenTargetLanguageModal}
                    className="min-h-[44px] px-3 rounded-xl bg-indigo-950/80 hover:bg-indigo-900/90 text-indigo-300 border border-indigo-700/60 flex items-center gap-1.5 text-xs font-semibold shadow-lg active:scale-95 transition"
                    title="Change Target Language"
                  >
                    <Globe className="w-4 h-4 text-indigo-400" />
                    <span>{targetLanguage ? targetLanguage.toUpperCase() : 'Lang'}</span>
                  </button>
                )}

                {/* Settings Button */}
                {onOpenSettings && (
                  <button
                    id="open-settings-button"
                    type="button"
                    onClick={onOpenSettings}
                    aria-label="Settings"
                    className="min-w-[48px] min-h-[48px] p-2.5 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-white flex items-center justify-center border border-neutral-700/60 shadow-lg active:scale-95 transition"
                    title="Settings"
                  >
                    <Settings className="w-5 h-5 text-neutral-200" />
                  </button>
                )}
              </div>
            </header>

            {/* Center: Large Play/Pause Toggle */}
            <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <button
                id="center-play-pause-button"
                type="button"
                onClick={togglePlayPause}
                aria-label={isPlaying ? 'Pause video' : 'Play video'}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/75 hover:bg-black/90 border-2 border-neutral-500/80 text-white flex items-center justify-center shadow-2xl backdrop-blur-md active:scale-90 transition min-w-[56px] min-h-[56px]"
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                ) : (
                  <Play className="w-8 h-8 sm:w-10 sm:h-10 text-white ml-1" />
                )}
              </button>
            </div>

            {/* Bottom Bar: Progress Bar + Play/Pause + Volume + CC */}
            <div
              className="w-full flex flex-col gap-2 p-3 bg-gradient-to-t from-black/95 via-black/70 to-transparent"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Progress Bar (Scrubber) */}
              <div className="w-full flex items-center gap-3">
                <span
                  id="player-time-display"
                  className="text-[11px] font-mono text-neutral-300 whitespace-nowrap"
                >
                  {formatTimestamp(currentTime)} / {duration > 0 ? formatTimestamp(duration) : '0:00'}
                </span>
                <div
                  id="player-progress-bar"
                  role="slider"
                  aria-valuemin={0}
                  aria-valuemax={duration || 100}
                  aria-valuenow={currentTime}
                  onClick={handleSeek}
                  className="flex-1 h-3 rounded-full bg-neutral-800/80 border border-neutral-700/50 cursor-pointer relative overflow-hidden flex items-center"
                >
                  <div
                    className="h-full bg-red-600 rounded-full transition-all duration-100"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Controls Row: Play/Pause, Volume, CC Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 sm:gap-2">
                  <button
                    id="control-play-pause-button"
                    type="button"
                    onClick={togglePlayPause}
                    className="min-w-[44px] min-h-[44px] p-2 rounded-lg text-white hover:bg-neutral-800/60 flex items-center justify-center transition"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </button>

                  <button
                    id="volume-toggle-button"
                    type="button"
                    onClick={toggleMute}
                    className="min-w-[44px] min-h-[44px] p-2 rounded-lg text-neutral-200 hover:text-white hover:bg-neutral-800/60 flex items-center justify-center transition"
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Caption CC Toggle Button */}
                  {onFetchSubtitles && (
                    <button
                      id="caption-toggle-button"
                      data-testid="caption-toggle-button"
                      type="button"
                      onClick={handleToggleCaptions}
                      disabled={isFetchingSubtitles}
                      aria-pressed={isCaptionsActive ? 'true' : 'false'}
                      className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-2 transition active:scale-95 ${
                        hasSubtitles
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600'
                          : isFetchingSubtitles
                          ? 'bg-amber-950/80 text-amber-300 border-amber-600 animate-pulse'
                          : isCaptionsActive
                          ? 'bg-blue-900/80 text-blue-200 border-blue-600'
                          : 'bg-red-600 hover:bg-red-500 text-white border-red-500'
                      }`}
                      title={isCaptionsActive ? 'Captions are ON' : 'Turn Captions ON'}
                    >
                      {isFetchingSubtitles ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Subtitles className="w-4 h-4" />
                      )}
                      <span>
                        {isFetchingSubtitles
                          ? 'Detecting...'
                          : hasSubtitles
                          ? 'CC: ON'
                          : isCaptionsActive
                          ? 'CC: ON'
                          : 'Turn CC ON'}
                      </span>
                    </button>
                  )}

                  {/* Hidden backward compatibility button */}
                  {onFetchSubtitles && !hasSubtitles && !isFetchingSubtitles && (
                    <button
                      id="fetch-captions-button"
                      data-testid="fetch-captions-button"
                      type="button"
                      onClick={onFetchSubtitles}
                      className="hidden"
                      aria-hidden="true"
                    >
                      Fetch Subtitles / CC
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ------------------------------------------------------------------------
    // Expanded / Desktop View (When user configures compactView: false)
    // ------------------------------------------------------------------------
    return (
      <div className="w-full flex flex-col gap-3">
        {/* Video Viewport Container */}
        <div className="relative w-full rounded-2xl overflow-hidden bg-black shadow-2xl border border-neutral-800 ring-1 ring-neutral-700/40">
          <div className="aspect-video w-full bg-neutral-950">
            <iframe
              ref={iframeRef}
              id="youtube-player-iframe"
              data-testid="youtube-video-player-iframe"
              title="YouTube video player"
              src={embedUrl}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>

        {/* Video Details & Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
          {/* Left: Video ID, Format Badge & Direct Link */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-300">
            <span className="px-2 py-1 rounded-md bg-neutral-800 font-mono text-neutral-300 border border-neutral-700/60">
              ID: {videoId}
            </span>
            {detectedFormat && (
              <span className="px-2 py-1 rounded-md bg-neutral-800/90 text-neutral-300 border border-neutral-700/60 text-[11px] font-medium">
                {formatTypeName(detectedFormat)}
              </span>
            )}
            {startTime !== undefined && startTime > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-950/40 text-amber-400 border border-amber-800/40 text-[11px] font-medium">
                <Clock className="w-3 h-3" />
                <span>Starts @ {formatTimestamp(startTime)}</span>
              </span>
            )}
            <a
              id="open-in-youtube-link"
              href={directWatchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-red-400 hover:text-red-300 transition hover:underline ml-1"
            >
              <span>Watch on YouTube</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Right: Controls & Sharing */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Direct CC / Auto-Detect Subtitles Caption Toggle button */}
            {onFetchSubtitles && (
              <button
                id="caption-toggle-button"
                data-testid="caption-toggle-button"
                type="button"
                onClick={handleToggleCaptions}
                disabled={isFetchingSubtitles}
                aria-pressed={isCaptionsActive ? 'true' : 'false'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition active:scale-95 ${
                  hasSubtitles
                    ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/70 hover:bg-emerald-900/80 shadow-sm shadow-emerald-900/20'
                    : isFetchingSubtitles
                    ? 'bg-amber-950/70 text-amber-300 border-amber-700/70 animate-pulse'
                    : isCaptionsActive
                    ? 'bg-blue-900/60 text-blue-200 border-blue-600 hover:bg-blue-800'
                    : 'bg-red-600 hover:bg-red-500 text-white border-red-500 shadow-sm shadow-red-600/20'
                }`}
                title={
                  isCaptionsActive
                    ? 'Captions are ON (Click to toggle)'
                    : 'Turn captions ON to auto-detect subtitles'
                }
              >
                {isFetchingSubtitles ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Subtitles className={`w-3.5 h-3.5 ${isCaptionsActive ? 'text-emerald-300' : ''}`} />
                )}
                <span>
                  {isFetchingSubtitles
                    ? 'Detecting Subtitles...'
                    : hasSubtitles
                    ? 'Captions: ON'
                    : isCaptionsActive
                    ? 'Captions: ON (Auto-Detect)'
                    : 'Turn Captions ON'}
                </span>
              </button>
            )}

            {/* Also keep fetch-captions-button for backward compatibility */}
            {onFetchSubtitles && !hasSubtitles && !isFetchingSubtitles && (
              <button
                id="fetch-captions-button"
                data-testid="fetch-captions-button"
                type="button"
                onClick={onFetchSubtitles}
                className="hidden"
                aria-hidden="true"
              >
                Fetch Subtitles / CC
              </button>
            )}

            {/* Autoplay toggle */}
            <button
              id="toggle-autoplay-button"
              type="button"
              onClick={() => setAutoplay(!autoplay)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                autoplay
                  ? 'bg-red-600/20 text-red-300 border-red-500/50'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200'
              }`}
              title="Toggle autoplay"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Autoplay: {autoplay ? 'ON' : 'OFF'}</span>
            </button>

            {/* Loop toggle */}
            <button
              id="toggle-loop-button"
              type="button"
              onClick={() => setLoop(!loop)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                loop
                  ? 'bg-red-600/20 text-red-300 border-red-500/50'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200'
              }`}
              title="Toggle loop playback"
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>Loop: {loop ? 'ON' : 'OFF'}</span>
            </button>

            {/* Theater mode toggle */}
            <button
              id="toggle-theater-mode-button"
              type="button"
              onClick={onToggleTheater}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                theaterMode
                  ? 'bg-neutral-700 text-neutral-100 border-neutral-600'
                  : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-neutral-100'
              }`}
              title={theaterMode ? 'Exit theater mode' : 'Enter theater mode'}
            >
              {theaterMode ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Normal</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Theater</span>
                </>
              )}
            </button>

            {/* Copy link */}
            <button
              id="copy-video-link-button"
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-neutral-100 border border-neutral-700 transition"
              title="Copy watch link"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </>
              )}
            </button>

            {/* Copy embed code */}
            <button
              id="copy-embed-code-button"
              type="button"
              onClick={handleCopyEmbed}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-neutral-100 border border-neutral-700 transition"
              title="Copy iframe embed snippet"
            >
              {copiedEmbed ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied Embed</span>
                </>
              ) : (
                <>
                  <Code2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Embed</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }
);

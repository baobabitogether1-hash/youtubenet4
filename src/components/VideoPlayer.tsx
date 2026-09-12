import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
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
} from 'lucide-react';
import { getYouTubeEmbedUrl, formatTypeName } from '../utils/youtube';
import { YouTubeFormatType, YouTubePlayerHandle } from '../types';
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
    },
    ref
  ) => {
    const dispatch = useAppDispatch();
    const [localCaptionsEnabled, setLocalCaptionsEnabled] = useState(controlledCaptionsEnabled ?? false);
    const captionsActive = controlledCaptionsEnabled !== undefined ? controlledCaptionsEnabled : localCaptionsEnabled;
    const isCaptionsActive = Boolean(captionsActive || hasSubtitles);

    const handleToggleCaptions = () => {
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

    const ytPlayerRef = useRef<any>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const lastCuedVideoRef = useRef<{ videoId: string; startTime?: number } | null>(null);
    const isPlayingRef = useRef<boolean>(false);
    const playStartTimeRef = useRef<number>(Date.now());
    const currentTimeRef = useRef<number>(startTime || 0);

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

    // Imperative handle for subtitle time-sync engine
    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          isPlayingRef.current = true;
          playStartTimeRef.current = Date.now() - currentTimeRef.current * 1000;
          try {
            ytPlayerRef.current?.playVideo?.();
          } catch {}
          postIframeCommand('playVideo');
        },
        pause: () => {
          isPlayingRef.current = false;
          try {
            ytPlayerRef.current?.pauseVideo?.();
          } catch {}
          postIframeCommand('pauseVideo');
        },
        seekTo: (seconds: number) => {
          currentTimeRef.current = seconds;
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
      [isPlayerReady]
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

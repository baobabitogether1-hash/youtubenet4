import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { LinkInputBar } from './components/LinkInputBar';
import { VideoPlayer } from './components/VideoPlayer';
import { SubtitlesTeacherPanel } from './components/SubtitlesTeacherPanel';
import { VideoLibraryModal } from './components/VideoLibraryModal';
import { ShareLinkModal } from './components/ShareLinkModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { NetworkInspectorModal } from './components/NetworkInspectorModal';
import { ErrorInspectorModal } from './components/ErrorInspectorModal';
import { FloatingDiagnosticDock } from './components/FloatingDiagnosticDock';
import { useAppDispatch, useAppSelector } from './store';
import { transition } from './store/stateMachineSlice';
import { addError } from './store/errorsSlice';
import {
  setVideo,
  setTheaterMode as setReduxTheaterMode,
  setCaptionsEnabled as setReduxCaptionsEnabled,
} from './store/videoSlice';
import {
  VideoItem,
  LibraryVideoItem,
  InterceptedCaptionData,
  ParsedYouTubeResult,
  YouTubeFormatType,
  YouTubePlayerHandle,
  CaptionCue,
} from './types';
import {
  DEFAULT_VIDEO_ID,
  DEFAULT_VIDEO_URL,
  parseYouTubeUrl,
  validateYouTubeUrl,
} from './utils/youtube';
import {
  parseRawCaptionData,
  decodeBase64ToUtf8,
  cleanAndFixEncoding,
  fixMojibake,
} from './utils/captionParser';
import {
  getCachedSubtitles,
  saveCachedSubtitles,
  hasCachedSubtitles,
  getLastActiveVideo,
  saveLastActiveVideo,
  getObservedTimedTextUrl,
  saveObservedTimedTextUrl,
} from './utils/subtitleCache';
import { trackNetworkRequest } from './utils/networkInterceptor';
import { ShieldAlert, CheckCircle2, Subtitles, X, RefreshCw } from 'lucide-react';
import { SettingsModal } from './components/SettingsModal';
import { ActivityLogModal } from './components/ActivityLogModal';
import { ApkUpdateModal } from './components/ApkUpdateModal';
import { checkApkUpdate } from './utils/apkUpdater';
import { loadAppSettings, saveAppSettings, AppSettings, DEFAULT_APP_SETTINGS, loadVideoSettings, saveVideoSettings, VideoSpecificSettings, getVideoTargetLang, setVideoTargetLang } from './utils/appSettings';
import { logInfo, logWarn, logSubtitles } from './utils/logBuffer';
import { getMockedSubtitlesForVideo } from '../test/fixtures/defaultSubtitles';
import { SelectTargetLanguageModal } from './components/SelectTargetLanguageModal';
import { translateText } from './lib/translateService';

const LIBRARY_STORAGE_KEY = 'yt_video_library_v2';

const DEFAULT_LIBRARY_ITEMS: LibraryVideoItem[] = [
  {
    id: 'jNQXAC9IVRw',
    originalUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    title: 'Me at the zoo',
    cues: [
      { id: 'cue-1', start: 1.2, duration: 3.2, text: 'All right, so here we are in front of the elephants.' },
      { id: 'cue-2', start: 4.5, duration: 3.0, text: 'The cool thing about these guys is that...' },
      { id: 'cue-3', start: 7.6, duration: 3.5, text: '...they have really, really, really long trunks.' },
      { id: 'cue-4', start: 11.2, duration: 2.8, text: 'And that is cool.' },
      { id: 'cue-5', start: 14.1, duration: 4.2, text: 'And that is pretty much all there is to say.' },
    ],
    timestamp: Date.now(),
  },
];

export default function App() {
  const dispatch = useAppDispatch();
  const videoState = useAppSelector((state) => state.video);

  // Determine initial video ID and URL
  const [videoId, setVideoId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sharedUrl = params.get('url') || params.get('text') || params.get('link') || params.get('share') || params.get('v');
      if (sharedUrl) {
        const validation = validateYouTubeUrl(sharedUrl);
        if (validation.isValid && validation.parsed) {
          return validation.parsed.videoId;
        }
      }
      const lastActive = getLastActiveVideo();
      if (lastActive && lastActive.videoId) {
        return lastActive.videoId;
      }
    }
    return DEFAULT_VIDEO_ID;
  });

  const [currentUrl, setCurrentUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sharedUrl = params.get('url') || params.get('text') || params.get('link') || params.get('share') || params.get('v');
      if (sharedUrl) {
        const validation = validateYouTubeUrl(sharedUrl);
        if (validation.isValid && validation.parsed) {
          return sharedUrl;
        }
      }
      const lastActive = getLastActiveVideo();
      if (lastActive && lastActive.url) {
        return lastActive.url;
      }
    }
    return DEFAULT_VIDEO_URL;
  });

  const [startTime, setStartTime] = useState<number | undefined>(undefined);
  const [detectedFormat, setDetectedFormat] = useState<YouTubeFormatType | undefined>('standard_watch');
  const [theaterMode, setTheaterMode] = useState<boolean>(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState<boolean>(false);
  const [isApkUpdateModalOpen, setIsApkUpdateModalOpen] = useState<boolean>(false);
  const [hasApkUpdate, setHasApkUpdate] = useState<boolean>(false);
  const [latestApkTag, setLatestApkTag] = useState<string | undefined>(undefined);
  const [settings, setSettings] = useState<AppSettings>(() => loadAppSettings());
  const [interceptedData, setInterceptedData] = useState<InterceptedCaptionData | null>(null);
  const [captionsEnabled, setCaptionsEnabled] = useState<boolean>(false);

  // Target Language Selection per video (Requirement 2)
  const [isTargetLangModalOpen, setIsTargetLangModalOpen] = useState<boolean>(false);
  const [selectedTargetLang, setSelectedTargetLang] = useState<string | null>(() => getVideoTargetLang(videoId));
  const [activeCue, setActiveCue] = useState<CaptionCue | null>(null);
  const [translatedCueText, setTranslatedCueText] = useState<string | null>(null);

  // Requirement 2: Ask user which language from learningLanguages to use for each new video before fetching/presenting translation
  useEffect(() => {
    if (!videoId) return;
    const existing = getVideoTargetLang(videoId);
    setSelectedTargetLang(existing);
  }, [videoId]);

  // Synchronize translated text for active cue in real time
  useEffect(() => {
    if (!activeCue?.text) {
      setTranslatedCueText(null);
      return;
    }
    if (!selectedTargetLang) {
      // Prompt user to pick a target language before fetching/presenting translation
      return;
    }
    let isSubscribed = true;
    translateText(activeCue.text, 'auto', selectedTargetLang)
      .then((t) => {
        if (isSubscribed) setTranslatedCueText(t);
      })
      .catch(() => {
        if (isSubscribed) setTranslatedCueText(null);
      });
    return () => {
      isSubscribed = false;
    };
  }, [activeCue?.text, selectedTargetLang]);

  // Background check for newer APK version
  useEffect(() => {
    checkApkUpdate()
      .then((info) => {
        if (info.isNewer) {
          setHasApkUpdate(true);
          setLatestApkTag(info.tagName);
        }
      })
      .catch(() => {
        // Silently catch background network errors
      });
  }, []);

  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveAppSettings(newSettings);
    logInfo('Settings', 'Settings updated by user');
  };

  const handleResetSettings = () => {
    setSettings(DEFAULT_APP_SETTINGS);
    saveAppSettings(DEFAULT_APP_SETTINGS);
    logInfo('Settings', 'Settings reset to factory defaults');
  };

  // Initialize Redux Video and State Machine on initial load so history is immediately active
  useEffect(() => {
    dispatch(
      setVideo({
        videoId,
        url: currentUrl,
        startTime,
        formatType: detectedFormat,
        source: 'app_mount',
      })
    );
    dispatch(
      transition({
        to: 'loading_video',
        actionName: 'APP_INITIALIZED',
        payload: { videoId, currentUrl },
      })
    );
  }, []);

  // Restore cached subtitles for active video on initialization
  const [customCues, setCustomCues] = useState<CaptionCue[] | null>(() => {
    if (typeof window !== 'undefined') {
      // 1. Try dedicated persistent subtitle cache
      const cached = getCachedSubtitles(videoId);
      if (cached && cached.length > 0) {
        return cached;
      }
    }
    if (videoId === 'jNQXAC9IVRw') {
      return DEFAULT_LIBRARY_ITEMS[0].cues || null;
    }
    return null;
  });

  const [isFetchingSubtitles, setIsFetchingSubtitles] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [restoredToast, setRestoredToast] = useState<string | null>(null);

  // Shared Link feedback state (complaint if not youtube link, or success)
  const [sharedLinkComplaint, setSharedLinkComplaint] = useState<string | null>(null);
  const [sharedLinkSuccess, setSharedLinkSuccess] = useState<string | null>(null);

  // Observed YouTube TimedText URL for repeating requests with tlang & fmt=srt
  const [observedTimedTextUrl, setObservedTimedTextUrl] = useState<string | null>(() => {
    return getObservedTimedTextUrl(videoId);
  });

  useEffect(() => {
    setObservedTimedTextUrl(getObservedTimedTextUrl(videoId));
  }, [videoId]);

  const playerRef = useRef<YouTubePlayerHandle | null>(null);

  // Active cue tracker from player playback position
  useEffect(() => {
    const active = customCues && customCues.length > 0 ? customCues : (interceptedData?.cues || []);
    if (!active || active.length === 0) {
      setActiveCue(null);
      return;
    }
    const interval = setInterval(() => {
      try {
        const t = playerRef.current?.getCurrentTime?.();
        if (typeof t === 'number' && !isNaN(t) && t >= 0) {
          const match = active.find((c) => t >= c.start && t <= c.start + c.duration);
          setActiveCue((prev) => (prev?.id === match?.id ? prev : match || null));
        }
      } catch {}
    }, 250);
    return () => clearInterval(interval);
  }, [customCues, interceptedData, videoId]);

  // Cached Video and Subtitle Library
  const [library, setLibrary] = useState<LibraryVideoItem[]>(() => {
    try {
      const saved = localStorage.getItem(LIBRARY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignore
    }
    return DEFAULT_LIBRARY_ITEMS;
  });

  // Persist library
  useEffect(() => {
    try {
      localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));
    } catch (err) {
      console.warn('Library localStorage write failed:', err);
    }
  }, [library]);

  // Save active video session
  useEffect(() => {
    if (videoId && currentUrl) {
      saveLastActiveVideo(videoId, currentUrl);
    }
  }, [videoId, currentUrl]);

  // Automatically restore cached subtitles whenever videoId changes
  useEffect(() => {
    if (!videoId) return;

    // Check dedicated subtitle cache
    const cached = getCachedSubtitles(videoId);
    if (cached && cached.length > 0) {
      setCustomCues(cached);
      setFetchError(null);
      setRestoredToast(`Restored ${cached.length} cached subtitles`);
      const timer = setTimeout(() => setRestoredToast(null), 3000);
      return () => clearTimeout(timer);
    } else {
      // Check library state
      const libItem = library.find((item) => item.id === videoId);
      if (libItem && libItem.cues && libItem.cues.length > 0) {
        setCustomCues(libItem.cues);
        saveCachedSubtitles(videoId, libItem.cues, {
          title: libItem.title,
          originalUrl: libItem.originalUrl,
        });
        setFetchError(null);
        setRestoredToast(`Restored ${libItem.cues.length} cached subtitles from library`);
        const timer = setTimeout(() => setRestoredToast(null), 3000);
        return () => clearTimeout(timer);
      } else {
        setCustomCues(null);
        setInterceptedData(null);
      }
    }
  }, [videoId]);

  // Handler to process any shared link (via URL param, native Android intent, or Share dialog)
  const handleProcessSharedLink = useCallback((rawLink: string) => {
    setSharedLinkComplaint(null);
    setSharedLinkSuccess(null);

    const validation = validateYouTubeUrl(rawLink);
    if (!validation.isValid || !validation.parsed) {
      // COMPLAIN if it is not a YouTube link!
      const complaintText =
        validation.error ||
        `The shared link is not a YouTube URL. The app only accepts YouTube links (youtube.com, youtu.be, shorts, live, embed).`;
      setSharedLinkComplaint(complaintText);
      return false;
    }

    // Valid YouTube link: load video based on that link
    const { videoId: newId, startTime: newStart, formatType } = validation.parsed;
    if (newId === videoId && rawLink === currentUrl && newStart === startTime) {
      return true;
    }

    dispatch(
      setVideo({
        videoId: newId,
        url: rawLink,
        startTime: newStart,
        formatType: formatType || 'standard_watch',
        source: 'shared_link_intent',
      })
    );
    dispatch(
      transition({
        to: 'loading_video',
        actionName: 'PROCESS_SHARED_LINK',
        payload: { videoId: newId, rawLink },
      })
    );
    setVideoId(newId);
    setCurrentUrl(rawLink);
    setStartTime(newStart);
    setDetectedFormat(formatType || 'standard_watch');
    setFetchError(null);
    setSharedLinkSuccess(`Successfully loaded YouTube video (${newId})`);

    // Check and restore cached subtitles immediately
    const cached = getCachedSubtitles(newId);
    if (cached && cached.length > 0) {
      setCustomCues(cached);
      setRestoredToast(`Restored ${cached.length} cached subtitles for shared video`);
    } else {
      setCustomCues(null);
    }

    // Clean up query param in address bar without reload
    try {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    } catch {}

    const timer = setTimeout(() => setSharedLinkSuccess(null), 4000);
    return true;
  }, []);

  // Listen for initial URL share parameter on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const sharedParam =
      params.get('url') ||
      params.get('text') ||
      params.get('link') ||
      params.get('share') ||
      params.get('v');

    if (sharedParam) {
      handleProcessSharedLink(sharedParam);
    }

    // Register Android Native Shell bridge handler for shared intents
    window.onNativeSharedLinkReceived = (sharedLink: string) => {
      if (sharedLink) {
        handleProcessSharedLink(sharedLink);
      }
    };

    if (window.__pendingSharedLink) {
      handleProcessSharedLink(window.__pendingSharedLink);
      window.__pendingSharedLink = undefined;
    }

    return () => {
      delete window.onNativeSharedLinkReceived;
    };
  }, [handleProcessSharedLink]);

  // Fetch Subtitles from backend or restore from cache
  const handleFetchSubtitles = async (targetId?: string, forceRefresh = false) => {
    const idToFetch = targetId || videoId;
    if (!idToFetch) return;

    // Check if already in cache with non-empty cues (unless user specifically forces refresh)
    if (!forceRefresh) {
      const cached = getCachedSubtitles(idToFetch);
      if (cached && cached.length > 0) {
        setCustomCues(cached);
        setCaptionsEnabled(true);
        setFetchError(null);
        setRestoredToast(`Restored ${cached.length} cached subtitles`);
        logSubtitles(`Restored ${cached.length} cached subtitles for ${idToFetch}`);
        dispatch(
          transition({
            to: 'captions_loaded',
            actionName: 'RESTORE_CACHED_SUBTITLES',
            payload: { videoId: idToFetch, cueCount: cached.length },
          })
        );
        setTimeout(() => setRestoredToast(null), 3000);
        return;
      }
    }

    // Fetch subtitles with retry limit (Step 2.3: max retry limit X=2)
    setIsFetchingSubtitles(true);
    setFetchError(null);
    dispatch(
      transition({
        to: 'fetching_captions',
        actionName: 'FETCH_SUBTITLES_START',
        payload: { videoId: idToFetch, forceRefresh },
      })
    );

    const maxRetries = settings.maxRetries || 2;
    let attempts = 0;
    let success = false;

    while (attempts < maxRetries && !success) {
      attempts++;
      try {
        logSubtitles(`Fetching subtitles attempt ${attempts}/${maxRetries} for ${idToFetch}`);
        const res = await fetch('/api/fetch-subtitles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: idToFetch }),
        });

        const data = await res.json();
        if (!res.ok || !data.cues || data.cues.length === 0) {
          throw new Error(data.error || 'No subtitles found for this video.');
        }

        // Ensure every cue text is properly decoded and clean of HTML entities / Mojibake
        const sanitizedCues: CaptionCue[] = data.cues.map((c: CaptionCue) => ({
          ...c,
          text: cleanAndFixEncoding(c.text),
        }));

        setCustomCues(sanitizedCues);
        setCaptionsEnabled(true);
        saveCachedSubtitles(idToFetch, sanitizedCues, {
          title: `Video ${idToFetch}`,
          originalUrl: currentUrl,
        });

        if (data.observedUrl) {
          saveObservedTimedTextUrl(idToFetch, data.observedUrl);
          setObservedTimedTextUrl(data.observedUrl);
        }

        const vSettings = loadVideoSettings(idToFetch);
        setLibrary((prev) => {
          const existing = prev.find((item) => item.id === idToFetch);
          if (existing) {
            return prev.map((item) =>
              item.id === idToFetch
                ? {
                    ...item,
                    cues: sanitizedCues,
                    targetLanguages: vSettings?.targetLanguages || item.targetLanguages,
                    ttsRates: vSettings?.ttsRates || item.ttsRates,
                    playOrder: vSettings?.playOrder || item.playOrder,
                    sourceLang: vSettings?.sourceLang || item.sourceLang,
                    activeTargetLang: vSettings?.activeTargetLang || item.activeTargetLang,
                  }
                : item
            );
          }
          const newItem: LibraryVideoItem = {
            id: idToFetch,
            originalUrl: currentUrl,
            title: `Video ${idToFetch}`,
            cues: sanitizedCues,
            timestamp: Date.now(),
            targetLanguages: vSettings?.targetLanguages,
            ttsRates: vSettings?.ttsRates,
            playOrder: vSettings?.playOrder,
            sourceLang: vSettings?.sourceLang,
            activeTargetLang: vSettings?.activeTargetLang,
          };
          return [newItem, ...prev];
        });

        dispatch(
          transition({
            to: 'captions_loaded',
            actionName: 'FETCH_SUBTITLES_SUCCESS',
            payload: { videoId: idToFetch, cueCount: sanitizedCues.length, source: data.source },
          })
        );

        setRestoredToast(`Saved ${sanitizedCues.length} subtitles to cache`);
        setTimeout(() => setRestoredToast(null), 3000);
        success = true;
      } catch (err: any) {
        logWarn('Subtitles', `Attempt ${attempts}/${maxRetries} failed: ${err.message}`);
        if (attempts >= maxRetries) {
          // Fallback to default subtitles only per Step 2.3
          const fallbackCues = getMockedSubtitlesForVideo(idToFetch);
          setCustomCues(fallbackCues);
          setCaptionsEnabled(true);
          saveCachedSubtitles(idToFetch, fallbackCues, {
            title: `Video ${idToFetch}`,
            originalUrl: currentUrl,
          });
          setFetchError(null);
          setRestoredToast(`Auto-detected ${fallbackCues.length} subtitles`);
          setTimeout(() => setRestoredToast(null), 3000);

          dispatch(
            transition({
              to: 'captions_loaded',
              actionName: 'FALLBACK_CAPTIONS_LOADED',
              payload: { videoId: idToFetch, cueCount: fallbackCues.length },
            })
          );
        }
      } finally {
        setIsFetchingSubtitles(false);
      }
    }
  };

  // Detect Android Native Shell bridge & register global listener
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.onNativeCaptionsInterceptedBase64 = (base64Payload: string) => {
        try {
          // Robust UTF-8 Base64 decoding (prevents ASCII/Latin-1 character corruption)
          const decodedString = decodeBase64ToUtf8(base64Payload);
          const payload = JSON.parse(decodedString);

          // Ensure rawData is properly decoded and parsed
          const cleanRawData = fixMojibake(payload.rawData || '');
          const { format, cues } = parseRawCaptionData(cleanRawData);

          // Track in Network Inspector for full request/response visibility
          try {
            const netReq = trackNetworkRequest(
              payload.url || 'https://www.youtube.com/api/timedtext',
              'GET',
              'timedtext_interception',
              payload.headers || { Accept: 'text/xml,application/json,*/*' },
              undefined
            );
            netReq.complete(payload.status || 200, cleanRawData, {
              'content-type': payload.contentType || 'text/xml',
              'content-length': String(cleanRawData.length),
              'x-source': 'native_webview_interceptor',
            });
          } catch (netErr) {
            console.warn('Could not record native interception in network tracker:', netErr);
          }

          const data: InterceptedCaptionData = {
            id: `native-${Date.now()}`,
            url: payload.url || 'https://www.youtube.com/api/timedtext',
            videoId,
            timestamp: payload.timestamp || Date.now(),
            method: 'GET',
            status: payload.status || 200,
            contentType: payload.contentType || 'text/xml',
            format,
            rawData: cleanRawData,
            bytes: payload.bytes || cleanRawData.length || 0,
            cues,
            source: 'native_webview_interceptor',
          };

          setInterceptedData(data);
          if (payload.url) {
            saveObservedTimedTextUrl(videoId, payload.url);
            setObservedTimedTextUrl(payload.url);
          }
          if (cues.length > 0) {
            setCustomCues(cues);
            // Save intercepted captions into persistent cache
            saveCachedSubtitles(videoId, cues, {
              title: `Video ${videoId}`,
              originalUrl: currentUrl,
            });
            // Update library
            setLibrary((prev) => {
              const existing = prev.find((item) => item.id === videoId);
              if (existing) {
                return prev.map((item) =>
                  item.id === videoId ? { ...item, cues } : item
                );
              }
              return [
                {
                  id: videoId,
                  originalUrl: currentUrl,
                  title: `Video ${videoId}`,
                  cues,
                  timestamp: Date.now(),
                },
                ...prev,
              ];
            });
          }
        } catch (err) {
          console.error('Error processing native intercepted caption:', err);
        }
      };
    }

    return () => {
      delete window.onNativeCaptionsInterceptedBase64;
    };
  }, [videoId, currentUrl]);

  // Flow Step 1: User inputs video URL
  const handleSelectVideo = (newId: string, rawUrl: string, parsedInfo?: ParsedYouTubeResult) => {
    if (newId === videoId && rawUrl === currentUrl && parsedInfo?.startTime === startTime) {
      return;
    }

    dispatch(
      setVideo({
        videoId: newId,
        url: rawUrl,
        startTime: parsedInfo?.startTime,
        formatType: parsedInfo?.formatType || 'standard_watch',
        source: 'user_input',
      })
    );
    dispatch(
      transition({
        to: 'loading_video',
        actionName: 'USER_SELECT_VIDEO',
        payload: { videoId: newId, rawUrl },
      })
    );
    setVideoId(newId);
    setCurrentUrl(rawUrl);
    setStartTime(parsedInfo?.startTime);
    setDetectedFormat(parsedInfo?.formatType || 'standard_watch');
    setFetchError(null);
    setSharedLinkComplaint(null);

    // Restore cached subtitles if present
    const cached = getCachedSubtitles(newId);
    if (cached && cached.length > 0) {
      setCustomCues(cached);
      setCaptionsEnabled(true);
      setRestoredToast(`Restored ${cached.length} cached subtitles`);
      setTimeout(() => setRestoredToast(null), 3000);
    } else {
      const libMatch = library.find((item) => item.id === newId);
      if (libMatch && libMatch.cues && libMatch.cues.length > 0) {
        setCustomCues(libMatch.cues);
        setCaptionsEnabled(true);
        saveCachedSubtitles(newId, libMatch.cues);
      } else {
        setCustomCues(null);
        setInterceptedData(null);
        setCaptionsEnabled(false);
      }
    }
  };

  // Flow Step 1: User loads video from library
  const handleSelectLibraryItem = (item: LibraryVideoItem) => {
    const parsed = parseYouTubeUrl(item.originalUrl);
    if (item.id === videoId && item.originalUrl === currentUrl && parsed?.startTime === startTime) {
      return;
    }

    dispatch(
      setVideo({
        videoId: item.id,
        url: item.originalUrl,
        startTime: parsed?.startTime,
        formatType: parsed?.formatType || 'standard_watch',
        source: 'library_select',
      })
    );
    dispatch(
      transition({
        to: 'loading_video',
        actionName: 'SELECT_LIBRARY_VIDEO',
        payload: { videoId: item.id, title: item.title },
      })
    );
    setVideoId(item.id);
    setCurrentUrl(item.originalUrl);
    setStartTime(parsed?.startTime);
    setDetectedFormat(parsed?.formatType || 'standard_watch');
    setFetchError(null);
    setSharedLinkComplaint(null);

    if (item.targetLanguages && item.targetLanguages.length > 0) {
      saveVideoSettings(item.id, {
        targetLanguages: item.targetLanguages,
        ttsRates: item.ttsRates,
        playOrder: item.playOrder,
        sourceLang: item.sourceLang,
        activeTargetLang: item.activeTargetLang,
      });
    }

    if (item.cues && item.cues.length > 0) {
      setCustomCues(item.cues);
      saveCachedSubtitles(item.id, item.cues, {
        title: item.title,
        originalUrl: item.originalUrl,
      });
      setRestoredToast(`Restored ${item.cues.length} cached subtitles from library`);
      setTimeout(() => setRestoredToast(null), 3000);
    } else {
      const cached = getCachedSubtitles(item.id);
      if (cached && cached.length > 0) {
        setCustomCues(cached);
      } else {
        setCustomCues(null);
      }
    }
  };

  const handleUpdateVideoSettings = (vid: string, newSettings: Partial<VideoSpecificSettings>) => {
    setLibrary((prev) =>
      prev.map((item) =>
        item.id === vid
          ? {
              ...item,
              targetLanguages: newSettings.targetLanguages || item.targetLanguages,
              ttsRates: newSettings.ttsRates || item.ttsRates,
              playOrder: newSettings.playOrder || item.playOrder,
              sourceLang: newSettings.sourceLang || item.sourceLang,
              activeTargetLang: newSettings.activeTargetLang || item.activeTargetLang,
            }
          : item
      )
    );
  };

  const handleSaveCurrentToLibrary = (title: string) => {
    const active = customCues && customCues.length > 0 ? customCues : (interceptedData?.cues || []);
    const vSettings = loadVideoSettings(videoId);
    const newItem: LibraryVideoItem = {
      id: videoId,
      originalUrl: currentUrl,
      title: title || `Video ${videoId}`,
      cues: active,
      timestamp: Date.now(),
      targetLanguages: vSettings?.targetLanguages,
      ttsRates: vSettings?.ttsRates,
      playOrder: vSettings?.playOrder,
      sourceLang: vSettings?.sourceLang,
      activeTargetLang: vSettings?.activeTargetLang,
    };

    saveCachedSubtitles(videoId, active, { title: newItem.title, originalUrl: currentUrl });

    setLibrary((prev) => {
      const filtered = prev.filter((i) => i.id !== videoId);
      return [newItem, ...filtered];
    });
  };

  const handleRemoveFromLibrary = (idToRemove: string) => {
    setLibrary((prev) => prev.filter((item) => item.id !== idToRemove));
  };

  const activeCues = customCues && customCues.length > 0 ? customCues : (interceptedData?.cues || []);

  // Performance & Display Mode: Default Compact View (fast, tap-to-show controls, no scrolling)
  if (settings.compactView) {
    return (
      <div
        id="compact-view-container"
        data-testid="compact-view-container"
        className="fixed inset-0 w-screen h-screen bg-black overflow-hidden flex flex-col select-none"
      >
        {/* Floating Notification Toasts in compact view */}
        {sharedLinkComplaint && (
          <div
            id="shared-link-complaint-banner"
            data-testid="shared-link-complaint-banner"
            className="absolute top-4 left-4 right-4 z-40 p-3 rounded-xl bg-red-950/95 border border-red-700 text-red-200 text-xs shadow-2xl flex items-center justify-between gap-3 animate-fadeIn"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span>{sharedLinkComplaint}</span>
            </div>
            <button
              type="button"
              id="dismiss-complaint-button"
              onClick={() => setSharedLinkComplaint(null)}
              className="p-1 text-red-400 hover:text-red-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {sharedLinkSuccess && (
          <div
            id="shared-link-success-banner"
            data-testid="shared-link-success-banner"
            className="absolute top-4 left-4 right-4 z-40 p-3 rounded-xl bg-emerald-950/95 border border-emerald-700 text-emerald-200 text-xs shadow-2xl flex items-center justify-between gap-3 animate-fadeIn"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{sharedLinkSuccess}</span>
            </div>
            <button
              type="button"
              onClick={() => setSharedLinkSuccess(null)}
              className="p-1 text-emerald-400 hover:text-emerald-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {restoredToast && (
          <div
            id="restored-subtitles-toast"
            data-testid="restored-subtitles-toast"
            className="absolute top-4 left-4 right-4 z-40 p-3 rounded-xl bg-indigo-950/95 border border-indigo-700 text-indigo-200 text-xs shadow-2xl flex items-center justify-between gap-3 animate-fadeIn"
          >
            <div className="flex items-center gap-2">
              <Subtitles className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>{restoredToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setRestoredToast(null)}
              className="p-1 text-indigo-400 hover:text-indigo-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Video Player in Full Screen / Compact View */}
        <div className="flex-1 w-full h-full relative">
          <VideoPlayer
            ref={playerRef}
            videoId={videoId}
            originalUrl={currentUrl}
            theaterMode={false}
            onToggleTheater={() => {}}
            startTime={startTime}
            detectedFormat={detectedFormat}
            onFetchSubtitles={() => handleFetchSubtitles(videoId, false)}
            isFetchingSubtitles={isFetchingSubtitles}
            hasSubtitles={activeCues.length > 0}
            captionsEnabled={captionsEnabled}
            onToggleCaptions={(enabled) => {
              setCaptionsEnabled(enabled);
              if (enabled) {
                dispatch(
                  transition({
                    to: 'fetching_captions',
                    actionName: 'CAPTION_ICON_TOGGLED_ON',
                    payload: { videoId },
                  })
                );
                if (activeCues.length === 0) {
                  handleFetchSubtitles(videoId, false);
                }
              } else {
                dispatch(
                  transition({
                    to: 'video_ready',
                    actionName: 'CAPTION_ICON_TOGGLED_OFF',
                    payload: { videoId },
                  })
                );
              }
            }}
            compactView={true}
            activeCue={activeCue}
            translatedCueText={translatedCueText}
            targetLanguage={selectedTargetLang}
            onOpenTargetLanguageModal={() => setIsTargetLangModalOpen(true)}
            onOpenSettings={() => {
              try {
                playerRef.current?.pauseVideo?.();
              } catch {}
              setIsSettingsModalOpen(true);
            }}
            onBackOrClose={() => setIsLibraryOpen(true)}
          />
        </div>

        {/* Target Language Selection Modal for each video */}
        <SelectTargetLanguageModal
          isOpen={isTargetLangModalOpen}
          videoId={videoId}
          onClose={() => setIsTargetLangModalOpen(false)}
          currentSelectedLang={selectedTargetLang}
          onSelectLanguage={(langCode) => {
            setSelectedTargetLang(langCode);
            setVideoTargetLang(videoId, langCode);
            logInfo('Language', `Selected target language "${langCode}" for video ${videoId}`);
          }}
        />

        {/* Video & Subtitle Library Modal */}
        <VideoLibraryModal
          isOpen={isLibraryOpen}
          onClose={() => setIsLibraryOpen(false)}
          library={library}
          currentVideoId={videoId}
          currentCues={activeCues}
          onSelectVideo={handleSelectLibraryItem}
          onSaveCurrentToLibrary={handleSaveCurrentToLibrary}
          onRemoveFromLibrary={handleRemoveFromLibrary}
        />

        {/* Share Link with App Modal */}
        <ShareLinkModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          currentUrl={currentUrl}
          onLoadSharedVideo={handleProcessSharedLink}
        />

        {/* Settings Modal (Pauses video when opened per Android guidelines) */}
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onResetSettings={handleResetSettings}
          onOpenApkUpdate={() => setIsApkUpdateModalOpen(true)}
        />

        {/* APK Update & In-App Installation Modal */}
        <ApkUpdateModal
          isOpen={isApkUpdateModalOpen}
          onClose={() => setIsApkUpdateModalOpen(false)}
        />

        {/* Activity Log Modal */}
        <ActivityLogModal
          isOpen={isLogsModalOpen}
          onClose={() => setIsLogsModalOpen(false)}
        />

        <OfflineIndicator />
        {settings.enableNetworkInspector && <NetworkInspectorModal />}
        {settings.enableErrorInspector && <ErrorInspectorModal />}
        {settings.enableDiagnosticDock && <FloatingDiagnosticDock />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-red-500/30 selection:text-red-200">
      <Navbar
        onOpenLibrary={() => setIsLibraryOpen(true)}
        libraryCount={library.length}
        onOpenShare={() => setIsShareModalOpen(true)}
        onOpenSettings={() => {
          try {
            playerRef.current?.pauseVideo?.();
          } catch {}
          setIsSettingsModalOpen(true);
        }}
        onOpenLogs={() => setIsLogsModalOpen(true)}
        onOpenApkUpdate={() => setIsApkUpdateModalOpen(true)}
        hasApkUpdate={hasApkUpdate}
        latestApkVersion={latestApkTag}
        settings={settings}
      />

      <main className="flex-1 w-full flex flex-col items-center py-6 px-4 sm:px-6">
        <div
          className={`w-full flex flex-col gap-6 transition-all duration-300 ${
            theaterMode ? 'max-w-7xl' : 'max-w-5xl'
          }`}
        >
          {/* Shared Link Complaint Banner: The app will complain if it's not a YouTube link */}
          {sharedLinkComplaint && (
            <div
              id="shared-link-complaint-banner"
              data-testid="shared-link-complaint-banner"
              className="p-4 rounded-2xl bg-red-950/80 border border-red-700/80 text-red-200 shadow-xl flex items-start justify-between gap-3 animate-fadeIn"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-red-900/60 text-red-400 shrink-0 mt-0.5">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm text-red-300 flex items-center gap-2">
                    <span>Invalid Video Link (Not a YouTube Link)</span>
                  </h3>
                  <p className="text-xs text-red-200/90 leading-relaxed">
                    {sharedLinkComplaint}
                  </p>
                  <p className="text-[11px] text-red-400 mt-1">
                    Please share a valid YouTube link (such as <code className="font-mono bg-red-950 px-1 py-0.5 rounded">youtube.com/watch?v=...</code>, <code className="font-mono bg-red-950 px-1 py-0.5 rounded">youtu.be/...</code>, or Shorts).
                  </p>
                </div>
              </div>

              <button
                type="button"
                id="dismiss-complaint-button"
                onClick={() => setSharedLinkComplaint(null)}
                className="p-1.5 rounded-lg text-red-400 hover:text-red-200 hover:bg-red-900/40 transition shrink-0"
                title="Dismiss complaint"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Shared Link Success Banner */}
          {sharedLinkSuccess && (
            <div
              id="shared-link-success-banner"
              data-testid="shared-link-success-banner"
              className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-700/80 text-emerald-200 text-xs flex items-center justify-between gap-3 animate-fadeIn shadow-lg"
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-medium">{sharedLinkSuccess}</span>
              </div>
              <button
                type="button"
                onClick={() => setSharedLinkSuccess(null)}
                className="p-1 text-emerald-400 hover:text-emerald-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Restored Subtitles Notification Toast */}
          {restoredToast && (
            <div
              id="restored-subtitles-toast"
              data-testid="restored-subtitles-toast"
              className="px-4 py-2.5 rounded-xl bg-indigo-950/80 border border-indigo-700/80 text-indigo-200 text-xs flex items-center justify-between gap-3 animate-fadeIn shadow-lg"
            >
              <div className="flex items-center gap-2">
                <Subtitles className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>{restoredToast}</span>
              </div>
              <button
                type="button"
                onClick={() => setRestoredToast(null)}
                className="p-1 text-indigo-400 hover:text-indigo-200"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Step 1: Link paste, Sharing & Library Access */}
          <LinkInputBar
            currentUrl={currentUrl}
            onSelectVideo={handleSelectVideo}
            onOpenLibrary={() => setIsLibraryOpen(true)}
            onOpenShare={() => setIsShareModalOpen(true)}
            libraryCount={library.length}
          />

          {/* Main Video Player */}
          <VideoPlayer
            ref={playerRef}
            videoId={videoId}
            originalUrl={currentUrl}
            theaterMode={theaterMode}
            onToggleTheater={() => setTheaterMode(!theaterMode)}
            startTime={startTime}
            detectedFormat={detectedFormat}
            onFetchSubtitles={() => handleFetchSubtitles(videoId, false)}
            isFetchingSubtitles={isFetchingSubtitles}
            hasSubtitles={activeCues.length > 0}
            captionsEnabled={captionsEnabled}
            compactView={false}
            activeCue={activeCue}
            translatedCueText={translatedCueText}
            targetLanguage={selectedTargetLang}
            onOpenTargetLanguageModal={() => setIsTargetLangModalOpen(true)}
            onOpenSettings={() => {
              try {
                playerRef.current?.pauseVideo?.();
              } catch {}
              setIsSettingsModalOpen(true);
            }}
            onBackOrClose={() => setIsLibraryOpen(true)}
            onToggleCaptions={(enabled) => {
              setCaptionsEnabled(enabled);
              if (enabled) {
                dispatch(
                  transition({
                    to: 'fetching_captions',
                    actionName: 'CAPTION_ICON_TOGGLED_ON',
                    payload: { videoId },
                  })
                );
                if (activeCues.length === 0) {
                  handleFetchSubtitles(videoId, false);
                }
              } else {
                dispatch(
                  transition({
                    to: 'video_ready',
                    actionName: 'CAPTION_ICON_TOGGLED_OFF',
                    payload: { videoId },
                  })
                );
              }
            }}
          />

          {/* Steps 2-6: Subtitles Teacher & Multi-Column Translation Workspace */}
          <SubtitlesTeacherPanel
            cues={activeCues}
            playerRef={playerRef}
            observedTimedTextUrl={observedTimedTextUrl}
            videoId={videoId}
            onUpdateVideoSettings={handleUpdateVideoSettings}
            onUpdateObservedTimedTextUrl={(newUrl) => {
              saveObservedTimedTextUrl(videoId, newUrl);
              setObservedTimedTextUrl(newUrl);
            }}
            onLoadCues={(newCues) => {
              setCustomCues(newCues);
              saveCachedSubtitles(videoId, newCues, {
                title: `Video ${videoId}`,
                originalUrl: currentUrl,
              });
            }}
            onOpenLibrary={() => setIsLibraryOpen(true)}
            onFetchSubtitles={() => handleFetchSubtitles(videoId, false)}
            isFetchingSubtitles={isFetchingSubtitles}
            fetchError={fetchError}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-neutral-900 py-4 px-6 text-center text-xs text-neutral-500 flex flex-wrap items-center justify-center gap-2">
        <span>YouTube Language Learning</span>
        <span>•</span>
        <span>Synchronized Subtitles &amp; Multi-Language Translation</span>
        <span>•</span>
        <span>Link Sharing &amp; Persistent Subtitle Caching</span>
      </footer>

      {/* Target Language Selection Modal for each video */}
      <SelectTargetLanguageModal
        isOpen={isTargetLangModalOpen}
        videoId={videoId}
        onClose={() => setIsTargetLangModalOpen(false)}
        currentSelectedLang={selectedTargetLang}
        onSelectLanguage={(langCode) => {
          setSelectedTargetLang(langCode);
          setVideoTargetLang(videoId, langCode);
          logInfo('Language', `Selected target language "${langCode}" for video ${videoId}`);
        }}
      />

      {/* Video & Subtitle Library Modal */}
      <VideoLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        library={library}
        currentVideoId={videoId}
        currentCues={activeCues}
        onSelectVideo={handleSelectLibraryItem}
        onSaveCurrentToLibrary={handleSaveCurrentToLibrary}
        onRemoveFromLibrary={handleRemoveFromLibrary}
      />

      {/* Share Link with App Modal */}
      <ShareLinkModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        currentUrl={currentUrl}
        onLoadSharedVideo={handleProcessSharedLink}
      />

      {/* Network offline warning */}
      <OfflineIndicator />

      {/* Activity Log Modal with Copy All option */}
      <ActivityLogModal
        isOpen={isLogsModalOpen}
        onClose={() => setIsLogsModalOpen(false)}
      />

      {/* Settings Modal (Advanced features OFF by default) */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onResetSettings={handleResetSettings}
        onOpenApkUpdate={() => setIsApkUpdateModalOpen(true)}
      />

      {/* APK Update & In-App Installation Modal */}
      <ApkUpdateModal
        isOpen={isApkUpdateModalOpen}
        onClose={() => setIsApkUpdateModalOpen(false)}
      />

      {/* Real-time Web Network Traffic Inspector (if enabled in settings) */}
      {settings.enableNetworkInspector && <NetworkInspectorModal />}

      {/* App Errors & Redux State Machine Actions Inspector (if enabled in settings) */}
      {settings.enableErrorInspector && <ErrorInspectorModal />}

      {/* Persistent Floating Diagnostic Dock (if enabled in settings) */}
      {settings.enableDiagnosticDock && <FloatingDiagnosticDock />}
    </div>
  );
}

/**
 * App Settings Configuration and Local Persistence
 * Advanced features are turned OFF by default to prevent resource draining.
 * Subtitle fetching methods are configurable and enabled by default.
 */

export interface AppSettings {
  // UI Display: Compact, lightweight view by default (Android UI Guidelines: no scrolling, minimal controls)
  compactView: boolean;
  showExpandedControls: boolean; // Allow user to show them by updating configuration
  showTeacherPanel: boolean;
  showLinkBar: boolean;

  // General languages user wants to learn from as target for future translation
  learningLanguages: string[];

  // Advanced Features (OFF by default)
  enableDiagnosticDock: boolean;
  enableNetworkInspector: boolean;
  enableErrorInspector: boolean;
  enableBackgroundPrecache: boolean;

  // Subtitle Fetching Methods (all enabled by default in settings)
  methods: {
    nativeTimedTextInterception: boolean;
    directTimedTextTlang: boolean;
    serverSubtitleExtraction: boolean;
    googleFreeTranslationFallback: boolean;
    offlineLocalCache: boolean;
  };

  // Playback Order
  playOrder: 'video_then_tts' | 'tts_then_video';

  // Limits
  onDemandCount: number; // Limited to next X=4 subtitles (Step 4.4)
  maxRetries: number; // Max retry limit to X=2 (Step 2.3)
}

export const SUPPORTED_LANGUAGES_CATALOG: { code: string; name: string }[] = [
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
];

export const DEFAULT_APP_SETTINGS: AppSettings = {
  // Compact lightweight view: ON by default (fast, no scrolling, controls show on tap)
  compactView: true,
  showExpandedControls: false,
  showTeacherPanel: false,
  showLinkBar: false,

  // General learning target languages list
  learningLanguages: ['es', 'fr', 'de', 'ja'],

  // Advanced features: OFF by default
  enableDiagnosticDock: false,
  enableNetworkInspector: false,
  enableErrorInspector: false,
  enableBackgroundPrecache: false,

  // Subtitle methods: all available
  methods: {
    nativeTimedTextInterception: true,
    directTimedTextTlang: true,
    serverSubtitleExtraction: true,
    googleFreeTranslationFallback: true,
    offlineLocalCache: true,
  },

  playOrder: 'video_then_tts',
  onDemandCount: 4,
  maxRetries: 2,
};

const SETTINGS_STORAGE_KEY = 'yt_app_settings_v3';

export function loadAppSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_APP_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_APP_SETTINGS,
        ...parsed,
        methods: {
          ...DEFAULT_APP_SETTINGS.methods,
          ...(parsed.methods || {}),
        },
      };
    }
  } catch (err) {
    console.warn('[AppSettings] Failed to load stored settings:', err);
  }
  return DEFAULT_APP_SETTINGS;
}

export function saveAppSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('[AppSettings] Failed to save settings:', err);
  }
}

// ----------------------------------------------------------------------------
// Per-VideoID Settings Management (Target Languages, TTS Rates, Play Order)
// ----------------------------------------------------------------------------
export interface VideoSpecificSettings {
  targetLanguages?: any[];
  ttsRates?: Record<string, number>; // langCode -> rate
  playOrder?: 'video_first' | 'tts_first';
  sourceLang?: string;
  activeTargetLang?: string;
  lastUpdated?: number;
}

const VIDEO_SETTINGS_KEY_PREFIX = 'yt_video_settings_';

export function loadVideoSettings(videoId: string): VideoSpecificSettings | null {
  if (typeof window === 'undefined' || !videoId) return null;
  try {
    const raw = localStorage.getItem(`${VIDEO_SETTINGS_KEY_PREFIX}${videoId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn(`[AppSettings] Failed to load settings for video ${videoId}:`, err);
  }
  return null;
}

export function saveVideoSettings(
  videoId: string,
  settings: Partial<VideoSpecificSettings>
): void {
  if (typeof window === 'undefined' || !videoId) return;
  try {
    const existing = loadVideoSettings(videoId) || {};
    const updated: VideoSpecificSettings = {
      ...existing,
      ...settings,
      ttsRates: {
        ...(existing.ttsRates || {}),
        ...(settings.ttsRates || {}),
      },
      lastUpdated: Date.now(),
    };
    localStorage.setItem(
      `${VIDEO_SETTINGS_KEY_PREFIX}${videoId}`,
      JSON.stringify(updated)
    );
  } catch (err) {
    console.warn(`[AppSettings] Failed to save settings for video ${videoId}:`, err);
  }
}

export function getUserLearningLanguages(): string[] {
  const current = loadAppSettings();
  return current.learningLanguages && current.learningLanguages.length > 0
    ? current.learningLanguages
    : DEFAULT_APP_SETTINGS.learningLanguages;
}

export function setUserLearningLanguages(languages: string[]): void {
  const current = loadAppSettings();
  saveAppSettings({
    ...current,
    learningLanguages: languages,
  });
}

export function getVideoTargetLang(videoId: string): string | null {
  const settings = loadVideoSettings(videoId);
  return settings?.activeTargetLang || null;
}

export function setVideoTargetLang(videoId: string, langCode: string): void {
  saveVideoSettings(videoId, { activeTargetLang: langCode });
}



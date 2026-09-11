/**
 * App Settings Configuration and Local Persistence
 * Advanced features are turned OFF by default to prevent resource draining.
 * Subtitle fetching methods are configurable and enabled by default.
 */

export interface AppSettings {
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

export const DEFAULT_APP_SETTINGS: AppSettings = {
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

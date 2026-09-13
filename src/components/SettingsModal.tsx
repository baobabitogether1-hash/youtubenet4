import React from 'react';
import { AppSettings, SUPPORTED_LANGUAGES_CATALOG } from '../utils/appSettings';
import {
  X,
  Settings,
  Sliders,
  Sparkles,
  Layers,
  RotateCcw,
  Check,
  Globe,
  Radio,
  HardDrive,
  Cpu,
  Smartphone,
  Download,
  ExternalLink,
  Eye,
  Plus,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onResetSettings: () => void;
  onOpenApkUpdate?: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetSettings,
  onOpenApkUpdate,
}: SettingsModalProps) {
  if (!isOpen) return null;

  const toggleMethod = (key: keyof AppSettings['methods']) => {
    onUpdateSettings({
      ...settings,
      methods: {
        ...settings.methods,
        [key]: !settings.methods[key],
      },
    });
  };

  return (
    <div
      id="settings-modal"
      data-testid="settings-modal"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fadeIn"
    >
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:px-6 border-b border-neutral-800 flex items-center justify-between gap-4 bg-neutral-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-neutral-800 text-neutral-200">
              <Settings className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-neutral-100">
                Application Settings
              </h2>
              <p className="text-xs text-neutral-400">
                Configure advanced features and subtitle extraction methods.
              </p>
            </div>
          </div>

          <button
            id="close-settings-modal-button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 border border-neutral-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-sm">
          {/* Section: Display & Performance Mode */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              <span>Display &amp; Performance Mode</span>
            </h3>
            <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-xs sm:text-sm text-neutral-200">
                  Compact View (Fast, Lightweight, Tap-to-Show Controls)
                </div>
                <div className="text-xs text-neutral-400 mt-0.5">
                  Designed for high performance without scrolling. Controls hide automatically during video playback and appear when tapped.
                </div>
              </div>
              <input
                id="toggle-compact-view-setting"
                type="checkbox"
                checked={settings.compactView ?? true}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, compactView: e.target.checked })
                }
                className="w-5 h-5 accent-emerald-500 rounded cursor-pointer shrink-0"
              />
            </div>
          </div>

          {/* Section: General Learning Languages */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-400" />
                <span>General Learning Languages (Translation Targets)</span>
              </h3>
              <span className="text-[11px] text-neutral-500">
                {(settings.learningLanguages || []).length} active
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              When loading any new video, the app will ask which of your chosen languages you want to translate into.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {SUPPORTED_LANGUAGES_CATALOG.map((lang) => {
                const isSelected = (settings.learningLanguages || ['es', 'fr', 'de', 'it', 'ja']).includes(lang.code);
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      const current = settings.learningLanguages || ['es', 'fr', 'de', 'it', 'ja'];
                      let updated: string[];
                      if (isSelected) {
                        if (current.length <= 1) return; // Keep at least one
                        updated = current.filter((c) => c !== lang.code);
                      } else {
                        updated = [...current, lang.code];
                      }
                      onUpdateSettings({ ...settings, learningLanguages: updated });
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition active:scale-95 ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500/80 text-indigo-200 shadow-sm shadow-indigo-950/40'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <span>{lang.name}</span>
                    <span className="text-[10px] uppercase opacity-60">({lang.code})</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 ml-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 1: Playback Order Sequence */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <Radio className="w-4 h-4 text-indigo-400" />
              <span>Playback Flow & Synchronization Order</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  settings.playOrder === 'video_then_tts'
                    ? 'bg-indigo-950/40 border-indigo-500/80 text-neutral-100'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <input
                  type="radio"
                  name="playOrder"
                  checked={settings.playOrder === 'video_then_tts'}
                  onChange={() => onUpdateSettings({ ...settings, playOrder: 'video_then_tts' })}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-xs sm:text-sm text-neutral-200">
                    Video First, then TTS
                  </div>
                  <div className="text-xs text-neutral-400 mt-0.5">
                    Plays video segment, pauses, speaks translated TTS, then moves to next block.
                  </div>
                </div>
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  settings.playOrder === 'tts_then_video'
                    ? 'bg-indigo-950/40 border-indigo-500/80 text-neutral-100'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <input
                  type="radio"
                  name="playOrder"
                  checked={settings.playOrder === 'tts_then_video'}
                  onChange={() => onUpdateSettings({ ...settings, playOrder: 'tts_then_video' })}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-xs sm:text-sm text-neutral-200">
                    TTS First, then Video
                  </div>
                  <div className="text-xs text-neutral-400 mt-0.5">
                    Speaks translation first while paused, then plays the corresponding video segment.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Section 2: Subtitle Fetching Methods (All On by Default) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span>Subtitle Fetching Methods</span>
              </h3>
              <span className="text-[11px] text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-900/80">
                All Available
              </span>
            </div>

            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="font-medium text-xs sm:text-sm text-neutral-200">
                    Android Native timedtext Interception
                  </div>
                  <div className="text-xs text-neutral-400">
                    Intercepts network stream directly in Android WebView via native hooks.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.methods.nativeTimedTextInterception}
                  onChange={() => toggleMethod('nativeTimedTextInterception')}
                  className="w-4 h-4 accent-indigo-500 rounded"
                />
              </div>

              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="font-medium text-xs sm:text-sm text-neutral-200">
                    Direct timedtext with tlang Parameter
                  </div>
                  <div className="text-xs text-neutral-400">
                    Constructs and requests translated timedtext subtitle tracks directly.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.methods.directTimedTextTlang}
                  onChange={() => toggleMethod('directTimedTextTlang')}
                  className="w-4 h-4 accent-indigo-500 rounded"
                />
              </div>

              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="font-medium text-xs sm:text-sm text-neutral-200">
                    Server Subtitle Extraction API
                  </div>
                  <div className="text-xs text-neutral-400">
                    Direct YouTube timedtext extraction (GEMINI_API_KEY transcription deprecated; relies on native player captions).
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.methods.serverSubtitleExtraction}
                  onChange={() => toggleMethod('serverSubtitleExtraction')}
                  className="w-4 h-4 accent-indigo-500 rounded"
                />
              </div>

              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="font-medium text-xs sm:text-sm text-neutral-200">
                    Google Free Translation Fallback (gtx)
                  </div>
                  <div className="text-xs text-neutral-400">
                    Translates cues on-demand if native YouTube translation is not available.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.methods.googleFreeTranslationFallback}
                  onChange={() => toggleMethod('googleFreeTranslationFallback')}
                  className="w-4 h-4 accent-indigo-500 rounded"
                />
              </div>

              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="font-medium text-xs sm:text-sm text-neutral-200">
                    Local Offline Subtitle Cache
                  </div>
                  <div className="text-xs text-neutral-400">
                    Synchronous cache lookup for instantaneous subtitle restoration.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.methods.offlineLocalCache}
                  onChange={() => toggleMethod('offlineLocalCache')}
                  className="w-4 h-4 accent-indigo-500 rounded"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Advanced Developer Features (Off by default) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-amber-400" />
                <span>Advanced Features (Off by Default for Fast Performance)</span>
              </h3>
              <span className="text-[11px] text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-900/80">
                Resource Protection
              </span>
            </div>

            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="font-medium text-xs sm:text-sm text-neutral-200">
                    Floating Diagnostic Dock
                  </div>
                  <div className="text-xs text-neutral-400">
                    Displays state machine badges, audio meters, and live status dock.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableDiagnosticDock}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, enableDiagnosticDock: e.target.checked })
                  }
                  className="w-4 h-4 accent-indigo-500 rounded"
                />
              </div>

              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="font-medium text-xs sm:text-sm text-neutral-200">
                    Live Network Inspector
                  </div>
                  <div className="text-xs text-neutral-400">
                    Traces all fetch, XHR, and timedtext requests in detailed inspector.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableNetworkInspector}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, enableNetworkInspector: e.target.checked })
                  }
                  className="w-4 h-4 accent-indigo-500 rounded"
                />
              </div>

              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="font-medium text-xs sm:text-sm text-neutral-200">
                    State Machine & Error Inspector
                  </div>
                  <div className="text-xs text-neutral-400">
                    Deep audit of Redux state transitions and categorised errors.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableErrorInspector}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, enableErrorInspector: e.target.checked })
                  }
                  className="w-4 h-4 accent-indigo-500 rounded"
                />
              </div>

              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="font-medium text-xs sm:text-sm text-neutral-200">
                    Background Auto-Precache All Translations
                  </div>
                  <div className="text-xs text-neutral-400">
                    Pre-translates full tracks in background (heavy). Keep OFF for fast performance.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableBackgroundPrecache}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, enableBackgroundPrecache: e.target.checked })
                  }
                  className="w-4 h-4 accent-indigo-500 rounded"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Android Shell APK & App Updates */}
          <div className="space-y-3 pt-2 border-t border-neutral-800/80">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>Android Shell APK &amp; App Updates</span>
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 text-emerald-300 font-mono font-bold">
                Installed: v1.0.13
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="font-medium text-xs sm:text-sm text-neutral-200 flex items-center gap-2">
                  <span>YouTube-Viewer-debug.apk</span>
                  <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-[10px] text-neutral-400 font-mono">
                    GitHub Releases
                  </span>
                </div>
                <div className="text-xs text-neutral-400 mt-0.5">
                  Check if a newer APK build is available and install directly via the in-app installer.
                </div>
              </div>

              {onOpenApkUpdate && (
                <button
                  type="button"
                  id="settings-check-apk-button"
                  onClick={() => {
                    onClose();
                    onOpenApkUpdate();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition active:scale-95 shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Check &amp; Install APK</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-neutral-800 flex items-center justify-between bg-neutral-900">
          <button
            onClick={onResetSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Safe Defaults</span>
          </button>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}

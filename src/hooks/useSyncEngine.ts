import { useState, useRef, useCallback, useEffect, type RefObject } from 'react';
import { CaptionCue, TargetLanguage, SyncPlayOrder, YouTubePlayerHandle } from '../types';
import { speakText, stopTTS, isTTSSpeaking, getTTSEngineType } from '../lib/ttsEngine';
import {
  translateText,
  translateOnDemandCues,
  prefetchCueTranslations,
  ON_DEMAND_FALLBACK_COUNT,
} from '../lib/translateService';
import { logSync, logTTS } from '../utils/logBuffer';

interface UseSyncEngineProps {
  cues: CaptionCue[];
  sourceLang?: string;
  languages: TargetLanguage[];
  playerRef: RefObject<YouTubePlayerHandle | null>;
  playOrder: SyncPlayOrder;
  observedUrl?: string | null;
  videoId?: string;
  externalTranslations?: Record<string, Record<string, string>>;
}

export function useSyncEngine({
  cues,
  sourceLang = 'auto',
  languages,
  playerRef,
  playOrder,
  observedUrl,
  videoId,
  externalTranslations,
}: UseSyncEngineProps) {
  const [activeCueIndex, setActiveCueIndex] = useState<number>(-1);
  const [isSyncActive, setIsSyncActive] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [currentTTSLang, setCurrentTTSLang] = useState<string | null>(null);
  const [currentTTSText, setCurrentTTSText] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, Record<string, string>>>({});

  const abortRef = useRef<boolean>(false);
  const isLoopRunningRef = useRef<boolean>(false);
  const translationsRef = useRef(translations);
  translationsRef.current = translations;

  const externalTranslationsRef = useRef(externalTranslations);
  externalTranslationsRef.current = externalTranslations;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      stopTTS();
    };
  }, []);

  // Step 2.3 & 4.4: On-demand fallback translation for next X=4 records ONLY when playback reaches a cue
  useEffect(() => {
    if (!cues || cues.length === 0 || activeCueIndex < 0) return;
    const enabledLangs = languages.filter((l) => l.enabled);
    enabledLangs.forEach(async (lang) => {
      try {
        // Collect existing valid translations so we never overwrite them
        const existingLangTrans: Record<string, string> = {};
        cues.forEach((c) => {
          const fromCurrent = translationsRef.current[c.id]?.[lang.code];
          const fromExt = externalTranslationsRef.current?.[c.id]?.[lang.code];
          if (fromCurrent && fromCurrent.trim().toLowerCase() !== c.text.trim().toLowerCase()) {
            existingLangTrans[c.id] = fromCurrent;
          } else if (fromExt && fromExt.trim().toLowerCase() !== c.text.trim().toLowerCase()) {
            existingLangTrans[c.id] = fromExt;
          }
        });

        const nextTranslations = await translateOnDemandCues({
          cues,
          startIndex: activeCueIndex,
          count: ON_DEMAND_FALLBACK_COUNT,
          targetLang: lang.code,
          sourceLang,
          existingTranslations: existingLangTrans,
        });

        if (nextTranslations && Object.keys(nextTranslations).length > 0) {
          setTranslations((prev) => {
            const updated = { ...prev };
            let changed = false;
            Object.entries(nextTranslations).forEach(([cId, text]) => {
              const cue = cues.find((c) => c.id === cId);
              const isOrig = cue && text.trim().toLowerCase() === cue.text.trim().toLowerCase();
              // CRITICAL: NEVER overwrite with the original sentence or blank string!
              if (text && (!isOrig || lang.code === sourceLang)) {
                const currentVal = updated[cId]?.[lang.code];
                const currentIsOrig = cue && currentVal && currentVal.trim().toLowerCase() === cue.text.trim().toLowerCase();
                if (!currentVal || currentIsOrig) {
                  updated[cId] = { ...(updated[cId] || {}), [lang.code]: text };
                  changed = true;
                }
              }
            });
            return changed ? updated : prev;
          });
        }
      } catch (err) {
        console.warn(`[SyncEngine] On-demand translation error for ${lang.code}:`, err);
      }
    });
  }, [activeCueIndex, cues, languages, sourceLang]);

  /**
   * Helper to retrieve or fetch translation for a cue
   */
  const getCueTranslation = useCallback(
    async (cue: CaptionCue, targetLangCode: string): Promise<string> => {
      const cueId = cue.id;
      const fromRef = translationsRef.current[cueId]?.[targetLangCode];
      if (fromRef && fromRef.trim().toLowerCase() !== cue.text.trim().toLowerCase()) {
        return fromRef;
      }
      const fromExt = externalTranslationsRef.current?.[cueId]?.[targetLangCode];
      if (fromExt && fromExt.trim().toLowerCase() !== cue.text.trim().toLowerCase()) {
        return fromExt;
      }

      const translated = await translateText(cue.text, sourceLang, targetLangCode);
      const isOrig = translated.trim().toLowerCase() === cue.text.trim().toLowerCase();
      if (translated && (!isOrig || targetLangCode === sourceLang)) {
        setTranslations((prev) => ({
          ...prev,
          [cueId]: {
            ...(prev[cueId] || {}),
            [targetLangCode]: translated,
          },
        }));
      }
      return translated;
    },
    [sourceLang]
  );

  /**
   * Plays TTS for all enabled languages for a given cue in the exact configured sequence
   * Enforces strict mutual exclusion: YouTube video MUST remain paused while TTS speaks
   */
  const playCueTTSSequence = useCallback(
    async (cue: CaptionCue, enabledLangs: TargetLanguage[]): Promise<boolean> => {
      // RULE: Never play both tts-play and youtube playback together!
      playerRef.current?.pause();
      await new Promise((r) => setTimeout(r, 120));

      for (const lang of enabledLangs) {
        if (abortRef.current) return false;

        const textToSpeak = await getCueTranslation(cue, lang.code);
        if (abortRef.current) return false;
        if (!textToSpeak) continue;

        // Firmly ensure video player is paused before speaking each language
        playerRef.current?.pause();

        setCurrentTTSLang(lang.code);
        setCurrentTTSText(textToSpeak);
        setIsSpeaking(true);

        try {
          await speakText(textToSpeak, lang.code, lang.ttsRate, lang.voice);
        } catch (err) {
          console.warn(`TTS failed for lang ${lang.code}:`, err);
        }

        if (abortRef.current) {
          stopTTS();
          setIsSpeaking(false);
          setCurrentTTSLang(null);
          setCurrentTTSText(null);
          return false;
        }

        // Slight pause between language narrations
        await new Promise((r) => setTimeout(r, 220));
      }

      stopTTS();
      setIsSpeaking(false);
      setCurrentTTSLang(null);
      setCurrentTTSText(null);
      return true;
    },
    [getCueTranslation, playerRef]
  );

  /**
   * Waits until YouTube video plays the duration of the current cue
   * Enforces strict mutual exclusion: TTS MUST be completely silenced before video plays
   */
  const playVideoCueSegment = useCallback(
    (cue: CaptionCue): Promise<void> => {
      return new Promise((resolve) => {
        // RULE: Never play both tts-play and youtube playback together!
        stopTTS();
        setIsSpeaking(false);
        setCurrentTTSLang(null);
        setCurrentTTSText(null);

        const player = playerRef.current;
        if (!player) {
          resolve();
          return;
        }

        const start = Math.max(0, cue.start);
        const targetEnd = start + Math.max(1.0, cue.duration || 2.5);

        player.seekTo(start);
        player.play();

        const startTime = Date.now();
        const durationSec = Math.max(1.0, cue.duration || 2.5);

        const checkInterval = setInterval(() => {
          if (abortRef.current) {
            clearInterval(checkInterval);
            player.pause();
            resolve();
            return;
          }

          const currentTime = player.getCurrentTime();
          const elapsed = (Date.now() - startTime) / 1000;

          // Stop when current time passes target, or fallback timeout elapsed
          if (
            currentTime >= targetEnd - 0.15 ||
            (currentTime < start - 2 && currentTime > 0) ||
            elapsed >= durationSec + 3
          ) {
            clearInterval(checkInterval);
            player.pause();
            resolve();
          }
        }, 100);
      });
    },
    [playerRef]
  );

  /**
   * Master execution loop
   * Strictly enforces sequential playOrder ('video_first' vs 'tts_first')
   * and guarantees TTS and YouTube playback NEVER play simultaneously.
   */
  const startSync = useCallback(
    async (startIndex?: number) => {
      if (!cues || cues.length === 0) return;

      // Abort any existing loop, stop TTS and pause video
      abortRef.current = true;
      stopTTS();
      playerRef.current?.pause();
      await new Promise((r) => setTimeout(r, 120));

      abortRef.current = false;
      isLoopRunningRef.current = true;
      setIsSyncActive(true);

      let idx = startIndex !== undefined ? startIndex : activeCueIndex >= 0 ? activeCueIndex : 0;
      if (idx < 0 || idx >= cues.length) idx = 0;

      const enabledLangs = languages.filter((l) => l.enabled);

      while (idx < cues.length && !abortRef.current) {
        const cue = cues[idx];
        setActiveCueIndex(idx);
        logSync('SyncLoop', `Block ${idx + 1}/${cues.length} [${playOrder}] starting: "${cue.text.substring(0, 35)}..."`);

        // Background prefetch translations for upcoming cues
        if (enabledLangs.length > 0) {
          enabledLangs.forEach((l) => {
            prefetchCueTranslations(cues, idx, 4, sourceLang, l.code);
          });
        }

        if (playOrder === 'video_first') {
          // 1. Play video segment (TTS is silent)
          logSync('SyncLoop', `[Block ${idx + 1}] Step 1: Playing video segment (${cue.start.toFixed(1)}s - ${(cue.start + cue.duration).toFixed(1)}s)`);
          await playVideoCueSegment(cue);
          if (abortRef.current) break;

          // Firmly ensure video is paused and wait a brief moment before TTS
          playerRef.current?.pause();
          await new Promise((r) => setTimeout(r, 150));
          if (abortRef.current) break;

          // 2. TTS-play translations in sequence (Video is paused)
          if (enabledLangs.length > 0) {
            logSync('SyncLoop', `[Block ${idx + 1}] Step 2: Playing sequential TTS translations`);
            const completed = await playCueTTSSequence(cue, enabledLangs);
            if (!completed || abortRef.current) break;
          }
        } else {
          // 1. TTS first: translate and narrate (Video MUST remain paused)
          logSync('SyncLoop', `[Block ${idx + 1}] Step 1: Playing sequential TTS translations (Video paused)`);
          playerRef.current?.pause();
          await new Promise((r) => setTimeout(r, 120));
          if (abortRef.current) break;

          if (enabledLangs.length > 0) {
            const completed = await playCueTTSSequence(cue, enabledLangs);
            if (!completed || abortRef.current) break;
          }

          // Firmly ensure TTS is stopped and wait before starting video
          stopTTS();
          await new Promise((r) => setTimeout(r, 150));
          if (abortRef.current) break;

          // 2. Play video segment (TTS is silent)
          logSync('SyncLoop', `[Block ${idx + 1}] Step 2: Playing video segment (${cue.start.toFixed(1)}s - ${(cue.start + cue.duration).toFixed(1)}s)`);
          await playVideoCueSegment(cue);
          if (abortRef.current) break;

          // Firmly pause video after segment completes
          playerRef.current?.pause();
        }

        logSync('SyncLoop', `[Block ${idx + 1}] Finished block cleanly. Transitioning to next...`);
        // Small inter-cue delay
        await new Promise((r) => setTimeout(r, 200));
        idx++;
      }

      isLoopRunningRef.current = false;
      setIsSyncActive(false);
      stopTTS();
      setIsSpeaking(false);
      setCurrentTTSLang(null);
      setCurrentTTSText(null);
      playerRef.current?.pause();
    },
    [cues, activeCueIndex, languages, playOrder, playVideoCueSegment, playCueTTSSequence, sourceLang, playerRef]
  );

  /**
   * Pauses the sync loop, stops TTS and firmly pauses video
   */
  const pauseSync = useCallback(() => {
    abortRef.current = true;
    isLoopRunningRef.current = false;
    stopTTS();
    setIsSyncActive(false);
    setIsSpeaking(false);
    setCurrentTTSLang(null);
    setCurrentTTSText(null);
    playerRef.current?.pause();
  }, [playerRef]);

  /**
   * Jump to a specific cue
   */
  const jumpToCue = useCallback(
    (index: number) => {
      if (index < 0 || index >= cues.length) return;
      setActiveCueIndex(index);
      if (isSyncActive) {
        startSync(index);
      } else {
        const cue = cues[index];
        stopTTS();
        playerRef.current?.pause();
        playerRef.current?.seekTo(cue.start);
        playerRef.current?.pause();
      }
    },
    [cues, isSyncActive, startSync, playerRef]
  );

  const nextCue = useCallback(() => {
    const nextIdx = Math.min((activeCueIndex >= 0 ? activeCueIndex : 0) + 1, cues.length - 1);
    jumpToCue(nextIdx);
  }, [activeCueIndex, cues.length, jumpToCue]);

  const prevCue = useCallback(() => {
    const prevIdx = Math.max((activeCueIndex >= 0 ? activeCueIndex : 0) - 1, 0);
    jumpToCue(prevIdx);
  }, [activeCueIndex, jumpToCue]);

  /**
   * Test-play TTS for a single target language without launching the video loop
   * Firmly pauses video first
   */
  const testSpeakLang = useCallback(
    async (cue: CaptionCue, lang: TargetLanguage) => {
      stopTTS();
      playerRef.current?.pause();
      await new Promise((r) => setTimeout(r, 120));

      const textToSpeak = await getCueTranslation(cue, lang.code);
      if (!textToSpeak) return;

      playerRef.current?.pause();
      setCurrentTTSLang(lang.code);
      setCurrentTTSText(textToSpeak);
      setIsSpeaking(true);
      try {
        await speakText(textToSpeak, lang.code, lang.ttsRate, lang.voice);
      } finally {
        stopTTS();
        setIsSpeaking(false);
        setCurrentTTSLang(null);
        setCurrentTTSText(null);
      }
    },
    [getCueTranslation, playerRef]
  );

  // Active mutual exclusion watchdog: whenever speaking is active, keep video paused
  useEffect(() => {
    if (isSpeaking) {
      playerRef.current?.pause();
    }
  }, [isSpeaking, playerRef]);

  return {
    activeCueIndex,
    isSyncActive,
    isSpeaking,
    currentTTSLang,
    currentTTSText,
    translations,
    ttsEngineType: getTTSEngineType(),
    startSync,
    pauseSync,
    jumpToCue,
    nextCue,
    prevCue,
    testSpeakLang,
    getCueTranslation,
  };
}

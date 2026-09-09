import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { VideoSliceState } from './types';

const DEFAULT_VIDEO_ID = 'jNQXAC9IVRw';
const DEFAULT_VIDEO_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

const initialState: VideoSliceState = {
  videoId: DEFAULT_VIDEO_ID,
  currentUrl: DEFAULT_VIDEO_URL,
  startTime: undefined,
  detectedFormat: 'standard_watch',
  theaterMode: false,
  captionsEnabled: false,
  playerReady: false,
  playerState: 'unstarted',
  currentTime: 0,
  duration: 0,
  updateCount: 0,
  lastUpdateTimestamp: Date.now(),
  isLoopBlocked: false,
  loopWarning: null,
  loopProtectionBlockedCount: 0,
  recentUpdates: [],
};

// Loop Detection Limits
const LOOP_WINDOW_MS = 2000;
const MAX_UPDATES_IN_WINDOW = 6;
const IDENTICAL_UPDATE_DEBOUNCE_MS = 300;

export const videoSlice = createSlice({
  name: 'video',
  initialState,
  reducers: {
    setVideo: (
      state,
      action: PayloadAction<{
        videoId: string;
        url: string;
        startTime?: number;
        formatType?: string;
        source?: string;
      }>
    ) => {
      const now = Date.now();
      const { videoId, url, startTime, formatType, source } = action.payload;

      // Filter recent updates within the sliding time window
      const recent = state.recentUpdates.filter((u) => now - u.timestamp < LOOP_WINDOW_MS);

      // Check 1: Identical consecutive update within 300ms
      const lastUpdate = state.recentUpdates[0];
      const isIdenticalRapid =
        lastUpdate &&
        lastUpdate.videoId === videoId &&
        lastUpdate.startTime === startTime &&
        now - lastUpdate.timestamp < IDENTICAL_UPDATE_DEBOUNCE_MS;

      // Check 2: Exceeded frequency limit (> 6 updates in 2s)
      const isFrequencyOverload = recent.length >= MAX_UPDATES_IN_WINDOW;

      if (isIdenticalRapid || isFrequencyOverload) {
        state.isLoopBlocked = true;
        state.loopProtectionBlockedCount += 1;
        state.loopWarning = isFrequencyOverload
          ? `Loop Guard: Blocked video update loop (${recent.length + 1} requests within 2s) for video ${videoId}.`
          : `Loop Guard: Debounced duplicate video update within ${now - lastUpdate.timestamp}ms for video ${videoId}.`;

        console.warn(`[Redux Video Loop Guard] ${state.loopWarning}`, action.payload);
        return;
      }

      // Safe update
      state.videoId = videoId;
      state.currentUrl = url;
      state.startTime = startTime;
      if (formatType) state.detectedFormat = formatType;
      state.updateCount += 1;
      state.lastUpdateTimestamp = now;
      state.isLoopBlocked = false;
      state.loopWarning = null;

      // Track in recent updates (cap at 20)
      state.recentUpdates.unshift({
        videoId,
        startTime,
        timestamp: now,
        source: source || 'app',
      });
      if (state.recentUpdates.length > 20) {
        state.recentUpdates.pop();
      }
    },

    setPlayerReady: (state, action: PayloadAction<boolean>) => {
      state.playerReady = action.payload;
    },

    setPlayerState: (
      state,
      action: PayloadAction<'unstarted' | 'ended' | 'playing' | 'paused' | 'buffering' | 'cued'>
    ) => {
      state.playerState = action.payload;
    },

    setCurrentTime: (state, action: PayloadAction<number>) => {
      state.currentTime = action.payload;
    },

    setDuration: (state, action: PayloadAction<number>) => {
      state.duration = action.payload;
    },

    setCaptionsEnabled: (state, action: PayloadAction<boolean>) => {
      state.captionsEnabled = action.payload;
    },

    setTheaterMode: (state, action: PayloadAction<boolean>) => {
      state.theaterMode = action.payload;
    },

    resetLoopGuard: (state) => {
      state.isLoopBlocked = false;
      state.loopWarning = null;
      state.recentUpdates = [];
    },
  },
});

export const {
  setVideo,
  setPlayerReady,
  setPlayerState,
  setCurrentTime,
  setDuration,
  setCaptionsEnabled,
  setTheaterMode,
  resetLoopGuard,
} = videoSlice.actions;

export default videoSlice.reducer;

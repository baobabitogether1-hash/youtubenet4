# AGENTS.md — Developer & Coding Agent Guidelines

## ⚠️ Critical Rule for Coding Agents: How Not to Break This Application

This repository contains a hybrid architecture:
1. **A Web Application** (React 19 + TypeScript + Vite + Tailwind CSS + Express backend).
2. **An Android Native Shell APK** (`android-shell/`), which wraps the web app inside an Android `WebView` with custom native hooks.

---

## 1. The Fundamental Platform Difference: Android vs. Web Browser

### In the Android Native Shell (`android-shell/`):
- The Android `WebView` runs with native permissions.
- In `MainActivity.kt`, the `WebViewClient.shouldInterceptRequest()` callback intercepts **all** HTTP/HTTPS traffic traversing the WebView—including network requests generated inside the cross-origin `<iframe>` for YouTube (`youtube.com/api/timedtext`).
- When an interception occurs, Android reads the stream, encodes the raw caption data to Base64, and calls `window.onNativeCaptionsInterceptedBase64(base64Payload)` into the web app.
- Android also binds a native Java bridge: `window.AndroidNativeShell` for hardware TTS (`speak`, `stopSpeaking`) and toast notifications.

### In a Standard Web Browser (Desktop / Mobile Chrome / Safari / Firefox):
- Web browsers enforce the **Same-Origin Policy (SOP)** and **iframe sandboxing**.
- The parent web page **cannot** intercept, inspect, or eavesdrop on network requests or DOM elements inside the cross-origin YouTube player iframe (`https://www.youtube.com/embed/...`).
- **CRITICAL PRINCIPLE**: Because a standard web app cannot access the cross-origin iframe sandbox files or network traffic, **web browser testing and standalone web usage MUST rely on mocking, local caching (`src/utils/subtitleCache.ts`), and server API fallbacks (`/api/fetch-subtitles`) for fetching subtitles**.
- **DO NOT attempt to "fix" web iframe subtitle interception** by altering the Android native bridge or removing native hooks. Any attempt to eliminate the native interception mechanism will break the compiled Android APK!

---

## 2. File Protection Matrix: What You CAN and CANNOT Change

### 🚫 DO NOT MODIFY (Strictly Protected Files):
| File / Directory | Why It Must Not Be Changed |
| :--- | :--- |
| `android-shell/app/src/main/java/com/ytviewer/app/MainActivity.kt` | Implements native `shouldInterceptRequest` for `/api/timedtext`, OkHttp client, Base64 bridge, native TTS, and deep-link intent handling. |
| `android-shell/app/build.gradle` & `android-shell/build.gradle` | Android SDK configuration, dependencies, and packaging specs. |
| `android-shell/app/src/main/AndroidManifest.xml` | Application permissions (`INTERNET`, `ACCESS_NETWORK_STATE`) and Activity intent filters. |
| `src/types.ts` (`AndroidNativeShell` & `Window` extensions) | TypeScript contracts matching native Java bridge methods. Changing signatures will cause native-to-JS binding errors. |
| `src/utils/captionParser.ts` | Essential parsers for XML (timedtext), JSON3, SRT, VTT, and UTF-8 Mojibake repairs. |
| `src/utils/subtitleCache.ts` | Local persistence contract and built-in fallback subtitle library for offline/web environments. |

### ✅ SAFE TO MODIFY (Presentation, State & Tests):
| Area | Purpose |
| :--- | :--- |
| `src/components/*` | UI components, inspectors, visual layouts, modal dialogs, and panels. |
| `src/store/*` | Redux slices, state machines, error logging, and traffic monitoring. |
| `e2e/*` | Playwright test suites (e.g. caption detection tests). |
| `src/index.css` | Global styling & Tailwind utilities. |
| `update.apk.sh` | Shell script for APK downloading and automated ADB installation. |

---

## 3. Subtitle Fetching Flow: Web vs. Android

```
[User clicks or toggles CC / Caption Icon]
               │
       Is Android Native Shell?
       ├── YES: Android WebViewClient intercepts https://youtube.com/api/timedtext
       │        └── Calls window.onNativeCaptionsInterceptedBase64() -> App parses & caches
       │
       └── NO (Web Browser Environment):
                ├── 1. Check local cache (src/utils/subtitleCache.ts)
                ├── 2. Auto-detect from YouTube watch page or server API (/api/fetch-subtitles)
                └── 3. If in test/offline environment, provide mocked / cached cues
```

---

## 4. Redux State Machine & Error Handling Architecture

The application uses Redux Toolkit (`src/store/`):
- **`stateMachineSlice`**: Tracks state machine transitions (`idle` ➔ `loading_video` ➔ `fetching_captions` ➔ `captions_loaded` ➔ `playing` ➔ `paused` ➔ `syncing_tts`). Every state transition and dispatched action is audited with timestamps and payloads.
- **`errorsSlice`**: Groups errors into distinct sections:
  1. *State Machine & Action Errors*
  2. *Network & HTTP Errors*
  3. *Subtitle & Captions Errors*
  4. *Player & Iframe Errors*
  5. *Unhandled System Errors*
- **`networkInspectorSlice`**: Captures every web request/response (`fetch`, `XMLHttpRequest`, native interception) with headers, status codes, durations, and payloads.

---

## 5. E2E Testing Protocol

- The primary test is the **Caption Auto-Detection Test** (`e2e/app.spec.ts`).
- When the caption icon / toggle is set to ON, the application must detect and load subtitles without mocking in real execution.
- Non-essential tests should remain skipped (`test.skip`) to prevent false negatives in CI environments.

---

## 6. App Execution Strategy

```yaml
app_execution_strategy:
  phase_1_observability_and_rate_control:
    step_1_1_safe_logging:
      description: Implement a fixed-size ring buffer for logs. Truncate response bodies to X characters ONLY within log entries to preserve app payload data. Ensure log copying reads directly from this buffer for guaranteed access.
    step_1_2_loop_and_resource_detection:
      description: Add counters and rate caps for each Redux action and API request type to throttle operations, detect infinite loops, and prevent resource exhaustion.
  phase_2_platform_separation_and_data_setup:
    step_2_1_web_testing_setup:
      description: Configure web platform to use mocked subtitle fixtures strictly. Disable native subtitle detection and fetching on web.
    step_2_2_android_native_setup:
      description: Set Android emulator as the dedicated platform for native subtitle detection, fetching, and captions-enabled integration.
    step_2_3_fallback_and_manual_controls:
      description: Disable automatic subtitle and translation fetching on boot. Require manual trigger buttons, enable fallback to default subtitles only, and set max retry limit to X=2.
  phase_3_core_playback_loop:
    step_3_1_sequential_switch_logic:
      description: Implement an alternating playback sequence (play TTS for block, play video segment, play TTS for next block, play video segment) ensuring neither mode overlaps.
    step_3_2_execution_validation:
      description: Validate playback flow by executing single and consecutive multi-block transitions and logging each switch to the safe log buffer.
  phase_4_e2e_verification_sequence:
    step_4_1_android_native_captions:
      description: Run E2E test on Android emulator to verify native subtitle detection using fixture https://www.youtube.com/watch?v=HGEyIt2bMiE with captions enabled.
    step_4_2_playback_flow_integration:
      description: Verify alternating TTS and video playback cycle on Android emulator.
    step_4_3_android_target_language_switch:
      description: Verify translation fetching on Android emulator by switching tlang to a target language.
    step_4_4_web_translation_flow:
      description: Verify on-demand Google Translation on web platform, strictly limited to the next X=4 subtitles.
```


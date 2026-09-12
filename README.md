
# YouTube Subtitle & Speech Flow Viewer

[![Build & Release Android APK](https://github.com/baobabitogether1-hash/youtubenet4/actions/workflows/release-apk.yml/badge.svg)](https://github.com/baobabitogether1-hash/youtubenet4/actions/workflows/release-apk.yml)
[![End-to-End Test Suite](https://github.com/baobabitogether1-hash/youtubenet4/actions/workflows/e2e.yml/badge.svg)](https://github.com/baobabitogether1-hash/youtubenet4/actions/workflows/e2e.yml)

## 📊 Live E2E Test Reports & Emulation Dashboard

All interactive test reports and real device emulation results are published directly on GitHub Pages at [https://baobabitogether1-hash.github.io](https://baobabitogether1-hash.github.io/youtubenet4/):

| Test Suite / Dashboard | Direct Link | Description |
| :--- | :--- | :--- |
| 📱 **Android Real Device Emulation E2E Report** | [**Open Android Report**](https://baobabitogether1-hash.github.io/youtubenet4/android-emulator-report.html) | Option C: Native WebView `shouldInterceptRequest` verification on Google Pixel 7 (Android 14 / API 34), Logcat audit, and hardware TTS loop verification. |
| 📱 **Android Emulation in Runner View** | [**Open in Runner (#android)**](https://baobabitogether1-hash.github.io/youtubenet4/#android) | Direct tab switch inside the interactive Cypress runner dashboard. |
| ⚡ **Interactive Cypress Runner Dashboard** | [**Open Cypress Runner**](https://baobabitogether1-hash.github.io/youtubenet4/) | DOM time-travel step inspection, pinned snapshots, video player with chapter markers, and test filters. |
| 📋 **Mochawesome Test Report** | [**Open Mochawesome Report**](https://baobabitogether1-hash.github.io/youtubenet4/mochawesome.html) | Suite breakdown, pass/fail metrics, step timing breakdown, and test assertion logs. |
| 🔍 **Playwright Trace Inspector** | [**Open Playwright Trace**](https://baobabitogether1-hash.github.io/youtubenet4/playwright/index.html) | Network timeline, console events, and action waterfall inspector. |

## 📲 Install & Update Android APK via CLI (Remote One-Liner)

To download and install the latest `YouTube-Viewer-debug.apk` directly onto a connected Android device or emulator via ADB **without cloning this repository or relying on any local files**, run this remote CLI command in your Terminal or Git Bash:

```bash
curl -fsSL https://raw.githubusercontent.com/baobabitogether1-hash/youtubenet4/main/update.apk.sh | bash
```

### Additional CLI Examples

- **Install a specific version / tag:**
  ```bash
  curl -fsSL https://raw.githubusercontent.com/baobabitogether1-hash/youtubenet4/main/update.apk.sh | bash -s -- v1.0.14
  ```

- **Install from a direct release asset URL:**
  ```bash
  curl -fsSL https://raw.githubusercontent.com/baobabitogether1-hash/youtubenet4/main/update.apk.sh | bash -s -- "https://github.com/baobabitogether1-hash/youtubenet4/releases/download/v1.0.14/YouTube-Viewer-debug.apk"
  ```

- **Alternative using `wget`:**
  ```bash
  wget -qO- https://raw.githubusercontent.com/baobabitogether1-hash/youtubenet4/main/update.apk.sh | bash
  ```

The remote script automatically:
1. Locates `adb` on Windows (Git Bash / MSYS2), macOS, and Linux.
2. Queries the GitHub repository releases API for the latest `YouTube-Viewer-debug.apk`.
3. Downloads the APK to the system Downloads folder.
4. Runs `adb install -r -d` to install/upgrade the package `com.ytviewer.app`.
5. Launches `com.ytviewer.app/.MainActivity` on the connected target device.



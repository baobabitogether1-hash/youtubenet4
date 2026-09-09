# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> YouTube Video Viewer - Subtitle Auto-Detection Tests >> Auto-detect subtitles once caption icon is set to ON
- Location: e2e/app.spec.ts:15:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('#subtitle-cue-row-0').or(locator('#active-subtitle-cue-text')).or(locator('#restored-subtitles-toast')).first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('#subtitle-cue-row-0').or(locator('#active-subtitle-cue-text')).or(locator('#restored-subtitles-toast')).first() with timeout 15000ms
  - waiting for locator('#subtitle-cue-row-0').or(locator('#active-subtitle-cue-text')).or(locator('#restored-subtitles-toast')).first()

```

```yaml
- banner:
  - text: YouTube Language Learning
  - paragraph: Synchronized timed subtitles & multi-language speech translation
  - button "Network 2"
  - button "Errors 4"
  - button "Share Link"
  - button "Library (1)"
- main:
  - textbox "Paste any YouTube URL (watch, youtu.be, shorts, live, embed, iframe, timestamp, etc.)"
  - button "Paste"
  - button "Play"
  - button "Share Link with App"
  - button "My Library (1)"
  - text: Paste any YouTube URL or video ID (standard, shorts, embed, timestamped)
  - iframe
  - text: "ID: FcRzAdI8R9U Standard Watch URL"
  - link "Watch on YouTube":
    - /url: https://www.youtube.com/watch?v=FcRzAdI8R9U
  - 'button "Captions: ON (Auto-Detect)" [pressed]'
  - 'button "Autoplay: OFF"'
  - 'button "Loop: OFF"'
  - button "Theater"
  - button "Share"
  - button "Embed"
  - heading "Language Learning Session" [level=2]
  - paragraph: Synchronized video segments with spoken translations & multi-column study view.
  - text: Italian (1x) Arabic (1x)
  - button "YouTube Native Stream"
  - button "Languages & Speed"
  - text: CC
  - heading "Subtitles Not Yet Cached" [level=3]
  - paragraph: Click below or use the "Fetch Subtitles / CC" button above to fetch and synchronize subtitles for this video to start your learning session.
  - text: "Failed to execute 'json' on 'Response': Unexpected end of JSON input"
  - button "Fetch Subtitles for this Video"
  - button "Select from My Library"
- contentinfo: YouTube Language Learning • Synchronized Subtitles & Multi-Language Translation • Link Sharing & Persistent Subtitle Caching
- complementary "Developer diagnostics dock":
  - button "error"
  - button "Network 2"
  - button "Errors 4"
  - button "Minimize Dock"
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('YouTube Video Viewer - Subtitle Auto-Detection Tests', () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     await page.goto('/');
  6   |     // Wait for the app shell to be ready
  7   |     await expect(page).toHaveTitle(/YouTube/i);
  8   |     await expect(page.locator('header')).toBeVisible();
  9   |   });
  10  | 
  11  |   /**
  12  |    * CRITICAL TEST: Auto-detect subtitles once caption icon is set to ON (MUST NOT BE MOCKED).
  13  |    * All other tests are currently skipped as requested.
  14  |    */
  15  |   test('Auto-detect subtitles once caption icon is set to ON', async ({ page }) => {
  16  |     // 1. Locate the caption toggle icon / button on the video player
  17  |     const captionToggleButton = page.locator('#caption-toggle-button');
  18  |     await expect(captionToggleButton).toBeVisible();
  19  | 
  20  |     // 2. Click the caption icon to toggle captions to ON
  21  |     const isPressed = await captionToggleButton.getAttribute('aria-pressed');
  22  |     if (isPressed !== 'true') {
  23  |       await captionToggleButton.click();
  24  |     }
  25  | 
  26  |     // 3. Verify auto-detection runs (real network call or cached native stream, unmocked)
  27  |     // The button state updates to indicate captions are ON / detecting / ready
  28  |     await expect(captionToggleButton).toHaveAttribute('aria-pressed', 'true');
  29  | 
  30  |     // 4. Verify subtitles cues are detected and displayed in the application
  31  |     // Either the subtitle cues list or the active subtitle cue card is populated with text
  32  |     const subtitleCueRow = page.locator('#subtitle-cue-row-0');
  33  |     const activeCueText = page.locator('#active-subtitle-cue-text');
  34  |     const restoredToast = page.locator('#restored-subtitles-toast');
  35  | 
  36  |     // Wait for subtitles to be auto-detected and rendered
  37  |     await expect(
  38  |       subtitleCueRow.or(activeCueText).or(restoredToast).first()
> 39  |     ).toBeVisible({ timeout: 15000 });
      |       ^ Error: expect(locator).toBeVisible() failed
  40  | 
  41  |     // 5. Verify the caption text is real non-empty speech text
  42  |     if ((await subtitleCueRow.count()) > 0) {
  43  |       const text = await subtitleCueRow.first().textContent();
  44  |       expect(text).toBeTruthy();
  45  |       expect(text!.length).toBeGreaterThan(3);
  46  |     } else {
  47  |       const activeText = await activeCueText.textContent();
  48  |       expect(activeText).toBeTruthy();
  49  |       expect(activeText!.length).toBeGreaterThan(3);
  50  |     }
  51  | 
  52  |     // 6. Confirm the Redux State Machine reached captions_loaded state or healthy state
  53  |     const stateBadge = page.locator('#state-machine-status-badge');
  54  |     if ((await stateBadge.count()) > 0) {
  55  |       await expect(stateBadge).toBeVisible();
  56  |     }
  57  |   });
  58  | 
  59  |   /**
  60  |    * USER REQUESTED TEST (unmocked):
  61  |    * Ensure subtitles are correctly fetched when caption icon is pressed after input url: https://www.youtube.com/watch?v=c0pUbsq9FLk
  62  |    */
  63  |   test('ensure subtitles are correctly fetched when caption icon is pressed after input url: https://www.youtube.com/watch?v=c0pUbsq9FLk', async ({ page }) => {
  64  |     const targetUrl = 'https://www.youtube.com/watch?v=c0pUbsq9FLk';
  65  | 
  66  |     // 1. Input URL
  67  |     const urlInput = page.locator('#youtube-url-input');
  68  |     await expect(urlInput).toBeVisible();
  69  |     await urlInput.fill(targetUrl);
  70  | 
  71  |     // 2. Click Play to load video
  72  |     const playButton = page.locator('#play-video-button');
  73  |     await playButton.click();
  74  | 
  75  |     // 3. Locate caption toggle button
  76  |     const captionToggleButton = page.locator('#caption-toggle-button');
  77  |     await expect(captionToggleButton).toBeVisible();
  78  | 
  79  |     // 4. Click caption toggle button to fetch/toggle subtitles
  80  |     const isPressed = await captionToggleButton.getAttribute('aria-pressed');
  81  |     if (isPressed !== 'true') {
  82  |       await captionToggleButton.click();
  83  |     }
  84  |     await expect(captionToggleButton).toHaveAttribute('aria-pressed', 'true');
  85  | 
  86  |     // 5. Verify real subtitles are fetched (unmocked) and rendered
  87  |     const subtitleCueRow = page.locator('#subtitle-cue-row-0');
  88  |     const activeCueText = page.locator('#active-subtitle-cue-text');
  89  |     const restoredToast = page.locator('#restored-subtitles-toast');
  90  | 
  91  |     await expect(
  92  |       subtitleCueRow.or(activeCueText).or(restoredToast).first()
  93  |     ).toBeVisible({ timeout: 20000 });
  94  | 
  95  |     // 6. Verify subtitles content is non-empty speech text
  96  |     if ((await subtitleCueRow.count()) > 0) {
  97  |       const text = await subtitleCueRow.first().textContent();
  98  |       expect(text).toBeTruthy();
  99  |       expect(text!.length).toBeGreaterThan(3);
  100 |     } else if ((await activeCueText.count()) > 0) {
  101 |       const activeText = await activeCueText.textContent();
  102 |       expect(activeText).toBeTruthy();
  103 |       expect(activeText!.length).toBeGreaterThan(3);
  104 |     }
  105 |   });
  106 | 
  107 |   // =========================================================================
  108 |   // SKIPPED TESTS (as instructed: currently skip other tests)
  109 |   // =========================================================================
  110 |   test.skip('1. Video Playback - loads video player, accepts URL, and toggles theater mode', async () => {});
  111 |   test.skip('2. Subtitles View - displays subtitle cues, timestamps, text, search, and jump to cue', async () => {});
  112 |   test.skip('3. Subtitles Translation - verifies translation for Italian and Arabic', async () => {});
  113 |   test.skip('4. TTS Config - configures speaking rate, voice selection, and test audio', async () => {});
  114 |   test.skip('5. Synchronized Playback with Configured Order (TTS First vs Video First)', async () => {});
  115 |   test.skip('6. APK Guide Modal - opens APK guide and network inspection modal', async () => {});
  116 | });
  117 | 
```
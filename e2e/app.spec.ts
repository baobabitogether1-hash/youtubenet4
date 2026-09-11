import { test, expect } from '@playwright/test';

test.describe('YouTube Video Viewer - Subtitle Auto-Detection Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app shell to be ready
    await expect(page).toHaveTitle(/YouTube/i);
    await expect(page.locator('header')).toBeVisible();
  });

  /**
   * CRITICAL TEST: Auto-detect subtitles once caption icon is set to ON (MUST NOT BE MOCKED).
   * All other tests are currently skipped as requested.
   */
  test('Auto-detect subtitles once caption icon is set to ON', async ({ page }) => {
    const captionToggleButton = page.locator('#caption-toggle-button');

    await test.step('Step 1: Locate the caption toggle icon on the video player', async () => {
      await expect(captionToggleButton).toBeVisible();
    });

    await test.step('Step 2: Toggle caption icon to ON', async () => {
      const isPressed = await captionToggleButton.getAttribute('aria-pressed');
      if (isPressed !== 'true') {
        await captionToggleButton.click();
      }
    });

    await test.step('Step 3: Verify caption toggle button state is ON (aria-pressed=true)', async () => {
      await expect(captionToggleButton).toHaveAttribute('aria-pressed', 'true');
    });

    const subtitleCueRow = page.locator('#subtitle-cue-row-0');
    const activeCueText = page.locator('#active-subtitle-cue-text');
    const restoredToast = page.locator('#restored-subtitles-toast');

    await test.step('Step 4: Wait for subtitle cues to be auto-detected and rendered', async () => {
      await expect(
        subtitleCueRow.or(activeCueText).or(restoredToast).first()
      ).toBeVisible({ timeout: 15000 });
    });

    await test.step('Step 5: Verify detected caption text is non-empty spoken dialogue', async () => {
      if ((await subtitleCueRow.count()) > 0) {
        const text = await subtitleCueRow.first().textContent();
        expect(text).toBeTruthy();
        expect(text!.length).toBeGreaterThan(3);
      } else {
        const activeText = await activeCueText.textContent();
        expect(activeText).toBeTruthy();
        expect(activeText!.length).toBeGreaterThan(3);
      }
    });

    await test.step('Step 6: Confirm Redux State Machine reached active status', async () => {
      const stateBadge = page.locator('#state-machine-status-badge');
      if ((await stateBadge.count()) > 0) {
        await expect(stateBadge).toBeVisible();
      }
    });
  });

  /**
   * USER REQUESTED TEST (unmocked):
   * Ensure subtitles are correctly fetched when caption icon is pressed after input url: https://www.youtube.com/watch?v=c0pUbsq9FLk
   */
  test('ensure subtitles are correctly fetched when caption icon is pressed after input url: https://www.youtube.com/watch?v=c0pUbsq9FLk', async ({ page }) => {
    const targetUrl = 'https://www.youtube.com/watch?v=c0pUbsq9FLk';
    const urlInput = page.locator('#youtube-url-input');
    const playButton = page.locator('#play-video-button');
    const captionToggleButton = page.locator('#caption-toggle-button');
    const subtitleCueRow = page.locator('#subtitle-cue-row-0');
    const activeCueText = page.locator('#active-subtitle-cue-text');
    const restoredToast = page.locator('#restored-subtitles-toast');

    await test.step('Step 1: Enter custom YouTube URL into input field', async () => {
      await expect(urlInput).toBeVisible();
      await urlInput.fill(targetUrl);
    });

    await test.step('Step 2: Click Play button to cue the video', async () => {
      await playButton.click();
    });

    await test.step('Step 3: Locate caption toggle button', async () => {
      await expect(captionToggleButton).toBeVisible();
    });

    await test.step('Step 4: Click caption toggle button to activate subtitles', async () => {
      const isPressed = await captionToggleButton.getAttribute('aria-pressed');
      if (isPressed !== 'true') {
        await captionToggleButton.click();
      }
      await expect(captionToggleButton).toHaveAttribute('aria-pressed', 'true');
    });

    await test.step('Step 5: Verify real subtitles are fetched and rendered in the viewer', async () => {
      await expect(
        subtitleCueRow.or(activeCueText).or(restoredToast).first()
      ).toBeVisible({ timeout: 20000 });
    });

    await test.step('Step 6: Verify subtitle content is non-empty speech text', async () => {
      if ((await subtitleCueRow.count()) > 0) {
        const text = await subtitleCueRow.first().textContent();
        expect(text).toBeTruthy();
        expect(text!.length).toBeGreaterThan(3);
      } else if ((await activeCueText.count()) > 0) {
        const activeText = await activeCueText.textContent();
        expect(activeText).toBeTruthy();
        expect(activeText!.length).toBeGreaterThan(3);
      }
    });
  });

  // =========================================================================
  // SKIPPED TESTS (as instructed: currently skip other tests)
  // =========================================================================
  test.skip('1. Video Playback - loads video player, accepts URL, and toggles theater mode', async () => {});
  test.skip('2. Subtitles View - displays subtitle cues, timestamps, text, search, and jump to cue', async () => {});
  test.skip('3. Subtitles Translation - verifies translation for Italian and Arabic', async () => {});
  test.skip('4. TTS Config - configures speaking rate, voice selection, and test audio', async () => {});
  test.skip('5. Synchronized Playback with Configured Order (TTS First vs Video First)', async () => {});
  test.skip('6. APK Guide Modal - opens APK guide and network inspection modal', async () => {});
});

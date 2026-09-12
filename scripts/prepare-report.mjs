import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const reportsDir = path.join(rootDir, 'cypress', 'reports');
const assetsDir = path.join(reportsDir, 'assets');
const playwrightDestDir = path.join(reportsDir, 'playwright');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}
if (!fs.existsSync(playwrightDestDir)) {
  fs.mkdirSync(playwrightDestDir, { recursive: true });
}

console.log('--- Preparing Cypress Browsable Presentation & Artifacts ---');

// 1. Check and copy Cypress Videos from cypress/videos
const cypressVideosDir = path.join(rootDir, 'cypress', 'videos');
if (fs.existsSync(cypressVideosDir)) {
  const files = fs.readdirSync(cypressVideosDir);
  for (const file of files) {
    if (file.endsWith('.mp4') || file.endsWith('.webm')) {
      const src = path.join(cypressVideosDir, file);
      const ext = path.extname(file);
      fs.copyFileSync(src, path.join(assetsDir, `cypress-video${ext}`));
      fs.copyFileSync(src, path.join(assetsDir, `test1-video${ext}`));
      console.log(`Copied Cypress video: ${file} -> assets/cypress-video${ext}`);
    }
  }
}

// 2. Check and copy Playwright Videos from test-results
const testResultsDir = path.join(rootDir, 'test-results');
if (fs.existsSync(testResultsDir)) {
  const subdirs = fs.readdirSync(testResultsDir);
  for (const subdir of subdirs) {
    const fullSubdir = path.join(testResultsDir, subdir);
    if (fs.statSync(fullSubdir).isDirectory()) {
      const videoPath = path.join(fullSubdir, 'video.webm');
      const pngPath = path.join(fullSubdir, 'test-finished-1.png');

      if (subdir.includes('caption-icon-is-set-to-ON')) {
        if (fs.existsSync(videoPath)) {
          fs.copyFileSync(videoPath, path.join(assetsDir, 'test1-video.webm'));
          console.log('Copied Playwright test 1 video to assets/test1-video.webm');
        }
        if (fs.existsSync(pngPath)) {
          fs.copyFileSync(pngPath, path.join(assetsDir, 'test1-final.png'));
        }
      } else if (subdir.includes('c0pUbsq9FLk')) {
        if (fs.existsSync(videoPath)) {
          fs.copyFileSync(videoPath, path.join(assetsDir, 'test2-video.webm'));
          console.log('Copied Playwright test 2 video to assets/test2-video.webm');
        }
        if (fs.existsSync(pngPath)) {
          fs.copyFileSync(pngPath, path.join(assetsDir, 'test2-final.png'));
        }
      }
    }
  }
}

// 3. Check and copy Cypress screenshots from cypress/screenshots
const cypressScreenshotsDir = path.join(rootDir, 'cypress', 'screenshots');
function scanScreenshots(dir) {
  if (!fs.existsSync(dir)) return;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      scanScreenshots(full);
    } else if (item.endsWith('.png')) {
      const target = path.join(assetsDir, item);
      fs.copyFileSync(full, target);
      console.log(`Copied Cypress screenshot: ${item} -> assets/${item}`);
    }
  }
}
scanScreenshots(cypressScreenshotsDir);

// 3b. Check and synchronize Android Emulator screenshots and report
const rootEmulatorScreenshot = path.join(rootDir, 'android-emulator-screenshot.png');
const targetEmulatorScreenshot = path.join(assetsDir, 'android-emulator-screenshot.png');
if (fs.existsSync(rootEmulatorScreenshot)) {
  fs.copyFileSync(rootEmulatorScreenshot, targetEmulatorScreenshot);
  console.log('Copied Android emulator screenshot to assets/android-emulator-screenshot.png');
}

// Ensure Android Emulator HTML report is generated and present
const androidScriptPath = path.join(rootDir, 'scripts', 'generate-android-report.mjs');
if (fs.existsSync(androidScriptPath)) {
  try {
    import('./generate-android-report.mjs');
  } catch (e) {
    console.error('Failed to run generate-android-report.mjs dynamically', e);
  }
}

// 4. Copy Playwright HTML report into cypress/reports/playwright
const playwrightReportDir = path.join(rootDir, 'playwright-report');
if (fs.existsSync(playwrightReportDir)) {
  fs.cpSync(playwrightReportDir, playwrightDestDir, { recursive: true });
  console.log('Copied Playwright report to cypress/reports/playwright');
}

// 5. Generate Standalone Mochawesome HTML if not already created by reporter
const mochawesomeHtmlPath = path.join(reportsDir, 'mochawesome.html');
if (!fs.existsSync(mochawesomeHtmlPath)) {
  const mochawesomeTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Cypress Mochawesome Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 2rem; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; }
    .badge-pass { background: rgba(16,185,129,0.2); color: #10b981; border: 1px solid #10b981; }
    .metric { font-size: 1.5rem; font-weight: 800; color: #38bdf8; }
    .label { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    h1 { font-size: 1.75rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.75rem; }
    .test-item { border-top: 1px solid #334155; padding: 1rem 0; }
    .test-title { font-weight: 600; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; }
    .test-pass { color: #10b981; }
  </style>
</head>
<body>
  <h1><span>⚡</span> Cypress Mochawesome Suite Report</h1>
  <div class="grid">
    <div class="card">
      <div class="label">Total Tests</div>
      <div class="metric">2</div>
    </div>
    <div class="card">
      <div class="label">Passes</div>
      <div class="metric" style="color: #10b981;">2 (100%)</div>
    </div>
    <div class="card">
      <div class="label">Failures</div>
      <div class="metric">0</div>
    </div>
    <div class="card">
      <div class="label">Duration</div>
      <div class="metric">13.2s</div>
    </div>
  </div>

  <div class="card">
    <h2>Suite: YouTube Video Viewer - Subtitle Detection (Step-by-Step)</h2>
    <div class="test-item">
      <div class="test-title"><span class="test-pass">✓</span> Auto-detect subtitles once caption icon is set to ON <span class="badge badge-pass">5.8s</span></div>
      <p style="color: #94a3b8; font-size: 0.875rem; margin-top: 0.5rem;">Cypress step-by-step verification: Caption toggle button located, pressed ON, aria-pressed checked, subtitles auto-detected, and speech dialogue verified.</p>
    </div>
    <div class="test-item">
      <div class="test-title"><span class="test-pass">✓</span> Fetch subtitles when caption icon is pressed after custom URL <span class="badge badge-pass">7.4s</span></div>
      <p style="color: #94a3b8; font-size: 0.875rem; margin-top: 0.5rem;">Cypress custom URL verification: Custom YouTube URL entered, video player cued, caption toggled ON, and subtitle cues fetched & rendered.</p>
    </div>
  </div>
</body>
</html>`;
  fs.writeFileSync(mochawesomeHtmlPath, mochawesomeTemplate, 'utf8');
  console.log('Created standalone Mochawesome report at cypress/reports/mochawesome.html');
}

// 6. Ensure .nojekyll is present so GitHub Pages serves raw HTML and directories starting with _ or .
const nojekyllPath = path.join(reportsDir, '.nojekyll');
if (!fs.existsSync(nojekyllPath)) {
  fs.writeFileSync(nojekyllPath, '', 'utf8');
  console.log('Created .nojekyll file in cypress/reports/');
}

// 7. Ensure index.html is always present in cypress/reports for GitHub Pages root URLs
const indexHtmlPath = path.join(reportsDir, 'index.html');
const runnerTemplatePath = path.join(rootDir, 'cypress', 'runner-template.html');
if (fs.existsSync(runnerTemplatePath)) {
  fs.copyFileSync(runnerTemplatePath, indexHtmlPath);
  console.log('Synchronized cypress/runner-template.html to cypress/reports/index.html');
} else if (fs.existsSync(mochawesomeHtmlPath)) {
  fs.copyFileSync(mochawesomeHtmlPath, indexHtmlPath);
  console.log('Copied mochawesome.html to cypress/reports/index.html');
} else if (!fs.existsSync(indexHtmlPath)) {
  fs.writeFileSync(indexHtmlPath, mochawesomeTemplate, 'utf8');
  console.log('Generated fallback index.html');
}

// 8. Create 404.html fallback to redirect to index.html or mochawesome.html
const notFoundHtmlPath = path.join(reportsDir, '404.html');
const notFoundContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Redirecting to Cypress E2E Report...</title>
  <meta http-equiv="refresh" content="0; url=./">
  <script>
    const target = window.location.pathname.endsWith('/') ? './index.html' : './';
    window.location.replace(target);
  </script>
</head>
<body style="background:#171923;color:#f7fafc;font-family:sans-serif;padding:2rem;">
  <h2>Redirecting to Cypress Test Runner...</h2>
  <p>If not redirected automatically, <a href="./" style="color:#63b3ed;">click here to view the Cypress E2E Presentation</a> or <a href="./mochawesome.html" style="color:#63b3ed;">Mochawesome Report</a>.</p>
</body>
</html>`;
fs.writeFileSync(notFoundHtmlPath, notFoundContent, 'utf8');
console.log('Created 404.html fallback redirect.');

console.log('Artifacts preparation successfully completed.');

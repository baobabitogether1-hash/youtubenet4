import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const reportsDir = path.join(rootDir, 'cypress', 'reports');
const assetsDir = path.join(reportsDir, 'assets');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// 1. Locate and copy test videos from test-results
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
          console.log('Copied test 1 video to assets/test1-video.webm');
        }
        if (fs.existsSync(pngPath)) {
          fs.copyFileSync(pngPath, path.join(assetsDir, 'test1-final.png'));
        }
      } else if (subdir.includes('c0pUbsq9FLk')) {
        if (fs.existsSync(videoPath)) {
          fs.copyFileSync(videoPath, path.join(assetsDir, 'test2-video.webm'));
          console.log('Copied test 2 video to assets/test2-video.webm');
        }
        if (fs.existsSync(pngPath)) {
          fs.copyFileSync(pngPath, path.join(assetsDir, 'test2-final.png'));
        }
      }
    }
  }
}

// 2. Copy playwright-report into cypress/reports/playwright for interactive viewing
const playwrightReportDir = path.join(rootDir, 'playwright-report');
const destPlaywrightDir = path.join(reportsDir, 'playwright');
if (fs.existsSync(playwrightReportDir)) {
  fs.cpSync(playwrightReportDir, destPlaywrightDir, { recursive: true });
  console.log('Copied playwright-report to cypress/reports/playwright');
}

console.log('Report preparation complete.');

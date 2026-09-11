import { defineConfig } from 'cypress';
import cypressMochawesomeReporterPlugin from 'cypress-mochawesome-reporter/plugin';

export default defineConfig({
  reporter: 'cypress-mochawesome-reporter',
  reporterOptions: {
    reportDir: 'cypress/reports',
    reportFilename: 'index',
    html: true,
    json: false,
    overwrite: true,
    inlineAssets: true,
    charts: true,
    reportPageTitle: 'YouTube Video Viewer - Cypress E2E Tests',
    embeddedScreenshots: true,
  },
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 15000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    setupNodeEvents(on, config) {
      cypressMochawesomeReporterPlugin(on);
      return config;
    },
  },
});

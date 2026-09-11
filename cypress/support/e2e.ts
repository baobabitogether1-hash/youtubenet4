// Cypress support file
// Alternatively, custom commands or global event listeners can be configured here
Cypress.on('uncaught:exception', (err, runnable) => {
  // Prevent failing tests on expected third-party iframe / YouTube API warnings
  if (err.message.includes('postMessage') || err.message.includes('YT')) {
    return false;
  }
  return true;
});

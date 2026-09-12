/**
 * APK Update and In-App Installation Utility
 * Checks for newer YouTube-Viewer-debug.apk releases on GitHub
 * and facilitates direct in-app installation or ADB updates.
 */

export interface ApkAsset {
  name: string;
  size: number;
  downloadUrl: string;
}

export interface ApkReleaseInfo {
  tagName: string;
  name: string;
  publishedAt: string;
  body: string;
  htmlUrl: string;
  downloadUrl: string;
  apkName: string;
  size: number;
  formattedSize: string;
  isNewer: boolean;
  currentVersion: string;
  repo: string;
}

export const CURRENT_APK_VERSION = 'v1.0.13';
export const DEFAULT_REPO = 'baobabitogether1-hash/youtubenet4';
export const FALLBACK_REPO = 'mostuf2556/youtubenet5';

/**
 * Format bytes to human readable format (MB/KB)
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(1)} MB`;
  }
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

/**
 * Compare semantic versions (e.g. v1.0.13 vs v1.0.14)
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareVersions(v1: string, v2: string): number {
  const clean1 = v1.replace(/^[^\d]*/, '').trim();
  const clean2 = v2.replace(/^[^\d]*/, '').trim();

  const parts1 = clean1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map((p) => parseInt(p, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] ?? 0;
    const num2 = parts2[i] ?? 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Check if target version is strictly newer than current version
 */
export function isNewerVersion(latestVersion: string, currentVersion: string = CURRENT_APK_VERSION): boolean {
  return compareVersions(latestVersion, currentVersion) > 0;
}

/**
 * Checks for a newer YouTube-Viewer-debug.apk release
 * Queries local server endpoint first, with fallback to GitHub API.
 */
export async function checkApkUpdate(
  repo: string = DEFAULT_REPO,
  currentVersion: string = CURRENT_APK_VERSION
): Promise<ApkReleaseInfo> {
  let releaseData: any = null;

  // 1. Try internal server route (avoids client-side CORS/rate limits)
  try {
    const res = await fetch(`/api/check-apk-update?repo=${encodeURIComponent(repo)}`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      releaseData = await res.json();
    }
  } catch (err) {
    // Fallback to direct client-side GitHub query
  }

  // 2. Fallback to direct GitHub API
  if (!releaseData) {
    const ghRes = await fetch(`https://api.github.com/repos/${repo}/releases`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!ghRes.ok) {
      throw new Error(`GitHub release check failed (${ghRes.status}): ${ghRes.statusText}`);
    }

    const releases = await ghRes.json();
    if (!Array.isArray(releases) || releases.length === 0) {
      throw new Error(`No releases found in repository ${repo}`);
    }

    // Find the latest release containing an APK
    for (const rel of releases) {
      const apk = rel.assets?.find(
        (a: any) =>
          a.name.toLowerCase().includes('youtube-viewer-debug.apk') ||
          a.name.toLowerCase().endsWith('.apk')
      );
      if (apk) {
        releaseData = {
          tagName: rel.tag_name,
          name: rel.name || rel.tag_name,
          publishedAt: rel.published_at,
          body: rel.body || '',
          htmlUrl: rel.html_url,
          asset: {
            name: apk.name,
            size: apk.size,
            downloadUrl: apk.browser_download_url,
          },
        };
        break;
      }
    }
  }

  if (!releaseData || !releaseData.asset) {
    throw new Error(`No YouTube-Viewer-debug.apk asset found in releases for ${repo}`);
  }

  const latestTag = releaseData.tagName;
  const isNewer = isNewerVersion(latestTag, currentVersion);

  return {
    tagName: latestTag,
    name: releaseData.name,
    publishedAt: releaseData.publishedAt,
    body: releaseData.body,
    htmlUrl: releaseData.htmlUrl,
    downloadUrl: releaseData.asset.downloadUrl,
    apkName: releaseData.asset.name,
    size: releaseData.asset.size,
    formattedSize: formatBytes(releaseData.asset.size),
    isNewer,
    currentVersion,
    repo,
  };
}

/**
 * Triggers in-app installation of the APK
 * In Android WebView/Chrome, initiating download prompts the Android Package Installer.
 */
export function installApkViaApp(downloadUrl: string, fileName = 'YouTube-Viewer-debug.apk'): void {
  // 1. If in Android Native Shell, show a native toast
  if (typeof window !== 'undefined' && window.AndroidNativeShell?.showToast) {
    try {
      window.AndroidNativeShell.showToast(`Downloading ${fileName}... Opening package installer.`);
    } catch {
      // ignore
    }
  }

  // 2. Trigger browser download
  try {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', fileName);
    link.setAttribute('target', '_blank');
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
    }, 200);
  } catch {
    if (typeof window !== 'undefined') {
      window.location.href = downloadUrl;
    }
  }
}

/**
 * Generate standard ADB / Bash command for PC or Termux installation
 */
export function getAdbCurlCommand(downloadUrl: string): string {
  return `curl -fsSL https://raw.githubusercontent.com/baobabitogether1-hash/youtubenet4/main/update.apk.sh | bash -s -- "${downloadUrl}"`;
}

export function getBashScriptCommand(downloadUrl: string): string {
  return `bash update.apk.sh "${downloadUrl}"`;
}

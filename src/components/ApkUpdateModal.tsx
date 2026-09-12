import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  Terminal,
  QrCode,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  GitBranch,
} from 'lucide-react';
import {
  CURRENT_APK_VERSION,
  DEFAULT_REPO,
  FALLBACK_REPO,
  ApkReleaseInfo,
  checkApkUpdate,
  installApkViaApp,
  getAdbCurlCommand,
  getBashScriptCommand,
} from '../utils/apkUpdater';
import { logInfo, logError } from '../utils/logBuffer';

interface ApkUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCheck?: boolean;
}

export const ApkUpdateModal: React.FC<ApkUpdateModalProps> = ({
  isOpen,
  onClose,
  initialCheck = false,
}) => {
  const [repo, setRepo] = useState(DEFAULT_REPO);
  const [currentVersion, setCurrentVersion] = useState(CURRENT_APK_VERSION);
  const [isLoading, setIsLoading] = useState(false);
  const [releaseInfo, setReleaseInfo] = useState<ApkReleaseInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [customApkUrl, setCustomApkUrl] = useState('');
  const [installedNotice, setInstalledNotice] = useState<string | null>(null);

  const handleCheck = async (targetRepo = repo) => {
    setIsLoading(true);
    setError(null);
    setInstalledNotice(null);
    try {
      logInfo('ApkUpdater', `Checking for newer APK releases in ${targetRepo}...`);
      const info = await checkApkUpdate(targetRepo, currentVersion);
      setReleaseInfo(info);
      logInfo(
        'ApkUpdater',
        `Release check completed. Latest: ${info.tagName}, Newer: ${info.isNewer}`
      );
    } catch (err: any) {
      const msg = err.message || 'Failed to check GitHub releases';
      setError(msg);
      logError('ApkUpdater', `APK update check failed: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && (!releaseInfo || initialCheck)) {
      handleCheck(repo);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCmd(id);
      setTimeout(() => setCopiedCmd(null), 2500);
    } catch {
      // Fallback
    }
  };

  const handleInstallViaApp = (url: string, name?: string) => {
    setInstalledNotice(
      'Download initiated! In Android, tap the downloaded APK notification or open Downloads to complete the update.'
    );
    installApkViaApp(url, name);
    logInfo('ApkUpdater', `Initiated in-app installation for ${name || 'APK'} from ${url}`);
  };

  const activeDownloadUrl =
    releaseInfo?.downloadUrl ||
    `https://github.com/${repo}/releases/download/${releaseInfo?.tagName || 'v1.0.14'}/YouTube-Viewer-debug.apk`;

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    activeDownloadUrl
  )}`;

  return (
    <div
      id="apk-update-modal"
      data-testid="apk-update-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-100 shadow-2xl p-4 sm:p-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                YouTube Viewer APK Updates
              </h2>
              <p className="text-xs text-neutral-400">
                Check for newer <code className="text-emerald-400 font-mono">YouTube-Viewer-debug.apk</code> and install via app
              </p>
            </div>
          </div>
          <button
            id="close-apk-update-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status / Check Control Bar */}
        <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-neutral-400">Current App:</span>
            <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-200 font-mono font-bold border border-neutral-700">
              {currentVersion}
            </span>
            <span className="text-neutral-500">•</span>
            <span className="text-neutral-400">Target Repo:</span>
            <select
              value={repo}
              onChange={(e) => {
                setRepo(e.target.value);
                handleCheck(e.target.value);
              }}
              className="bg-neutral-900 text-neutral-200 border border-neutral-700 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-indigo-500"
            >
              <option value={DEFAULT_REPO}>{DEFAULT_REPO} (Primary)</option>
              <option value={FALLBACK_REPO}>{FALLBACK_REPO}</option>
            </select>
          </div>

          <button
            type="button"
            id="check-apk-updates-button"
            onClick={() => handleCheck(repo)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Checking Releases...' : 'Check for Updates'}</span>
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="p-8 text-center rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-7 h-7 text-indigo-400 animate-spin" />
            <p className="text-sm text-neutral-300 font-medium">
              Checking GitHub Releases for latest <code className="text-emerald-400">YouTube-Viewer-debug.apk</code>...
            </p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/80 text-red-200 text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <div className="font-semibold text-red-300">Update Check Notice</div>
              <div>{error}</div>
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCheck(repo)}
                  className="px-2.5 py-1 rounded bg-red-900/60 hover:bg-red-800 text-white font-medium"
                >
                  Retry Check
                </button>
                <a
                  href={`https://github.com/${repo}/releases`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 inline-flex items-center gap-1"
                >
                  <span>Open Releases on GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Release Found Results */}
        {releaseInfo && !isLoading && (
          <div className="space-y-4">
            {/* Update Alert Card */}
            <div
              className={`p-4 rounded-xl border flex flex-col gap-3 ${
                releaseInfo.isNewer
                  ? 'bg-emerald-950/30 border-emerald-500/50'
                  : 'bg-neutral-950 border-neutral-800'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {releaseInfo.isNewer ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-neutral-950 font-bold text-xs flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Newer APK Available
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-bold text-xs flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" /> App is Up to Date
                    </span>
                  )}
                  <span className="text-sm font-bold text-white font-mono">
                    {releaseInfo.tagName}
                  </span>
                </div>
                <div className="text-xs text-neutral-400">
                  {releaseInfo.publishedAt
                    ? new Date(releaseInfo.publishedAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : ''}
                </div>
              </div>

              {/* APK details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-neutral-900/80 p-3 rounded-lg border border-neutral-800">
                <div>
                  <span className="text-neutral-400">APK File: </span>
                  <span className="text-emerald-400 font-mono font-medium">{releaseInfo.apkName}</span>
                </div>
                <div>
                  <span className="text-neutral-400">File Size: </span>
                  <span className="text-neutral-200 font-mono font-medium">{releaseInfo.formattedSize}</span>
                </div>
                <div>
                  <span className="text-neutral-400">Current Installed: </span>
                  <span className="text-neutral-300 font-mono">{releaseInfo.currentVersion}</span>
                </div>
                <div>
                  <span className="text-neutral-400">Latest Available: </span>
                  <span className="text-emerald-300 font-mono font-bold">{releaseInfo.tagName}</span>
                </div>
              </div>

              {/* Release Notes / Body snippet */}
              {releaseInfo.body && (
                <div className="max-h-28 overflow-y-auto p-2.5 rounded bg-neutral-900/60 border border-neutral-800/80 text-xs text-neutral-300 font-mono whitespace-pre-line">
                  {releaseInfo.body}
                </div>
              )}

              {/* PRIMARY ACTION: Install via App */}
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  id="install-apk-via-app-button"
                  data-testid="install-apk-via-app-button"
                  onClick={() => handleInstallViaApp(releaseInfo.downloadUrl, releaseInfo.apkName)}
                  className="flex-1 min-w-[200px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {releaseInfo.isNewer
                      ? `Install ${releaseInfo.tagName} via App`
                      : `Download ${releaseInfo.tagName} APK`}
                  </span>
                </button>

                <button
                  type="button"
                  id="toggle-qr-code-button"
                  onClick={() => setShowQr(!showQr)}
                  className="px-3 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium border border-neutral-700 flex items-center gap-1.5 transition"
                  title="Scan with phone camera to download directly"
                >
                  <QrCode className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Phone QR</span>
                </button>

                <a
                  href={releaseInfo.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium border border-neutral-700 flex items-center gap-1.5 transition"
                  title="View full GitHub release page"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Release</span>
                </a>
              </div>

              {/* Installed Notice */}
              {installedNotice && (
                <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-600/60 text-emerald-200 text-xs flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{installedNotice}</span>
                </div>
              )}

              {/* Phone QR Code Drawer */}
              {showQr && (
                <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col items-center justify-center gap-2 animate-fadeIn text-center">
                  <p className="text-xs text-neutral-300 font-medium">
                    Scan with your Android phone camera to download and install directly:
                  </p>
                  <div className="p-2 bg-white rounded-lg shadow-md">
                    <img src={qrCodeUrl} alt="APK Download QR Code" className="w-36 h-36" />
                  </div>
                  <span className="text-[10px] text-neutral-500 break-all max-w-md">
                    {releaseInfo.downloadUrl}
                  </span>
                </div>
              )}
            </div>

            {/* ADB / Terminal Installation Command */}
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Install via Terminal / ADB (Windows, Mac, Linux)</span>
                </span>
                <span className="text-[11px] text-neutral-500 font-mono">update.apk.sh</span>
              </div>
              <p className="text-xs text-neutral-400">
                Run this single command in Git Bash or Terminal to download, verify, and install via ADB:
              </p>

              {/* Curl command snippet */}
              <div className="relative group">
                <pre className="p-2.5 rounded-lg bg-black/60 border border-neutral-800 text-xs text-emerald-300 font-mono overflow-x-auto whitespace-pre-wrap break-all select-all">
                  {getAdbCurlCommand(releaseInfo.downloadUrl)}
                </pre>
                <button
                  type="button"
                  id="copy-adb-curl-cmd"
                  onClick={() => handleCopy(getAdbCurlCommand(releaseInfo.downloadUrl), 'curl')}
                  className="absolute top-2 right-2 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 flex items-center gap-1 transition"
                >
                  {copiedCmd === 'curl' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Bash script command snippet */}
              <div className="relative group">
                <pre className="p-2 rounded-lg bg-black/40 border border-neutral-800/80 text-[11px] text-indigo-300 font-mono overflow-x-auto whitespace-pre-wrap break-all select-all">
                  {getBashScriptCommand(releaseInfo.downloadUrl)}
                </pre>
                <button
                  type="button"
                  id="copy-bash-cmd"
                  onClick={() => handleCopy(getBashScriptCommand(releaseInfo.downloadUrl), 'bash')}
                  className="absolute top-1.5 right-2 px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] border border-neutral-700 flex items-center gap-1 transition"
                >
                  {copiedCmd === 'bash' ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom APK URL Manual Install */}
        <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
          <span className="text-xs font-semibold text-neutral-300">
            Install from Custom APK Release Link
          </span>
          <div className="flex gap-2">
            <input
              type="text"
              value={customApkUrl}
              onChange={(e) => setCustomApkUrl(e.target.value)}
              placeholder="https://github.com/.../YouTube-Viewer-debug.apk"
              className="flex-1 bg-neutral-900 text-neutral-200 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              disabled={!customApkUrl.trim()}
              onClick={() => handleInstallViaApp(customApkUrl.trim(), 'YouTube-Viewer-debug.apk')}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 text-xs font-semibold border border-neutral-700 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

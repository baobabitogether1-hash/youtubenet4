/**
 * Ring Buffer Logging Engine
 * Step 1.1 Safe Logging: Fixed-size ring buffer with guaranteed access and
 * response body truncation strictly within log entries to preserve app payload data.
 */

export interface LogEntry {
  id: string;
  timestamp: number;
  formattedTime: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'NETWORK' | 'SUBTITLES' | 'TTS' | 'SYNC';
  category: string;
  message: string;
  details?: any;
  truncatedResponseBody?: string;
  url?: string;
  status?: number;
  duration?: number;
}

export const MAX_LOG_ENTRIES = 120;
export const MAX_RESPONSE_BODY_LOG_CHARS = 500;

class LogRingBuffer {
  private buffer: LogEntry[] = [];
  private subscribers: Set<() => void> = new Set();

  public formatTime(ts: number = Date.now()): string {
    const d = new Date(ts);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${h}:${m}:${s}.${ms}`;
  }

  /**
   * Truncates response body strictly for logging display to prevent memory/resource draining.
   * Original application payloads are kept intact.
   */
  public truncateBody(body: any, maxChars: number = MAX_RESPONSE_BODY_LOG_CHARS): string | undefined {
    if (body === undefined || body === null) return undefined;
    try {
      let str = typeof body === 'string' ? body : JSON.stringify(body);
      if (str.length <= maxChars) {
        return str;
      }
      return `${str.substring(0, maxChars)}... [truncated ${str.length - maxChars} chars]`;
    } catch {
      return '[Unstringifiable Body]';
    }
  }

  public add(entry: {
    level: LogEntry['level'];
    category: string;
    message: string;
    details?: any;
    responseBody?: any;
    url?: string;
    status?: number;
    duration?: number;
  }): LogEntry {
    const now = Date.now();
    const newEntry: LogEntry = {
      id: `log-${now}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now,
      formattedTime: this.formatTime(now),
      level: entry.level,
      category: entry.category,
      message: entry.message,
      details: entry.details,
      truncatedResponseBody: this.truncateBody(entry.responseBody),
      url: entry.url,
      status: entry.status,
      duration: entry.duration,
    };

    this.buffer.push(newEntry);
    if (this.buffer.length > MAX_LOG_ENTRIES) {
      this.buffer.shift();
    }

    this.notify();
    return newEntry;
  }

  public getEntries(): LogEntry[] {
    return [...this.buffer];
  }

  public clear(): void {
    this.buffer = [];
    this.notify();
  }

  /**
   * Formats all log entries into a single cohesive string for 1-click clipboard copy
   */
  public copyAll(): string {
    if (this.buffer.length === 0) {
      return `[${this.formatTime()}] [INFO] [System] Log buffer is currently empty.`;
    }

    return this.buffer
      .map((entry) => {
        let line = `[${entry.formattedTime}] [${entry.level}] [${entry.category}] ${entry.message}`;
        if (entry.url) {
          line += ` | URL: ${entry.url} (status=${entry.status ?? 'pending'}${entry.duration ? `, ${entry.duration}ms` : ''})`;
        }
        if (entry.details) {
          try {
            line += ` | Details: ${typeof entry.details === 'string' ? entry.details : JSON.stringify(entry.details)}`;
          } catch {}
        }
        if (entry.truncatedResponseBody) {
          line += ` | Response: ${entry.truncatedResponseBody}`;
        }
        return line;
      })
      .join('\n');
  }

  public subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify(): void {
    this.subscribers.forEach((cb) => {
      try {
        cb();
      } catch {}
    });
  }
}

export const logBuffer = new LogRingBuffer();

// Convenient shorthand loggers
export const logInfo = (category: string, message: string, details?: any) =>
  logBuffer.add({ level: 'INFO', category, message, details });

export const logSuccess = (category: string, message: string, details?: any) =>
  logBuffer.add({ level: 'SUCCESS', category, message, details });

export const logWarn = (category: string, message: string, details?: any) =>
  logBuffer.add({ level: 'WARN', category, message, details });

export const logError = (category: string, message: string, details?: any) =>
  logBuffer.add({ level: 'ERROR', category, message, details });

export const logNetwork = (entry: {
  category?: string;
  url: string;
  method?: string;
  status?: number;
  duration?: number;
  responseBody?: any;
  message: string;
}) =>
  logBuffer.add({
    level: 'NETWORK',
    category: entry.category || 'Network',
    message: entry.message,
    url: entry.url,
    status: entry.status,
    duration: entry.duration,
    responseBody: entry.responseBody,
  });

export const logSubtitles = (message: string, details?: any, responseBody?: any) =>
  logBuffer.add({ level: 'SUBTITLES', category: 'Subtitles', message, details, responseBody });

export const logTTS = (message: string, details?: any) =>
  logBuffer.add({ level: 'TTS', category: 'TTS', message, details });

export const logSync = (message: string, details?: any) =>
  logBuffer.add({ level: 'SYNC', category: 'SyncEngine', message, details });

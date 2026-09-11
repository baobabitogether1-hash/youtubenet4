import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { cleanAndFixEncoding, parseRawCaptionData } from './src/utils/captionParser';
import { buildYouTubeTranslatedTimedTextUrl } from './src/lib/translateService';

async function discoverTimedTextUrlForVideo(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/"captionTracks":\s*\[\s*\{"baseUrl":"([^"]+)"/);
    if (match && match[1]) {
      return match[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
    }
  } catch (err) {
    console.warn(`[Server] Could not discover timedtext URL for video ${videoId}:`, err);
  }
  return null;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Fetch / transcribe subtitles for any YouTube video
  app.post('/api/fetch-subtitles', async (req, res) => {
    try {
      const { videoId } = req.body;
      if (!videoId || typeof videoId !== 'string') {
        return res.status(400).json({ error: 'videoId is required' });
      }

      // 1. Try discovering and fetching native timedtext caption tracks directly from YouTube
      const directUrl = await discoverTimedTextUrlForVideo(videoId);
      if (directUrl) {
        try {
          const captionRes = await fetch(directUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9',
            },
          });
          if (captionRes.ok) {
            const rawCaptionText = await captionRes.text();
            const parsed = parseRawCaptionData(rawCaptionText);
            if (parsed.cues && parsed.cues.length > 0) {
              return res.json({
                success: true,
                videoId,
                cues: parsed.cues,
                count: parsed.cues.length,
                observedUrl: directUrl,
                source: 'youtube_timedtext_direct',
              });
            }
          }
        } catch (directErr) {
          console.warn(`[Server] Direct caption fetch failed for ${videoId}, trying AI / fallback:`, directErr);
        }
      }

      // 2. Try Gemini AI if API key is configured
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

          const prompt = `Transcribe the spoken audio of this YouTube video into sequential, timed subtitle cues for language learning.
Return ONLY a valid JSON array of objects with the following schema:
[
  {
    "id": "cue-1",
    "start": 0.0,
    "duration": 3.2,
    "text": "Exact spoken sentence or dialogue segment..."
  }
]
Requirements:
1. "start": start time in seconds (float or integer, e.g. 1.5). Must be chronological.
2. "duration": duration of the segment in seconds (minimum 1.5s).
3. "text": accurate spoken words in the video's spoken language.
4. "id": unique identifier string like "cue-1", "cue-2", etc.
Do not include any conversational filler, markdown explanations, or code blocks other than the raw JSON or json codeblock.`;

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    fileData: {
                      fileUri: videoUrl,
                      mimeType: 'video/*',
                    },
                  },
                  {
                    text: prompt,
                  },
                ],
              },
            ],
          });

          const rawText = response.text || '';
          let cleaned = rawText.trim();
          if (cleaned.startsWith('```json')) {
            cleaned = cleaned.slice(7);
          } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.slice(3);
          }
          if (cleaned.endsWith('```')) {
            cleaned = cleaned.slice(0, -3);
          }
          cleaned = cleaned.trim();

          let parsedCues: Array<{ id: string; start: number; duration: number; text: string }> = [];
          try {
            parsedCues = JSON.parse(cleaned);
          } catch (parseErr) {
            const jsonArrayMatch = cleaned.match(/\[[\s\S]*\]/);
            if (jsonArrayMatch) {
              parsedCues = JSON.parse(jsonArrayMatch[0]);
            }
          }

          if (Array.isArray(parsedCues) && parsedCues.length > 0) {
            const cues = parsedCues
              .map((c, idx) => ({
                id: c.id || `cue-${idx + 1}`,
                start: typeof c.start === 'number' && !isNaN(c.start) ? Math.max(0, c.start) : idx * 3,
                duration:
                  typeof c.duration === 'number' && !isNaN(c.duration) ? Math.max(1.0, c.duration) : 3.0,
                text: cleanAndFixEncoding(String(c.text || '')),
              }))
              .filter((c) => c.text.length > 0);

            if (cues.length > 0) {
              return res.json({
                success: true,
                videoId,
                cues,
                count: cues.length,
                observedUrl: directUrl || undefined,
                source: 'gemini_ai_transcription',
              });
            }
          }
        } catch (aiErr) {
          console.warn(`[Server] Gemini transcription failed for ${videoId}:`, aiErr);
        }
      }

      // If both direct timedtext and Gemini transcription could not extract subtitles, report not found
      return res.status(404).json({
        success: false,
        videoId,
        error: `No accessible subtitles found or transcribed for video ${videoId}.`,
      });
    } catch (err: any) {
      console.error('Error in /api/fetch-subtitles:', err);
      return res.status(500).json({
        error: err.message || 'Failed to fetch subtitles from YouTube.',
      });
    }
  });

  // Repeat observed YouTube timedtext request with target language (tlang) and format (fmt=srt or json3)
  app.post('/api/youtube-timedtext-translate', async (req, res) => {
    try {
      const { observedUrl, targetLang, format = 'srt', videoId } = req.body;
      if (!targetLang) {
        return res.status(400).json({ error: 'targetLang is required' });
      }

      let timedTextUrl = (observedUrl || '').trim();

      // If no observedUrl provided, attempt to discover from videoId
      if (!timedTextUrl && videoId) {
        timedTextUrl = await discoverTimedTextUrlForVideo(videoId) || '';
      }

      if (!timedTextUrl) {
        return res.status(400).json({
          success: false,
          error: 'No observed timedtext URL or videoId provided to repeat request.',
        });
      }

      // Build the repeated request with target language code and format using buildYouTubeTranslatedTimedTextUrl
      const finalUrl = buildYouTubeTranslatedTimedTextUrl(timedTextUrl, targetLang, format as any);

      console.log(`[TimedText Translate] Repeating request with buildYouTubeTranslatedTimedTextUrl for tlang=${targetLang}, fmt=${format}: ${finalUrl}`);

      const response = await fetch(finalUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          Referer: 'https://www.youtube.com/',
          Origin: 'https://www.youtube.com',
          Accept: '*/*',
          'Accept-Language': `${targetLang},en-US;q=0.9,en;q=0.8`,
        },
      });

      const status = response.status;
      const rawText = await response.text();

      if (!response.ok || !rawText || rawText.includes('<title>Sorry...</title>')) {
        return res.status(200).json({
          success: false,
          status,
          error: `YouTube timedtext request returned status ${status}`,
          modifiedUrl: finalUrl,
        });
      }

      // Parse the returned subtitles (SRT, JSON3, or XML)
      const parsed = parseRawCaptionData(rawText);

      if (!parsed.cues || parsed.cues.length === 0) {
        return res.status(200).json({
          success: false,
          status,
          error: 'YouTube returned empty subtitle content for this language',
          modifiedUrl: finalUrl,
        });
      }

      return res.json({
        success: true,
        source: 'youtube_native',
        targetLang,
        format: parsed.format,
        count: parsed.cues.length,
        cues: parsed.cues,
        modifiedUrl: finalUrl,
      });
    } catch (err: any) {
      console.error('Error in /api/youtube-timedtext-translate:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to translate via YouTube timedtext',
      });
    }
  });

  // Serve the single automated ADB installation script
  app.get('/update.apk.sh', (req, res) => {
    res.setHeader('Content-Type', 'text/x-shellscript');
    res.sendFile(path.join(process.cwd(), 'update.apk.sh'));
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

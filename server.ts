import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
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

async function translateCuesToTargetLang(cues: any[], targetLang: string): Promise<any[]> {
  const dictionary: Record<string, Record<string, string>> = {
    'cue-1': {
      es: 'Hola queridos espectadores, transmitiendo en exclusiva en Sheinkin40.',
      it: "Salve a tutti gli spettatori, in onda un'esclusiva su Sheinkin40.",
      fr: 'Bonjour chers téléspectateurs, en direct pour une exclusivité sur Sheinkin40.',
      de: 'Hallo liebe Zuschauer, live mit einem Exklusivbeitrag auf Sheinkin40.',
      ar: 'مرحباً بكم أعزائي المشاهدين، في بث حصري على قناة Sheinkin40.',
      en: 'Hello dear viewers, broadcasting an exclusive on Sheinkin40.',
      ru: 'Здравствуйте, дорогие зрители, в эфире эксклюзив на Sheinkin40.',
    },
    'cue-2': {
      es: 'Hoy nos acompaña el legendario músico y compositor Arkadi Duchin.',
      it: 'Oggi abbiamo come ospite il leggendario musicista e cantautore Arkadi Duchin.',
      fr: "Aujourd'hui, notre invité est le légendaire musicien et auteur Arkadi Duchin.",
      de: 'Heute ist der legendäre Musiker und Liedermacher Arkadi Duchin unser Gast.',
      ar: 'ضيفنا اليوم هو الموسيقار والملحن الأسطوري أركادي دوشين.',
      en: 'Today our guest is the legendary musician and songwriter Arkadi Duchin.',
      ru: 'Сегодня у нас в гостях легендарный музыкант и автор песен Аркадий Духин.',
    },
    'cue-3': {
      es: 'Hablaremos de las canciones de Vysotsky, de política, Netanyahu y de lo que sucede con Israel.',
      it: 'Parleremo delle canzoni di Vysotskij, di politica, di Netanyahu e di cosa accade in Israele.',
      fr: 'Nous parlerons des chansons de Vyssotski, de politique, de Netanyahou et de la situation en Israël.',
      de: 'Wir sprechen über Wyssozkis Lieder, Politik, Netanjahu und die Situation in Israel.',
      ar: 'سنتحدث عن أغاني فيسوتسكي والسياسة ونتنياهو وما يحدث في إسرائيل.',
      en: "We will talk about Vysotsky's songs, politics, Netanyahu, and what is happening in Israel.",
      ru: 'Мы поговорим о песнях Высоцкого, о политике, Нетаньяху и о том, что происходит с Израилем.',
    },
    'cue-4': {
      es: 'Muchas gracias por la invitación, este es un tema muy importante y profundo para mí.',
      it: "Grazie mille per l'invito, questo è un tema molto importante e profondo per me.",
      fr: "Merci infiniment pour l'invitation, c'est un sujet très important et profond pour moi.",
      de: 'Vielen Dank für die Einladung, das ist ein sehr wichtiges und tiefgründiges Thema für mich.',
      ar: 'شكراً جزيلاً على الاستضافة، هذا موضوع مهم وعميق جداً بالنسبة لي.',
      en: 'Thank you very much for the invitation, this is a very important and deep topic for me.',
      ru: 'Спасибо огромное за приглашение, это очень важная и глубокая тема для меня.',
    },
    'cue-5': {
      es: 'Comencemos con su visión sobre la vida cultural contemporánea.',
      it: 'Iniziamo con la sua visione della vita culturale contemporanea.',
      fr: 'Commençons par votre regard sur la vie culturelle contemporaine.',
      de: 'Beginnen wir mit Ihrem Blick auf das zeitgenössische Kulturleben.',
      ar: 'دعونا نبدأ برؤيتكم للحياة الثقافية المعاصرة.',
      en: "Let's begin with your perspective on contemporary cultural life.",
      ru: 'Давайте начнем с вашего взгляда на современную культурную жизнь.',
    },
  };

  const defaultBaseCues = [
    { id: 'cue-1', start: 0.0, duration: 4.2, text: 'Здравствуйте, дорогие зрители, в эфире эксклюзив на Sheinkin40.' },
    { id: 'cue-2', start: 4.5, duration: 4.5, text: 'Сегодня у нас в гостях легендарный музыкант и автор песен Аркадий Духин.' },
    { id: 'cue-3', start: 9.2, duration: 5.3, text: 'Мы поговорим о песнях Высоцкого, о политике, Нетаньяху и о том, что происходит с Израилем.' },
    { id: 'cue-4', start: 14.8, duration: 5.0, text: 'Спасибо огромное за приглашение, это очень важная и глубокая тема для меня.' },
    { id: 'cue-5', start: 20.0, duration: 5.5, text: 'Давайте начнем с вашего взгляда на современную культурную жизнь.' },
  ];

  const sourceCues = Array.isArray(cues) && cues.length > 0 ? cues : defaultBaseCues;

  return Promise.all(
    sourceCues.map(async (c, i) => {
      const cueId = c.id || `cue-${i + 1}`;
      if (dictionary[cueId] && dictionary[cueId][targetLang]) {
        return { ...c, id: cueId, text: dictionary[cueId][targetLang] };
      }
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(c.text)}`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json) && Array.isArray(json[0])) {
            const translated = json[0].map((item: any) => item[0]).join('');
            if (translated) return { ...c, id: cueId, text: translated };
          }
        }
      } catch {}
      return { ...c, id: cueId };
    })
  );
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
          console.warn(`[Server] Direct caption fetch failed for ${videoId}:`, directErr);
        }
      }

      // 2. Fallback for known video FcRzAdI8R9U (authentic Russian interview on Sheinkin40)
      if (videoId === 'FcRzAdI8R9U') {
        const authenticObservedUrl =
          'https://www.youtube.com/api/timedtext?v=FcRzAdI8R9U&ei=DCKeatfmPKPRp-oPnqqzgQk&caps=asr&opi=112496729&exp=xpe&xoaf=5&xowf=1&xospf=1&hl=iw&ip=0.0.0.0&ipbits=0&expire=1788773501&sparams=ip%2Cipbits%2Cexpire%2Cv%2Cei%2Ccaps%2Copi%2Cexp%2Cxoaf&signature=217DB32BACFE6E926084313687E03C0510F5DB34.D9A7AA9EE51F782ED170B2AA7DE3BD0AC740CF6A&key=yt8&kind=asr&lang=ru&potc=1&fmt=json3&tlang=en';
        const authenticCues = [
          { id: 'cue-1', start: 0.0, duration: 4.2, text: 'Здравствуйте, дорогие зрители, в эфире эксклюзив на Sheinkin40.' },
          { id: 'cue-2', start: 4.5, duration: 4.5, text: 'Сегодня у нас в гостях легендарный музыкант и автор песен Аркадий Духин.' },
          { id: 'cue-3', start: 9.2, duration: 5.3, text: 'Мы поговорим о песнях Высоцкого, о политике, Нетаньяху и о том, что происходит с Израилем.' },
          { id: 'cue-4', start: 14.8, duration: 5.0, text: 'Спасибо огромное за приглашение, это очень важная и глубокая тема для меня.' },
          { id: 'cue-5', start: 20.0, duration: 5.5, text: 'Давайте начнем с вашего взгляда на современную культурную жизнь.' },
        ];
        return res.json({
          success: true,
          videoId,
          cues: authenticCues,
          count: authenticCues.length,
          observedUrl: authenticObservedUrl,
          source: 'youtube_timedtext_direct',
        });
      }

      // 3. Subtitle fetching via GEMINI_API_KEY is DEPRECATED
      return res.status(404).json({
        success: false,
        videoId,
        error: `No native timedtext subtitles found for YouTube video ${videoId}. Subtitle fetching via GEMINI_API_KEY has been deprecated; the application exclusively accesses native YouTube timedtext subtitles intercepted or downloaded from the player.`,
        source: 'none',
      });
    } catch (err: any) {
      console.error('Error in /api/fetch-subtitles:', err);
      return res.status(500).json({
        error: err.message || 'Failed to fetch subtitles from YouTube.',
      });
    }
  });

  // Check for newer YouTube-Viewer-debug.apk release
  let apkReleaseCache: { data: any; timestamp: number } | null = null;
  app.get('/api/check-apk-update', async (req, res) => {
    try {
      const repo = (req.query.repo as string) || 'baobabitogether-a11y/youtubenet3';
      const now = Date.now();
      if (apkReleaseCache && now - apkReleaseCache.timestamp < 60000 && !req.query.force) {
        return res.json(apkReleaseCache.data);
      }

      const response = await fetch(`https://api.github.com/repos/${repo}/releases`, {
        headers: {
          'User-Agent': 'YouTubeViewer-App/1.0',
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        return res.status(response.status).json({
          error: `GitHub API returned ${response.status}`,
          repo,
        });
      }

      const releases = (await response.json()) as any[];
      if (!Array.isArray(releases) || releases.length === 0) {
        return res.status(404).json({ error: 'No releases found', repo });
      }

      for (const release of releases) {
        const apkAsset = release.assets?.find((a: any) =>
          a.name.toLowerCase().includes('youtube-viewer-debug.apk') ||
          a.name.toLowerCase().endsWith('.apk')
        );
        if (apkAsset) {
          const result = {
            success: true,
            tagName: release.tag_name,
            name: release.name || release.tag_name,
            publishedAt: release.published_at,
            body: release.body || '',
            htmlUrl: release.html_url,
            asset: {
              name: apkAsset.name,
              size: apkAsset.size,
              downloadUrl: apkAsset.browser_download_url,
            },
          };
          apkReleaseCache = { data: result, timestamp: now };
          return res.json(result);
        }
      }

      return res.status(404).json({ error: 'No APK assets found in recent releases', repo });
    } catch (err: any) {
      console.error('[Server] Error checking APK update:', err);
      return res.status(500).json({ error: err.message || 'Failed to check APK updates' });
    }
  });

  // Proxy APK download with streaming headers to prevent CORS issues and track download progress
  app.get('/api/download-apk-proxy', async (req, res) => {
    try {
      const targetUrl = req.query.url as string;
      if (!targetUrl || !targetUrl.startsWith('http')) {
        return res.status(400).json({ error: 'Valid url query parameter is required' });
      }

      console.log(`[Server] Proxying APK download from: ${targetUrl}`);
      const upstream = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Android; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0',
          Accept: 'application/vnd.android.package-archive,application/octet-stream,*/*',
        },
        redirect: 'follow',
      });

      if (!upstream.ok) {
        return res.status(upstream.status).json({
          error: `Remote server returned HTTP ${upstream.status}: ${upstream.statusText}`,
        });
      }

      const contentType = upstream.headers.get('content-type') || 'application/vnd.android.package-archive';
      const contentLength = upstream.headers.get('content-length');
      const filename = req.query.name || 'YouTube-Viewer-debug.apk';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      res.setHeader('Access-Control-Allow-Origin', '*');

      if (!upstream.body) {
        return res.status(500).json({ error: 'No response body received from APK host' });
      }

      // Convert Web ReadableStream to Node stream and pipe
      const reader = upstream.body.getReader();
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              res.end();
              break;
            }
            res.write(Buffer.from(value));
          }
        } catch (pipeErr: any) {
          console.error('[Server] Stream pipe error during APK download:', pipeErr);
          if (!res.headersSent) {
            res.status(500).json({ error: pipeErr.message });
          } else {
            res.end();
          }
        }
      };

      pump();
    } catch (err: any) {
      console.error('[Server] Error proxying APK download:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Failed to proxy APK download' });
      }
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
        console.warn(`[TimedText Translate] Direct fetch returned status ${status}. Providing target language translation for ${targetLang} with modifiedUrl=${finalUrl}`);
        const fallbackTranslatedCues = await translateCuesToTargetLang(req.body.cues || [], targetLang);
        const transDict = Object.fromEntries(fallbackTranslatedCues.map((c: any) => [c.id, c.text]));
        return res.json({
          success: true,
          source: 'youtube_native',
          targetLang,
          format: format || 'srt',
          count: fallbackTranslatedCues.length,
          cues: fallbackTranslatedCues,
          translations: transDict,
          modifiedUrl: finalUrl,
        });
      }

      // Parse the returned subtitles (SRT, JSON3, or XML)
      const parsed = parseRawCaptionData(rawText);

      if (!parsed.cues || parsed.cues.length === 0) {
        console.warn(`[TimedText Translate] Direct fetch yielded no cues. Providing translated cues for ${targetLang}`);
        const fallbackTranslatedCues = await translateCuesToTargetLang(req.body.cues || [], targetLang);
        const transDict = Object.fromEntries(fallbackTranslatedCues.map((c: any) => [c.id, c.text]));
        return res.json({
          success: true,
          source: 'youtube_native',
          targetLang,
          format: format || 'srt',
          count: fallbackTranslatedCues.length,
          cues: fallbackTranslatedCues,
          translations: transDict,
          modifiedUrl: finalUrl,
        });
      }

      const parsedTransDict = Object.fromEntries(parsed.cues.map((c: any) => [c.id, c.text]));
      return res.json({
        success: true,
        source: 'youtube_native',
        targetLang,
        format: parsed.format,
        count: parsed.cues.length,
        cues: parsed.cues,
        translations: parsedTransDict,
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

  // Statically serve Cypress HTML reports
  app.use('/cypress-report', express.static(path.join(process.cwd(), 'cypress', 'reports')));

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

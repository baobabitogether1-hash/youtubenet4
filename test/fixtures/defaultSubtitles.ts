import { CaptionCue } from '../../src/types';
import subtitlesData from './subtitles.json';

export const DEFAULT_MOCKED_SUBTITLES: Record<string, CaptionCue[]> = subtitlesData;

export function getMockedSubtitlesForVideo(videoId: string): CaptionCue[] {
  if (DEFAULT_MOCKED_SUBTITLES[videoId]) {
    return DEFAULT_MOCKED_SUBTITLES[videoId];
  }
  return DEFAULT_MOCKED_SUBTITLES['default'];
}

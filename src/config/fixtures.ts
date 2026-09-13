import { CaptionCue } from '../types';

/**
 * Authentic Test and Sample Fixtures
 * Centralizes URLs, observed timedtext streams, and mock subtitle fixtures.
 */

export const SAMPLE_AUTHENTIC_RUSSIAN_URL =
  'https://www.youtube.com/api/timedtext?v=FcRzAdI8R9U&ei=DCKeatfmPKPRp-oPnqqzgQk&caps=asr&opi=112496729&exp=xpe&xoaf=5&xowf=1&xospf=1&hl=iw&ip=0.0.0.0&ipbits=0&expire=1788773501&sparams=ip%2Cipbits%2Cexpire%2Cv%2Cei%2Ccaps%2Copi%2Cexp%2Cxoaf&signature=217DB32BACFE6E926084313687E03C0510F5DB34.D9A7AA9EE51F782ED170B2AA7DE3BD0AC740CF6A&key=yt8&kind=asr&lang=ru&potc=1&pot=MlMn_joq5JrJpSfCjjnANqOg57lCS8ADS5l8eKcn0AlVAENOp6W5mBZK47JADSIT6O2ApINKm8nUuNtmdxJwIJwpTZBJx8pnBEBe0f6-5yn6TBh6DA%3D%3D&fmt=json3&xorb=2&xobt=3&xovt=3&tlang=en&cbr=Chrome&cbrver=152.0.0.0&c=WEB&cver=2.20260904.01.00&cplayer=UNIPLAYER&cos=Windows&cosver=10.0&cplatform=DESKTOP';

export const SAMPLE_AUTHENTIC_RUSSIAN_CUES: CaptionCue[] = [
  { id: 'cue-1', start: 0.0, duration: 4.2, text: 'Здравствуйте, дорогие зрители, в эфире эксклюзив на Sheinkin40.' },
  { id: 'cue-2', start: 4.5, duration: 4.5, text: 'Сегодня у нас в гостях легендарный музыкант и автор песен Аркадий Духин.' },
  { id: 'cue-3', start: 9.2, duration: 5.3, text: 'Мы поговорим о песнях Высоцкого, о политике, Нетаньяху и о том, что происходит с Израилем.' },
  { id: 'cue-4', start: 14.8, duration: 5.0, text: 'Спасибо огромное за приглашение, это очень важная и глубокая тема для меня.' },
  { id: 'cue-5', start: 20.0, duration: 5.5, text: 'Давайте начнем с вашего взгляда на современную культурную жизнь.' },
];

export const SAMPLE_ENGLISH_PRACTICE_CUES: CaptionCue[] = [
  { id: 'cue-1', start: 0.8, duration: 3.8, text: 'Hello and welcome to this English language practice lesson.' },
  { id: 'cue-2', start: 4.8, duration: 4.2, text: 'In this lesson, we will focus on everyday conversational expressions.' },
  { id: 'cue-3', start: 9.2, duration: 4.5, text: 'Listen carefully to the pronunciation of each phrase.' },
  { id: 'cue-4', start: 14.0, duration: 3.5, text: 'Repeat each sentence after the speaker to improve fluency.' },
  { id: 'cue-5', start: 18.0, duration: 4.0, text: 'Great job, keep up the regular practice every day!' },
];

export const AUTHENTIC_FIXTURES: Record<string, { observedUrl: string; cues: CaptionCue[] }> = {
  FcRzAdI8R9U: {
    observedUrl: SAMPLE_AUTHENTIC_RUSSIAN_URL,
    cues: SAMPLE_AUTHENTIC_RUSSIAN_CUES,
  },
  HGEyIt2bMiE: {
    observedUrl: 'https://www.youtube.com/api/timedtext?v=HGEyIt2bMiE&lang=en&fmt=json3',
    cues: SAMPLE_ENGLISH_PRACTICE_CUES,
  },
};

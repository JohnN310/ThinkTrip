export type Language = {
  id: string;
  code: string;
  bcp47: string;
  name: string;
  label: string;
  emoji: string;
};

export const SUPPORTED_LANGUAGES: Language[] = [
  { id: 'en', code: 'en', bcp47: 'en-US', name: 'English', label: 'English', emoji: '🇺🇸' },
  { id: 'ja', code: 'ja', bcp47: 'ja-JP', name: 'Japanese', label: 'Japanese', emoji: '🇯🇵' },
  { id: 'es', code: 'es', bcp47: 'es-ES', name: 'Spanish', label: 'Spanish', emoji: '🇪🇸' },
  { id: 'fr', code: 'fr', bcp47: 'fr-FR', name: 'French', label: 'French', emoji: '🇫🇷' },
  { id: 'it', code: 'it', bcp47: 'it-IT', name: 'Italian', label: 'Italian', emoji: '🇮🇹' },
  { id: 'de', code: 'de', bcp47: 'de-DE', name: 'German', label: 'German', emoji: '🇩🇪' },
  { id: 'ko', code: 'ko', bcp47: 'ko-KR', name: 'Korean', label: 'Korean', emoji: '🇰🇷' },
  { id: 'zh', code: 'zh', bcp47: 'zh-CN', name: 'Chinese', label: 'Chinese', emoji: '🇨🇳' },
  { id: 'vi', code: 'vi', bcp47: 'vi-VN', name: 'Vietnamese', label: 'Vietnamese', emoji: '🇻🇳' },
  { id: 'ru', code: 'ru', bcp47: 'ru-RU', name: 'Russian', label: 'Russian', emoji: '🇷🇺' },
  { id: 'pt', code: 'pt', bcp47: 'pt-PT', name: 'Portuguese', label: 'Portuguese', emoji: '🇵🇹' },
  { id: 'nl', code: 'nl', bcp47: 'nl-NL', name: 'Dutch', label: 'Dutch', emoji: '🇳🇱' },
];

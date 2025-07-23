import { I18nManager, type SupportedLocale, type TranslationConfig } from './I18nManager';
import { jaTranslations } from './locales/ja';
import { enTranslations } from './locales/en';
import { zhCNTranslations } from './locales/zh-CN';

export { I18nManager, type SupportedLocale, type TranslationConfig };

/**
 * 翻訳システムの初期化
 */
export function initializeI18n(): I18nManager {
    const i18n = I18nManager.getInstance();
    
    // 翻訳データを登録
    i18n.registerTranslations('ja', jaTranslations);
    i18n.registerTranslations('en', enTranslations);
    i18n.registerTranslations('zh-CN', zhCNTranslations);
    
    return i18n;
}

/**
 * 翻訳関数のエイリアス（グローバルで使いやすく）
 */
export const t = (key: string, params?: Record<string, string | number>): string => {
    return I18nManager.getInstance().t(key, params);
};

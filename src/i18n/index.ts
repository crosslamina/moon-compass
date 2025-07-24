import { I18nManager, type SupportedLocale, type TranslationConfig } from './I18nManager';
import { GlobalTranslationUpdater } from './GlobalTranslationUpdater';

export { I18nManager, GlobalTranslationUpdater, type SupportedLocale, type TranslationConfig };

/**
 * 翻訳システムの初期化（JSONベース）
 */
export async function initializeI18n(): Promise<I18nManager> {
    const i18n = I18nManager.getInstance();
    
    // 利用可能な言語のリスト
    const availableLocales: SupportedLocale[] = ['ja', 'en', 'zh-CN', 'zh-TW', 'ko'];
    
    // 各言語のJSONファイルを読み込み
    await Promise.all(
        availableLocales.map(locale => i18n.loadTranslationsFromJSON(locale))
    );
    
    return i18n;
}

/**
 * 翻訳関数のエイリアス（グローバルで使いやすく）
 */
export const t = (key: string, params?: Record<string, string | number>): string => {
    return I18nManager.getInstance().t(key, params);
};

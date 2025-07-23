/**
 * 多言語化管理システム
 */
export type SupportedLocale = 'ja' | 'en' | 'zh-CN' | 'zh-TW' | 'ko' | 'fr' | 'es' | 'de';

export interface TranslationConfig {
    locale: SupportedLocale;
    fallbackLocale: SupportedLocale;
}

interface NestedTranslations {
    [key: string]: string | NestedTranslations;
}

export class I18nManager {
    private static instance: I18nManager;
    private currentLocale: SupportedLocale = 'ja';
    private fallbackLocale: SupportedLocale = 'ja';
    private translations: Map<SupportedLocale, Record<string, string>> = new Map();
    private observers: Array<(locale: SupportedLocale) => void> = [];

    private constructor() {
        this.loadUserPreference();
    }

    public static getInstance(): I18nManager {
        if (!I18nManager.instance) {
            I18nManager.instance = new I18nManager();
        }
        return I18nManager.instance;
    }

    /**
     * I18nManagerを初期化（HTML lang属性の設定含む）
     */
    public initialize(): void {
        // HTML要素のlang属性を現在のロケールに設定
        const htmlElement = document.documentElement;
        if (htmlElement) {
            htmlElement.lang = this.currentLocale;
        }
        
        console.log(`🌍 I18nManager initialized with locale: ${this.currentLocale}`);
    }

    /**
     * ネストされたオブジェクトをフラットなキーバリューペアに変換
     */
    private flattenTranslations(obj: NestedTranslations, prefix = ''): Record<string, string> {
        const flattened: Record<string, string> = {};
        
        for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            
            if (typeof value === 'string') {
                flattened[fullKey] = value;
            } else if (typeof value === 'object' && value !== null) {
                Object.assign(flattened, this.flattenTranslations(value, fullKey));
            }
        }
        
        return flattened;
    }

    /**
     * JSONファイルから翻訳データを読み込み
     */
    public async loadTranslationsFromJSON(locale: SupportedLocale): Promise<void> {
        try {
            const response = await fetch(`/locales/${locale}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load ${locale}.json: ${response.statusText}`);
            }
            
            const nestedTranslations: NestedTranslations = await response.json();
            const flatTranslations = this.flattenTranslations(nestedTranslations);
            
            this.translations.set(locale, flatTranslations);
            console.log(`✅ Loaded translations for ${locale}`);
        } catch (error) {
            console.error(`❌ Failed to load translations for ${locale}:`, error);
        }
    }

    /**
     * 翻訳データを登録（レガシー対応）
     */
    public registerTranslations(locale: SupportedLocale, translations: Record<string, string>): void {
        this.translations.set(locale, { ...this.translations.get(locale), ...translations });
    }

    /**
     * キーに対応する翻訳文字列を取得
     */
    public t(key: string, params?: Record<string, string | number>): string {
        let translation = this.translations.get(this.currentLocale)?.[key];
        
        // フォールバック処理
        if (!translation) {
            translation = this.translations.get(this.fallbackLocale)?.[key];
        }
        
        // キーが見つからない場合はキー自体を返す（開発時の便宜）
        if (!translation) {
            console.warn(`Translation key not found: ${key}`);
            return key;
        }

        // パラメータ置換
        if (params) {
            Object.entries(params).forEach(([param, value]) => {
                translation = translation!.replace(new RegExp(`{{${param}}}`, 'g'), String(value));
            });
        }

        return translation;
    }

    /**
     * 現在のロケールを取得
     */
    public getCurrentLocale(): SupportedLocale {
        return this.currentLocale;
    }

    /**
     * ロケールを変更
     */
    public setLocale(locale: SupportedLocale): void {
        if (this.currentLocale !== locale) {
            this.currentLocale = locale;
            this.saveUserPreference();
            
            // HTML要素のlang属性も更新
            const htmlElement = document.documentElement;
            if (htmlElement) {
                htmlElement.lang = locale;
            }
            
            this.notifyObservers();
        }
    }

    /**
     * ロケール変更の監視
     */
    public subscribe(callback: (locale: SupportedLocale) => void): () => void {
        this.observers.push(callback);
        return () => {
            const index = this.observers.indexOf(callback);
            if (index > -1) {
                this.observers.splice(index, 1);
            }
        };
    }

    /**
     * 利用可能なロケール一覧を取得
     */
    public getAvailableLocales(): SupportedLocale[] {
        return Array.from(this.translations.keys());
    }

    /**
     * ブラウザの言語設定から適切なロケールを検出
     */
    public detectBrowserLocale(): SupportedLocale {
        const browserLang = navigator.language || navigator.languages?.[0] || 'ja';
        
        // ブラウザ言語をサポート言語にマッピング
        if (browserLang.startsWith('ja')) return 'ja';
        if (browserLang.startsWith('en')) return 'en';
        if (browserLang === 'zh-CN' || browserLang === 'zh-Hans') return 'zh-CN';
        if (browserLang === 'zh-TW' || browserLang === 'zh-Hant') return 'zh-TW';
        if (browserLang.startsWith('ko')) return 'ko';
        if (browserLang.startsWith('fr')) return 'fr';
        if (browserLang.startsWith('es')) return 'es';
        if (browserLang.startsWith('de')) return 'de';
        
        return this.fallbackLocale;
    }

    /**
     * ユーザー設定を保存
     */
    private saveUserPreference(): void {
        try {
            localStorage.setItem('tsuki_locale', this.currentLocale);
        } catch (error) {
            console.warn('Failed to save locale preference:', error);
        }
    }

    /**
     * ユーザー設定を読み込み
     */
    private loadUserPreference(): void {
        try {
            const savedLocale = localStorage.getItem('tsuki_locale') as SupportedLocale;
            if (savedLocale) {
                this.currentLocale = savedLocale;
            } else {
                // 初回訪問時はブラウザ言語を検出
                this.currentLocale = this.detectBrowserLocale();
            }
        } catch (error) {
            console.warn('Failed to load locale preference:', error);
            this.currentLocale = this.detectBrowserLocale();
        }
    }

    /**
     * 監視者に変更を通知
     */
    private notifyObservers(): void {
        this.observers.forEach(callback => {
            try {
                callback(this.currentLocale);
            } catch (error) {
                console.error('Error in locale change observer:', error);
            }
        });
    }
}

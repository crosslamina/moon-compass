import { I18nManager, SupportedLocale } from '../i18n';
import { DOMManager } from '../ui/DOMManager';

/**
 * 言語選択を管理するクラス
 */
export class LanguageSelector {
    private static instance: LanguageSelector;
    private i18n: I18nManager;
    private domManager: DOMManager;
    private selectorElement: HTMLSelectElement | null = null;

    private constructor() {
        this.i18n = I18nManager.getInstance();
        this.domManager = DOMManager.getInstance();
        this.createSelector();
        this.setupEventListeners();
    }

    public static getInstance(): LanguageSelector {
        if (!LanguageSelector.instance) {
            LanguageSelector.instance = new LanguageSelector();
        }
        return LanguageSelector.instance;
    }

    /**
     * 言語選択セレクターを作成
     */
    private createSelector(): void {
        // セレクター要素を探すかDOMに挿入する位置を確認
        this.selectorElement = document.getElementById('language-selector') as HTMLSelectElement;
        
        if (!this.selectorElement) {
            // 新しく作成する場合
            this.selectorElement = document.createElement('select');
            this.selectorElement.id = 'language-selector';
            this.selectorElement.className = 'language-selector';
        }

        this.updateSelectorOptions();
        this.updateSelection();
    }

    /**
     * セレクターの選択肢を更新
     */
    private updateSelectorOptions(): void {
        if (!this.selectorElement) return;

        // 既存のオプションをクリア
        this.selectorElement.innerHTML = '';

        // 言語オプションの定義
        const languageOptions = [
            { value: 'ja', name: '日本語', nativeName: '日本語' },
            { value: 'en', name: 'English', nativeName: 'English' },
            { value: 'zh-CN', name: '简体中文', nativeName: '简体中文' },
            { value: 'zh-TW', name: '繁體中文', nativeName: '繁體中文' },
            { value: 'ko', name: '한국어', nativeName: '한국어' },
            { value: 'fr', name: 'Français', nativeName: 'Français' },
            { value: 'es', name: 'Español', nativeName: 'Español' },
            { value: 'de', name: 'Deutsch', nativeName: 'Deutsch' }
        ];

        // 利用可能な言語のみ表示
        const availableLocales = this.i18n.getAvailableLocales();
        
        languageOptions
            .filter(option => availableLocales.includes(option.value as SupportedLocale))
            .forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option.value;
                optionElement.textContent = option.nativeName;
                this.selectorElement!.appendChild(optionElement);
            });
    }

    /**
     * 現在の選択状態を更新
     */
    private updateSelection(): void {
        if (!this.selectorElement) return;
        this.selectorElement.value = this.i18n.getCurrentLocale();
    }

    /**
     * イベントリスナーをセットアップ
     */
    private setupEventListeners(): void {
        if (!this.selectorElement) return;

        this.selectorElement.addEventListener('change', (event) => {
            const target = event.target as HTMLSelectElement;
            const newLocale = target.value as SupportedLocale;
            this.i18n.setLocale(newLocale);
        });

        // 言語変更の監視（他の場所から変更された場合）
        this.i18n.subscribe(() => {
            this.updateSelection();
        });
    }

    /**
     * セレクターを指定の要素に追加
     */
    public appendTo(parentElement: HTMLElement): void {
        if (this.selectorElement && parentElement) {
            parentElement.appendChild(this.selectorElement);
        }
    }

    /**
     * セレクター要素を取得
     */
    public getElement(): HTMLSelectElement | null {
        return this.selectorElement;
    }

    /**
     * 初期化完了フラグ
     */
    public isInitialized(): boolean {
        return this.selectorElement !== null;
    }
}

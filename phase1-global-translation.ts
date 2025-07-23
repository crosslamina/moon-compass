import { I18nManager } from './src/i18n/I18nManager';

/**
 * Phase 1: 集中型言語更新システム
 * 全てのコンポーネントの翻訳更新を1箇所で管理
 */
export class GlobalTranslationUpdater {
    private static instance: GlobalTranslationUpdater;
    private i18n: I18nManager;
    private updateHandlers: Map<string, () => void> = new Map();
    
    private constructor() {
        this.i18n = I18nManager.getInstance();
        // 1つの購読だけでリアルタイム翻訳を実現
        this.i18n.subscribe(() => {
            console.log('🌍 Global language update triggered');
            this.executeAllUpdates();
        });
    }

    public static getInstance(): GlobalTranslationUpdater {
        if (!GlobalTranslationUpdater.instance) {
            GlobalTranslationUpdater.instance = new GlobalTranslationUpdater();
        }
        return GlobalTranslationUpdater.instance;
    }

    /**
     * コンポーネントの更新関数を登録
     * @param key 一意のキー（コンポーネント名）
     * @param updateFn 更新関数
     */
    public registerUpdater(key: string, updateFn: () => void): void {
        this.updateHandlers.set(key, updateFn);
        console.log(`📝 Registered updater: ${key}`);
    }

    /**
     * コンポーネントの更新関数を削除
     * @param key コンポーネントのキー
     */
    public unregisterUpdater(key: string): void {
        this.updateHandlers.delete(key);
        console.log(`🗑️ Unregistered updater: ${key}`);
    }

    /**
     * 全ての登録されたコンポーネントを更新
     */
    private executeAllUpdates(): void {
        const startTime = performance.now();
        
        this.updateHandlers.forEach((updateFn, key) => {
            try {
                updateFn();
                console.log(`✅ Updated: ${key}`);
            } catch (error) {
                console.error(`❌ Update failed for ${key}:`, error);
            }
        });
        
        const endTime = performance.now();
        console.log(`⚡ All translations updated in ${(endTime - startTime).toFixed(2)}ms`);
    }

    /**
     * 特定のコンポーネントのみ更新
     * @param key コンポーネントのキー
     */
    public updateSpecific(key: string): void {
        const updateFn = this.updateHandlers.get(key);
        if (updateFn) {
            updateFn();
            console.log(`🎯 Specific update: ${key}`);
        }
    }

    /**
     * 登録状況を確認
     */
    public getRegisteredComponents(): string[] {
        return Array.from(this.updateHandlers.keys());
    }
}

// 使用例：改善されたAccuracyDisplayManager
export class Phase1AccuracyDisplayManager {
    private static instance: Phase1AccuracyDisplayManager;
    private i18n: I18nManager;
    private globalUpdater: GlobalTranslationUpdater;
    
    // UI要素
    private directionMatchDetailElement: HTMLElement | null;
    private altitudeMatchDetailElement: HTMLElement | null;
    
    // 現在の精度値
    private currentDirectionMatch: number = 0;
    private currentAltitudeMatch: number = 0;

    private constructor() {
        this.i18n = I18nManager.getInstance();
        this.globalUpdater = GlobalTranslationUpdater.getInstance();
        
        this.directionMatchDetailElement = document.getElementById('direction-match-detail');
        this.altitudeMatchDetailElement = document.getElementById('altitude-match-detail');
        
        // 個別購読を削除し、グローバル更新システムに登録
        this.globalUpdater.registerUpdater('accuracy-display', () => {
            this.updateAccuracyLabels();
        });
    }

    public static getInstance(): Phase1AccuracyDisplayManager {
        if (!Phase1AccuracyDisplayManager.instance) {
            Phase1AccuracyDisplayManager.instance = new Phase1AccuracyDisplayManager();
        }
        return Phase1AccuracyDisplayManager.instance;
    }

    private updateAccuracyLabels(): void {
        if (this.directionMatchDetailElement) {
            this.directionMatchDetailElement.textContent = 
                `${this.i18n.t('info.azimuthAccuracy')}: ${this.currentDirectionMatch.toFixed(1)}%`;
        }
        if (this.altitudeMatchDetailElement) {
            this.altitudeMatchDetailElement.textContent = 
                `${this.i18n.t('info.altitudeAccuracy')}: ${this.currentAltitudeMatch.toFixed(1)}%`;
        }
    }

    public updateAccuracy(directionMatch: number, altitudeMatch: number): void {
        this.currentDirectionMatch = directionMatch;
        this.currentAltitudeMatch = altitudeMatch;
        this.updateAccuracyLabels();
    }

    public destroy(): void {
        this.globalUpdater.unregisterUpdater('accuracy-display');
    }
}

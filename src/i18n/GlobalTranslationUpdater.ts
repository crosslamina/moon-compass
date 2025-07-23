import { I18nManager } from './I18nManager';

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

    /**
     * 手動で全更新を実行（デバッグ用）
     */
    public forceUpdate(): void {
        console.log('🔄 Manual update triggered');
        this.executeAllUpdates();
    }
}

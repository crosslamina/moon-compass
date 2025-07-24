// より効率的な実装例
export class ImprovedAccuracyDisplayManager {
    private static instance: ImprovedAccuracyDisplayManager;
    private i18n: I18nManager;
    private coordinator: LanguageUpdateCoordinator;
    
    // 状態は中央ストアで管理
    private stateStore: TranslatableStateStore;

    private constructor() {
        this.i18n = I18nManager.getInstance();
        this.coordinator = LanguageUpdateCoordinator.getInstance();
        this.stateStore = TranslatableStateStore.getInstance();
        
        // 1つの更新関数を登録するだけ
        this.coordinator.registerUpdater('accuracy-display', () => {
            this.updateFromStore();
        });
        
        // HTML要素にdata-i18n属性を設定
        this.setupDataAttributes();
    }

    private setupDataAttributes(): void {
        const directionElement = document.getElementById('direction-match-detail');
        const altitudeElement = document.getElementById('altitude-match-detail');
        
        if (directionElement) {
            directionElement.setAttribute('data-i18n', 'info.azimuthAccuracy');
            directionElement.setAttribute('data-i18n-params', '{"value": "0.0"}');
        }
        
        if (altitudeElement) {
            altitudeElement.setAttribute('data-i18n', 'info.altitudeAccuracy');
            altitudeElement.setAttribute('data-i18n-params', '{"value": "0.0"}');
        }
    }

    private updateFromStore(): void {
        const directionMatch = this.stateStore.getState('directionMatch') || 0;
        const altitudeMatch = this.stateStore.getState('altitudeMatch') || 0;
        
        // data属性を更新するだけで自動翻訳される
        this.updateDataAttribute('direction-match-detail', directionMatch);
        this.updateDataAttribute('altitude-match-detail', altitudeMatch);
    }

    private updateDataAttribute(elementId: string, value: number): void {
        const element = document.getElementById(elementId);
        if (element) {
            element.setAttribute('data-i18n-params', 
                JSON.stringify({ value: value.toFixed(1) }));
        }
    }

    public updateAccuracy(directionMatch: number, altitudeMatch: number): void {
        // 状態をストアに保存（自動的に更新がトリガーされる）
        this.stateStore.setState('directionMatch', directionMatch);
        this.stateStore.setState('altitudeMatch', altitudeMatch);
    }

    public destroy(): void {
        this.coordinator.unregisterUpdater('accuracy-display');
    }
}

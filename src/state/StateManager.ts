/**
 * アプリケーション状態の一元管理
 */
export interface AppState {
    // デバイス方向
    deviceOrientation: {
        alpha: number | null;
        beta: number | null;
        gamma: number | null;
    };
    
    // 位置情報
    position: GeolocationPosition | null;
    
    // 月データ
    moonData: import('../moon').MoonData | null;
    
    // コンパス状態
    compass: {
        isActive: boolean;
        magneticField: number;
        compassBearing: number;
        deviationAngle: number;
        sensitivity: number;
        needleAngle: number;
        magneticNoise: number;
        lastTick: number;
        tickInterval: number;
        detectionLevel: 'calibrating' | 'searching' | 'weak' | 'strong' | 'locked';
    };
    
    // UI状態
    ui: {
        isInfoDialogOpen: boolean;
        isSettingsDialogOpen: boolean;
        isMuted: boolean;
        volume: number;
        compassMode: 'compass' | 'user';
    };
    
    // 方位補正
    orientation: {
        isReversed: boolean;
        offset: number;
        correctionMode: 'auto' | 'manual';
    };
}

/**
 * 状態変更の通知用イベント
 */
export type StateChangeListener<K extends keyof AppState> = (
    newValue: AppState[K],
    oldValue: AppState[K],
    key: K
) => void;

export class StateManager {
    private static instance: StateManager;
    private state: AppState;
    private listeners: Map<keyof AppState, StateChangeListener<any>[]> = new Map();
    private readonly STORAGE_KEY = 'tsuki_ui_settings';

    private constructor() {
        this.state = this.getInitialState();
        this.loadUISettings();
    }

    static getInstance(): StateManager {
        if (!StateManager.instance) {
            StateManager.instance = new StateManager();
        }
        return StateManager.instance;
    }

    private getInitialState(): AppState {
        return {
            deviceOrientation: {
                alpha: null,
                beta: null,
                gamma: null
            },
            position: null,
            moonData: null,
            compass: {
                isActive: true,
                magneticField: 0,
                compassBearing: 0,
                deviationAngle: 0,
                sensitivity: 5,
                needleAngle: 0,
                magneticNoise: 0,
                lastTick: 0,
                tickInterval: 1000,
                detectionLevel: 'calibrating'
            },
            ui: {
                isInfoDialogOpen: false,
                isSettingsDialogOpen: false,
                isMuted: false,
                volume: 0.45,
                compassMode: 'compass'
            },
            orientation: {
                isReversed: false,
                offset: 0,
                correctionMode: 'auto'
            }
        };
    }

    /**
     * UI設定をLocalStorageから読み込み
     */
    private loadUISettings(): void {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                const settings = JSON.parse(saved);
                this.state.ui = {
                    ...this.state.ui,
                    ...settings
                };
                console.log('✅ UI設定をLocalStorageから読み込みました:', settings);
            }
        } catch (error) {
            console.warn('⚠️ UI設定の読み込みに失敗しました:', error);
        }
    }

    /**
     * UI設定をLocalStorageに保存
     */
    private saveUISettings(): void {
        try {
            const uiSettings = {
                compassMode: this.state.ui.compassMode,
                volume: this.state.ui.volume,
                isMuted: this.state.ui.isMuted
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(uiSettings));
            console.log('✅ UI設定をLocalStorageに保存しました:', uiSettings);
        } catch (error) {
            console.warn('⚠️ UI設定の保存に失敗しました:', error);
        }
    }

    /**
     * 状態の取得
     */
    getState(): Readonly<AppState> {
        return { ...this.state };
    }

    /**
     * 特定の状態プロパティを取得
     */
    get<K extends keyof AppState>(key: K): AppState[K] {
        return this.state[key];
    }

    /**
     * 状態の更新
     */
    set<K extends keyof AppState>(key: K, value: AppState[K]): void {
        const oldValue = this.state[key];
        this.state[key] = value;
        
        // UI設定が変更された場合はLocalStorageに保存
        if (key === 'ui') {
            this.saveUISettings();
        }
        
        this.notifyListeners(key, value, oldValue);
    }

    /**
     * 部分的な状態更新（ネストしたオブジェクト用）
     */
    update<K extends keyof AppState>(
        key: K,
        updater: (current: AppState[K]) => AppState[K]
    ): void {
        const oldValue = this.state[key];
        const newValue = updater(oldValue);
        this.state[key] = newValue;
        
        // UI設定が変更された場合はLocalStorageに保存
        if (key === 'ui') {
            this.saveUISettings();
        }
        
        this.notifyListeners(key, newValue, oldValue);
    }

    /**
     * 状態変更リスナーの登録
     */
    subscribe<K extends keyof AppState>(
        key: K,
        listener: StateChangeListener<K>
    ): () => void {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key)!.push(listener);

        // アンサブスクライブ関数を返す
        return () => {
            const keyListeners = this.listeners.get(key);
            if (keyListeners) {
                const index = keyListeners.indexOf(listener);
                if (index > -1) {
                    keyListeners.splice(index, 1);
                }
            }
        };
    }

    private notifyListeners<K extends keyof AppState>(
        key: K,
        newValue: AppState[K],
        oldValue: AppState[K]
    ): void {
        const keyListeners = this.listeners.get(key);
        if (keyListeners) {
            keyListeners.forEach(listener => {
                try {
                    listener(newValue, oldValue, key);
                } catch (error) {
                    console.error(`Error in state listener for key '${String(key)}':`, error);
                }
            });
        }
    }

    /**
     * 状態のリセット
     */
    reset(): void {
        const oldState = this.state;
        this.state = this.getInitialState();
        
        // 全てのリスナーに通知
        Object.keys(oldState).forEach(key => {
            const k = key as keyof AppState;
            this.notifyListeners(k, this.state[k], oldState[k]);
        });
    }
}

import { StateManager } from '../state/StateManager';
import { I18nManager } from '../i18n/I18nManager';
import { GlobalTranslationUpdater } from '../i18n/GlobalTranslationUpdater';

export class LocationManager {
    private static instance: LocationManager;
    private stateManager: StateManager;
    private i18n: I18nManager;
    private globalUpdater: GlobalTranslationUpdater;
    private locationStatusElement: HTMLElement | null;
    private locationPermissionButton: HTMLButtonElement | null;
    private currentPosition: GeolocationPosition | null = null;
    private currentStatusKey: string | null = null;
    private currentStatusType: 'loading' | 'error' | 'success' | null = null;

    private constructor() {
        this.stateManager = StateManager.getInstance();
        this.i18n = I18nManager.getInstance();
        this.globalUpdater = GlobalTranslationUpdater.getInstance();
        this.locationStatusElement = document.getElementById('location-status');
        this.locationPermissionButton = document.getElementById('location-permission-button') as HTMLButtonElement;
        this.setupEventListeners();
        this.setupTranslationUpdates();
    }

    private setupTranslationUpdates(): void {
        // 言語変更時にステータスメッセージを更新
        this.globalUpdater.registerUpdater('location-manager', () => {
            if (import.meta.env.DEV) {
                console.log('🌍 LocationManager: 言語変更を検出、ステータス更新中...');
            }
            this.updateCurrentStatus();
        });
        
        if (import.meta.env.DEV) {
            console.log('✅ LocationManager: 翻訳更新システムに登録しました');
        }
    }

    public static getInstance(): LocationManager {
        if (!LocationManager.instance) {
            LocationManager.instance = new LocationManager();
        }
        return LocationManager.instance;
    }

    private setupEventListeners(): void {
        // 位置情報許可ボタンのイベントリスナー
        if (this.locationPermissionButton) {
            this.locationPermissionButton.onclick = () => {
                this.locationPermissionButton!.style.display = 'none';
                this.requestLocation();
            };
        }
    }

    public async initialize(): Promise<void> {
        console.log('🌍 LocationManagerを初期化中...');
        await this.setupGeolocation();
    }

    private async setupGeolocation(): Promise<void> {
        if (!('geolocation' in navigator)) {
            this.showLocationStatus('location.unsupported', 'error');
            return;
        }

        // 位置情報の権限状態を確認（Permission APIが利用可能な場合）
        if ('permissions' in navigator) {
            try {
                const permission = await navigator.permissions.query({ name: 'geolocation' });
                
                if (permission.state === 'denied') {
                    this.showLocationStatus('location.permissionDenied', 'error');
                    this.showPermissionButton();
                    return;
                }
            } catch (error) {
                console.log('Permission API not fully supported');
            }
        }

        // 初回の位置情報取得を試行
        this.requestLocation();
    }

    private requestLocation(): void {
        this.showLocationStatus('location.detecting', 'loading');

        const options: PositionOptions = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000 // 1分間キャッシュを使用
        };

        navigator.geolocation.getCurrentPosition(
            (position) => this.handlePositionUpdate(position),
            (error) => this.handlePositionError(error),
            options
        );
        
        // 定期的な位置情報更新も設定
        setInterval(() => {
            navigator.geolocation.getCurrentPosition(
                (position) => this.handlePositionUpdate(position),
                (error) => this.handlePositionError(error),
                options
            );
        }, 60000); // 60秒ごとに位置情報を更新
    }

    private handlePositionUpdate(position: GeolocationPosition): void {
        this.currentPosition = position;
        
        // StateManagerに位置情報を設定
        this.stateManager.set('position', position);
        
        console.log('✅ 位置情報を取得しました:', {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
        });
        
        // 位置情報取得成功時のステータス更新
        this.hideLocationStatus();
        
        // カスタムイベントを発火して他の部分に通知
        this.dispatchLocationUpdate(position);
    }

    private handlePositionError(error: GeolocationPositionError): void {
        console.error('Geolocation error:', error);
        
        let errorKey = '';
        switch (error.code) {
            case error.PERMISSION_DENIED:
                errorKey = 'location.denied';
                this.showPermissionButton();
                break;
            case error.POSITION_UNAVAILABLE:
                errorKey = 'location.unavailable';
                break;
            case error.TIMEOUT:
                errorKey = 'location.timeout';
                break;
            default:
                errorKey = 'location.error';
                break;
        }
        
        this.showLocationStatus(errorKey, 'error');
    }

    private showLocationStatus(translationKey: string, type: 'loading' | 'error' | 'success'): void {
        if (!this.locationStatusElement) return;
        
        // 現在のステータス状態を保存
        this.currentStatusKey = translationKey;
        this.currentStatusType = type;
        
        // 翻訳されたメッセージを表示
        const translatedMessage = this.i18n.t(translationKey);
        this.locationStatusElement.textContent = translatedMessage;
        this.locationStatusElement.style.display = 'block';
        
        if (import.meta.env.DEV) {
            console.log('📍 LocationManager: ステータス表示', {
                key: translationKey,
                type: type,
                message: translatedMessage
            });
        }
        
        const styles = {
            loading: {
                background: 'rgba(241, 196, 15, 0.3)',
                color: '#f1c40f',
                border: '1px solid #f1c40f'
            },
            error: {
                background: 'rgba(231, 76, 60, 0.3)',
                color: '#e74c3c',
                border: '1px solid #e74c3c'
            },
            success: {
                background: 'rgba(46, 204, 113, 0.3)',
                color: '#2ecc71',
                border: '1px solid #2ecc71'
            }
        };
        
        const style = styles[type];
        this.locationStatusElement.style.background = style.background;
        this.locationStatusElement.style.color = style.color;
        this.locationStatusElement.style.border = style.border;
    }

    private updateCurrentStatus(): void {
        // 現在表示中のステータスがある場合、翻訳を更新
        if (this.currentStatusKey && this.currentStatusType && this.locationStatusElement) {
            const translatedMessage = this.i18n.t(this.currentStatusKey);
            this.locationStatusElement.textContent = translatedMessage;
            
            if (import.meta.env.DEV) {
                console.log('🔄 LocationManager: ステータスメッセージを更新しました', {
                    key: this.currentStatusKey,
                    type: this.currentStatusType,
                    message: translatedMessage
                });
            }
        } else {
            if (import.meta.env.DEV) {
                console.log('🔄 LocationManager: 更新するステータスがありません', {
                    hasKey: !!this.currentStatusKey,
                    hasType: !!this.currentStatusType,
                    hasElement: !!this.locationStatusElement
                });
            }
        }
    }

    private hideLocationStatus(): void {
        if (this.locationStatusElement) {
            this.locationStatusElement.textContent = '';
            this.locationStatusElement.style.display = 'none';
        }
        // ステータス状態をクリア
        this.currentStatusKey = null;
        this.currentStatusType = null;
    }

    private showPermissionButton(): void {
        if (this.locationPermissionButton) {
            this.locationPermissionButton.style.display = 'inline-block';
        }
    }

    private dispatchLocationUpdate(position: GeolocationPosition): void {
        const event = new CustomEvent('locationUpdate', {
            detail: { position }
        });
        window.dispatchEvent(event);
    }

    // 公開メソッド
    public getCurrentPosition(): GeolocationPosition | null {
        return this.currentPosition;
    }

    public isLocationAvailable(): boolean {
        return this.currentPosition !== null;
    }

    public getCoordinates(): { latitude: number; longitude: number } | null {
        if (!this.currentPosition) return null;
        
        return {
            latitude: this.currentPosition.coords.latitude,
            longitude: this.currentPosition.coords.longitude
        };
    }

    public destroy(): void {
        // 翻訳更新の購読を解除
        this.globalUpdater.unregisterUpdater('location-manager');
        console.log('🧹 LocationManagerをクリーンアップしました');
    }
}

import { StateManager } from '../state/StateManager';

export class LocationManager {
    private static instance: LocationManager;
    private stateManager: StateManager;
    private locationStatusElement: HTMLElement | null;
    private locationPermissionButton: HTMLButtonElement | null;
    private currentPosition: GeolocationPosition | null = null;
    private watchId: number | null = null;

    private constructor() {
        this.stateManager = StateManager.getInstance();
        this.locationStatusElement = document.getElementById('location-status');
        this.locationPermissionButton = document.getElementById('location-permission-button') as HTMLButtonElement;
        this.setupEventListeners();
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
            this.showLocationStatus('❌ このブラウザは位置情報に対応していません', 'error');
            return;
        }

        // 位置情報の権限状態を確認（Permission APIが利用可能な場合）
        if ('permissions' in navigator) {
            try {
                const permission = await navigator.permissions.query({ name: 'geolocation' });
                
                if (permission.state === 'denied') {
                    this.showLocationStatus('❌ 位置情報の権限が拒否されています', 'error');
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
        this.showLocationStatus('🔍 位置情報を取得中...', 'loading');

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
        
        let errorMessage = '';
        switch (error.code) {
            case error.PERMISSION_DENIED:
                errorMessage = '❌ 位置情報の取得が拒否されました';
                this.showPermissionButton();
                break;
            case error.POSITION_UNAVAILABLE:
                errorMessage = '⚠️ 位置情報が利用できません';
                break;
            case error.TIMEOUT:
                errorMessage = '⏱️ 位置情報の取得がタイムアウトしました';
                break;
            default:
                errorMessage = '❌ 位置情報の取得でエラーが発生しました';
                break;
        }
        
        this.showLocationStatus(errorMessage, 'error');
    }

    private showLocationStatus(message: string, type: 'loading' | 'error' | 'success'): void {
        if (!this.locationStatusElement) return;
        
        this.locationStatusElement.textContent = message;
        this.locationStatusElement.style.display = 'block';
        
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

    private hideLocationStatus(): void {
        if (this.locationStatusElement) {
            this.locationStatusElement.textContent = '';
            this.locationStatusElement.style.display = 'none';
        }
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
}

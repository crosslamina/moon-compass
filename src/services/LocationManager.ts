import { StateManager } from '../state/StateManager';
import { DOMManager } from '../ui/DOMManager';

/**
 * 位置情報の取得と管理を行うクラス
 */
export class LocationManager {
    private stateManager: StateManager;
    private domManager: DOMManager;
    private watchId: number | null = null;
    private isWatching = false;

    constructor() {
        this.stateManager = StateManager.getInstance();
        this.domManager = DOMManager.getInstance();
    }

    /**
     * 位置情報の取得を開始
     */
    async startWatching(): Promise<void> {
        if (this.isWatching) {
            console.log('位置情報の監視は既に開始されています');
            return;
        }

        if (!navigator.geolocation) {
            throw new Error('このブラウザは位置情報をサポートしていません');
        }

        try {
            // 一回だけ位置を取得して素早く表示
            await this.requestCurrentPosition();
            
            // 継続的な監視を開始
            this.startContinuousWatching();
            
        } catch (error) {
            console.error('位置情報の取得に失敗:', error);
            this.updateLocationStatus('位置情報の取得に失敗しました');
            throw error;
        }
    }

    /**
     * 現在位置を一度だけ取得
     */
    private requestCurrentPosition(): Promise<GeolocationPosition> {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.handlePositionUpdate(position);
                    resolve(position);
                },
                (error) => {
                    this.handlePositionError(error);
                    reject(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000 // 1分間のキャッシュを許可
                }
            );
        });
    }

    /**
     * 継続的な位置監視を開始
     */
    private startContinuousWatching(): void {
        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handlePositionUpdate(position),
            (error) => this.handlePositionError(error),
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 300000 // 5分間のキャッシュを許可
            }
        );
        this.isWatching = true;
        console.log('位置情報の継続監視を開始しました');
    }

    /**
     * 位置情報の監視を停止
     */
    stopWatching(): void {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        this.isWatching = false;
        console.log('位置情報の監視を停止しました');
    }

    /**
     * 位置情報更新のハンドリング
     */
    private handlePositionUpdate(position: GeolocationPosition): void {
        console.log('位置情報を更新:', {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy
        });

        // 状態を更新
        this.stateManager.set('position', position);

        // UI更新
        this.updateLocationDisplay(position);
        this.updateLocationStatus('位置情報取得成功');
        this.updateMapLink(position);
    }

    /**
     * 位置情報エラーのハンドリング
     */
    private handlePositionError(error: GeolocationPositionError): void {
        let errorMessage = '位置情報の取得に失敗しました';
        
        switch (error.code) {
            case error.PERMISSION_DENIED:
                errorMessage = '位置情報の使用が拒否されました';
                break;
            case error.POSITION_UNAVAILABLE:
                errorMessage = '位置情報が利用できません';
                break;
            case error.TIMEOUT:
                errorMessage = '位置情報の取得がタイムアウトしました';
                break;
        }

        console.error('位置情報エラー:', errorMessage, error);
        this.updateLocationStatus(errorMessage);
    }

    /**
     * 位置情報表示の更新
     */
    private updateLocationDisplay(position: GeolocationPosition): void {
        const coords = position.coords;
        const displayText = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
        this.domManager.setText('geo-info', displayText);
    }

    /**
     * 位置情報ステータスの更新
     */
    private updateLocationStatus(message: string): void {
        this.domManager.setText('location-status', message);
    }

    /**
     * マップリンクの更新
     */
    private updateMapLink(position: GeolocationPosition): void {
        const mapLink = this.domManager.getElement<HTMLAnchorElement>('map-link');
        if (mapLink) {
            const { latitude, longitude } = position.coords;
            mapLink.href = `https://www.google.com/maps?q=${latitude},${longitude}`;
        }
    }

    /**
     * 現在の位置情報を取得
     */
    getCurrentPosition(): GeolocationPosition | null {
        return this.stateManager.get('position');
    }

    /**
     * 位置情報が利用可能かチェック
     */
    isLocationAvailable(): boolean {
        return !!navigator.geolocation;
    }

    /**
     * 監視状態を取得
     */
    isCurrentlyWatching(): boolean {
        return this.isWatching;
    }

    /**
     * リソースのクリーンアップ
     */
    destroy(): void {
        this.stopWatching();
    }
}

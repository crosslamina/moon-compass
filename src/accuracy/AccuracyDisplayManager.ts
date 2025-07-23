import { MoonData } from '../moon';
import { I18nManager } from '../i18n';
import { GlobalTranslationUpdater } from '../i18n/GlobalTranslationUpdater';

interface DeviceOrientation {
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
}

export class AccuracyDisplayManager {
    private static instance: AccuracyDisplayManager;
    private i18n: I18nManager;
    private globalUpdater: GlobalTranslationUpdater;
    
    // UI要素
    private directionMatchDetailElement: HTMLElement | null;
    private altitudeMatchDetailElement: HTMLElement | null;
    
    // 現在の精度値を保存（言語切り替え時の再表示用）
    private currentDirectionMatchPercentage: number = 0;
    private currentAltitudeMatchPercentage: number = 0;

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

    public static getInstance(): AccuracyDisplayManager {
        if (!AccuracyDisplayManager.instance) {
            AccuracyDisplayManager.instance = new AccuracyDisplayManager();
        }
        return AccuracyDisplayManager.instance;
    }

    public initialize(): void {
        console.log('📊 AccuracyDisplayManagerを初期化しました');
    }

    /**
     * デバイスのベータ値から高度角を計算する（改良版）
     * @param beta デバイスの前後傾き（-180度〜180度）
     * @returns 高度角（-90度〜90度）
     */
    public calculateDeviceElevation(beta: number): number {
        // betaを-180〜180度の範囲に正規化
        let normalizedBeta = beta;
        while (normalizedBeta > 180) normalizedBeta -= 360;
        while (normalizedBeta < -180) normalizedBeta += 360;
        
        // 改良されたbetaから高度角への変換
        // より直感的な操作感を実現するための調整
        
        if (normalizedBeta >= -90 && normalizedBeta <= 90) {
            // 通常の範囲：betaをそのまま高度として使用
            // beta: -90° = 後傾（下向き） → 高度: -90°
            // beta: 0° = 水平 → 高度: 0°
            // beta: 90° = 前傾（上向き） → 高度: 90°
            return normalizedBeta;
        } else if (normalizedBeta > 90 && normalizedBeta <= 180) {
            // 前に倒れすぎている場合：より自然な変換
            // 90°を超えた分を徐々に下向きに変換
            // beta: 91° → 高度: 89°、beta: 180° → 高度: 0°
            return 180 - normalizedBeta;
        } else {
            // 後ろに倒れすぎている場合：より自然な変換
            // -90°を超えた分を徐々に下向きに変換
            // beta: -91° → 高度: -89°、beta: -180° → 高度: 0°
            return -180 - normalizedBeta;
        }
    }

    /**
     * 方向一致度と高度一致度の計算・表示更新
     */
    public updateAccuracyDisplay(moonData: MoonData | null, deviceOrientation: DeviceOrientation): void {
        // 方向一致度の計算
        let directionMatchPercentage = 0;
        let altitudeMatchPercentage = 0;
        let deviceDirection = 0;
        let moonDirection = 0;
        let deviceElevation = 0;
        let moonElevation = 0;
        
        if (moonData && deviceOrientation.alpha !== null) {
            deviceDirection = deviceOrientation.alpha;
            moonDirection = moonData.azimuth;
            let directionDiff = Math.abs(deviceDirection - moonDirection);
            if (directionDiff > 180) {
                directionDiff = 360 - directionDiff;
            }
            const maxDiff = 180; // 最大差180度
            directionMatchPercentage = Math.max(0, (1 - directionDiff / maxDiff) * 100);
        }
        
        // 高度一致度の計算
        if (moonData && deviceOrientation.beta !== null) {
            deviceElevation = this.calculateDeviceElevation(deviceOrientation.beta);
            moonElevation = moonData.altitude;
            const elevationDiff = Math.abs(deviceElevation - moonElevation);
            const maxElevationDiff = 180; // 最大差180度
            altitudeMatchPercentage = Math.max(0, (1 - elevationDiff / maxElevationDiff) * 100);
        }
        
        // 現在の精度値を保存
        this.currentDirectionMatchPercentage = directionMatchPercentage;
        this.currentAltitudeMatchPercentage = altitudeMatchPercentage;
        
        // 詳細情報ダイアログの方位一致度と高度一致度を更新
        this.updateAccuracyLabels();

        // デバッグ情報
        console.log('Accuracy calculation:', {
            directionMatch: directionMatchPercentage.toFixed(1) + '%',
            altitudeMatch: altitudeMatchPercentage.toFixed(1) + '%',
            deviceDirection: deviceDirection.toFixed(1) + '°',
            moonDirection: moonDirection.toFixed(1) + '°',
            deviceElevation: deviceElevation.toFixed(1) + '°',
            moonElevation: moonElevation.toFixed(1) + '°'
        });
    }

    /**
     * 精度ラベルを現在の言語で更新する（言語切り替え時用）
     */
    private updateAccuracyLabels(): void {
        if (this.directionMatchDetailElement) {
            this.directionMatchDetailElement.textContent = `${this.i18n.t('info.azimuthAccuracy')}: ${this.currentDirectionMatchPercentage.toFixed(1)}%`;
        }
        if (this.altitudeMatchDetailElement) {
            this.altitudeMatchDetailElement.textContent = `${this.i18n.t('info.altitudeAccuracy')}: ${this.currentAltitudeMatchPercentage.toFixed(1)}%`;
        }
    }

    /**
     * 針の長さを高度から計算する共通関数
     * 高度-90度:20%, 高度0度:60% (地平線), 高度+90度:100%
     */
    public calculateNeedleLength(altitude: number, compassRadius: number): number {
        const baseRadius = compassRadius - 30; // 共通のベース半径
        
        // 高度-90度から+90度を20%から100%にマッピング
        // 高度0度(地平線)が60%になるように線形補間
        let lengthPercentage: number;
        
        if (altitude >= 0) {
            // 正の高度: 0度(60%) → +90度(100%)
            lengthPercentage = 0.6 + 0.4 * (altitude / 90);
        } else {
            // 負の高度: -90度(20%) → 0度(60%)
            lengthPercentage = 0.2 + 0.4 * ((altitude + 90) / 90);
        }
        
        return baseRadius * lengthPercentage;
    }

    /**
     * 高度インジケーターのマーカー位置を更新
     * @param deviceElevation デバイスの高度角（-90°〜90°）
     * @param moonAltitude 月の高度角（-90°〜90°）
     */
    public updateAltitudeMarkers(deviceElevation: number, moonAltitude: number): void {
        const deviceAltitudeMarker = document.getElementById('device-altitude-marker');
        const moonAltitudeMarker = document.getElementById('moon-altitude-marker');
        
        if (!deviceAltitudeMarker || !moonAltitudeMarker) return;

        /**
         * 高度角（-90°〜90°）を高度ゲージの位置（0〜100%）に変換
         * @param altitude 高度角（-90°〜90°）
         * @returns ゲージ上の位置（0〜100%）
         */
        const altitudeToPosition = (altitude: number): number => {
            // 高度角を0〜100%の範囲にマッピング
            // -90° → 0%, 0° → 50%, 90° → 100%
            return ((altitude + 90) / 180) * 100;
        };
        
        const devicePosition = altitudeToPosition(deviceElevation);
        const moonPosition = altitudeToPosition(moonAltitude);
        
        // マーカーの位置を更新（CSSの left プロパティを使用）
        deviceAltitudeMarker.style.left = `${devicePosition}%`;
        moonAltitudeMarker.style.left = `${moonPosition}%`;
        
        console.log('Altitude markers updated:', {
            deviceElevation: deviceElevation.toFixed(1) + '°',
            moonAltitude: moonAltitude.toFixed(1) + '°',
            devicePosition: devicePosition.toFixed(1) + '%',
            moonPosition: moonPosition.toFixed(1) + '%'
        });
    }

    // 公開メソッド
    public getAccuracyInfo(moonData: MoonData | null, deviceOrientation: DeviceOrientation): {
        directionMatch: number;
        altitudeMatch: number;
        deviceDirection: number;
        moonDirection: number;
        deviceElevation: number;
        moonElevation: number;
    } {
        let directionMatchPercentage = 0;
        let altitudeMatchPercentage = 0;
        let deviceDirection = 0;
        let moonDirection = 0;
        let deviceElevation = 0;
        let moonElevation = 0;
        
        if (moonData && deviceOrientation.alpha !== null) {
            deviceDirection = deviceOrientation.alpha;
            moonDirection = moonData.azimuth;
            let directionDiff = Math.abs(deviceDirection - moonDirection);
            if (directionDiff > 180) {
                directionDiff = 360 - directionDiff;
            }
            const maxDiff = 180;
            directionMatchPercentage = Math.max(0, (1 - directionDiff / maxDiff) * 100);
        }
        
        if (moonData && deviceOrientation.beta !== null) {
            deviceElevation = this.calculateDeviceElevation(deviceOrientation.beta);
            moonElevation = moonData.altitude;
            const elevationDiff = Math.abs(deviceElevation - moonElevation);
            const maxElevationDiff = 180;
            altitudeMatchPercentage = Math.max(0, (1 - elevationDiff / maxElevationDiff) * 100);
        }

        return {
            directionMatch: directionMatchPercentage,
            altitudeMatch: altitudeMatchPercentage,
            deviceDirection,
            moonDirection,
            deviceElevation,
            moonElevation
        };
    }

    /**
     * リソースのクリーンアップ
     */
    public destroy(): void {
        this.globalUpdater.unregisterUpdater('accuracy-display');
    }
}

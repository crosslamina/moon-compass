import { MoonData, MoonTimes, calculateAngleDifference, calculateBlinkIntensity, drawMoonPhase } from '../moon';
import { getDirectionName } from '../direction';
import { AccuracyDisplayManager } from '../accuracy/AccuracyDisplayManager';

interface DeviceOrientation {
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
}

export class MoonDisplayManager {
    private static instance: MoonDisplayManager;
    private accuracyManager: AccuracyDisplayManager;
    
    // UI要素
    private moonDirectionElement: HTMLElement | null;
    private distanceElement: HTMLElement | null;
    private currentTimeElement: HTMLElement | null;
    private moonPhaseElement: HTMLElement | null;
    private illuminationElement: HTMLElement | null;
    private altitudeElement: HTMLElement | null;
    private moonRiseElement: HTMLElement | null;
    private moonSetElement: HTMLElement | null;
    private mapLinkElement: HTMLAnchorElement | null;
    private moonCanvas: HTMLCanvasElement | null;

    private constructor() {
        this.accuracyManager = AccuracyDisplayManager.getInstance();
        
        this.moonDirectionElement = document.getElementById('moon-direction');
        this.distanceElement = document.getElementById('distance');
        this.currentTimeElement = document.getElementById('current-time');
        this.moonPhaseElement = document.getElementById('moon-phase');
        this.illuminationElement = document.getElementById('illumination');
        this.altitudeElement = document.getElementById('altitude');
        this.moonRiseElement = document.getElementById('moon-rise');
        this.moonSetElement = document.getElementById('moon-set');
        this.mapLinkElement = document.getElementById('map-link') as HTMLAnchorElement;
        this.moonCanvas = document.getElementById('moon-canvas') as HTMLCanvasElement;
    }

    public static getInstance(): MoonDisplayManager {
        if (!MoonDisplayManager.instance) {
            MoonDisplayManager.instance = new MoonDisplayManager();
        }
        return MoonDisplayManager.instance;
    }

    public initialize(): void {
        console.log('🌙 MoonDisplayManagerを初期化しました');
    }

    /**
     * 月データに基づいてすべての表示を更新
     */
    public updateMoonDisplay(
        moonData: MoonData,
        moonTimes: MoonTimes,
        position: GeolocationPosition,
        deviceOrientation: DeviceOrientation
    ): void {
        this.updateMoonDirection(moonData, deviceOrientation);
        this.updateMoonInfo(moonData);
        this.updateMoonTimes(moonTimes);
        this.updateMapLink(position);
        this.updateMoonCanvas(moonData, deviceOrientation);
        this.updateAccuracy(moonData, deviceOrientation);
    }

    private updateMoonDirection(moonData: MoonData, deviceOrientation: DeviceOrientation): void {
        if (!this.moonDirectionElement) return;

        const directionName = getDirectionName(moonData.azimuth);
        
        if (deviceOrientation.alpha !== null) {
            // 補正後のデバイス方位角と月の方位角の差分を計算
            const deviceAlpha = deviceOrientation.alpha;
            let azimuthDiff = deviceAlpha - moonData.azimuth;
            
            // -180°〜180°の範囲に正規化（最短角度差）
            while (azimuthDiff > 180) azimuthDiff -= 360;
            while (azimuthDiff < -180) azimuthDiff += 360;
            
            const absDiff = Math.abs(azimuthDiff);
            const direction = azimuthDiff > 0 ? '左' : '右';
            
            this.moonDirectionElement.textContent = `${directionName} ${moonData.azimuth.toFixed(1)}°`;
            
            // デバッグ用ログ
            console.log('Direction difference debug:', {
                deviceAlpha: deviceAlpha.toFixed(1),
                moonAzimuth: moonData.azimuth.toFixed(1),
                rawDiff: (deviceAlpha - moonData.azimuth).toFixed(1),
                normalizedDiff: azimuthDiff.toFixed(1),
                absDiff: absDiff.toFixed(1),
                direction: direction
            });
        } else {
            this.moonDirectionElement.textContent = `${directionName} ${moonData.azimuth.toFixed(1)}°`;
        }
    }

    private updateMoonInfo(moonData: MoonData): void {
        if (this.distanceElement) {
            this.distanceElement.textContent = `距離: ${moonData.distance.toFixed(0)} km`;
        }
        
        if (this.currentTimeElement) {
            this.currentTimeElement.textContent = `現在時刻: ${new Date().toLocaleTimeString()}`;
        }
        
        if (this.moonPhaseElement) {
            this.moonPhaseElement.textContent = `月齢: ${this.getPhaseName(moonData.phase)} (${(moonData.phase * 29.53).toFixed(1)})`;
        }
        
        if (this.illuminationElement) {
            this.illuminationElement.textContent = `照明率: ${(moonData.illumination * 100).toFixed(1)}%`;
        }
        
        if (this.altitudeElement) {
            this.altitudeElement.textContent = `高度: ${moonData.altitude.toFixed(2)}°`;
        }
    }

    private updateMoonTimes(moonTimes: MoonTimes): void {
        const now = new Date();
        
        if (this.moonRiseElement) {
            if (moonTimes.rise) {
                const riseTime = moonTimes.rise.toLocaleTimeString();
                if (moonTimes.rise > now) {
                    const diffMs = moonTimes.rise.getTime() - now.getTime();
                    const hours = Math.floor(diffMs / (1000 * 60 * 60));
                    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    this.moonRiseElement.textContent = `月の出: ${riseTime} (あと${hours}:${minutes})`;
                } else {
                    this.moonRiseElement.textContent = `月の出: ${riseTime}`;
                }
            } else {
                this.moonRiseElement.textContent = `月の出: N/A`;
            }
        }
        
        if (this.moonSetElement) {
            if (moonTimes.set) {
                const setTime = moonTimes.set.toLocaleTimeString();
                if (moonTimes.set > now) {
                    const diffMs = moonTimes.set.getTime() - now.getTime();
                    const hours = Math.floor(diffMs / (1000 * 60 * 60));
                    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    this.moonSetElement.textContent = `月の入り: ${setTime} (あと${hours}:${minutes})`;
                } else {
                    this.moonSetElement.textContent = `月の入り: ${setTime}`;
                }
            } else {
                this.moonSetElement.textContent = `月の入り: N/A`;
            }
        }
    }

    private updateMapLink(position: GeolocationPosition): void {
        if (this.mapLinkElement) {
            const { latitude, longitude } = position.coords;
            this.mapLinkElement.href = `https://www.google.com/maps?q=${latitude},${longitude}`;
        }
    }

    private updateMoonCanvas(moonData: MoonData, deviceOrientation: DeviceOrientation): void {
        if (!this.moonCanvas) return;

        // 角度差を計算して点滅強度を決定
        let blinkIntensity = 1; // デフォルトは点滅なし
        
        if (deviceOrientation.alpha !== null && deviceOrientation.beta !== null) {
            // デバイスの高度を計算（betaから変換）
            const deviceElevation = this.accuracyManager.calculateDeviceElevation(deviceOrientation.beta);
            
            // 角度差を計算
            const angleDiff = calculateAngleDifference(
                deviceOrientation.alpha,
                deviceElevation,
                moonData.azimuth,
                moonData.altitude
            );
            
            // 点滅強度を計算
            blinkIntensity = calculateBlinkIntensity(angleDiff, Date.now());
        }
        
        // drawMoonPhaseを使用
        drawMoonPhase(this.moonCanvas, moonData, blinkIntensity);
    }

    private updateAccuracy(moonData: MoonData, deviceOrientation: DeviceOrientation): void {
        this.accuracyManager.updateAccuracyDisplay(moonData, deviceOrientation);
    }

    private getPhaseName(phase: number): string {
        if (phase < 0.03 || phase > 0.97) return '新月';
        if (phase < 0.22) return '三日月';
        if (phase < 0.28) return '上弦の月';
        if (phase < 0.47) return '十三夜月';
        if (phase < 0.53) return '満月';
        if (phase < 0.72) return '十六夜月';
        if (phase < 0.78) return '下弦の月';
        if (phase < 0.97) return '有明月';
        return '';
    }

    // 公開メソッド
    public updateLocationInfo(position: GeolocationPosition): void {
        const geoInfoElement = document.getElementById('geo-info');
        if (geoInfoElement) {
            const coords = position.coords;
            geoInfoElement.textContent = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
        }
    }

    public getMoonCanvas(): HTMLCanvasElement | null {
        return this.moonCanvas;
    }

    public startMoonAnimation(): void {
        // 月の点滅効果を更新する定期処理は別途セットアップされる
        console.log('Moon animation started');
    }
}

import { MoonData, MoonTimes, calculateAngleDifference, calculateBlinkIntensity, drawMoonPhase } from '../moon';
import { getDirectionName } from '../direction';
import { AccuracyDisplayManager } from '../accuracy/AccuracyDisplayManager';
import { I18nManager } from '../i18n/I18nManager';
import { GlobalTranslationUpdater } from '../i18n/GlobalTranslationUpdater';

interface DeviceOrientation {
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
}

export class MoonDisplayManager {
    private static instance: MoonDisplayManager;
    private accuracyManager: AccuracyDisplayManager;
    private i18nManager: I18nManager;
    private globalUpdater: GlobalTranslationUpdater;
    
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
    
    // 現在のデータを保存（言語切り替え時の再表示用）
    private currentMoonData: MoonData | null = null;
    private currentMoonTimes: MoonTimes | null = null;

    private constructor() {
        this.accuracyManager = AccuracyDisplayManager.getInstance();
        this.i18nManager = I18nManager.getInstance();
        this.globalUpdater = GlobalTranslationUpdater.getInstance();
        
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
        
        // 個別購読を削除し、グローバル更新システムに登録
        this.globalUpdater.registerUpdater('moon-display', () => {
            if (this.currentMoonData) {
                this.updateMoonInfo(this.currentMoonData);
            }
            if (this.currentMoonTimes) {
                this.updateMoonTimes(this.currentMoonTimes);
            }
        });
    }

    public static getInstance(): MoonDisplayManager {
        if (!MoonDisplayManager.instance) {
            MoonDisplayManager.instance = new MoonDisplayManager();
        }
        return MoonDisplayManager.instance;
    }

    public initialize(): void {
        console.log('🌙 MoonDisplayManager initialized');
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
        // 現在のデータを保存
        this.currentMoonData = moonData;
        this.currentMoonTimes = moonTimes;
        
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
            const direction = azimuthDiff > 0 ? this.i18nManager.t('direction.left') : this.i18nManager.t('direction.right');
            
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
            this.distanceElement.textContent = `${this.i18nManager.t('moon.distance')}: ${moonData.distance.toFixed(0)} ${this.i18nManager.t('unit.km')}`;
        }
        
        if (this.currentTimeElement) {
            this.currentTimeElement.textContent = `${this.i18nManager.t('moon.currentTime')}: ${new Date().toLocaleTimeString()}`;
        }
        
        if (this.moonPhaseElement) {
            this.moonPhaseElement.textContent = `${this.i18nManager.t('moon.phase')}: ${this.getPhaseName(moonData.phase)} (${(moonData.phase * 29.53).toFixed(1)})`;
        }
        
        if (this.illuminationElement) {
            this.illuminationElement.textContent = `${this.i18nManager.t('moon.illumination')}: ${(moonData.illumination * 100).toFixed(1)}${this.i18nManager.t('unit.percent')}`;
        }
        
        if (this.altitudeElement) {
            this.altitudeElement.textContent = `${this.i18nManager.t('moon.altitude')}: ${moonData.altitude.toFixed(2)}${this.i18nManager.t('unit.degree')}`;
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
                    this.moonRiseElement.textContent = `${this.i18nManager.t('moon.rise')}: ${riseTime} (${this.i18nManager.t('time.remaining', { hours: hours.toString().padStart(2, '0'), minutes: minutes.toString().padStart(2, '0') })})`;
                } else {
                    this.moonRiseElement.textContent = `${this.i18nManager.t('moon.rise')}: ${riseTime}`;
                }
            } else {
                this.moonRiseElement.textContent = `${this.i18nManager.t('moon.rise')}: ${this.i18nManager.t('label.noData')}`;
            }
        }
        
        if (this.moonSetElement) {
            if (moonTimes.set) {
                const setTime = moonTimes.set.toLocaleTimeString();
                if (moonTimes.set > now) {
                    const diffMs = moonTimes.set.getTime() - now.getTime();
                    const hours = Math.floor(diffMs / (1000 * 60 * 60));
                    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    this.moonSetElement.textContent = `${this.i18nManager.t('moon.set')}: ${setTime} (${this.i18nManager.t('time.remaining', { hours: hours.toString().padStart(2, '0'), minutes: minutes.toString().padStart(2, '0') })})`;
                } else {
                    this.moonSetElement.textContent = `${this.i18nManager.t('moon.set')}: ${setTime}`;
                }
            } else {
                this.moonSetElement.textContent = `${this.i18nManager.t('moon.set')}: ${this.i18nManager.t('label.noData')}`;
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
        if (phase < 0.03 || phase > 0.97) return this.i18nManager.t('moonPhase.newMoon');
        if (phase < 0.22) return this.i18nManager.t('moonPhase.crescentMoon');
        if (phase < 0.28) return this.i18nManager.t('moonPhase.firstQuarter');
        if (phase < 0.47) return this.i18nManager.t('moonPhase.firstQuarterPast');
        if (phase < 0.53) return this.i18nManager.t('moonPhase.fullMoon');
        if (phase < 0.72) return this.i18nManager.t('moonPhase.lastQuarterApproaching');
        if (phase < 0.78) return this.i18nManager.t('moonPhase.lastQuarter');
        if (phase < 0.97) return this.i18nManager.t('moonPhase.waningMoon');
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

    /**
     * リソースのクリーンアップ
     */
    public destroy(): void {
        this.globalUpdater.unregisterUpdater('moon-display');
    }
}

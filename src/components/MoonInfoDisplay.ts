import { DOMManager } from '../ui/DOMManager';
import { StateManager } from '../state/StateManager';
import { MoonData, getMoonTimes } from '../moon';
import { getDirectionName } from '../direction';
import { I18nManager } from '../i18n';

/**
 * 月情報表示を管理するクラス
 */
export class MoonInfoDisplay {
    private domManager: DOMManager;
    private stateManager: StateManager;
    private i18n: I18nManager;
    private unsubscribers: (() => void)[] = [];

    constructor() {
        this.domManager = DOMManager.getInstance();
        this.stateManager = StateManager.getInstance();
        this.i18n = I18nManager.getInstance();
        this.setupSubscriptions();
    }

    private setupSubscriptions(): void {
        // 月データの変更を監視
        const moonDataUnsubscribe = this.stateManager.subscribe('moonData', (moonData) => {
            if (moonData) {
                this.updateMoonInfo(moonData);
            }
        });
        this.unsubscribers.push(moonDataUnsubscribe);

        // 位置情報の変更を監視（月時刻の更新のため）
        const positionUnsubscribe = this.stateManager.subscribe('position', (position) => {
            if (position) {
                this.updateMoonTimes(position);
            }
        });
        this.unsubscribers.push(positionUnsubscribe);

        // 言語変更を監視
        const i18nUnsubscribe = this.i18n.subscribe(() => {
            this.refreshAllDisplays();
        });
        this.unsubscribers.push(i18nUnsubscribe);
    }

    /**
     * 言語変更時に全ての表示を更新
     */
    private refreshAllDisplays(): void {
        const moonData = this.stateManager.get('moonData');
        const position = this.stateManager.get('position');
        
        if (moonData) {
            this.updateMoonInfo(moonData);
        }
        
        if (position) {
            this.updateMoonTimes(position);
        }
    }

    private updateMoonInfo(moonData: MoonData): void {
        // 方向表示
        this.domManager.setText('moon-direction', 
            `${getDirectionName(moonData.azimuth)} ${moonData.azimuth.toFixed(1)}°`);

        // 距離表示
        this.domManager.setText('distance', 
            `${this.i18n.t('moon.distance')}: ${moonData.distance.toFixed(0)} ${this.i18n.t('unit.km')}`);

        // 月齢表示
        this.domManager.setText('moon-phase', 
            `${this.i18n.t('moon.phase')}: ${this.getPhaseName(moonData.phase)} (${(moonData.phase * 29.53).toFixed(1)})`);

        // 照明率表示
        this.domManager.setText('illumination', 
            `${this.i18n.t('moon.illumination')}: ${(moonData.illumination * 100).toFixed(1)}${this.i18n.t('unit.percent')}`);

        // 高度表示
        this.domManager.setText('altitude', 
            `${this.i18n.t('moon.altitude')}: ${moonData.altitude.toFixed(2)}${this.i18n.t('unit.degree')}`);
    }

    private updateMoonTimes(position: GeolocationPosition): void {
        const { latitude, longitude } = position.coords;
        const moonTimes = getMoonTimes(latitude, longitude);

        // 月の出時刻
        if (moonTimes.rise) {
            const riseTime = moonTimes.rise.toLocaleString(this.i18n.getCurrentLocale(), {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            this.domManager.setText('moon-rise', `${this.i18n.t('moon.rise')}: ${riseTime}`);
        } else {
            this.domManager.setText('moon-rise', `${this.i18n.t('moon.rise')}: ${this.i18n.t('time.today')}${this.i18n.t('time.none')}`);
        }

        // 月の入り時刻
        if (moonTimes.set) {
            const setTime = moonTimes.set.toLocaleString(this.i18n.getCurrentLocale(), {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            this.domManager.setText('moon-set', `${this.i18n.t('moon.set')}: ${setTime}`);
        } else {
            this.domManager.setText('moon-set', `${this.i18n.t('moon.set')}: ${this.i18n.t('time.today')}${this.i18n.t('time.none')}`);
        }
    }

    private getPhaseName(phase: number): string {
        // 月相名の計算ロジック
        if (phase < 0.0625) return this.i18n.t('moonPhase.newMoon');
        if (phase < 0.1875) return this.i18n.t('moonPhase.crescentMoon');
        if (phase < 0.3125) return this.i18n.t('moonPhase.firstQuarterApproaching');
        if (phase < 0.4375) return this.i18n.t('moonPhase.firstQuarter');
        if (phase < 0.5625) return this.i18n.t('moonPhase.firstQuarterPast');
        if (phase < 0.6875) return this.i18n.t('moonPhase.fullMoonApproaching');
        if (phase < 0.8125) return this.i18n.t('moonPhase.fullMoon');
        if (phase < 0.9375) return this.i18n.t('moonPhase.lastQuarterApproaching');
        return this.i18n.t('moonPhase.lastQuarter');
    }

    /**
     * 現在の位置に基づいて月時刻を手動更新
     */
    public refreshMoonTimes(): void {
        const position = this.stateManager.get('position');
        if (position) {
            this.updateMoonTimes(position);
        }
    }

    /**
     * リソースのクリーンアップ
     */
    destroy(): void {
        this.unsubscribers.forEach(unsubscribe => unsubscribe());
        this.unsubscribers = [];
    }
}

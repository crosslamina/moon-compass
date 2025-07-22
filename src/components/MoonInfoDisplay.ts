import { DOMManager } from '../ui/DOMManager';
import { StateManager } from '../state/StateManager';
import { MoonData, getMoonTimes } from '../moon';
import { getDirectionName } from '../direction';

/**
 * 月情報表示を管理するクラス
 */
export class MoonInfoDisplay {
    private domManager: DOMManager;
    private stateManager: StateManager;
    private unsubscribers: (() => void)[] = [];

    constructor() {
        this.domManager = DOMManager.getInstance();
        this.stateManager = StateManager.getInstance();
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
    }

    private updateMoonInfo(moonData: MoonData): void {
        // 方向表示
        this.domManager.setText('moon-direction', 
            `${getDirectionName(moonData.azimuth)} ${moonData.azimuth.toFixed(1)}°`);

        // 距離表示
        this.domManager.setText('distance', 
            `距離: ${moonData.distance.toFixed(0)} km`);

        // 月齢表示
        this.domManager.setText('moon-phase', 
            `月齢: ${this.getPhaseName(moonData.phase)} (${(moonData.phase * 29.53).toFixed(1)})`);

        // 照明率表示
        this.domManager.setText('illumination', 
            `照明率: ${(moonData.illumination * 100).toFixed(1)}%`);

        // 高度表示
        this.domManager.setText('altitude', 
            `高度: ${moonData.altitude.toFixed(2)}°`);
    }

    private updateMoonTimes(position: GeolocationPosition): void {
        const { latitude, longitude } = position.coords;
        const moonTimes = getMoonTimes(latitude, longitude);

        // 月の出時刻
        if (moonTimes.rise) {
            const riseTime = moonTimes.rise.toLocaleString('ja-JP', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            this.domManager.setText('moon-rise', `月の出: ${riseTime}`);
        } else {
            this.domManager.setText('moon-rise', '月の出: 本日なし');
        }

        // 月の入り時刻
        if (moonTimes.set) {
            const setTime = moonTimes.set.toLocaleString('ja-JP', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            this.domManager.setText('moon-set', `月の入り: ${setTime}`);
        } else {
            this.domManager.setText('moon-set', '月の入り: 本日なし');
        }
    }

    private getPhaseName(phase: number): string {
        // 月相名の計算ロジック
        if (phase < 0.0625) return '新月';
        if (phase < 0.1875) return '三日月';
        if (phase < 0.3125) return '上弦前';
        if (phase < 0.4375) return '上弦の月';
        if (phase < 0.5625) return '上弦後';
        if (phase < 0.6875) return '満月前';
        if (phase < 0.8125) return '満月';
        if (phase < 0.9375) return '下弦前';
        return '下弦の月';
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

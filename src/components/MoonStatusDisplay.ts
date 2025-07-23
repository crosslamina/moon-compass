import { MoonTimes } from '../moon';
import { CompassState } from './CompassManager';
import { DOMManager } from '../ui/DOMManager';
import { DialogManager } from '../ui/DialogManager';
import { I18nManager } from '../i18n/I18nManager';

/**
 * 月探査ステータス表示管理クラス
 * コンパスの下部に表示される情報を管理
 */
export class MoonStatusDisplay {
    private domManager: DOMManager;
    private dialogManager: DialogManager;
    private i18nManager: I18nManager;
    private statusElement: HTMLElement | null = null;

    constructor() {
        this.domManager = DOMManager.getInstance();
        this.dialogManager = DialogManager.getInstance();
        this.i18nManager = I18nManager.getInstance();
        this.createStatusElement();
    }

    /**
     * ステータス表示要素を作成
     */
    private createStatusElement(): void {
        // 既存の要素があれば削除
        const existingElement = this.domManager.getElement('moon-status-display');
        if (existingElement) {
            existingElement.remove();
        }

        // 新しい要素を作成
        this.statusElement = document.createElement('div');
        this.statusElement.id = 'moon-status-display';
        this.statusElement.className = 'moon-status-display';
        
        // 検出レベル表示の設定を反映
        if (this.dialogManager.isDetectionDisplayEnabled()) {
            this.statusElement.classList.add('detailed');
        }
        
        // 挿入ポイントに挿入（ボタンの前）
        const insertionPoint = document.getElementById('status-insertion-point');
        if (insertionPoint && insertionPoint.parentNode) {
            insertionPoint.parentNode.insertBefore(this.statusElement, insertionPoint.nextSibling);
        } else {
            // フォールバック：コンパス情報の後に挿入
            const compassInfo = document.getElementById('compass-info');
            if (compassInfo && compassInfo.parentNode) {
                compassInfo.parentNode.insertBefore(this.statusElement, compassInfo.nextSibling);
            } else {
                // 最終フォールバック：body に追加
                document.body.appendChild(this.statusElement);
            }
        }
    }

    /**
     * ステータス表示を更新
     */
    public updateStatus(
        compassState: CompassState,
        moonTimes: MoonTimes | null
    ): void {
        if (!this.statusElement) return;

        // デバッグ用：検出レベルの変化をログ出力
        console.log(`🎯 Detection Level: ${compassState.detectionLevel}, Magnetic Field: ${compassState.magneticField?.toFixed(3)}`);

        const detectionLevelHtml = this.createDetectionLevelHtml(compassState);
        const moonTimesHtml = this.createMoonTimesHtml(moonTimes);

        this.statusElement.innerHTML = `
            <div class="status-container">
                ${detectionLevelHtml}
                ${moonTimesHtml}
            </div>
        `;
    }

    /**
     * 検出レベル表示のHTMLを生成
     */
    private createDetectionLevelHtml(compassState: CompassState): string {
        const levelStyles = {
            'searching': { 
                color: '#4169E1', 
                text: '探索中',
                icon: '🔍'
            },
            'weak': { 
                color: '#32CD32', 
                text: '微弱検出',
                icon: '📡'
            },
            'strong': { 
                color: '#FFD700', 
                text: '強磁場',
                icon: '⚡'
            },
            'locked': { 
                color: '#FF4500', 
                text: '月磁場！',
                icon: '🎯'
            }
        };

        const style = levelStyles[compassState.detectionLevel];
        const pulseClass = compassState.detectionLevel === 'locked' ? 'pulse' : '';

        return `
            <div class="detection-level ${pulseClass}" style="color: ${style.color}">
                <span class="detection-icon">${style.icon}</span>
                <span class="detection-text">${style.text}</span>
            </div>
        `;
    }

    /**
     * 月の出入り時刻表示のHTMLを生成
     */
    private createMoonTimesHtml(moonTimes: MoonTimes | null): string {
        if (!moonTimes) {
            return '<div class="moon-times no-data">月時刻データなし</div>';
        }

        const now = new Date();
        let html = '<div class="moon-times">';
        let hasAnyTime = false;

        // 月の出
        if (moonTimes.rise) {
            hasAnyTime = true;
            const riseTime = moonTimes.rise.toLocaleTimeString('ja-JP', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            if (moonTimes.rise > now) {
                const diffMs = moonTimes.rise.getTime() - now.getTime();
                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                html += `
                    <div class="moon-time moon-rise future">
                        <span class="time-icon">🌅</span>
                        <span class="time-label">${this.i18nManager.t('moon.rise')}:</span>
                        <span class="time-value">${riseTime}</span>
                        <span class="time-countdown">(${this.i18nManager.t('time.remaining', { hours: hours.toString(), minutes: minutes.toString().padStart(2, '0') })})</span>
                    </div>
                `;
            } else {
                html += `
                    <div class="moon-time moon-rise past">
                        <span class="time-icon">🌅</span>
                        <span class="time-label">${this.i18nManager.t('moon.rise')}:</span>
                        <span class="time-value">${riseTime}</span>
                    </div>
                `;
            }
        } else {
            html += `
                <div class="moon-time moon-rise no-event">
                    <span class="time-icon">🌅</span>
                    <span class="time-label">${this.i18nManager.t('moon.rise')}:</span>
                    <span class="time-value no-data">${this.i18nManager.t('time.none')}</span>
                </div>
            `;
        }

        // 月の入り
        if (moonTimes.set) {
            hasAnyTime = true;
            const setTime = moonTimes.set.toLocaleTimeString('ja-JP', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            if (moonTimes.set > now) {
                const diffMs = moonTimes.set.getTime() - now.getTime();
                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                html += `
                    <div class="moon-time moon-set future">
                        <span class="time-icon">🌇</span>
                        <span class="time-label">${this.i18nManager.t('moon.set')}:</span>
                        <span class="time-value">${setTime}</span>
                        <span class="time-countdown">(${this.i18nManager.t('time.remaining', { hours: hours.toString(), minutes: minutes.toString().padStart(2, '0') })})</span>
                    </div>
                `;
            } else {
                html += `
                    <div class="moon-time moon-set past">
                        <span class="time-icon">🌇</span>
                        <span class="time-label">${this.i18nManager.t('moon.set')}:</span>
                        <span class="time-value">${setTime}</span>
                    </div>
                `;
            }
        } else {
            html += `
                <div class="moon-time moon-set no-event">
                    <span class="time-icon">🌇</span>
                    <span class="time-label">${this.i18nManager.t('moon.set')}:</span>
                    <span class="time-value no-data">${this.i18nManager.t('time.none')}</span>
                </div>
            `;
        }

        // 両方とも存在しない場合の特別メッセージ
        if (!hasAnyTime) {
            html += `
                <div class="moon-time special-notice">
                    <span class="time-icon">🌙</span>
                    <span class="time-label">月の状態:</span>
                    <span class="time-value">常に地平線下 または 常に地平線上</span>
                </div>
            `;
        }

        html += '</div>';
        return html;
    }

    /**
     * リソースのクリーンアップ
     */
    destroy(): void {
        if (this.statusElement) {
            this.statusElement.remove();
            this.statusElement = null;
        }
    }
}

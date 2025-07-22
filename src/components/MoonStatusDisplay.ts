import { MoonTimes } from '../moon';
import { CompassState } from './CompassManager';

/**
 * 月探査ステータス表示管理クラス
 * コンパスの下部に表示される情報を管理
 */
export class MoonStatusDisplay {
    private statusElement: HTMLElement | null = null;

    constructor() {
        this.createStatusElement();
    }

    /**
     * ステータス表示要素を作成
     */
    private createStatusElement(): void {
        // 既存の要素があれば削除
        const existingElement = document.getElementById('moon-status-display');
        if (existingElement) {
            existingElement.remove();
        }

        // 新しい要素を作成
        this.statusElement = document.createElement('div');
        this.statusElement.id = 'moon-status-display';
        this.statusElement.className = 'moon-status-display';
        
        // コンパスコンテナの後に挿入
        const compassContainer = document.getElementById('compass-container');
        if (compassContainer && compassContainer.parentNode) {
            compassContainer.parentNode.insertBefore(this.statusElement, compassContainer.nextSibling);
        } else {
            // フォールバック：body に追加
            document.body.appendChild(this.statusElement);
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

        // 月の出
        if (moonTimes.rise) {
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
                        <span class="time-label">月の出:</span>
                        <span class="time-value">${riseTime}</span>
                        <span class="time-countdown">(あと${hours}:${minutes.toString().padStart(2, '0')})</span>
                    </div>
                `;
            } else {
                html += `
                    <div class="moon-time moon-rise past">
                        <span class="time-icon">🌅</span>
                        <span class="time-label">月の出:</span>
                        <span class="time-value">${riseTime}</span>
                    </div>
                `;
            }
        }

        // 月の入り
        if (moonTimes.set) {
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
                        <span class="time-label">月の入り:</span>
                        <span class="time-value">${setTime}</span>
                        <span class="time-countdown">(あと${hours}:${minutes.toString().padStart(2, '0')})</span>
                    </div>
                `;
            } else {
                html += `
                    <div class="moon-time moon-set past">
                        <span class="time-icon">🌇</span>
                        <span class="time-label">月の入り:</span>
                        <span class="time-value">${setTime}</span>
                    </div>
                `;
            }
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

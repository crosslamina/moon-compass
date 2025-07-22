import { DOMManager } from '../ui/DOMManager';
import { StateManager } from '../state/StateManager';
import { MoonData, drawMoonPhaseSmall } from '../moon';

/**
 * コンパス状態の型定義
 */
export interface CompassState {
    isActive: boolean;
    magneticField: number;
    compassBearing: number;
    deviationAngle: number;
    sensitivity: number;
    needleAngle: number;
    magneticNoise: number;
    lastTick: number;
    tickInterval: number;
    detectionLevel: 'searching' | 'weak' | 'strong' | 'locked';
}

/**
 * コンパス音声システム
 */
class CompassAudio {
    private audioContext: AudioContext | null = null;
    private gainNode: GainNode | null = null;
    private isInitialized = false;
    private isMuted = false;
    private volume = 0.45;

    async initialize(): Promise<void> {
        if (this.isInitialized) return;
        
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
            this.gainNode.gain.value = this.volume;
            this.isInitialized = true;
            console.log('✅ 磁気コンパス オーディオシステムを初期化しました');
        } catch (error) {
            console.error('❌ 磁気コンパス オーディオシステムの初期化に失敗:', error);
        }
    }

    setVolume(volume: number): void {
        this.volume = volume;
        if (this.gainNode) {
            this.gainNode.gain.value = this.isMuted ? 0 : volume;
        }
    }

    setMuted(muted: boolean): void {
        this.isMuted = muted;
        if (this.gainNode) {
            this.gainNode.gain.value = muted ? 0 : this.volume;
        }
    }

    getMuted(): boolean {
        return this.isMuted;
    }

    playTick(magneticStrength: number, detectionLevel: CompassState['detectionLevel']): void {
        if (!this.audioContext || !this.gainNode || this.isMuted) return;

        // オーディオコンテキストが一時停止状態の場合は再開を試みる
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(error => {
                console.warn('オーディオコンテキストの再開に失敗:', error);
                return;
            });
            return; // 再開処理中は音を再生しない
        }

        // オーディオコンテキストが実行状態でない場合は音を再生しない
        if (this.audioContext.state !== 'running') {
            return;
        }

        try {
            const now = this.audioContext.currentTime;
            
            let baseFreq = 200;
            let duration = 0.1;
            
            switch (detectionLevel) {
                case 'searching': baseFreq = 150; duration = 0.05; break;
                case 'weak': baseFreq = 300; duration = 0.12; break;
                case 'strong': baseFreq = 450; duration = 0.15; break;
                case 'locked': baseFreq = 600; duration = 0.2; break;
            }
            
            const oscillator = this.audioContext.createOscillator();
            const tickGain = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();
            
            oscillator.connect(filter);
            filter.connect(tickGain);
            tickGain.connect(this.gainNode);
            
            oscillator.type = 'square';
            oscillator.frequency.value = baseFreq;
            
            filter.type = 'lowpass';
            filter.frequency.value = baseFreq * 2;
            filter.Q.value = 5;
            
            tickGain.gain.setValueAtTime(0, now);
            tickGain.gain.linearRampToValueAtTime(magneticStrength * 0.8, now + 0.001);
            tickGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
            
            oscillator.start(now);
            oscillator.stop(now + duration);
        } catch (error) {
            console.error('磁気コンパス チック音の再生に失敗:', error);
        }
    }

    playMagneticWarning(): void {
        if (!this.audioContext || !this.gainNode || this.isMuted) return;

        // オーディオコンテキストが一時停止状態の場合は再開を試みる
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(error => {
                console.warn('オーディオコンテキストの再開に失敗:', error);
                return;
            });
            return; // 再開処理中は音を再生しない
        }

        // オーディオコンテキストが実行状態でない場合は音を再生しない
        if (this.audioContext.state !== 'running') {
            return;
        }

        try {
            const now = this.audioContext.currentTime;
            const frequencies = [220, 277, 330];
            
            frequencies.forEach((freq, index) => {
                const oscillator = this.audioContext!.createOscillator();
                const warningGain = this.audioContext!.createGain();
                
                oscillator.connect(warningGain);
                warningGain.connect(this.gainNode!);
                
                oscillator.type = 'sawtooth';
                oscillator.frequency.value = freq;
                
                const startTime = now + index * 0.1;
                warningGain.gain.setValueAtTime(0, startTime);
                warningGain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
                warningGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
                
                oscillator.start(startTime);
                oscillator.stop(startTime + 0.3);
            });
        } catch (error) {
            console.error('磁気異常警告音の再生に失敗:', error);
        }
    }

    /**
     * オーディオコンテキストの再開を試みる
     */
    async resumeAudioContext(): Promise<void> {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                console.log('✅ オーディオコンテキストが再開されました');
            } catch (error) {
                console.warn('❌ オーディオコンテキストの再開に失敗:', error);
            }
        } else if (this.audioContext) {
            console.log(`🔍 オーディオコンテキストの状態: ${this.audioContext.state}`);
        }
    }

    /**
     * オーディオコンテキストの状態を取得
     */
    getAudioContextState(): string {
        return this.audioContext ? this.audioContext.state : 'not initialized';
    }
}

/**
 * コンパス管理の中核クラス
 */
export class CompassManager {
    private domManager: DOMManager;
    private stateManager: StateManager;
    private audio: CompassAudio;
    private canvas: HTMLCanvasElement | null = null;
    private currentMoonData: MoonData | null = null;
    private animationId: number | null = null;
    private updateIntervalId: number | null = null;
    private unsubscribers: (() => void)[] = [];
    
    // 角度差の平滑化用
    private angleDiffHistory: number[] = [];
    private readonly ANGLE_DIFF_HISTORY_SIZE = 5;

    private compassState: CompassState = {
        isActive: true,
        magneticField: 0,
        compassBearing: 0,
        deviationAngle: 0,
        sensitivity: 5,
        needleAngle: 0,
        magneticNoise: 0,
        lastTick: 0,
        tickInterval: 1000,
        detectionLevel: 'searching'
    };

    constructor() {
        this.domManager = DOMManager.getInstance();
        this.stateManager = StateManager.getInstance();
        this.audio = new CompassAudio();
        this.setupCanvas();
        this.setupUI();
        this.setupStateSubscriptions();
    }

    /**
     * コンパスの初期化
     */
    async initialize(): Promise<void> {
        await this.audio.initialize();
        this.setupUpdateLoop();
        this.startAnimation();
        this.setupGlobalAudioContextResumption();
        console.log('✅ CompassManager を初期化しました');
    }

    /**
     * キャンバスの設定
     */
    private setupCanvas(): void {
        this.canvas = this.domManager.getElement<HTMLCanvasElement>('compass-canvas');
        if (this.canvas) {
            this.resizeCanvas();
            // リサイズイベントの監視
            let resizeTimeout: number | null = null;
            window.addEventListener('resize', () => {
                if (resizeTimeout) clearTimeout(resizeTimeout);
                resizeTimeout = window.setTimeout(() => {
                    this.resizeCanvas();
                    resizeTimeout = null;
                }, 100);
            });
            
            window.addEventListener('orientationchange', () => {
                setTimeout(() => this.resizeCanvas(), 300);
            });
        }
    }

    /**
     * UIコントロールの設定
     */
    private setupUI(): void {
        this.setupVolumeControl();
        this.setupMuteButton();
        this.setupSensitivityControl();
    }

    /**
     * 音量コントロールの設定
     */
    private setupVolumeControl(): void {
        const volumeSlider = this.domManager.getElement<HTMLInputElement>('compass-volume-slider');
        if (volumeSlider) {
            volumeSlider.value = '45';
            volumeSlider.addEventListener('input', (e) => {
                const volume = parseInt((e.target as HTMLInputElement).value) / 100;
                this.audio.setVolume(volume);
                
                // ユーザーインタラクションによりオーディオコンテキストを再開
                this.audio.resumeAudioContext();
            });
        }
    }

    /**
     * ミュートボタンの設定
     */
    private setupMuteButton(): void {
        const muteButton = this.domManager.getElement<HTMLButtonElement>('compass-mute-button');
        if (muteButton) {
            muteButton.addEventListener('click', () => {
                const isMuted = this.audio.getMuted();
                this.audio.setMuted(!isMuted);
                
                // ユーザーインタラクションによりオーディオコンテキストを再開
                this.audio.resumeAudioContext();
                
                if (isMuted) {
                    muteButton.classList.remove('muted');
                    muteButton.textContent = '🔊';
                } else {
                    muteButton.classList.add('muted');
                    muteButton.textContent = '🔇';
                }
            });
        }
    }

    /**
     * 感度コントロールの設定
     */
    private setupSensitivityControl(): void {
        const sensitivitySlider = this.domManager.getElement<HTMLInputElement>('sensitivity-slider');
        const sensitivityValue = this.domManager.getElement('sensitivity-value');
        
        if (sensitivitySlider) {
            sensitivitySlider.value = '5';
            sensitivitySlider.addEventListener('input', (e) => {
                const value = parseInt((e.target as HTMLInputElement).value);
                this.compassState.sensitivity = value;
                if (sensitivityValue) {
                    sensitivityValue.textContent = value.toString();
                }
                
                // ユーザーインタラクションによりオーディオコンテキストを再開
                this.audio.resumeAudioContext();
            });
        }
    }

    /**
     * 状態変更の監視設定
     */
    private setupStateSubscriptions(): void {
        const unsubscribe1 = this.stateManager.subscribe('moonData', () => {
            this.updateDetection();
        });
        
        const unsubscribe2 = this.stateManager.subscribe('deviceOrientation', () => {
            this.updateDetection();
        });
        
        this.unsubscribers.push(unsubscribe1, unsubscribe2);
    }

    /**
     * グローバルなオーディオコンテキスト再開の設定
     * 最初のユーザーインタラクションでオーディオコンテキストを確実に開始する
     */
    private setupGlobalAudioContextResumption(): void {
        const resumeAudioOnInteraction = () => {
            this.audio.resumeAudioContext();
            // 一度実行したらイベントリスナーを削除
            document.removeEventListener('click', resumeAudioOnInteraction);
            document.removeEventListener('touchstart', resumeAudioOnInteraction);
            document.removeEventListener('keydown', resumeAudioOnInteraction);
        };

        document.addEventListener('click', resumeAudioOnInteraction);
        document.addEventListener('touchstart', resumeAudioOnInteraction);
        document.addEventListener('keydown', resumeAudioOnInteraction);
    }

    /**
     * キャンバスのリサイズ
     */
    private resizeCanvas(): void {
        if (!this.canvas) return;
        
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const maxSize = 400;
        const targetSize = Math.min(vw * 0.8, vh * 0.8, maxSize);
        const dpr = window.devicePixelRatio || 1;
        const canvasSize = Math.floor(targetSize * dpr);
        
        this.canvas.width = canvasSize;
        this.canvas.height = canvasSize;
        this.canvas.style.width = targetSize + 'px';
        this.canvas.style.height = targetSize + 'px';
        
        if (import.meta.env.DEV) {
            console.log(`Canvas resized: ${targetSize}px (canvas: ${canvasSize}px, dpr: ${dpr})`);
        }
    }

    /**
     * 更新ループの設定
     */
    private setupUpdateLoop(): void {
        this.updateIntervalId = window.setInterval(() => {
            this.updateDetection();
        }, 100);
    }

    /**
     * アニメーションの開始
     */
    private startAnimation(): void {
        const animate = () => {
            this.draw();
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    }

    /**
     * 検出状態の更新
     */
    private updateDetection(): void {
        const moonData = this.stateManager.get('moonData');
        const deviceOrientation = this.stateManager.get('deviceOrientation');
        
        if (!moonData || deviceOrientation.alpha === null || deviceOrientation.beta === null) {
            return;
        }

        const deviceElevation = this.calculateDeviceElevation(deviceOrientation.beta);
        const angleDiff = this.calculateAngleDifference(
            deviceOrientation.alpha,
            deviceElevation,
            moonData.azimuth,
            moonData.altitude
        );

        this.updateCompassDetector(angleDiff, moonData.altitude);
    }

    /**
     * コンパス検出器の更新
     */
    public updateCompassDetector(totalAngleDiff: number, clampedMoonAltitude: number): void {
        const now = Date.now();
        
        // 角度差の平滑化（急激な変化を抑制）
        this.angleDiffHistory.push(totalAngleDiff);
        if (this.angleDiffHistory.length > this.ANGLE_DIFF_HISTORY_SIZE) {
            this.angleDiffHistory.shift();
        }
        
        // 平均を計算してスムーズな角度差を取得
        const smoothedAngleDiff = this.angleDiffHistory.reduce((sum, val) => sum + val, 0) / this.angleDiffHistory.length;
        
        // 角度差に基づく磁場強度計算（平滑化された値を使用）
        const maxDetectionAngle = 120;
        const normalizedDiff = Math.max(0, Math.min(1, 1 - (smoothedAngleDiff / maxDetectionAngle)));
        
        // 月の高度による強度補正
        const altitudeBonus = Math.max(0, clampedMoonAltitude / 90) * 0.3;
        const baseField = normalizedDiff + altitudeBonus;
        
        // 感度による調整
        this.compassState.magneticField = Math.min(1, baseField * (this.compassState.sensitivity / 5));
        
        // 検知レベルの決定（ヒステリシス付き）- 平滑化された角度差を使用
        const currentLevel = this.compassState.detectionLevel;
        let newLevel: CompassState['detectionLevel'];
        
        // ヒステリシス幅（状態変更を安定化）
        const hysteresis = 5; // 度
        
        if (smoothedAngleDiff <= 3) {
            newLevel = 'locked';
        } else if (smoothedAngleDiff <= 15 + (currentLevel === 'locked' ? hysteresis : 0)) {
            newLevel = 'strong';
        } else if (smoothedAngleDiff <= 45 + (currentLevel === 'strong' ? hysteresis : 0)) {
            newLevel = 'weak';
        } else {
            newLevel = 'searching';
        }
        
        // レベル変更時のログ出力（開発モードのみ）
        if (import.meta.env.DEV && newLevel !== currentLevel) {
            console.log(`検知レベル変更: ${currentLevel} → ${newLevel} (平滑化角度差: ${smoothedAngleDiff.toFixed(1)}°, 生角度差: ${totalAngleDiff.toFixed(1)}°)`);
        }
        
        this.compassState.detectionLevel = newLevel;
        
        // 音響フィードバック（平滑化された角度差を使用）
        if (now - this.compassState.lastTick > this.compassState.tickInterval) {
            const tickInterval = this.calculateTickInterval(smoothedAngleDiff);
            if (now - this.compassState.lastTick > tickInterval) {
                this.audio.playTick(this.compassState.magneticField, this.compassState.detectionLevel);
                this.compassState.lastTick = now;
            }
        }
    }

    /**
     * チック間隔の計算
     */
    private calculateTickInterval(angleDiff: number): number {
        if (angleDiff <= 3) return 200;
        if (angleDiff <= 15) return 500;
        if (angleDiff <= 45) return 1000;
        if (angleDiff <= 90) return 2000;
        return 3000;
    }

    /**
     * デバイス仰角の計算
     */
    private calculateDeviceElevation(beta: number): number {
        
        return beta;
    }

    /**
     * 角度差の計算
     */
    private calculateAngleDifference(
        deviceAzimuth: number,
        deviceAltitude: number,
        moonAzimuth: number,
        moonAltitude: number
    ): number {
        let azimuthDiff = Math.abs(deviceAzimuth - moonAzimuth);
        if (azimuthDiff > 180) {
            azimuthDiff = 360 - azimuthDiff;
        }
        
        const altitudeDiff = Math.abs(deviceAltitude - moonAltitude);
        return Math.sqrt(azimuthDiff * azimuthDiff + altitudeDiff * altitudeDiff);
    }

    /**
     * 針の長さ計算（コンパス半径ベース）
     */
    private calculateNeedleLength(altitude: number, compassRadius: number): number {
        const maxLength = compassRadius; // 最大長100%（高度90°）
        const minLength = compassRadius * 0.2; // 最小長20%（高度-90°）
        
        const clampedAltitude = Math.max(-90, Math.min(90, altitude));
        const normalizedAltitude = (clampedAltitude + 90) / 180;
        const calculatedLength = minLength + (maxLength - minLength) * normalizedAltitude;
        
        return calculatedLength;
    }

    /**
     * コンパスの描画
     */
    private draw(): void {
        if (!this.canvas) return;
        
        const ctx = this.canvas.getContext('2d');
        if (!ctx) return;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const compassRadius = Math.min(width, height) * 0.4;
        
        // 最外層装飾の半径を計算（コンパスリングと一致）
        const outerOffset = compassRadius * 0.05;
        const outerDecorationRadius = compassRadius + outerOffset;
        
        // 荘厳なアンティーク風背景（最外層装飾と同じ大きさ）
        const backgroundGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, outerDecorationRadius);
        backgroundGradient.addColorStop(0, '#2F1B14'); // ダークブラウン
        backgroundGradient.addColorStop(0.4, '#1A0F0A'); // より暗いブラウン
        backgroundGradient.addColorStop(0.8, '#0A0605'); // さらに暗く
        backgroundGradient.addColorStop(1, '#000000'); // アプリ背景と同じ純粋な黒
        
        ctx.fillStyle = backgroundGradient;
        ctx.fillRect(0, 0, width, height);
        
        this.drawCompassRing(ctx, centerX, centerY, compassRadius);
        this.drawDirectionMarks(ctx, centerX, centerY, compassRadius);
        this.drawHorizonLine(ctx, centerX, centerY, compassRadius);
        this.drawNeedles(ctx, centerX, centerY, compassRadius);
        this.drawCenter(ctx, centerX, centerY, compassRadius);
        this.drawMagneticField(ctx, centerX, centerY, compassRadius);
        // 検出レベルと月時刻表示は別コンポーネントに移行
    }

    /**
     * コンパスリングの描画（豪華なアンティーク風）
     */
    private drawCompassRing(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        // 多層の装飾リング構成
        this.drawOuterDecorations(ctx, centerX, centerY, compassRadius);
        this.drawMainFrame(ctx, centerX, centerY, compassRadius);
        this.drawInnerDecorations(ctx, centerX, centerY, compassRadius);
        this.drawDecorativeNotches(ctx, centerX, centerY, compassRadius);
        this.drawCelestialOrnaments(ctx, centerX, centerY, compassRadius);
    }

    /**
     * 外側装飾の描画（最外層）
     */
    private drawOuterDecorations(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        const outerOffset = compassRadius * 0.05;
        
        // 最外側のベベル効果リング
        const bevelGradient = ctx.createRadialGradient(centerX, centerY, compassRadius + outerOffset - 10, centerX, centerY, compassRadius + outerOffset + 10);
        bevelGradient.addColorStop(0, '#1a1a1a');
        bevelGradient.addColorStop(0.3, '#4a4a4a');
        bevelGradient.addColorStop(0.7, '#2a2a2a');
        bevelGradient.addColorStop(1, '#0a0a0a');
        
        ctx.strokeStyle = bevelGradient;
        ctx.lineWidth = Math.max(8, compassRadius * 0.04);
        ctx.beginPath();
        ctx.arc(centerX, centerY, compassRadius + outerOffset, 0, Math.PI * 2);
        ctx.stroke();
        
        // ハイライトリング
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
        ctx.lineWidth = Math.max(2, compassRadius * 0.01);
        ctx.beginPath();
        ctx.arc(centerX - 1, centerY - 1, compassRadius + outerOffset - 2, 0, Math.PI * 2);
        ctx.stroke();
    }

    /**
     * メインフレームの描画
     */
    private drawMainFrame(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        const ringThickness = compassRadius * 0.045;
        
        // 深い影効果
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = Math.max(6, ringThickness * 1.2);
        ctx.beginPath();
        ctx.arc(centerX + 3, centerY + 3, compassRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // メインの真鍮風グラデーション（より豪華に）
        const mainGradient = ctx.createLinearGradient(centerX - compassRadius, centerY - compassRadius, centerX + compassRadius, centerY + compassRadius);
        mainGradient.addColorStop(0, '#8B4513'); // サドルブラウン
        mainGradient.addColorStop(0.15, '#CD853F'); // ペルー
        mainGradient.addColorStop(0.35, '#DAA520'); // ゴールデンロッド
        mainGradient.addColorStop(0.5, '#FFD700'); // ゴールド
        mainGradient.addColorStop(0.65, '#FFA500'); // オレンジ
        mainGradient.addColorStop(0.85, '#FF8C00'); // ダークオレンジ
        mainGradient.addColorStop(1, '#B8860B'); // ダークゴールデンロッド
        
        ctx.strokeStyle = mainGradient;
        ctx.lineWidth = Math.max(6, ringThickness);
        ctx.beginPath();
        ctx.arc(centerX, centerY, compassRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // 上部ハイライト
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = Math.max(3, ringThickness * 0.5);
        ctx.beginPath();
        ctx.arc(centerX - 1, centerY - 2, compassRadius - 1, Math.PI * 0.8, Math.PI * 1.2);
        ctx.stroke();
    }

    /**
     * 内側装飾の描画
     */
    private drawInnerDecorations(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        const innerOffset1 = compassRadius * 0.06;
        const innerOffset2 = compassRadius * 0.12;
        
        // 第一内側リング（アンティークブロンズ）
        const innerGradient1 = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, compassRadius - innerOffset1);
        innerGradient1.addColorStop(0, '#F4A460'); // サンディブラウン
        innerGradient1.addColorStop(0.5, '#CD7F32'); // ブロンズ
        innerGradient1.addColorStop(1, '#8B4513'); // サドルブラウン
        
        ctx.strokeStyle = innerGradient1;
        ctx.lineWidth = Math.max(4, compassRadius * 0.025);
        ctx.beginPath();
        ctx.arc(centerX, centerY, compassRadius - innerOffset1, 0, Math.PI * 2);
        ctx.stroke();
        
        // 第二内側リング（より細い装飾）
        const innerGradient2 = ctx.createLinearGradient(centerX - compassRadius, centerY - compassRadius, centerX + compassRadius, centerY + compassRadius);
        innerGradient2.addColorStop(0, '#D2B48C'); // タン
        innerGradient2.addColorStop(0.5, '#DEB887'); // バーリーウッド
        innerGradient2.addColorStop(1, '#BC8F8F'); // ロージーブラウン
        
        ctx.strokeStyle = innerGradient2;
        ctx.lineWidth = Math.max(2, compassRadius * 0.015);
        ctx.beginPath();
        ctx.arc(centerX, centerY, compassRadius - innerOffset2, 0, Math.PI * 2);
        ctx.stroke();
        
        // エンボス効果の内側ハイライト
        ctx.strokeStyle = 'rgba(255, 248, 220, 0.3)';
        ctx.lineWidth = Math.max(1, compassRadius * 0.008);
        ctx.beginPath();
        ctx.arc(centerX - 0.5, centerY - 0.5, compassRadius - innerOffset2 + 1, 0, Math.PI * 2);
        ctx.stroke();
    }

    /**
     * 天体装飾の描画（星座風装飾）
     */
    private drawCelestialOrnaments(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        const ornamentRadius = compassRadius * 1.08;
        const starSize = compassRadius * 0.015;
        
        // 4つの主要方位に星の装飾
        const mainDirections = [0, 90, 180, 270]; // N, E, S, W
        
        for (const angle of mainDirections) {
            const radian = (angle - 90) * Math.PI / 180;
            const x = centerX + Math.cos(radian) * ornamentRadius;
            const y = centerY + Math.sin(radian) * ornamentRadius;
            
            this.drawOrnamentalStar(ctx, x, y, starSize, angle);
        }
        
        // 8つの副方位に小さな装飾
        const subDirections = [45, 135, 225, 315]; // NE, SE, SW, NW
        
        for (const angle of subDirections) {
            const radian = (angle - 90) * Math.PI / 180;
            const x = centerX + Math.cos(radian) * (ornamentRadius * 0.95);
            const y = centerY + Math.sin(radian) * (ornamentRadius * 0.95);
            
            this.drawOrnamentalDiamond(ctx, x, y, starSize * 0.7);
        }
    }

    /**
     * 装飾的な星の描画
     */
    private drawOrnamentalStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number): void {
        const points = 8;
        const outerRadius = size;
        const innerRadius = size * 0.4;
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation * Math.PI / 180);
        
        // 星の影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / points;
            const px = Math.cos(angle) * radius + 1;
            const py = Math.sin(angle) * radius + 1;
            
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        
        // 星本体
        const starGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, outerRadius);
        starGradient.addColorStop(0, '#FFD700');
        starGradient.addColorStop(0.7, '#DAA520');
        starGradient.addColorStop(1, '#B8860B');
        
        ctx.fillStyle = starGradient;
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / points;
            const px = Math.cos(angle) * radius;
            const py = Math.sin(angle) * radius;
            
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        
        // ハイライト
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(-size * 0.2, -size * 0.2, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }

    /**
     * 装飾的なダイヤモンドの描画
     */
    private drawOrnamentalDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
        ctx.save();
        ctx.translate(x, y);
        
        // ダイヤモンドの影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.moveTo(1, -size + 1);
        ctx.lineTo(size + 1, 1);
        ctx.lineTo(1, size + 1);
        ctx.lineTo(-size + 1, 1);
        ctx.closePath();
        ctx.fill();
        
        // ダイヤモンド本体
        const diamondGradient = ctx.createLinearGradient(-size, -size, size, size);
        diamondGradient.addColorStop(0, '#F0E68C');
        diamondGradient.addColorStop(0.5, '#FFD700');
        diamondGradient.addColorStop(1, '#DAA520');
        
        ctx.fillStyle = diamondGradient;
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size, 0);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }

    /**
     * 装飾的な刻み線の描画（豪華版）
     */
    private drawDecorativeNotches(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        // メジャー刻み（15度間隔）
        this.drawMajorNotches(ctx, centerX, centerY, compassRadius);
        
        // マイナー刻み（5度間隔）
        this.drawMinorNotches(ctx, centerX, centerY, compassRadius);
        
        // マイクロ刻み（1度間隔、特定範囲のみ）
        this.drawMicroNotches(ctx, centerX, centerY, compassRadius);
    }

    /**
     * メジャー刻み線（15度間隔）
     */
    private drawMajorNotches(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        const notchCount = 24; // 15度間隔
        const notchLength = compassRadius * 0.04;
        const notchRadius = compassRadius * 0.94;
        const lineWidth = Math.max(2, compassRadius * 0.008);
        
        for (let i = 0; i < notchCount; i++) {
            if (i % 6 !== 0) { // 主要方位目盛りを避ける
                const angle = (i * 15 - 90) * Math.PI / 180;
                const x1 = centerX + Math.cos(angle) * notchRadius;
                const y1 = centerY + Math.sin(angle) * notchRadius;
                const x2 = centerX + Math.cos(angle) * (notchRadius - notchLength);
                const y2 = centerY + Math.sin(angle) * (notchRadius - notchLength);
                
                // 刻みの影
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.lineWidth = lineWidth * 1.5;
                ctx.beginPath();
                ctx.moveTo(x1 + 1, y1 + 1);
                ctx.lineTo(x2 + 1, y2 + 1);
                ctx.stroke();
                
                // メイン刻み
                const notchGradient = ctx.createLinearGradient(x2, y2, x1, y1);
                notchGradient.addColorStop(0, '#8B4513');
                notchGradient.addColorStop(0.5, '#CD853F');
                notchGradient.addColorStop(1, '#DAA520');
                
                ctx.strokeStyle = notchGradient;
                ctx.lineWidth = lineWidth;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
                ctx.lineCap = 'butt';
            }
        }
    }

    /**
     * マイナー刻み線（5度間隔）
     */
    private drawMinorNotches(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        const notchCount = 72; // 5度間隔
        const notchLength = compassRadius * 0.02;
        const notchRadius = compassRadius * 0.96;
        const lineWidth = Math.max(1, compassRadius * 0.004);
        
        for (let i = 0; i < notchCount; i++) {
            if (i % 18 !== 0 && i % 6 !== 0) { // メジャー刻みと主要方位を避ける
                const angle = (i * 5 - 90) * Math.PI / 180;
                const x1 = centerX + Math.cos(angle) * notchRadius;
                const y1 = centerY + Math.sin(angle) * notchRadius;
                const x2 = centerX + Math.cos(angle) * (notchRadius - notchLength);
                const y2 = centerY + Math.sin(angle) * (notchRadius - notchLength);
                
                ctx.strokeStyle = 'rgba(139, 69, 19, 0.7)';
                ctx.lineWidth = lineWidth;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        }
    }

    /**
     * マイクロ刻み線（1度間隔、主要方位周辺のみ）
     */
    private drawMicroNotches(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        const mainDirections = [0, 90, 180, 270]; // N, E, S, W
        const notchLength = compassRadius * 0.01;
        const notchRadius = compassRadius * 0.97;
        const lineWidth = Math.max(0.5, compassRadius * 0.002);
        
        for (const mainDir of mainDirections) {
            for (let offset = -10; offset <= 10; offset++) {
                if (offset % 5 !== 0) { // 5度刻みを避ける
                    const angle = (mainDir + offset - 90) * Math.PI / 180;
                    const x1 = centerX + Math.cos(angle) * notchRadius;
                    const y1 = centerY + Math.sin(angle) * notchRadius;
                    const x2 = centerX + Math.cos(angle) * (notchRadius - notchLength);
                    const y2 = centerY + Math.sin(angle) * (notchRadius - notchLength);
                    
                    ctx.strokeStyle = 'rgba(139, 69, 19, 0.4)';
                    ctx.lineWidth = lineWidth;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }
            }
        }
    }

    /**
     * 方位目盛りの描画（豪華なクラシック風NSEW）
     */
    private drawDirectionMarks(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        const directions = ['N', 'E', 'S', 'W']; // 標準方位（N, E, S, W）
        
        // スケール比率をコンパス半径ベースで計算
        const markOuterOffset = compassRadius * 0.005;
        const mainMarkLength = compassRadius * 0.15; // より長い主要方位マーク
        const midMarkLength = compassRadius * 0.11;
        const minorMarkLength = compassRadius * 0.07;
        const labelOffset = compassRadius * 0.25; // より外側にラベル配置
        
        // ライン幅もコンパス半径ベースで計算
        const mainLineWidth = Math.max(4, compassRadius * 0.022); // より太い主要ライン
        const midLineWidth = Math.max(3, compassRadius * 0.015);
        const minorLineWidth = Math.max(1.5, compassRadius * 0.008);
        
        // フォントサイズをコンパス半径ベースで計算
        const fontSize = Math.max(28, compassRadius * 0.16); // より大きなフォント
        
        // 背景の古紙風パターン
        this.drawAntiquePaperBackground(ctx, centerX, centerY, compassRadius * 0.85);
        
        for (let angle = 0; angle < 360; angle += 10) {
            const radian = (angle - 90) * Math.PI / 180;
            const isMainDirection = angle % 90 === 0;
            const isMidDirection = angle % 30 === 0;
            
            const outerRadius = compassRadius - markOuterOffset;
            const innerRadius = isMainDirection ? compassRadius - mainMarkLength : 
                               isMidDirection ? compassRadius - midMarkLength : compassRadius - minorMarkLength;
            
            const x1 = centerX + Math.cos(radian) * outerRadius;
            const y1 = centerY + Math.sin(radian) * outerRadius;
            const x2 = centerX + Math.cos(radian) * innerRadius;
            const y2 = centerY + Math.sin(radian) * innerRadius;
            
            // 影の描画
            if (isMainDirection || isMidDirection) {
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.lineWidth = (isMainDirection ? mainLineWidth : midLineWidth) * 1.5;
                ctx.beginPath();
                ctx.moveTo(x1 + 2, y1 + 2);
                ctx.lineTo(x2 + 2, y2 + 2);
                ctx.stroke();
            }
            
            // グラデーション色を設定
            const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
            if (isMainDirection) {
                gradient.addColorStop(0, '#FFD700');
                gradient.addColorStop(0.3, '#FFA500');
                gradient.addColorStop(0.7, '#DAA520');
                gradient.addColorStop(1, '#B8860B');
            } else if (isMidDirection) {
                gradient.addColorStop(0, '#F4A460');
                gradient.addColorStop(0.5, '#CD853F');
                gradient.addColorStop(1, '#A0522D');
            } else {
                gradient.addColorStop(0, '#DEB887');
                gradient.addColorStop(1, '#8B4513');
            }
            
            ctx.strokeStyle = gradient;
            ctx.lineWidth = isMainDirection ? mainLineWidth : isMidDirection ? midLineWidth : minorLineWidth;
            
            // 装飾的な先端
            if (isMainDirection) {
                ctx.lineCap = 'round';
                // 主要方位の矢印先端
                this.drawDirectionArrowHead(ctx, x2, y2, radian, compassRadius * 0.03);
            } else if (isMidDirection) {
                ctx.lineCap = 'round';
            }
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.lineCap = 'butt'; // リセット
            
            // 主要方位ラベル（NSEW）
            if (isMainDirection) {
                const labelRadius = compassRadius - labelOffset;
                const labelX = centerX + Math.cos(radian) * labelRadius;
                const labelY = centerY + Math.sin(radian) * labelRadius;
                const directionIndex = angle / 90;
                
                this.drawDirectionLabel(ctx, labelX, labelY, directions[directionIndex], fontSize);
            }
        }
    }

    /**
     * 方位マーク用矢印先端の描画
     */
    private drawDirectionArrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number): void {
        const arrowAngle = Math.PI / 6; // 30度
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle + Math.PI);
        
        const gradient = ctx.createLinearGradient(-size, 0, size, 0);
        gradient.addColorStop(0, '#FFD700');
        gradient.addColorStop(1, '#B8860B');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-size * Math.cos(arrowAngle), -size * Math.sin(arrowAngle));
        ctx.lineTo(-size * Math.cos(arrowAngle), size * Math.sin(arrowAngle));
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }

    /**
     * 方位ラベルの描画（シンプルで洗練されたスタイル）
     */
    private drawDirectionLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, fontSize: number): void {
        const fontFamily = 'serif';
        
        // 深い影を描画（より控えめに）
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.font = `bold ${fontSize}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + 1.5, y + 1.5);
        
        // アウトライン（より細く）
        ctx.strokeStyle = '#4A4A4A';
        ctx.lineWidth = Math.max(1, fontSize * 0.05);
        ctx.strokeText(text, x, y);
        
        // メイン文字（よりエレガントな色）
        const gradient = ctx.createLinearGradient(x, y - fontSize/2, x, y + fontSize/2);
        gradient.addColorStop(0, '#F5DEB3'); // ウィート
        gradient.addColorStop(0.3, '#DDD8C7'); // ライトベージュ
        gradient.addColorStop(0.7, '#C9B683'); // ゴールデンタン
        gradient.addColorStop(1, '#B8860B'); // ダークゴールデンロッド
        
        ctx.fillStyle = gradient;
        ctx.fillText(text, x, y);
        
        // 控えめなハイライト
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.font = `bold ${fontSize * 0.9}px ${fontFamily}`;
        ctx.fillText(text, x - 0.5, y - 0.5);
    }

    /**
     * アンティーク紙風背景の描画（強化版）
     */
    private drawAntiquePaperBackground(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number): void {
        // 古紙風の放射状グラデーション
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, 'rgba(245, 245, 220, 0.15)'); // ベージュ（より濃く）
        gradient.addColorStop(0.3, 'rgba(222, 184, 135, 0.1)'); // バーリーウッド
        gradient.addColorStop(0.7, 'rgba(160, 82, 45, 0.06)'); // サドルブラウン
        gradient.addColorStop(1, 'rgba(139, 69, 19, 0.03)'); // より暗いブラウン
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 古地図風の装飾線（より多く）
        ctx.strokeStyle = 'rgba(139, 69, 19, 0.08)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 16; i++) {
            const angle = (i * 22.5) * Math.PI / 180;
            const innerR = radius * 0.2;
            const outerR = radius * 0.95;
            
            ctx.beginPath();
            ctx.moveTo(centerX + Math.cos(angle) * innerR, centerY + Math.sin(angle) * innerR);
            ctx.lineTo(centerX + Math.cos(angle) * outerR, centerY + Math.sin(angle) * outerR);
            ctx.stroke();
        }
        
        // 同心円の装飾
        for (let r = radius * 0.3; r < radius; r += radius * 0.15) {
            ctx.strokeStyle = `rgba(139, 69, 19, ${0.05 * (1 - r / radius)})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    /**
     * 地平線の描画（装飾的）
     */
    private drawHorizonLine(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        const horizonRadius = compassRadius * 0.6;
        const dashLength = compassRadius * 0.03;
        const lineWidth = Math.max(2, compassRadius * 0.006);
        
        // 装飾的な地平線（二重線）
        ctx.strokeStyle = 'rgba(218, 165, 32, 0.4)'; // ゴールデンロッド
        ctx.lineWidth = lineWidth;
        ctx.setLineDash([dashLength, dashLength * 0.5]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, horizonRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // 内側の地平線
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = lineWidth * 0.5;
        ctx.setLineDash([dashLength * 0.7, dashLength * 0.3]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, horizonRadius - 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    /**
     * 針の描画（クラシック風装飾針）
     */
    private drawNeedles(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        const deviceOrientation = this.stateManager.get('deviceOrientation');
        const moonData = this.currentMoonData || this.stateManager.get('moonData');
        
        if (import.meta.env.DEV) {
            console.log('Drawing needles - deviceOrientation:', deviceOrientation, 'moonData:', moonData);
            console.log('コンパス半径:', compassRadius.toFixed(1), 'px');
        }
        
        // デバイス針（装飾的なクラシック針）
        if (deviceOrientation && deviceOrientation.alpha !== null && deviceOrientation.beta !== null) {
            const deviceElevation = this.calculateDeviceElevation(deviceOrientation.beta);
            const deviceNeedleLength = this.calculateNeedleLength(deviceElevation, compassRadius);
            const deviceNeedleAngle = (deviceOrientation.alpha - 90) * Math.PI / 180;
            
            this.drawClassicNeedle(ctx, centerX, centerY, deviceNeedleAngle, deviceNeedleLength, 'device', compassRadius);
        }
        
        // 月針（より装飾的な月針）
        if (moonData) {
            const moonNeedleLength = this.calculateNeedleLength(moonData.altitude, compassRadius);
            const moonNeedleAngle = (moonData.azimuth - 90) * Math.PI / 180;
            
            this.drawClassicNeedle(ctx, centerX, centerY, moonNeedleAngle, moonNeedleLength, 'moon', compassRadius);
            
            // 月の先端装飾
            if (moonNeedleLength > compassRadius * 0.1) {
                const tipX = centerX + Math.cos(moonNeedleAngle) * moonNeedleLength;
                const tipY = centerY + Math.sin(moonNeedleAngle) * moonNeedleLength;
                const tipRadius = Math.max(compassRadius * 0.08, compassRadius * 0.1);
                
                this.drawMoonOrnament(ctx, tipX, tipY, tipRadius, moonData);
            }
        }
    }

    /**
     * クラシック風装飾針の描画
     */
    private drawClassicNeedle(
        ctx: CanvasRenderingContext2D, 
        centerX: number, 
        centerY: number, 
        angle: number, 
        length: number, 
        type: 'device' | 'moon',
        compassRadius: number
    ): void {
        const needleWidth = compassRadius * (type === 'device' ? 0.025 : 0.02);
        const arrowHeadLength = compassRadius * 0.08;
        const arrowHeadWidth = compassRadius * 0.04;
        const shadowOffset = 3;
        
        // 針の先端と基部の座標
        const tipX = centerX + Math.cos(angle) * length;
        const tipY = centerY + Math.sin(angle) * length;
        const baseX = centerX - Math.cos(angle) * (compassRadius * 0.15);
        const baseY = centerY - Math.sin(angle) * (compassRadius * 0.15);
        
        // 影の描画
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = needleWidth * 1.5;
        ctx.beginPath();
        ctx.moveTo(baseX + shadowOffset, baseY + shadowOffset);
        ctx.lineTo(tipX + shadowOffset, tipY + shadowOffset);
        ctx.stroke();
        
        // 針本体のグラデーション
        const gradient = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
        if (type === 'device') {
            gradient.addColorStop(0, '#B22222'); // ファイアブリック
            gradient.addColorStop(0.3, '#DC143C'); // クリムゾン
            gradient.addColorStop(0.7, '#FF6347'); // トマト
            gradient.addColorStop(1, '#FF0000'); // レッド
        } else {
            gradient.addColorStop(0, '#B8860B'); // ダークゴールデンロッド
            gradient.addColorStop(0.3, '#DAA520'); // ゴールデンロッド
            gradient.addColorStop(0.7, '#FFD700'); // ゴールド
            gradient.addColorStop(1, '#FFFF00'); // イエロー
        }
        
        // 針本体
        ctx.strokeStyle = gradient;
        ctx.lineWidth = needleWidth;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        
        // 装飾的な矢尻
        this.drawArrowHead(ctx, tipX, tipY, angle, arrowHeadLength, arrowHeadWidth, type);
        
        // 針の基部装飾
        this.drawNeedleBase(ctx, baseX, baseY, compassRadius * 0.02, type);
        
        ctx.lineCap = 'butt'; // リセット
    }

    /**
     * 装飾的な矢尻の描画
     */
    private drawArrowHead(
        ctx: CanvasRenderingContext2D,
        tipX: number,
        tipY: number,
        angle: number,
        length: number,
        _width: number, // 未使用だが型の一貫性のため保持
        type: 'device' | 'moon'
    ): void {
        const leftAngle = angle - Math.PI * 0.85;
        const rightAngle = angle + Math.PI * 0.85;
        
        const leftX = tipX + Math.cos(leftAngle) * length;
        const leftY = tipY + Math.sin(leftAngle) * length;
        const rightX = tipX + Math.cos(rightAngle) * length;
        const rightY = tipY + Math.sin(rightAngle) * length;
        
        // 矢尻のグラデーション
        const gradient = ctx.createLinearGradient(leftX, leftY, rightX, rightY);
        if (type === 'device') {
            gradient.addColorStop(0, '#8B0000'); // ダークレッド
            gradient.addColorStop(0.5, '#DC143C'); // クリムゾン
            gradient.addColorStop(1, '#8B0000'); // ダークレッド
        } else {
            gradient.addColorStop(0, '#B8860B'); // ダークゴールデンロッド
            gradient.addColorStop(0.5, '#FFD700'); // ゴールド
            gradient.addColorStop(1, '#B8860B'); // ダークゴールデンロッド
        }
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(leftX, leftY);
        ctx.lineTo(rightX, rightY);
        ctx.closePath();
        ctx.fill();
        
        // 矢尻の縁取り
        ctx.strokeStyle = type === 'device' ? '#4B0000' : '#8B6914';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    /**
     * 針の基部装飾の描画
     */
    private drawNeedleBase(
        ctx: CanvasRenderingContext2D,
        baseX: number,
        baseY: number,
        radius: number,
        type: 'device' | 'moon'
    ): void {
        // 基部の円形装飾
        const gradient = ctx.createRadialGradient(baseX, baseY, 0, baseX, baseY, radius);
        if (type === 'device') {
            gradient.addColorStop(0, '#FF6347');
            gradient.addColorStop(1, '#8B0000');
        } else {
            gradient.addColorStop(0, '#FFD700');
            gradient.addColorStop(1, '#B8860B');
        }
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(baseX, baseY, radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = type === 'device' ? '#4B0000' : '#8B6914';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    /**
     * 月の装飾的な先端
     */
    private drawMoonOrnament(
        ctx: CanvasRenderingContext2D,
        tipX: number,
        tipY: number,
        radius: number,
        moonData: MoonData
    ): void {
        // 装飾的な背景円
        const bgGradient = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, radius * 1.3);
        bgGradient.addColorStop(0, 'rgba(255, 215, 0, 0.6)');
        bgGradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
        
        ctx.fillStyle = bgGradient;
        ctx.beginPath();
        ctx.arc(tipX, tipY, radius * 1.3, 0, Math.PI * 2);
        ctx.fill();
        
        // 月相の描画
        drawMoonPhaseSmall(ctx, tipX, tipY, radius, moonData);
        
        // 装飾的な縁取り
        ctx.strokeStyle = '#B8860B';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tipX, tipY, radius, 0, Math.PI * 2);
        ctx.stroke();
    }

    /**
     * 中心点の描画（装飾的なアンティーク風）
     */
    private drawCenter(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        const outerRadius = Math.max(12, compassRadius * 0.06); // より大きな外側半径
        const middleRadius = Math.max(9, compassRadius * 0.045); // 中間半径
        const innerRadius = Math.max(6, compassRadius * 0.03); // 内側半径
        const coreRadius = Math.max(3, compassRadius * 0.015); // コア半径
        
        // 外側装飾リング（真鍮風）
        const outerGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, outerRadius);
        outerGradient.addColorStop(0, '#FFD700'); // ゴールド
        outerGradient.addColorStop(0.7, '#DAA520'); // ゴールデンロッド
        outerGradient.addColorStop(1, '#B8860B'); // ダークゴールデンロッド
        
        ctx.fillStyle = outerGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // 装飾的な刻み線
        ctx.strokeStyle = '#8B6914';
        ctx.lineWidth = 1;
        for (let i = 0; i < 12; i++) {
            const angle = (i * 30) * Math.PI / 180;
            const startR = outerRadius * 0.8;
            const endR = outerRadius * 0.95;
            
            const x1 = centerX + Math.cos(angle) * startR;
            const y1 = centerY + Math.sin(angle) * startR;
            const x2 = centerX + Math.cos(angle) * endR;
            const y2 = centerY + Math.sin(angle) * endR;
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        
        // 中間リング（ブロンズ風）
        const middleGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, middleRadius);
        middleGradient.addColorStop(0, '#CD853F'); // ペルー
        middleGradient.addColorStop(0.5, '#DEB887'); // バーリーウッド
        middleGradient.addColorStop(1, '#A0522D'); // サドルブラウン
        
        ctx.fillStyle = middleGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, middleRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // 内側リング（暗い真鍮）
        const innerGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, innerRadius);
        innerGradient.addColorStop(0, '#B8860B'); // ダークゴールデンロッド
        innerGradient.addColorStop(1, '#8B6914'); // オリーブドラブ
        
        ctx.fillStyle = innerGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // コア（最内部）
        ctx.fillStyle = '#4B0000'; // ダークレッド
        ctx.beginPath();
        ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // 中央のジュエル風装飾
        this.drawCentralJewel(ctx, centerX, centerY, coreRadius * 1.5);
        
        // 外枠の縁取り
        ctx.strokeStyle = '#654321'; // ダークブラウン
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // 最上部のハイライト
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(centerX - 2, centerY - 2, outerRadius * 0.4, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * 中央のジュエル風装飾の描画
     */
    private drawCentralJewel(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number): void {
        // ベース（ダークレッド）
        const baseGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        baseGradient.addColorStop(0, '#8B0000');
        baseGradient.addColorStop(0.7, '#4B0000');
        baseGradient.addColorStop(1, '#2B0000');
        
        ctx.fillStyle = baseGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // ジュエル効果
        const jewelGradient = ctx.createRadialGradient(centerX - radius * 0.3, centerY - radius * 0.3, 0, centerX, centerY, radius);
        jewelGradient.addColorStop(0, 'rgba(255, 100, 100, 0.8)');
        jewelGradient.addColorStop(0.4, 'rgba(200, 50, 50, 0.6)');
        jewelGradient.addColorStop(1, 'rgba(139, 0, 0, 0.9)');
        
        ctx.fillStyle = jewelGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.8, 0, Math.PI * 2);
        ctx.fill();
        
        // 輝き効果
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(centerX - radius * 0.4, centerY - radius * 0.4, radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // 小さな輝き
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(centerX + radius * 0.2, centerY - radius * 0.3, radius * 0.15, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * 磁場可視化の描画（神秘的なエフェクト）
     */
    private drawMagneticField(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        if (this.compassState.magneticField > 0) {
            const intensity = this.compassState.magneticField;
            const glowRadius = compassRadius + (compassRadius * 0.08);
            
            // 多層グロー効果
            const layers = [
                { radius: glowRadius, alpha: intensity * 0.2, color: '255, 215, 0' }, // ゴールド
                { radius: glowRadius * 0.8, alpha: intensity * 0.3, color: '218, 165, 32' }, // ゴールデンロッド
                { radius: glowRadius * 0.6, alpha: intensity * 0.4, color: '184, 134, 11' }, // ダークゴールデンロッド
            ];
            
            layers.forEach(layer => {
                const gradient = ctx.createRadialGradient(centerX, centerY, compassRadius * 0.7, centerX, centerY, layer.radius);
                gradient.addColorStop(0, `rgba(${layer.color}, ${layer.alpha})`);
                gradient.addColorStop(0.5, `rgba(${layer.color}, ${layer.alpha * 0.5})`);
                gradient.addColorStop(1, `rgba(${layer.color}, 0)`);
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(centerX, centerY, layer.radius, 0, Math.PI * 2);
                ctx.fill();
            });
        }
        
        // 神秘的なエネルギー粒子
        const particleCount = Math.floor(this.compassState.magneticField * compassRadius * 0.12);
        const time = Date.now() * 0.001; // アニメーション用時間
        
        for (let i = 0; i < particleCount; i++) {
            const angleOffset = (i / particleCount) * Math.PI * 2;
            const radiusVariation = Math.sin(time * 2 + i) * 0.1 + 0.9;
            const distance = (compassRadius * 0.4 + Math.sin(time + i) * compassRadius * 0.2) * radiusVariation;
            const angle = angleOffset + time * 0.5;
            
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            const particleSize = Math.max(1.5, compassRadius * 0.006) * (0.5 + Math.sin(time * 3 + i) * 0.5);
            const alpha = 0.3 + Math.sin(time * 4 + i) * 0.4;
            
            // パーティクルのグラデーション
            const particleGradient = ctx.createRadialGradient(x, y, 0, x, y, particleSize);
            particleGradient.addColorStop(0, `rgba(255, 215, 0, ${alpha})`);
            particleGradient.addColorStop(1, `rgba(255, 215, 0, 0)`);
            
            ctx.fillStyle = particleGradient;
            ctx.beginPath();
            ctx.arc(x, y, particleSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /**
     * コンパス状態の取得
     */
    getCompassState(): Readonly<CompassState> {
        return { ...this.compassState };
    }

    /**
     * コンパス表示の描画（外部から呼び出し可能）
     */
    public drawCompass(canvas: HTMLCanvasElement, moonData: MoonData | null): void {
        this.canvas = canvas;
        this.currentMoonData = moonData;
        this.draw();
    }

    /**
     * オーディオボリュームを設定
     */
    public setVolume(volume: number): void {
        this.audio.setVolume(volume);
    }

    /**
     * オーディオのミュート設定
     */
    public setMuted(muted: boolean): void {
        this.audio.setMuted(muted);
    }

    /**
     * 感度を設定
     */
    public setSensitivity(sensitivity: number): void {
        this.compassState.sensitivity = sensitivity;
    }

    /**
     * リソースのクリーンアップ
     */
    destroy(): void {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        if (this.updateIntervalId) {
            clearInterval(this.updateIntervalId);
            this.updateIntervalId = null;
        }
        
        this.unsubscribers.forEach(unsubscribe => unsubscribe());
        this.unsubscribers = [];
        
        console.log('🧹 CompassManager をクリーンアップしました');
    }
}

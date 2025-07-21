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
    detectionLevel: 'calibrating' | 'searching' | 'weak' | 'strong' | 'locked';
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

        try {
            const now = this.audioContext.currentTime;
            
            let baseFreq = 200;
            let duration = 0.1;
            
            switch (detectionLevel) {
                case 'calibrating': baseFreq = 150; duration = 0.05; break;
                case 'searching': baseFreq = 200; duration = 0.08; break;
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
        detectionLevel: 'calibrating'
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
        
        console.log(`Canvas resized: ${targetSize}px (canvas: ${canvasSize}px, dpr: ${dpr})`);
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
        } else if (smoothedAngleDiff <= 90 + (currentLevel === 'weak' ? hysteresis : 0)) {
            newLevel = 'searching';
        } else {
            newLevel = 'calibrating';
        }
        
        // レベル変更時のログ出力（デバッグ用）
        if (newLevel !== currentLevel) {
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
        let elevation = 0;
        
        // デバッグログ追加
        console.log(`デバイス仰角計算: 入力beta=${beta.toFixed(1)}°`);
        
        if (beta >= -30 && beta <= 30) {
            elevation = beta;
        } else if (beta > 30 && beta <= 90) {
            elevation = 90 - beta;
        } else if (beta > 90 && beta <= 150) {
            elevation = beta - 90;
        } else if (beta > 150 && beta <= 180) {
            elevation = 180 - beta;
        } else if (beta < -30 && beta >= -90) {
            elevation = -90 - beta;
        } else if (beta < -90 && beta >= -150) {
            elevation = beta + 90;
        } else if (beta < -150 && beta >= -180) {
            elevation = -180 - beta;
        }
        
        const clampedElevation = Math.max(-90, Math.min(90, elevation));
        console.log(`デバイス仰角計算結果: elevation=${elevation.toFixed(1)}°, clamped=${clampedElevation.toFixed(1)}°`);
        
        return clampedElevation;
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
        
        // デバッグログ追加
        console.log(`針の長さ計算: 高度=${altitude.toFixed(1)}°, クランプ後=${clampedAltitude.toFixed(1)}°, 正規化=${normalizedAltitude.toFixed(3)}, 長さ=${calculatedLength.toFixed(1)}px (半径=${compassRadius.toFixed(1)}px)`);
        
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
        
        // 背景クリア
        ctx.fillStyle = '#1a0f0a';
        ctx.fillRect(0, 0, width, height);
        
        this.drawCompassRing(ctx, centerX, centerY, compassRadius);
        this.drawDirectionMarks(ctx, centerX, centerY, compassRadius);
        this.drawHorizonLine(ctx, centerX, centerY, compassRadius);
        this.drawNeedles(ctx, centerX, centerY, compassRadius);
        this.drawCenter(ctx, centerX, centerY, compassRadius);
        this.drawMagneticField(ctx, centerX, centerY, compassRadius);
        this.drawDetectionLevel(ctx, centerX, centerY, compassRadius);
    }

    /**
     * コンパスリングの描画
     */
    private drawCompassRing(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        const ringThickness = compassRadius * 0.02; // 外枠の太さをさらに増加（1.5%→2%）
        const innerRingThickness = compassRadius * 0.012; // 内側リングの太さをさらに増加（0.8%→1.2%）
        const innerRingOffset = compassRadius * 0.06; // 内側リングのオフセットをさらに増加（5%→6%）
        
        // 外枠
        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = Math.max(3, ringThickness);
        ctx.beginPath();
        ctx.arc(centerX, centerY, compassRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // 内側リング
        ctx.strokeStyle = '#cd853f';
        ctx.lineWidth = Math.max(2, innerRingThickness);
        ctx.beginPath();
        ctx.arc(centerX, centerY, compassRadius - innerRingOffset, 0, Math.PI * 2);
        ctx.stroke();
    }

    /**
     * 方位目盛りの描画
     */
    private drawDirectionMarks(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        const directions = ['N', 'E', 'S', 'W'];
        
        // スケール比率をコンパス半径ベースで計算
        const markOuterOffset = compassRadius * 0.008; // 外側オフセットをさらに減少（1%→0.8%）
        const mainMarkLength = compassRadius * 0.1; // 主要方位マークの長さをさらに増加（8%→10%）
        const midMarkLength = compassRadius * 0.08; // 中間マークの長さをさらに増加（6.5%→8%）
        const minorMarkLength = compassRadius * 0.06; // 小さなマークの長さをさらに増加（5%→6%）
        const labelOffset = compassRadius * 0.13; // ラベルのオフセットをさらに増加（11%→13%）
        
        // ライン幅もコンパス半径ベースで計算
        const mainLineWidth = Math.max(2, compassRadius * 0.013); // 主要ラインをさらに太く（1%→1.3%）
        const midLineWidth = Math.max(1.5, compassRadius * 0.009); // 中間ラインをさらに太く（0.7%→0.9%）
        const minorLineWidth = Math.max(1, compassRadius * 0.005); // 小さなラインをさらに太く（0.4%→0.5%）
        
        // フォントサイズをコンパス半径ベースで計算
        const fontSize = Math.max(16, compassRadius * 0.08); // フォントサイズをさらに大幅増加（6%→8%）
        
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
            
            ctx.strokeStyle = isMainDirection ? '#daa520' : '#cd853f';
            ctx.lineWidth = isMainDirection ? mainLineWidth : isMidDirection ? midLineWidth : minorLineWidth;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            
            // 主要方位ラベル
            if (isMainDirection) {
                const labelRadius = compassRadius - labelOffset;
                const labelX = centerX + Math.cos(radian) * labelRadius;
                const labelY = centerY + Math.sin(radian) * labelRadius;
                const directionIndex = angle / 90;
                
                ctx.fillStyle = '#daa520';
                ctx.font = `bold ${fontSize}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(directions[directionIndex], labelX, labelY);
            }
        }
    }

    /**
     * 地平線の描画
     */
    private drawHorizonLine(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        const horizonRadius = compassRadius * 0.7; // コンパス半径の70%（65%→70%にさらに増加）
        const dashLength = compassRadius * 0.025; // ダッシュの長さをさらに増加（2%→2.5%）
        const lineWidth = Math.max(1.5, compassRadius * 0.005); // ライン幅をさらに増加（0.4%→0.5%）
        const labelOffset = compassRadius * 0.06; // ラベルオフセットをさらに増加（5%→6%）
        const fontSize = Math.max(12, compassRadius * 0.04); // フォントサイズをさらに増加（3.2%→4%）
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = lineWidth;
        ctx.setLineDash([dashLength, dashLength]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, horizonRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = `${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('地平線', centerX, centerY + horizonRadius + labelOffset);
    }

    /**
     * 針の描画
     */
    private drawNeedles(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        const deviceOrientation = this.stateManager.get('deviceOrientation');
        const moonData = this.currentMoonData || this.stateManager.get('moonData');
        
        // 針の太さをコンパス半径ベースで計算
        const deviceNeedleWidth = Math.max(4, compassRadius * 0.02); // デバイス針をさらに太く（1.5%→2%）
        const moonNeedleWidth = Math.max(3, compassRadius * 0.015); // 月針をさらに太く（1.2%→1.5%）
        const shadowOffset = compassRadius * 0.01; // 影のオフセットをさらに増加（0.8%→1%）
        const shadowWidth = deviceNeedleWidth * 1.5;
        
        console.log('Drawing needles - deviceOrientation:', deviceOrientation, 'moonData:', moonData);
        console.log('コンパス半径:', compassRadius.toFixed(1), 'px');
        
        // デバイス針
        if (deviceOrientation && deviceOrientation.alpha !== null && deviceOrientation.beta !== null) {
            const deviceElevation = this.calculateDeviceElevation(deviceOrientation.beta);
            const deviceNeedleLength = this.calculateNeedleLength(deviceElevation, compassRadius);
            const deviceNeedleAngle = (deviceOrientation.alpha - 90) * Math.PI / 180;
            
            console.log('デバイス針の描画:', {
                beta: deviceOrientation.beta.toFixed(1),
                elevation: deviceElevation.toFixed(1),
                needleLength: deviceNeedleLength.toFixed(1),
                angle: deviceNeedleAngle.toFixed(3)
            });
            
            // デバイス針の影
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = shadowWidth;
            ctx.beginPath();
            ctx.moveTo(centerX + shadowOffset, centerY + shadowOffset);
            ctx.lineTo(
                centerX + Math.cos(deviceNeedleAngle) * deviceNeedleLength + shadowOffset,
                centerY + Math.sin(deviceNeedleAngle) * deviceNeedleLength + shadowOffset
            );
            ctx.stroke();
            
            // デバイス針本体
            ctx.strokeStyle = '#dc143c';
            ctx.lineWidth = deviceNeedleWidth;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(
                centerX + Math.cos(deviceNeedleAngle) * deviceNeedleLength,
                centerY + Math.sin(deviceNeedleAngle) * deviceNeedleLength
            );
            ctx.stroke();
        }
        
        // 月針
        if (moonData) {
            const moonNeedleLength = this.calculateNeedleLength(moonData.altitude, compassRadius);
            const moonNeedleAngle = (moonData.azimuth - 90) * Math.PI / 180;
            
            console.log('月針の描画:', {
                azimuth: moonData.azimuth.toFixed(1),
                altitude: moonData.altitude.toFixed(1),
                needleLength: moonNeedleLength.toFixed(1),
                angle: moonNeedleAngle.toFixed(3)
            });
            
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = moonNeedleWidth;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(
                centerX + Math.cos(moonNeedleAngle) * moonNeedleLength,
                centerY + Math.sin(moonNeedleAngle) * moonNeedleLength
            );
            ctx.stroke();
            
            // 月の先端（最小サイズを設定）
            const minTipRadius = compassRadius * 0.07; // 月の先端サイズを大幅増加（5%→7%）
            if (moonNeedleLength > minTipRadius) {
                const tipX = centerX + Math.cos(moonNeedleAngle) * moonNeedleLength;
                const tipY = centerY + Math.sin(moonNeedleAngle) * moonNeedleLength;
                const tipRadius = Math.max(minTipRadius, compassRadius * 0.08); // 月の先端サイズを大幅増加（5.5%→8%）
                
                drawMoonPhaseSmall(ctx, tipX, tipY, tipRadius, moonData);
            }
        }
    }

    /**
     * 中心点の描画
     */
    private drawCenter(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        const outerRadius = Math.max(10, compassRadius * 0.05); // 外側半径をさらに増加（4%→5%）
        const innerRadius = Math.max(7, compassRadius * 0.032); // 内側半径をさらに増加（2.6%→3.2%）
        
        ctx.fillStyle = '#8b4513';
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#cd853f';
        ctx.beginPath();
        ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * 磁場可視化の描画
     */
    private drawMagneticField(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        if (this.compassState.magneticField > 0) {
            const intensity = this.compassState.magneticField;
            const glowRadius = compassRadius + (compassRadius * 0.05); // グローエフェクトの半径をコンパス半径ベースに
            
            const gradient = ctx.createRadialGradient(centerX, centerY, compassRadius, centerX, centerY, glowRadius);
            gradient.addColorStop(0, `rgba(255, 215, 0, ${intensity * 0.3})`);
            gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // ノイズ粒子（サイズをコンパス半径ベースに）
        const particleCount = Math.floor(this.compassState.magneticField * compassRadius * 0.1); // パーティクル数をさらに増加（8%→10%）
        const particleSize = Math.max(1.5, compassRadius * 0.005); // パーティクルサイズをさらに増加（0.4%→0.5%）
        
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = compassRadius * 0.3 + Math.random() * compassRadius * 0.4;
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            ctx.fillStyle = `rgba(255, 215, 0, ${Math.random() * 0.5})`;
            ctx.beginPath();
            ctx.arc(x, y, particleSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /**
     * 検出レベル表示
     */
    private drawDetectionLevel(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        const levelColors = {
            'calibrating': '#888888',
            'searching': '#4169e1',
            'weak': '#32cd32',
            'strong': '#ffd700',
            'locked': '#ff4500'
        };
        
        const levelNames = {
            'calibrating': '校正中',
            'searching': '探索中',
            'weak': '微弱検出',
            'strong': '強磁場',
            'locked': '月磁場！'
        };
        
        const fontSize = Math.max(14, compassRadius * 0.055); // フォントサイズをさらに増加（4.5%→5.5%）
        const textOffset = compassRadius * 0.1; // テキストオフセットをさらに増加（8%→10%）
        
        ctx.fillStyle = levelColors[this.compassState.detectionLevel];
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(levelNames[this.compassState.detectionLevel], centerX, centerY + compassRadius + textOffset);
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

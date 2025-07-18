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
        return Math.max(-90, Math.min(90, elevation));
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
     * 針の長さ計算
     */
    private calculateNeedleLength(altitude: number, compassRadius: number): number {
        const baseLength = compassRadius - 30;
        const maxLength = baseLength * 0.95;
        const minLength = baseLength * 0.3;
        
        const clampedAltitude = Math.max(-90, Math.min(90, altitude));
        const normalizedAltitude = (clampedAltitude + 90) / 180;
        
        return minLength + (maxLength - minLength) * normalizedAltitude;
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
        this.drawCenter(ctx, centerX, centerY);
        this.drawMagneticField(ctx, centerX, centerY, compassRadius);
        this.drawDetectionLevel(ctx, centerX, centerY, compassRadius);
    }

    /**
     * コンパスリングの描画
     */
    private drawCompassRing(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        // 外枠
        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(centerX, centerY, compassRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // 内側リング
        ctx.strokeStyle = '#cd853f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, compassRadius - 15, 0, Math.PI * 2);
        ctx.stroke();
    }

    /**
     * 方位目盛りの描画
     */
    private drawDirectionMarks(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        const directions = ['N', 'E', 'S', 'W'];
        
        for (let angle = 0; angle < 360; angle += 10) {
            const radian = (angle - 90) * Math.PI / 180;
            const isMainDirection = angle % 90 === 0;
            const isMidDirection = angle % 30 === 0;
            
            const outerRadius = compassRadius - 5;
            const innerRadius = isMainDirection ? compassRadius - 25 : 
                               isMidDirection ? compassRadius - 20 : compassRadius - 15;
            
            const x1 = centerX + Math.cos(radian) * outerRadius;
            const y1 = centerY + Math.sin(radian) * outerRadius;
            const x2 = centerX + Math.cos(radian) * innerRadius;
            const y2 = centerY + Math.sin(radian) * innerRadius;
            
            ctx.strokeStyle = isMainDirection ? '#daa520' : '#cd853f';
            ctx.lineWidth = isMainDirection ? 3 : isMidDirection ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            
            // 主要方位ラベル
            if (isMainDirection) {
                const labelRadius = compassRadius - 35;
                const labelX = centerX + Math.cos(radian) * labelRadius;
                const labelY = centerY + Math.sin(radian) * labelRadius;
                const directionIndex = angle / 90;
                
                ctx.fillStyle = '#daa520';
                ctx.font = 'bold 16px Arial';
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
        const horizonRadius = (compassRadius - 30) * 0.6;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, horizonRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('地平線', centerX, centerY + horizonRadius + 15);
    }

    /**
     * 針の描画
     */
    private drawNeedles(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        const deviceOrientation = this.stateManager.get('deviceOrientation');
        const moonData = this.currentMoonData || this.stateManager.get('moonData');
        
        console.log('Drawing needles - deviceOrientation:', deviceOrientation, 'moonData:', moonData);
        
        // デバイス針
        if (deviceOrientation && deviceOrientation.alpha !== null && deviceOrientation.beta !== null) {
            console.log('Drawing device needle with:', {
                alpha: deviceOrientation.alpha,
                beta: deviceOrientation.beta
            });
            
            const deviceElevation = this.calculateDeviceElevation(deviceOrientation.beta);
            const deviceNeedleLength = this.calculateNeedleLength(deviceElevation, compassRadius);
            const deviceNeedleAngle = (deviceOrientation.alpha - 90) * Math.PI / 180;
            
            console.log('Device needle calculations:', {
                elevation: deviceElevation,
                length: deviceNeedleLength,
                angle: deviceNeedleAngle
            });
            
            // デバイス針の影
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(centerX + 2, centerY + 2);
            ctx.lineTo(
                centerX + Math.cos(deviceNeedleAngle) * deviceNeedleLength + 2,
                centerY + Math.sin(deviceNeedleAngle) * deviceNeedleLength + 2
            );
            ctx.stroke();
            
            // デバイス針本体
            ctx.strokeStyle = '#dc143c';
            ctx.lineWidth = 4;
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
            console.log('Drawing moon needle with:', {
                azimuth: moonData.azimuth,
                altitude: moonData.altitude
            });
            
            const moonNeedleLength = this.calculateNeedleLength(moonData.altitude, compassRadius);
            const moonNeedleAngle = (moonData.azimuth - 90) * Math.PI / 180;
            
            console.log('Moon needle calculations:', {
                length: moonNeedleLength,
                angle: moonNeedleAngle
            });
            
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(
                centerX + Math.cos(moonNeedleAngle) * moonNeedleLength,
                centerY + Math.sin(moonNeedleAngle) * moonNeedleLength
            );
            ctx.stroke();
            
            // 月の先端
            if (moonNeedleLength > 10) {
                const tipX = centerX + Math.cos(moonNeedleAngle) * moonNeedleLength;
                const tipY = centerY + Math.sin(moonNeedleAngle) * moonNeedleLength;
                const tipRadius = 12;
                
                drawMoonPhaseSmall(ctx, tipX, tipY, tipRadius, moonData);
            }
        }
    }

    /**
     * 中心点の描画
     */
    private drawCenter(ctx: CanvasRenderingContext2D, centerX: number, centerY: number): void {
        ctx.fillStyle = '#8b4513';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 12, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#cd853f';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * 磁場可視化の描画
     */
    private drawMagneticField(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, compassRadius: number): void {
        if (this.compassState.magneticField > 0) {
            const intensity = this.compassState.magneticField;
            const glowRadius = compassRadius + 20;
            
            const gradient = ctx.createRadialGradient(centerX, centerY, compassRadius, centerX, centerY, glowRadius);
            gradient.addColorStop(0, `rgba(255, 215, 0, ${intensity * 0.3})`);
            gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // ノイズ粒子
        for (let i = 0; i < this.compassState.magneticField * 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = compassRadius * 0.3 + Math.random() * compassRadius * 0.4;
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            ctx.fillStyle = `rgba(255, 215, 0, ${Math.random() * 0.5})`;
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
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
        
        ctx.fillStyle = levelColors[this.compassState.detectionLevel];
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(levelNames[this.compassState.detectionLevel], centerX, centerY + compassRadius + 25);
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

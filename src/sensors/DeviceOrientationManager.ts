import { StateManager } from '../state/StateManager';

interface OrientationCorrection {
    isCalibrated: boolean;
    offsetAngle: number;
    isReversed: boolean;
    calibrationSamples: Array<{ alpha: number; timestamp: number }>;
    lastKnownTrueDirection: number | null;
}

export class DeviceOrientationManager {
    private static instance: DeviceOrientationManager;
    private stateManager: StateManager;
    private deviceOrientationElement: HTMLElement | null;
    private permissionButton: HTMLButtonElement | null;
    
    private deviceOrientation = {
        alpha: null as number | null,
        beta: null as number | null,
        gamma: null as number | null
    };

    private orientationCorrection: OrientationCorrection = {
        isCalibrated: false,
        offsetAngle: 0,
        isReversed: false,
        calibrationSamples: [],
        lastKnownTrueDirection: null
    };

    private currentEventType: 'deviceorientationabsolute' | 'deviceorientation' | null = null;
    private fallbackTimer: number | null = null;
    private nullValueCount = 0;
    private readonly MAX_NULL_VALUES = 10;
    private readonly CALIBRATION_SAMPLE_SIZE = 10;

    private constructor() {
        this.stateManager = StateManager.getInstance();
        this.deviceOrientationElement = document.getElementById('device-orientation');
        this.permissionButton = document.getElementById('permission-button') as HTMLButtonElement;
    }

    public static getInstance(): DeviceOrientationManager {
        if (!DeviceOrientationManager.instance) {
            DeviceOrientationManager.instance = new DeviceOrientationManager();
        }
        return DeviceOrientationManager.instance;
    }

    public async initialize(): Promise<void> {
        console.log('🧭 DeviceOrientationManagerを初期化中...');
        await this.setupDeviceOrientation();
    }

    private async setupDeviceOrientation(): Promise<void> {
        console.log('=== センサー初期化開始 ===');
        
        if (!window.DeviceOrientationEvent) {
            console.error('DeviceOrientationEvent がサポートされていません');
            this.updateOrientationDisplay('センサー未対応');
            return;
        }

        // deviceorientationabsoluteが利用可能かチェック
        const hasAbsoluteOrientation = 'ondeviceorientationabsolute' in window;
        console.log('deviceorientationabsolute サポート:', hasAbsoluteOrientation);
        
        // まず絶対センサーから試行
        if (hasAbsoluteOrientation) {
            console.log('✅ 絶対方位センサー（deviceorientationabsolute）を試行します');
            this.setupSensorListener('deviceorientationabsolute');
        } else {
            console.warn('⚠️ deviceorientationabsolute が利用できません。通常のdeviceorientationを使用します。');
            this.setupSensorListener('deviceorientation');
        }
        console.log('=== センサー初期化完了 ===');
    }

    private setupSensorListener(eventType: 'deviceorientationabsolute' | 'deviceorientation'): void {
        // 既存のリスナーを削除
        if (this.currentEventType) {
            window.removeEventListener(this.currentEventType, this.handleOrientationWithFallback.bind(this));
            console.log(`既存の${this.currentEventType}リスナーを削除しました`);
        }
        
        // フォールバックタイマーをリセット
        if (this.fallbackTimer) {
            clearTimeout(this.fallbackTimer);
            this.fallbackTimer = null;
        }
        
        this.currentEventType = eventType;
        this.nullValueCount = 0;
        
        // センサーの種類を判定
        let sensorType = '';
        let isAbsoluteSensor = false;
        
        if (eventType === 'deviceorientationabsolute') {
            sensorType = '絶対方位センサー（deviceorientationabsolute）- 磁北基準';
            isAbsoluteSensor = true;
            console.log('✅ 絶対方位センサーを使用します');
        } else {
            sensorType = '相対方位センサー（deviceorientation）- 端末起動時基準';
            isAbsoluteSensor = false;
            console.log('✅ 相対方位センサーを使用します（フォールバック）');
        }
        
        // センサー種別をグローバル変数として保存
        (window as any).currentSensorType = sensorType;
        (window as any).isAbsoluteSensor = isAbsoluteSensor;
        
        // iOS 13+では権限要求が必要
        if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
            console.log('iOS端末: 権限要求が必要です');
            // 権限ボタンを表示
            if (this.permissionButton) {
                this.permissionButton.style.display = 'block';
                this.permissionButton.onclick = async () => {
                    try {
                        console.log('iOS権限要求中...');
                        const permission = await (DeviceOrientationEvent as any).requestPermission();
                        console.log('iOS権限結果:', permission);
                        
                        if (permission === 'granted') {
                            window.addEventListener(eventType, this.handleOrientationWithFallback.bind(this));
                            console.log(`✅ iOS: ${sensorType}を使用`);
                            this.permissionButton!.style.display = 'none';
                        } else {
                            console.error('iOS権限が拒否されました');
                            this.updateOrientationDisplay('センサー許可拒否');
                        }
                    } catch (error) {
                        console.error('Device orientation permission error:', error);
                        this.updateOrientationDisplay('センサーエラー');
                    }
                };
            }
        } else {
            // Android等、権限要求が不要な場合
            console.log('権限要求不要: イベントリスナーを直接登録');
            
            window.addEventListener(eventType, this.handleOrientationWithFallback.bind(this));
            console.log(`✅ イベントリスナーを登録しました: ${eventType}`);
            
            // フォールバック監視タイマーを設定（10秒後）
            this.fallbackTimer = window.setTimeout(() => {
                console.log('=== 10秒後のフォールバックチェック ===');
                if (this.nullValueCount >= this.MAX_NULL_VALUES && eventType === 'deviceorientationabsolute') {
                    console.warn(`❌ ${this.MAX_NULL_VALUES}回連続でnull値を検出。deviceorientationにフォールバックします`);
                    this.setupSensorListener('deviceorientation');
                } else if (this.deviceOrientation.alpha === null && this.deviceOrientation.beta === null && this.deviceOrientation.gamma === null) {
                    console.warn('⚠️ 5秒経過してもセンサー値が取得できていません');
                    if (eventType === 'deviceorientationabsolute') {
                        console.log('🔄 deviceorientationにフォールバックを試行します');
                        this.setupSensorListener('deviceorientation');
                    }
                } else {
                    console.log('✅ センサー値は正常に取得できています');
                }
                console.log('==========================================');
            }, 5000);
        }
    }

    private handleOrientationWithFallback(event: DeviceOrientationEvent): void {
        // null値カウント
        if (event.alpha === null && event.beta === null && event.gamma === null) {
            this.nullValueCount++;
            console.log(`null値検出 ${this.nullValueCount}/${this.MAX_NULL_VALUES} (イベント: ${this.currentEventType})`);
            
            // 連続してnull値が来た場合のフォールバック
            if (this.nullValueCount >= this.MAX_NULL_VALUES && this.currentEventType === 'deviceorientationabsolute') {
                console.warn(`❌ ${this.MAX_NULL_VALUES}回連続でnull値を検出。deviceorientationにフォールバックします`);
                this.setupSensorListener('deviceorientation');
                return;
            }
        } else {
            // 有効な値が取得できた場合はカウントをリセット
            this.nullValueCount = 0;
        }
        
        // 通常のhandleOrientationを呼び出し
        this.handleOrientation(event);
    }

    private handleOrientation(event: DeviceOrientationEvent): void {
        // センサー値取得状況をデバッグ出力
        console.log('=== handleOrientation イベント発火 ===');
        console.log('Raw sensor values:', {
            alpha: event.alpha,
            beta: event.beta,
            gamma: event.gamma,
            absolute: event.absolute
        });
        
        const rawAlpha = event.alpha;
        const rawBeta = event.beta;
        const rawGamma = event.gamma;

        // null値チェック
        if (rawAlpha === null && rawBeta === null && rawGamma === null) {
            console.error('❌ 全てのセンサー値がnullです！');
        }

        // フィルターを無効化：生のセンサー値をそのまま使用
        const filteredAlpha = rawAlpha;
        const filteredBeta = rawBeta;
        const filteredGamma = rawGamma;

        // ブラウザ固有の補正を適用
        const correctedAlpha = this.correctOrientationForBrowser(filteredAlpha, navigator.userAgent);

        // 動的補正のための分析（サンプル収集）
        if (filteredAlpha !== null) {
            this.detectAndCorrectOrientation(filteredAlpha);
        }

        // デバイスの向きを保存
        this.deviceOrientation.alpha = correctedAlpha;
        this.deviceOrientation.beta = filteredBeta;
        this.deviceOrientation.gamma = filteredGamma;

        // StateManagerにデバイス向きを設定
        this.stateManager.set('deviceOrientation', this.deviceOrientation);

        // UIを更新
        this.updateOrientationDisplay();

        // カスタムイベントを発火
        this.dispatchOrientationUpdate();

        console.log('Updated deviceOrientation:', this.deviceOrientation);
        console.log('=========================================');
    }

    private correctOrientationForBrowser(alpha: number | null, userAgent: string): number | null {
        if (alpha === null) return alpha;
        
        let correctedAlpha = alpha;
        
        // 基本的なブラウザ固有補正
        if (userAgent.includes('Android')) {
            // Android では東西が逆転している場合がある
            if (this.orientationCorrection.isReversed) {
                correctedAlpha = 360 - alpha;
                console.log(`Android方位角補正: ${alpha}° → ${correctedAlpha}° (東西反転)`);
            }
        }
        
        // 動的オフセット補正を適用
        if (this.orientationCorrection.isCalibrated) {
            correctedAlpha = (correctedAlpha + this.orientationCorrection.offsetAngle) % 360;
            if (correctedAlpha < 0) correctedAlpha += 360;
        }
        
        return correctedAlpha;
    }

    private detectAndCorrectOrientation(alpha: number): void {
        // サンプルを収集
        this.orientationCorrection.calibrationSamples.push({
            alpha: alpha,
            timestamp: Date.now()
        });
        
        // 古いサンプルを削除（10秒以上古いもの）
        const tenSecondsAgo = Date.now() - 10000;
        this.orientationCorrection.calibrationSamples = this.orientationCorrection.calibrationSamples
            .filter(sample => sample.timestamp > tenSecondsAgo);
        
        // 十分なサンプルが集まったら分析
        if (this.orientationCorrection.calibrationSamples.length >= this.CALIBRATION_SAMPLE_SIZE) {
            this.analyzeOrientationPattern();
        }
    }

    private analyzeOrientationPattern(): void {
        const samples = this.orientationCorrection.calibrationSamples;
        if (samples.length < this.CALIBRATION_SAMPLE_SIZE) return;
        
        // サンプルの変化量を分析
        let totalChange = 0;
        let positiveChanges = 0;
        let negativeChanges = 0;
        
        for (let i = 1; i < samples.length; i++) {
            const prev = samples[i - 1].alpha;
            const curr = samples[i].alpha;
            
            // 角度の最短差を計算
            let diff = curr - prev;
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;
            
            totalChange += Math.abs(diff);
            if (diff > 5) positiveChanges++;
            if (diff < -5) negativeChanges++;
        }
        
        // 変化量が少ない場合はキャリブレーション不要
        if (totalChange < 30) {
            console.log('方位角の変化が少ないため、キャリブレーションをスキップ');
            return;
        }
        
        const changeRatio = positiveChanges / (positiveChanges + negativeChanges);
        
        console.log('方位角パターン分析:', {
            totalSamples: samples.length,
            totalChange: totalChange.toFixed(1),
            positiveChanges: positiveChanges,
            negativeChanges: negativeChanges,
            changeRatio: changeRatio.toFixed(2)
        });
    }

    private updateOrientationDisplay(overrideText?: string): void {
        if (!this.deviceOrientationElement) return;

        if (overrideText) {
            this.deviceOrientationElement.textContent = overrideText;
            return;
        }

        const correctedAlpha = this.deviceOrientation.alpha;
        const filteredBeta = this.deviceOrientation.beta;

        this.deviceOrientationElement.textContent = 
            `方位: ${correctedAlpha?.toFixed(1) ?? 'N/A'}° | 傾き: ${filteredBeta?.toFixed(1) ?? 'N/A'}°`;
    }

    private dispatchOrientationUpdate(): void {
        const event = new CustomEvent('orientationUpdate', {
            detail: { 
                orientation: this.deviceOrientation,
                correction: this.orientationCorrection
            }
        });
        window.dispatchEvent(event);
    }

    // 公開メソッド
    public getOrientation() {
        return { ...this.deviceOrientation };
    }

    public toggleOrientationReverse(): boolean {
        this.orientationCorrection.isReversed = !this.orientationCorrection.isReversed;
        
        const status = this.orientationCorrection.isReversed ? '有効' : '無効';
        console.log(`方位角東西反転補正: ${status}`);
        
        return this.orientationCorrection.isReversed;
    }

    public setOrientationOffset(offset: number): void {
        this.orientationCorrection.offsetAngle = offset;
        this.orientationCorrection.isCalibrated = true;
        
        console.log(`方位角オフセット設定: ${offset}°`);
    }

    public resetOrientationCorrection(): void {
        this.orientationCorrection.isCalibrated = false;
        this.orientationCorrection.offsetAngle = 0;
        this.orientationCorrection.isReversed = false;
        this.orientationCorrection.calibrationSamples = [];
        this.orientationCorrection.lastKnownTrueDirection = null;
        
        console.log('方位角補正をリセットしました');
    }

    public getCorrectionStatus() {
        return { ...this.orientationCorrection };
    }

    // デバッグ用メソッド
    public forceFallbackToRelative(): void {
        console.log('🔄 強制的にdeviceorientationセンサーに切り替えます');
        this.setupSensorListener('deviceorientation');
    }

    public resetToAbsoluteSensor(): void {
        if ('ondeviceorientationabsolute' in window) {
            console.log('🔄 deviceorientationabsoluteセンサーに戻します');
            this.setupSensorListener('deviceorientationabsolute');
        } else {
            console.warn('⚠️ deviceorientationabsoluteはサポートされていません');
        }
    }

    public testSensorValues(alpha: number, beta: number, gamma: number): void {
        console.log(`手動センサー値設定: Alpha=${alpha}°, Beta=${beta}°, Gamma=${gamma}°`);
        
        // 手動でイベントを作成してhandleOrientationを呼び出し
        const mockEvent = {
            alpha: alpha,
            beta: beta,
            gamma: gamma
        } as DeviceOrientationEvent;
        
        this.handleOrientation(mockEvent);
        
        console.log('センサー値を手動で設定しました。UIの変化を確認してください。');
    }
}

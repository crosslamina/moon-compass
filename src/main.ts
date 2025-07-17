const deviceOrientationElement = document.getElementById('device-orientation');
const geoInfoElement = document.getElementById('geo-info');
import { getMoonData, getMoonTimes, MoonData, MoonTimes, drawMoonPhase, calculateAngleDifference, calculateBlinkIntensity, resetBlinkTimer, testSunCalcCoordinates } from './moon';
// ...existing code...
const illuminationElement = document.getElementById('illumination');
import { getDirectionName } from './direction';

const moonDirectionElement = document.getElementById('moon-direction');
const distanceElement = document.getElementById('distance');
const currentTimeElement = document.getElementById('current-time');
const moonPhaseElement = document.getElementById('moon-phase');
const altitudeElement = document.getElementById('altitude');
const moonRiseElement = document.getElementById('moon-rise');
const moonSetElement = document.getElementById('moon-set');
const mapLinkElement = document.getElementById('map-link') as HTMLAnchorElement;
const moonCanvas = document.getElementById('moon-canvas') as HTMLCanvasElement;

// 月探知機関連の要素
const detectorStatusElement = document.getElementById('detector-status');
const compassNeedle = document.getElementById('compass-needle');
const moonTarget = document.getElementById('moon-target');
const deviceAltitudeMarker = document.getElementById('device-altitude-marker');
const moonAltitudeMarker = document.getElementById('moon-altitude-marker');
const permissionButton = document.getElementById('permission-button') as HTMLButtonElement;
const locationPermissionButton = document.getElementById('location-permission-button') as HTMLButtonElement;
const locationStatusElement = document.getElementById('location-status');

// 音波探知機関連の要素
const sonarCanvas = document.getElementById('sonar-canvas') as HTMLCanvasElement;
const volumeSlider = document.getElementById('volume-slider') as HTMLInputElement;
const muteButton = document.getElementById('mute-button') as HTMLButtonElement;

// レーダー探知機関連の要素
const radarCanvas = document.getElementById('radar-canvas') as HTMLCanvasElement;
const radarVolumeSlider = document.getElementById('radar-volume-slider') as HTMLInputElement;
const radarMuteButton = document.getElementById('radar-mute-button') as HTMLButtonElement;
const sweepSpeedSlider = document.getElementById('sweep-speed-slider') as HTMLInputElement;
const radarDistanceElement = document.getElementById('radar-distance');
const radarBearingElement = document.getElementById('radar-bearing');
const radarElevationElement = document.getElementById('radar-elevation');

// 探知機タブ関連の要素
const sonarTab = document.getElementById('sonar-tab') as HTMLButtonElement;
const radarTab = document.getElementById('radar-tab') as HTMLButtonElement;
const sonarDetector = document.getElementById('sonar-detector');
const radarDetector = document.getElementById('radar-detector');

// 方位角補正コントロール関連の要素
const toggleReverseBtn = document.getElementById('toggle-reverse-btn') as HTMLButtonElement;
const resetCorrectionBtn = document.getElementById('reset-correction-btn') as HTMLButtonElement;
const correctionStatusElement = document.getElementById('correction-status');

// ダイアログ関連の要素
const infoButton = document.getElementById('info-button') as HTMLButtonElement;
const infoDialog = document.getElementById('info-dialog');
const closeDialogButton = document.getElementById('close-dialog') as HTMLButtonElement;

// デバイスの向きを保存する変数
let deviceOrientation = {
    alpha: null as number | null,  // 方位角（コンパス方向）
    beta: null as number | null,   // 前後の傾き（高度に対応）
    gamma: null as number | null   // 左右の傾き
};

// 月探知機の更新をスロットリングするための変数
let lastDetectorUpdate = 0;
const DETECTOR_UPDATE_INTERVAL = 200; // 200ms間隔で更新（敏感さを抑制）

// 音波探知機の状態管理
interface SonarState {
    isActive: boolean;
    waveRadius: number;
    waveOpacity: number;
    animationPhase: number;
    lastPulse: number;
    pulseInterval: number;
    moonDistance: number;
    moonAngle: number;
    detectionLevel: 'scanning' | 'close' | 'found' | 'locked';
}

// レーダー探知機の状態管理
interface RadarState {
    isActive: boolean;
    sweepAngle: number;
    sweepSpeed: number;
    lastPing: number;
    pingInterval: number;
    moonDistance: number;
    moonAngle: number;
    moonElevation: number;
    detectionLevel: 'scanning' | 'close' | 'found' | 'locked';
    targets: Array<{
        angle: number;
        distance: number;
        strength: number;
        fadeTime: number;
    }>;
    sweepTrail: Array<{
        angle: number;
        opacity: number;
    }>;
}

let sonarState: SonarState = {
    isActive: true,
    waveRadius: 0,
    waveOpacity: 1,
    animationPhase: 0,
    lastPulse: 0,
    pulseInterval: 2000, // 初期パルス間隔（2秒）
    moonDistance: Infinity,
    moonAngle: 0,
    detectionLevel: 'scanning'
};

let radarState: RadarState = {
    isActive: false,
    sweepAngle: 0,
    sweepSpeed: 3,
    lastPing: 0,
    pingInterval: 1500,
    moonDistance: Infinity,
    moonAngle: 0,
    moonElevation: 0,
    detectionLevel: 'scanning',
    targets: [],
    sweepTrail: []
};

// 現在アクティブな探知機
let activeDetector: 'sonar' | 'radar' = 'sonar';

// オーディオシステム
class SonarAudio {
    private audioContext: AudioContext | null = null;
    private gainNode: GainNode | null = null;
    private oscillator: OscillatorNode | null = null;
    private isInitialized = false;
    private isMuted = false;
    private volume = 0.3;

    async initialize() {
        if (this.isInitialized) return;
        
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
            this.gainNode.gain.value = this.volume;
            this.isInitialized = true;
            console.log('✅ オーディオシステムを初期化しました');
        } catch (error) {
            console.error('❌ オーディオシステムの初期化に失敗:', error);
        }
    }

    setVolume(volume: number) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.gainNode) {
            this.gainNode.gain.value = this.isMuted ? 0 : this.volume;
        }
    }

    setMuted(muted: boolean) {
        this.isMuted = muted;
        if (this.gainNode) {
            this.gainNode.gain.value = this.isMuted ? 0 : this.volume;
        }
    }

    playBeep(frequency: number, duration: number) {
        if (!this.isInitialized || !this.audioContext || !this.gainNode || this.isMuted) return;

        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.gainNode);
            
            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';
            
            // エンベロープ（音量の変化）を設定
            const now = this.audioContext.currentTime;
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01); // アタック
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration); // ディケイ
            
            oscillator.start(now);
            oscillator.stop(now + duration);
        } catch (error) {
            console.error('ビープ音の再生に失敗:', error);
        }
    }

    // レーダー用のピング音
    playRadarPing(frequency: number, duration: number, sweepEffect: boolean = false) {
        if (!this.isInitialized || !this.audioContext || !this.gainNode || this.isMuted) return;

        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.gainNode);
            
            oscillator.type = 'triangle'; // レーダーらしい音色
            
            const now = this.audioContext.currentTime;
            
            if (sweepEffect) {
                // スイープ効果: 周波数が変化
                oscillator.frequency.setValueAtTime(frequency * 0.8, now);
                oscillator.frequency.linearRampToValueAtTime(frequency * 1.2, now + duration * 0.5);
                oscillator.frequency.linearRampToValueAtTime(frequency, now + duration);
            } else {
                oscillator.frequency.value = frequency;
            }
            
            // レーダー特有のエンベロープ
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.5, now + 0.005); // 短いアタック
            gainNode.gain.exponentialRampToValueAtTime(0.1, now + duration * 0.3); // 早いディケイ
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration); // ロングテール
            
            oscillator.start(now);
            oscillator.stop(now + duration);
        } catch (error) {
            console.error('レーダーピング音の再生に失敗:', error);
        }
    }
}

const sonarAudio = new SonarAudio();
const radarAudio = new SonarAudio(); // レーダー用に別インスタンス


let currentPosition: GeolocationPosition | null = null;
let currentMoonData: MoonData | null = null;

function updateDisplay() {
    // 位置情報の表示
    if (geoInfoElement && currentPosition) {
        const coords = currentPosition.coords;
        let info = `緯度: ${coords.latitude}<br>経度: ${coords.longitude}`;
        info += `<br>標高: ${coords.altitude ?? 'N/A'}`;
        info += `<br>高度精度: ${coords.altitudeAccuracy ?? 'N/A'}`;
        info += `<br>位置精度: ${coords.accuracy}`;
        info += `<br>方角: ${coords.heading ?? 'N/A'}`;
        info += `<br>速度: ${coords.speed ?? 'N/A'}`;
        geoInfoElement.innerHTML = info;
    }
    if (!currentPosition) return;

    const { latitude, longitude } = currentPosition.coords;

    const moonData = getMoonData(latitude, longitude);
    const moonTimes = getMoonTimes(latitude, longitude);
    const directionName = getDirectionName(moonData.azimuth);

    // 現在の月データを保存
    currentMoonData = moonData;

    if (moonDirectionElement) {
        // 補正後のデバイス方位角と月の方位角の差分を計算
        const deviceAlpha = deviceOrientation.alpha ?? 0;
        let azimuthDiff = deviceAlpha - moonData.azimuth;
        
        // -180°〜180°の範囲に正規化（最短角度差）
        while (azimuthDiff > 180) azimuthDiff -= 360;
        while (azimuthDiff < -180) azimuthDiff += 360;
        
        const absDiff = Math.abs(azimuthDiff);
        const direction = azimuthDiff > 0 ? '左' : '右';
        
        moonDirectionElement.textContent = `方角: ${moonData.azimuth.toFixed(1)}° ${directionName} (差: ${absDiff.toFixed(1)}° ${direction}へ)`;
        
        // デバッグ用ログ
        console.log('Direction difference debug:', {
            deviceAlpha: deviceAlpha.toFixed(1),
            moonAzimuth: moonData.azimuth.toFixed(1),
            rawDiff: (deviceAlpha - moonData.azimuth).toFixed(1),
            normalizedDiff: azimuthDiff.toFixed(1),
            absDiff: absDiff.toFixed(1),
            direction: direction
        });
    }
    if (distanceElement) {
        distanceElement.textContent = `距離: ${moonData.distance.toFixed(0)} km`;
    }
    if (currentTimeElement) {
        currentTimeElement.textContent = `現在時刻: ${new Date().toLocaleTimeString()}`; // 1秒ごとに更新
    }
    if (moonPhaseElement) {
        moonPhaseElement.textContent = `月齢: ${getPhaseName(moonData.phase)} (${(moonData.phase * 29.53).toFixed(1)})`;
    }
    if (illuminationElement ) {
        illuminationElement.textContent = `照明率: ${(moonData.illumination * 100).toFixed(1)}%`;
    }
    if (altitudeElement) {
        altitudeElement.textContent = `高度: ${moonData.altitude.toFixed(2)}°`;
    }
    if (moonRiseElement) {
        moonRiseElement.textContent = `月の出: ${moonTimes.rise?.toLocaleTimeString() ?? 'N/A'}`;
    }
    if (moonSetElement) {
        moonSetElement.textContent = `月の入り: ${moonTimes.set?.toLocaleTimeString() ?? 'N/A'}`;
    }
    if (mapLinkElement) {
        mapLinkElement.href = `https://www.google.com/maps?q=${latitude},${longitude}`;
    }

    // 月の形を描画（点滅機能付き）
    if (moonCanvas) {
        // 角度差を計算して点滅強度を決定
        let blinkIntensity = 1; // デフォルトは点滅なし
        
        if (deviceOrientation.alpha !== null && deviceOrientation.beta !== null) {
            // デバイスの高度を計算（betaから変換）
            // beta: -180°〜180°の範囲（-90°=後傾、0°=水平、90°=前傾、±180°=逆さま）
            let deviceElevation = calculateDeviceElevation(deviceOrientation.beta);
            
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
        
        drawMoonPhase(moonCanvas, moonData, blinkIntensity);
    }

    // 月探知機の更新
    updateMoonDetector(moonData);
}

// 月探知機の定期的な更新（センサーの変化を即座に反映）
setInterval(() => {
    if (currentMoonData && (deviceOrientation.alpha !== null && deviceOrientation.beta !== null)) {
        updateMoonDetector(currentMoonData);
        
        // 月の点滅効果を更新（安定したタイミングで）
        if (moonCanvas) {
            const deviceElevation = calculateDeviceElevation(deviceOrientation.beta);
            const angleDiff = calculateAngleDifference(
                deviceOrientation.alpha,
                deviceElevation,
                currentMoonData.azimuth,
                currentMoonData.altitude
            );
            const blinkIntensity = calculateBlinkIntensity(angleDiff, Date.now());
            drawMoonPhase(moonCanvas, currentMoonData, blinkIntensity);
        }
    }
}, 100); // 100ms間隔で滑らかだが敏感すぎない制御

// 音波探知機の描画ループ
function startSonarAnimation() {
    function animate() {
        if (activeDetector === 'sonar' && sonarState.isActive) {
            drawSonarDisplay();
        } else if (activeDetector === 'radar' && radarState.isActive) {
            drawRadarDisplay();
        }
        requestAnimationFrame(animate);
    }
    animate();
}

// 音波探知機の初期化
async function initializeSonar() {
    // オーディオシステムの初期化
    await sonarAudio.initialize();
    await radarAudio.initialize();
    
    // ソナーキャンバスのサイズ設定
    if (sonarCanvas) {
        sonarCanvas.width = 300;
        sonarCanvas.height = 300;
    }
    
    // レーダーキャンバスのサイズ設定
    if (radarCanvas) {
        radarCanvas.width = 320;
        radarCanvas.height = 320;
    }
    
    // タブイベントリスナー
    if (sonarTab && radarTab) {
        sonarTab.addEventListener('click', () => switchDetector('sonar'));
        radarTab.addEventListener('click', () => switchDetector('radar'));
    }
    
    // 音量スライダーのイベントリスナー（ソナー）
    if (volumeSlider) {
        volumeSlider.value = '30'; // 初期音量30%
        volumeSlider.addEventListener('input', (e) => {
            const volume = parseInt((e.target as HTMLInputElement).value) / 100;
            sonarAudio.setVolume(volume);
        });
    }
    
    // ミュートボタンのイベントリスナー（ソナー）
    if (muteButton) {
        muteButton.addEventListener('click', () => {
            const isMuted = muteButton.classList.contains('muted');
            sonarAudio.setMuted(!isMuted);
            
            if (isMuted) {
                muteButton.classList.remove('muted');
                muteButton.textContent = '🔊';
            } else {
                muteButton.classList.add('muted');
                muteButton.textContent = '🔇';
            }
        });
    }
    
    // レーダー音量スライダーのイベントリスナー
    if (radarVolumeSlider) {
        radarVolumeSlider.value = '40'; // 初期音量40%
        radarVolumeSlider.addEventListener('input', (e) => {
            const volume = parseInt((e.target as HTMLInputElement).value) / 100;
            radarAudio.setVolume(volume);
        });
    }
    
    // レーダーミュートボタンのイベントリスナー
    if (radarMuteButton) {
        radarMuteButton.addEventListener('click', () => {
            const isMuted = radarMuteButton.classList.contains('muted');
            radarAudio.setMuted(!isMuted);
            
            if (isMuted) {
                radarMuteButton.classList.remove('muted');
                radarMuteButton.textContent = '🔊';
            } else {
                radarMuteButton.classList.add('muted');
                radarMuteButton.textContent = '🔇';
            }
        });
    }
    
    // スイープ速度スライダーのイベントリスナー
    if (sweepSpeedSlider) {
        sweepSpeedSlider.value = '3'; // 初期速度
        sweepSpeedSlider.addEventListener('input', (e) => {
            radarState.sweepSpeed = parseInt((e.target as HTMLInputElement).value);
        });
    }
    
    // アニメーション開始
    startSonarAnimation();
    
    console.log('✅ 探知機システムを初期化しました');
}

// ページ読み込み時に音波探知機を初期化
initializeSonar();

function getPhaseName(phase: number): string {
    if (phase < 0.03 || phase > 0.97) return '新月';
    if (phase < 0.22) return '三日月';
    if (phase < 0.28) return '上弦の月';
    if (phase < 0.47) return '十三夜月';
    if (phase < 0.53) return '満月';
    if (phase < 0.72) return '十六夜月';
    if (phase < 0.78) return '下弦の月';
    if (phase < 0.97) return '有明月';
    return ''
}

function handleOrientation(event: DeviceOrientationEvent) {
    // センサー値取得状況をデバッグ出力
    console.log('=== handleOrientation イベント発火 ===');
    console.log('Event object:', event);
    console.log('Raw sensor values:', {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
        absolute: event.absolute
    });
    console.log('Sensor value types:', {
        alphaType: typeof event.alpha,
        betaType: typeof event.beta,
        gammaType: typeof event.gamma
    });
    
    const rawAlpha = event.alpha;
    const rawBeta = event.beta;
    const rawGamma = event.gamma;

    // null値チェックとログ出力
    if (rawAlpha === null) console.warn('⚠️ Alpha値がnullです');
    if (rawBeta === null) console.warn('⚠️ Beta値がnullです');
    if (rawGamma === null) console.warn('⚠️ Gamma値がnullです');
    
    if (rawAlpha === null && rawBeta === null && rawGamma === null) {
        console.error('❌ 全てのセンサー値がnullです！');
        console.log('対処法:');
        console.log('1. HTTPSで接続していることを確認');
        console.log('2. 実機での動作テスト（開発者ツールではセンサー値がnullになることがある）');
        console.log('3. ブラウザの設定でセンサーアクセスが許可されているか確認');
    }

    // フィルターを無効化：生のセンサー値をそのまま使用
    const filteredAlpha = rawAlpha;
    const filteredBeta = rawBeta;
    const filteredGamma = rawGamma;

    // ブラウザ固有の補正を適用
    const correctedAlpha = correctOrientationForBrowser(filteredAlpha, navigator.userAgent);

    console.log('Corrected alpha:', correctedAlpha);

    // 動的補正のための分析（サンプル収集）
    if (filteredAlpha !== null) {
        detectAndCorrectOrientation(filteredAlpha);
    }

    // デバイスの向きを保存
    deviceOrientation.alpha = correctedAlpha;
    deviceOrientation.beta = filteredBeta;
    deviceOrientation.gamma = filteredGamma;

    console.log('Updated deviceOrientation:', deviceOrientation);
    console.log('=========================================');

    if (deviceOrientationElement) {
        const deviceElevationForDisplay = deviceOrientation.beta ? calculateDeviceElevation(deviceOrientation.beta) : null;
        
        // センサー種別を動的に取得
        const sensorType = (window as any).currentSensorType || '不明なセンサー';
        const isAbsolute = (window as any).isAbsoluteSensor || false;
        
        // センサー値の状態をチェック
        const sensorStatus = {
            alphaAvailable: correctedAlpha !== null,
            betaAvailable: filteredBeta !== null,
            gammaAvailable: filteredGamma !== null
        };
        
        const missingSensors: string[] = [];
        if (!sensorStatus.alphaAvailable) missingSensors.push('Alpha(方位角)');
        if (!sensorStatus.betaAvailable) missingSensors.push('Beta(前後傾き)');
        if (!sensorStatus.gammaAvailable) missingSensors.push('Gamma(左右傾き)');
        
        // 警告メッセージ（相対センサーの場合）
        const warningMessage = !isAbsolute ? 
            '<br><span style="color: #f39c12;">⚠️ 相対方位センサーのため、方位角は端末起動時を基準とした値です。実際の磁北とは異なる可能性があります。</span>' : '';
        
        // センサー値欠損の警告
        const missingSensorMessage = missingSensors.length > 0 ? 
            `<br><span style="color: #e74c3c;">❌ センサー値が取得できません: ${missingSensors.join(', ')}</span>` : 
            '<br><span style="color: #2ecc71;">✅ 全センサー値を正常に取得中</span>';
        
        // HTTPSチェックメッセージ
        const httpsMessage = location.protocol !== 'https:' && location.hostname !== 'localhost' ? 
            '<br><span style="color: #e67e22;">⚠️ HTTPSでないため、一部のセンサーが利用できない可能性があります</span>' : '';
        
        // 補正状態の表示
        const correctionStatus: string[] = [];
        if (orientationCorrection.isReversed) {
            correctionStatus.push('<span style="color: #3498db;">東西反転補正: 有効</span>');
        }
        if (orientationCorrection.isCalibrated) {
            correctionStatus.push(`<span style="color: #2ecc71;">オフセット補正: ${orientationCorrection.offsetAngle.toFixed(1)}°</span>`);
        }
        const correctionInfo = correctionStatus.length > 0 ? '<br>' + correctionStatus.join(' | ') : '';
        
        deviceOrientationElement.innerHTML = 
            `<strong>センサー種別: ${sensorType}</strong>${warningMessage}${missingSensorMessage}${httpsMessage}${correctionInfo}<br>` +
            `デバイス方位（alpha/コンパス）: ${correctedAlpha?.toFixed(1) ?? '<span style="color: #e74c3c;">N/A</span>'}°<br>` +
            `前後傾き（beta）: ${filteredBeta?.toFixed(1) ?? '<span style="color: #e74c3c;">N/A</span>'}°<br>` +
            `計算された高度角: ${deviceElevationForDisplay?.toFixed(1) ?? '<span style="color: #e74c3c;">N/A</span>'}°<br>` +
            `左右傾き（gamma）: ${filteredGamma?.toFixed(1) ?? '<span style="color: #e74c3c;">N/A</span>'}°<br>` +
            `<small>alpha: 0°=北 90°=東 180°=南 270°=西<br>` +
            `beta: -90°=後傾 0°=水平 90°=前傾 ±180°=逆さま<br>` +
            `高度角: -90°=真下 0°=水平 90°=真上<br>` +
            `gamma: 0°=水平 90°=右傾 -90°=左傾<br>` +
            `<strong>プロトコル: ${location.protocol} (${location.hostname})</strong><br>` +
            `<strong>デバッグ:</strong> コンソールで getCurrentSensorStatus() を実行して詳細確認<br>` +
            `<strong>テスト:</strong> コンソールで testSensorValues(90, 0, 0) を実行<br>` +
            `<strong>キャリブレーション:</strong> コンソールで toggleOrientationReverse() または setOrientationOffset(角度) を実行</small>`;
    }

    // センサーの値が変わったら月探知機を即座に更新（スロットリング付き）
    if (currentMoonData) {
        const now = Date.now();
        if (now - lastDetectorUpdate > DETECTOR_UPDATE_INTERVAL) {
            updateMoonDetector(currentMoonData);
            lastDetectorUpdate = now;
        }
    }
}

// 方位角の動的補正システム
let orientationCorrection = {
    isCalibrated: false,
    offsetAngle: 0, // デバイス固有のオフセット角度
    isReversed: false, // 東西が逆転しているかどうか
    calibrationSamples: [] as { alpha: number, timestamp: number }[],
    lastKnownTrueDirection: null as number | null
};

const CALIBRATION_SAMPLE_SIZE = 10; // キャリブレーション用サンプル数

// フォールバック制御用の変数
let currentEventType: 'deviceorientationabsolute' | 'deviceorientation' | null = null;
let fallbackTimer: number | null = null;
let nullValueCount = 0;
const MAX_NULL_VALUES = 10; // 10回連続でnull値が来たらフォールバック

// DeviceOrientationEventのサポート判定とイベント登録
async function setupDeviceOrientation() {
    console.log('=== センサー初期化開始 ===');
    
    if (!window.DeviceOrientationEvent) {
        console.error('DeviceOrientationEvent がサポートされていません');
        if (deviceOrientationElement) {
            deviceOrientationElement.innerHTML = '❌ このブラウザはデバイスの向き取得（DeviceOrientationEvent）に対応していません。<br><small>デバッグ用: コンソールで testSensorValues(alpha, beta, gamma) を実行してテストできます。</small>';
        }
        return;
    }

    // deviceorientationabsoluteが利用可能かチェック
    const hasAbsoluteOrientation = 'ondeviceorientationabsolute' in window;
    console.log('deviceorientationabsolute サポート:', hasAbsoluteOrientation);
    
    // まず絶対センサーから試行
    if (hasAbsoluteOrientation) {
        console.log('✅ 絶対方位センサー（deviceorientationabsolute）を試行します');
        setupSensorListener('deviceorientationabsolute');
    } else {
        console.warn('⚠️ deviceorientationabsolute が利用できません。通常のdeviceorientationを使用します。');
        setupSensorListener('deviceorientation');
    }
    console.log('=== センサー初期化完了 ===');
}

/**
 * センサーリスナーをセットアップ（フォールバック機能付き）
 * @param eventType 使用するイベントタイプ
 */
function setupSensorListener(eventType: 'deviceorientationabsolute' | 'deviceorientation') {
    // 既存のリスナーを削除
    if (currentEventType) {
        window.removeEventListener(currentEventType, handleOrientationWithFallback);
        console.log(`既存の${currentEventType}リスナーを削除しました`);
    }
    
    // フォールバックタイマーをリセット
    if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
    }
    
    currentEventType = eventType;
    nullValueCount = 0;
    
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
        if (permissionButton) {
            permissionButton.style.display = 'block';
            permissionButton.onclick = async () => {
                try {
                    console.log('iOS権限要求中...');
                    const permission = await (DeviceOrientationEvent as any).requestPermission();
                    console.log('iOS権限結果:', permission);
                    
                    if (permission === 'granted') {
                        window.addEventListener(eventType, handleOrientationWithFallback);
                        console.log(`✅ iOS: ${sensorType}を使用`);
                        permissionButton.style.display = 'none';
                    } else {
                        console.error('iOS権限が拒否されました');
                        if (deviceOrientationElement) {
                            deviceOrientationElement.innerHTML = '❌ デバイスの向き取得の許可が拒否されました。<br><small>デバッグ用: コンソールで testSensorValues(alpha, beta, gamma) を実行してテストできます。</small>';
                        }
                    }
                } catch (error) {
                    console.error('Device orientation permission error:', error);
                    if (deviceOrientationElement) {
                        deviceOrientationElement.innerHTML = '❌ デバイスの向き取得でエラーが発生しました。<br><small>デバッグ用: コンソールで testSensorValues(alpha, beta, gamma) を実行してテストできます。</small>';
                    }
                }
            };
        }
    } else {
        // Android等、権限要求が不要な場合
        console.log('権限要求不要: イベントリスナーを直接登録');
        
        window.addEventListener(eventType, handleOrientationWithFallback);
        console.log(`✅ イベントリスナーを登録しました: ${eventType}`);
        
        // フォールバック監視タイマーを設定（10秒後）
        fallbackTimer = window.setTimeout(() => {
            console.log('=== 10秒後のフォールバックチェック ===');
            if (nullValueCount >= MAX_NULL_VALUES && eventType === 'deviceorientationabsolute') {
                console.warn(`❌ ${MAX_NULL_VALUES}回連続でnull値を検出。deviceorientationにフォールバックします`);
                setupSensorListener('deviceorientation');
            } else if (deviceOrientation.alpha === null && deviceOrientation.beta === null && deviceOrientation.gamma === null) {
                console.warn('⚠️ 10秒経過してもセンサー値が取得できていません');
                if (eventType === 'deviceorientationabsolute') {
                    console.log('🔄 deviceorientationにフォールバックを試行します');
                    setupSensorListener('deviceorientation');
                }
            } else {
                console.log('✅ センサー値は正常に取得できています');
            }
            console.log('==========================================');
        }, 10000);
    }
}

/**
 * フォールバック機能付きのイベントハンドラー
 * @param event DeviceOrientationEvent
 */
function handleOrientationWithFallback(event: DeviceOrientationEvent) {
    // null値カウント
    if (event.alpha === null && event.beta === null && event.gamma === null) {
        nullValueCount++;
        console.log(`null値検出 ${nullValueCount}/${MAX_NULL_VALUES} (イベント: ${currentEventType})`);
        
        // 連続してnull値が来た場合のフォールバック
        if (nullValueCount >= MAX_NULL_VALUES && currentEventType === 'deviceorientationabsolute') {
            console.warn(`❌ ${MAX_NULL_VALUES}回連続でnull値を検出。deviceorientationにフォールバックします`);
            setupSensorListener('deviceorientation');
            return;
        }
    } else {
        // 有効な値が取得できた場合はカウントをリセット
        nullValueCount = 0;
    }
    
    // 通常のhandleOrientationを呼び出し
    handleOrientation(event);
}

// ページ読み込み時にセットアップ
setupDeviceOrientation();

// キャリブレーション情報を表示
console.log('=== 方位角キャリブレーション機能 ===');
console.log('東西が逆の場合: toggleOrientationReverse()');
console.log('オフセット設定: setOrientationOffset(角度)');
console.log('リセット: resetOrientationCorrection()');
console.log('=====================================');

// 開発者ツール用の説明
console.log('=== 開発者ツールでのテスト方法 ===');
console.log('1. Chrome DevTools を開く（F12）');
console.log('2. [...]メニュー → More tools → Sensors');
console.log('3. Orientation を "Custom orientation" に設定');
console.log('4. Alpha（方位角）、Beta（前後傾き）、Gamma（左右傾き）を調整');
console.log('   - Alpha: 0°=北, 90°=東, 180°=南, 270°=西');
console.log('   - Beta: -90°=下向き, 0°=水平, 90°=上向き');
console.log('   - Gamma: -90°=左傾き, 0°=水平, 90°=右傾き');
console.log('5. 相対センサーのため、実際の磁北とは異なる値になります');
console.log('=====================================');

// デバッグ用：手動センサー値設定機能
console.log('=== デバッグ用手動センサー設定 ===');
console.log('testSensorValues(alpha, beta, gamma) - 手動でセンサー値を設定');
console.log('例: testSensorValues(90, 0, 0) - 東向き水平');
console.log('例: testSensorValues(0, 45, 0) - 北向き上向き45度');
console.log('getCurrentSensorStatus() - 詳細なセンサー診断');
console.log('testEventFiring() - イベント発火テスト');
console.log('=====================================');

// 点滅タイマーを初期化
resetBlinkTimer();

function positionUpdate(position: GeolocationPosition) {
    currentPosition = position;
    
    // SunCalcの座標系をテスト（デバッグ用）
    testSunCalcCoordinates(position.coords.latitude, position.coords.longitude);
    
    // コンパス座標系をテスト（デバッグ用） - 初回のみ
    if (!currentMoonData) {
        testCompassCoordinates();
    }
    
    updateDisplay();
    
    // 位置情報取得成功時のステータス更新
    if (locationStatusElement) {
        locationStatusElement.textContent = '✅ 位置情報を取得しました';
        locationStatusElement.style.background = 'rgba(46, 204, 113, 0.3)';
        locationStatusElement.style.color = '#2ecc71';
        locationStatusElement.style.border = '1px solid #2ecc71';
    }
}

function positionError(error: GeolocationPositionError) {
    console.error('Geolocation error:', error);
    
    let errorMessage = '';
    switch (error.code) {
        case error.PERMISSION_DENIED:
            errorMessage = '❌ 位置情報の取得が拒否されました';
            break;
        case error.POSITION_UNAVAILABLE:
            errorMessage = '⚠️ 位置情報が利用できません';
            break;
        case error.TIMEOUT:
            errorMessage = '⏱️ 位置情報の取得がタイムアウトしました';
            break;
        default:
            errorMessage = '❌ 位置情報の取得でエラーが発生しました';
            break;
    }
    
    if (locationStatusElement) {
        locationStatusElement.textContent = errorMessage;
        locationStatusElement.style.background = 'rgba(231, 76, 60, 0.3)';
        locationStatusElement.style.color = '#e74c3c';
        locationStatusElement.style.border = '1px solid #e74c3c';
    }
    
    // 権限が拒否された場合、再要求ボタンを表示
    if (error.code === error.PERMISSION_DENIED && locationPermissionButton) {
        locationPermissionButton.style.display = 'inline-block';
    }
}

async function setupGeolocation() {
    if (!('geolocation' in navigator)) {
        if (locationStatusElement) {
            locationStatusElement.textContent = '❌ このブラウザは位置情報に対応していません';
            locationStatusElement.style.background = 'rgba(231, 76, 60, 0.3)';
            locationStatusElement.style.color = '#e74c3c';
        }
        return;
    }

    // 位置情報の権限状態を確認（Permission APIが利用可能な場合）
    if ('permissions' in navigator) {
        try {
            const permission = await navigator.permissions.query({ name: 'geolocation' });
            
            if (permission.state === 'denied') {
                if (locationStatusElement) {
                    locationStatusElement.textContent = '❌ 位置情報の権限が拒否されています';
                    locationStatusElement.style.background = 'rgba(231, 76, 60, 0.3)';
                    locationStatusElement.style.color = '#e74c3c';
                }
                if (locationPermissionButton) {
                    locationPermissionButton.style.display = 'inline-block';
                }
                return;
            }
        } catch (error) {
            console.log('Permission API not fully supported');
        }
    }

    // 初回の位置情報取得を試行
    requestLocation();
}

function requestLocation() {
    if (locationStatusElement) {
        locationStatusElement.textContent = '🔍 位置情報を取得中...';
        locationStatusElement.style.background = 'rgba(241, 196, 15, 0.3)';
        locationStatusElement.style.color = '#f1c40f';
        locationStatusElement.style.border = '1px solid #f1c40f';
    }

    const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000 // 1分間キャッシュを使用
    };

    navigator.geolocation.getCurrentPosition(positionUpdate, positionError, options);
    
    // 定期的な位置情報更新も設定
    setInterval(() => {
        navigator.geolocation.getCurrentPosition(positionUpdate, positionError, options);
    }, 60000); // 60秒ごとに位置情報を更新（月の位置計算は別途1秒ごと）
    
    // 月データの定期更新（1秒ごと）
    setInterval(() => {
        if (currentPosition) {
            updateDisplay(); // 月の位置を1秒ごとに再計算
        }
    }, 1000); // 1秒ごとに月の情報を更新
}

// 位置情報許可ボタンのイベントリスナー
if (locationPermissionButton) {
    locationPermissionButton.onclick = () => {
        locationPermissionButton.style.display = 'none';
        requestLocation();
    };
}

// ページ読み込み時に位置情報のセットアップ
setupGeolocation();

/**
 * 月探知機の状態を更新（直感的なインジケーター）
 */
function updateMoonDetector(moonData: MoonData) {
    if (!detectorStatusElement) {
        return;
    }

    // 位置情報が取得できていない場合
    if (!currentPosition) {
        detectorStatusElement.textContent = '📍 位置情報が必要です';
        detectorStatusElement.className = 'detector-inactive';
        sonarState.detectionLevel = 'scanning';
        sonarState.moonDistance = Infinity;
        return;
    }

    const deviceAlpha = deviceOrientation.alpha;
    const deviceBeta = deviceOrientation.beta;

    if (deviceAlpha === null || deviceBeta === null) {
        detectorStatusElement.textContent = '📱 デバイスの向きセンサーが利用できません';
        detectorStatusElement.className = 'detector-inactive';
        sonarState.detectionLevel = 'scanning';
        sonarState.moonDistance = Infinity;
        return;
    }

    // 月の方位角と高度
    const moonAzimuth = moonData.azimuth;
    const moonAltitude = moonData.altitude;

    // === 直感的なコンパス更新 ===
    
    // コンパス針の回転（デバイスの向き）
    if (compassNeedle) {
        compassNeedle.style.transform = `translate(-50%, -100%) rotate(${deviceAlpha}deg)`;
    }
    
    // 月のターゲット位置（コンパス円周上）
    if (moonTarget) {
        moonTarget.style.transform = `translate(-50%, -50%) rotate(${moonAzimuth}deg) translateY(-65px)`;
    }

    // === 高度インジケーター更新 ===
    
    const deviceElevation = calculateDeviceElevation(deviceBeta);
    const clampedMoonAltitude = Math.max(-90, Math.min(90, moonAltitude));
    
    // 高度インジケーターのマーカー位置を更新
    updateAltitudeMarkers(deviceElevation, clampedMoonAltitude);
    
    // === 角度差の計算 ===
    
    let azimuthDiff = Math.abs(deviceAlpha - moonAzimuth);
    if (azimuthDiff > 180) {
        azimuthDiff = 360 - azimuthDiff;
    }
    
    const altitudeDiff = Math.abs(deviceElevation - clampedMoonAltitude);
    const totalAngleDiff = calculateAngleDifference(deviceAlpha, deviceElevation, moonAzimuth, clampedMoonAltitude);
    
    // === 音波探知機の状態更新 ===
    
    // 月の方向と距離を更新
    sonarState.moonAngle = moonAzimuth;
    sonarState.moonDistance = totalAngleDiff;
    
    // 検知レベルの判定と更新
    const previousLevel = sonarState.detectionLevel;
    
    if (totalAngleDiff <= 3) {
        sonarState.detectionLevel = 'locked';
        sonarState.pulseInterval = 200; // 0.2秒間隔
        detectorStatusElement.textContent = '🎯 完全一致！月を捕捉';
        detectorStatusElement.className = 'detector-locked';
        
        // バイブレーション（対応デバイスのみ）
        if ('vibrate' in navigator) {
            navigator.vibrate([100, 50, 100, 50, 100]);
        }
    } else if (totalAngleDiff <= 15) {
        sonarState.detectionLevel = 'found';
        sonarState.pulseInterval = 500; // 0.5秒間隔
        const locationText = moonAltitude < 0 ? '（地平線下）' : '';
        detectorStatusElement.textContent = `🌙 月を発見しました${locationText}`;
        detectorStatusElement.className = 'detector-found';
        
        // バイブレーション（対応デバイスのみ）
        if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
        }
    } else if (totalAngleDiff <= 30) {
        sonarState.detectionLevel = 'close';
        sonarState.pulseInterval = 1000; // 1秒間隔
        const locationText = moonAltitude < 0 ? '（地平線下）' : '';
        detectorStatusElement.textContent = `🔍 音波が強くなっています${locationText}`;
        detectorStatusElement.className = 'detector-close';
    } else {
        sonarState.detectionLevel = 'scanning';
        sonarState.pulseInterval = 2000; // 2秒間隔
        const locationText = moonAltitude < 0 ? '（地平線下）' : '';
        detectorStatusElement.textContent = `� 音波探知中${locationText}`;
        detectorStatusElement.className = 'detector-inactive';
    }
    
    // 検知レベルが変わった場合は即座にパルスを発生
    if (previousLevel !== sonarState.detectionLevel) {
        sonarState.lastPulse = 0; // 次回の描画で即座にパルス
        console.log(`音波探知レベル変更: ${previousLevel} → ${sonarState.detectionLevel}`);
    }
    
    // レーダー用の月データも更新
    if (radarState.isActive) {
        radarState.moonAngle = moonAzimuth;
        radarState.moonDistance = totalAngleDiff;
        radarState.moonElevation = clampedMoonAltitude;
        radarState.detectionLevel = sonarState.detectionLevel; // 同じ検知レベルを使用
    }
}

/**
 * レーダー探知機の画面を描画
 */
function drawRadarDisplay() {
    if (!radarCanvas) return;
    
    const ctx = radarCanvas.getContext('2d');
    if (!ctx) return;
    
    const centerX = radarCanvas.width / 2;
    const centerY = radarCanvas.height / 2;
    const maxRadius = Math.min(centerX, centerY) - 30;
    
    // 背景をクリア
    ctx.clearRect(0, 0, radarCanvas.width, radarCanvas.height);
    
    // 背景を暗青色に
    ctx.fillStyle = '#001122';
    ctx.fillRect(0, 0, radarCanvas.width, radarCanvas.height);
    
    // グリッド線を描画（同心円）
    ctx.strokeStyle = '#003366';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
        const radius = (maxRadius / 4) * i;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // 距離ラベル
        ctx.fillStyle = '#0066AA';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${i * 25}°`, centerX, centerY - radius + 10);
    }
    
    // 十字線とレンジ線を描画
    ctx.strokeStyle = '#003366';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // 縦線
    ctx.moveTo(centerX, centerY - maxRadius);
    ctx.lineTo(centerX, centerY + maxRadius);
    // 横線
    ctx.moveTo(centerX - maxRadius, centerY);
    ctx.lineTo(centerX + maxRadius, centerY);
    // 対角線
    const diagonal = maxRadius * 0.707;
    ctx.moveTo(centerX - diagonal, centerY - diagonal);
    ctx.lineTo(centerX + diagonal, centerY + diagonal);
    ctx.moveTo(centerX - diagonal, centerY + diagonal);
    ctx.lineTo(centerX + diagonal, centerY - diagonal);
    ctx.stroke();
    
    // 方位ラベルを描画
    ctx.fillStyle = '#0099FF';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('N', centerX, centerY - maxRadius - 8);
    ctx.fillText('S', centerX, centerY + maxRadius + 20);
    ctx.textAlign = 'left';
    ctx.fillText('E', centerX + maxRadius + 8, centerY + 4);
    ctx.textAlign = 'right';
    ctx.fillText('W', centerX - maxRadius - 8, centerY + 4);
    
    // スイープトレイルを描画（残像効果）
    radarState.sweepTrail.forEach((trail, index) => {
        if (trail.opacity > 0) {
            const trailRadius = maxRadius;
            const trailX = centerX + Math.sin(trail.angle * Math.PI / 180) * trailRadius;
            const trailY = centerY - Math.cos(trail.angle * Math.PI / 180) * trailRadius;
            
            ctx.strokeStyle = `rgba(0, 153, 255, ${trail.opacity * 0.1})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(trailX, trailY);
            ctx.stroke();
            
            // 透明度を減少
            trail.opacity -= 0.05;
            if (trail.opacity <= 0) {
                radarState.sweepTrail.splice(index, 1);
            }
        }
    });
    
    // 検知されたターゲットの残像を描画
    const currentTime = Date.now();
    radarState.targets.forEach((target, index) => {
        const fadeAge = currentTime - target.fadeTime;
        const fadeOpacity = Math.max(0, 1 - (fadeAge / 3000)); // 3秒で消失
        
        if (fadeOpacity > 0) {
            const targetRadius = (target.distance / 100) * maxRadius;
            const targetX = centerX + Math.sin(target.angle * Math.PI / 180) * targetRadius;
            const targetY = centerY - Math.cos(target.angle * Math.PI / 180) * targetRadius;
            
            // ターゲットの強度に応じて色と大きさを変更
            let color = '#00FF00';
            let size = 3;
            if (target.strength > 0.8) {
                color = '#FFFFFF';
                size = 6;
            } else if (target.strength > 0.5) {
                color = '#FFFF00';
                size = 4;
            }
            
            ctx.fillStyle = color.replace(')', `, ${fadeOpacity})`).replace('rgb', 'rgba');
            ctx.beginPath();
            ctx.arc(targetX, targetY, size, 0, Math.PI * 2);
            ctx.fill();
            
            // ターゲット周りの環
            ctx.strokeStyle = color.replace(')', `, ${fadeOpacity * 0.5})`).replace('rgb', 'rgba');
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(targetX, targetY, size + 3, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            radarState.targets.splice(index, 1);
        }
    });
    
    // メインスイープラインを描画
    radarState.sweepAngle += radarState.sweepSpeed;
    if (radarState.sweepAngle >= 360) {
        radarState.sweepAngle = 0;
        
        // スイープが一周したときにピング音を再生
        const frequency = getRadarPingFrequency(radarState.detectionLevel);
        const duration = getRadarPingDuration(radarState.detectionLevel);
        radarAudio.playRadarPing(frequency, duration, true);
    }
    
    // スイープトレイルを追加
    radarState.sweepTrail.push({
        angle: radarState.sweepAngle,
        opacity: 1
    });
    
    // 月がスイープライン上にある場合、ターゲットとして記録
    const sweepTolerance = 5; // 度
    const angleDiff = Math.abs(radarState.sweepAngle - radarState.moonAngle);
    const normalizedAngleDiff = Math.min(angleDiff, 360 - angleDiff);
    
    if (normalizedAngleDiff <= sweepTolerance && radarState.moonDistance < Infinity) {
        // ターゲット強度を計算
        const strength = Math.max(0, 1 - (radarState.moonDistance / 100));
        
        radarState.targets.push({
            angle: radarState.moonAngle,
            distance: radarState.moonDistance,
            strength: strength,
            fadeTime: currentTime
        });
        
        // 検知時の効果音
        if (strength > 0.5) {
            const detectionFreq = 600 + (strength * 400);
            radarAudio.playRadarPing(detectionFreq, 0.2, false);
        }
    }
    
    // メインスイープライン
    const sweepRadius = maxRadius;
    const sweepX = centerX + Math.sin(radarState.sweepAngle * Math.PI / 180) * sweepRadius;
    const sweepY = centerY - Math.cos(radarState.sweepAngle * Math.PI / 180) * sweepRadius;
    
    // スイープラインのグラデーション
    const sweepGradient = ctx.createLinearGradient(centerX, centerY, sweepX, sweepY);
    sweepGradient.addColorStop(0, 'rgba(0, 255, 255, 0.8)');
    sweepGradient.addColorStop(0.7, 'rgba(0, 153, 255, 0.4)');
    sweepGradient.addColorStop(1, 'rgba(0, 153, 255, 0)');
    
    ctx.strokeStyle = sweepGradient;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(sweepX, sweepY);
    ctx.stroke();
    
    // 中央のレーダー中心点を描画
    ctx.fillStyle = '#00FFFF';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // スイープ角度の表示
    ctx.fillStyle = '#0099FF';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SWEEP: ${radarState.sweepAngle.toFixed(0)}°`, 10, 20);
    ctx.fillText(`SPEED: ${radarState.sweepSpeed}`, 10, 35);
    
    // レーダー情報の更新
    if (radarDistanceElement) {
        radarDistanceElement.textContent = `距離: ${radarState.moonDistance < Infinity ? radarState.moonDistance.toFixed(1) + '°' : '--'}`;
    }
    if (radarBearingElement) {
        radarBearingElement.textContent = `方位: ${radarState.moonDistance < Infinity ? radarState.moonAngle.toFixed(1) + '°' : '--'}`;
    }
    if (radarElevationElement) {
        radarElevationElement.textContent = `仰角: ${radarState.moonDistance < Infinity ? radarState.moonElevation.toFixed(1) + '°' : '--'}`;
    }
}

/**
 * 検知レベルに応じたレーダーピング周波数を取得
 */
function getRadarPingFrequency(level: RadarState['detectionLevel']): number {
    switch (level) {
        case 'scanning': return 300;
        case 'close': return 450;
        case 'found': return 600;
        case 'locked': return 800;
        default: return 300;
    }
}

/**
 * タブ切り替え機能
 */
function switchDetector(type: 'sonar' | 'radar') {
    activeDetector = type;
    
    // タブの見た目を更新
    if (sonarTab && radarTab) {
        sonarTab.classList.toggle('active', type === 'sonar');
        radarTab.classList.toggle('active', type === 'radar');
    }
    
    // パネルの表示を切り替え
    if (sonarDetector && radarDetector) {
        sonarDetector.classList.toggle('active', type === 'sonar');
        radarDetector.classList.toggle('active', type === 'radar');
    }
    
    // 探知機の状態を更新
    sonarState.isActive = (type === 'sonar');
    radarState.isActive = (type === 'radar');
    
    console.log(`探知機を${type === 'sonar' ? 'ソナー' : 'レーダー'}に切り替えました`);
}

/**
 * 検知レベルに応じたレーダーピング継続時間を取得
 */
function getRadarPingDuration(level: RadarState['detectionLevel']): number {
    switch (level) {
        case 'scanning': return 0.3;
        case 'close': return 0.4;
        case 'found': return 0.5;
        case 'locked': return 0.6;
        default: return 0.3;
    }
}

/**
 * ダイアログを開く
 */
function openDialog() {
    if (infoDialog) {
        infoDialog.style.display = 'flex';
        // フェードイン効果
        setTimeout(() => {
            infoDialog.style.opacity = '1';
        }, 10);
    }
}

/**
 * 音波探知機のソナー画面を描画
 */
function drawSonarDisplay() {
    if (!sonarCanvas) return;
    
    const ctx = sonarCanvas.getContext('2d');
    if (!ctx) return;
    
    const centerX = sonarCanvas.width / 2;
    const centerY = sonarCanvas.height / 2;
    const maxRadius = Math.min(centerX, centerY) - 20;
    
    // 背景をクリア
    ctx.clearRect(0, 0, sonarCanvas.width, sonarCanvas.height);
    
    // 背景を暗緑色に
    ctx.fillStyle = '#001100';
    ctx.fillRect(0, 0, sonarCanvas.width, sonarCanvas.height);
    
    // グリッド線を描画（同心円）
    ctx.strokeStyle = '#004400';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
        const radius = (maxRadius / 4) * i;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // 十字線を描画
    ctx.strokeStyle = '#004400';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // 縦線
    ctx.moveTo(centerX, centerY - maxRadius);
    ctx.lineTo(centerX, centerY + maxRadius);
    // 横線
    ctx.moveTo(centerX - maxRadius, centerY);
    ctx.lineTo(centerX + maxRadius, centerY);
    ctx.stroke();
    
    // 方位ラベルを描画
    ctx.fillStyle = '#00AA00';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('N', centerX, centerY - maxRadius - 5);
    ctx.fillText('S', centerX, centerY + maxRadius + 18);
    ctx.textAlign = 'left';
    ctx.fillText('E', centerX + maxRadius + 5, centerY + 5);
    ctx.textAlign = 'right';
    ctx.fillText('W', centerX - maxRadius - 5, centerY + 5);
    
    // 音波の波紋を描画
    const currentTime = Date.now();
    if (currentTime - sonarState.lastPulse > sonarState.pulseInterval) {
        sonarState.waveRadius = 0;
        sonarState.waveOpacity = 1;
        sonarState.lastPulse = currentTime;
        
        // ビープ音を再生
        const frequency = getBeepFrequency(sonarState.detectionLevel);
        const duration = getBeepDuration(sonarState.detectionLevel);
        sonarAudio.playBeep(frequency, duration);
    }
    
    // 波紋のアニメーション
    sonarState.waveRadius += maxRadius / 60; // 1秒で画面端まで到達
    sonarState.waveOpacity = Math.max(0, 1 - (sonarState.waveRadius / maxRadius));
    
    if (sonarState.waveRadius < maxRadius) {
        const alpha = sonarState.waveOpacity * getWaveIntensity(sonarState.detectionLevel);
        ctx.strokeStyle = `rgba(0, 255, 0, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, sonarState.waveRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // 近接時は追加の波紋
        if (sonarState.detectionLevel !== 'scanning') {
            const secondWave = sonarState.waveRadius * 0.7;
            if (secondWave > 0) {
                ctx.strokeStyle = `rgba(0, 255, 0, ${alpha * 0.5})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(centerX, centerY, secondWave, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    }
    
    // 月のインジケーターを描画
    if (sonarState.moonDistance < Infinity) {
        const moonX = centerX + Math.sin(sonarState.moonAngle * Math.PI / 180) * (maxRadius * 0.8);
        const moonY = centerY - Math.cos(sonarState.moonAngle * Math.PI / 180) * (maxRadius * 0.8);
        
        // 月の点滅効果
        const blinkPhase = (currentTime / 500) % 1; // 0.5秒周期
        let moonAlpha = 0.5 + Math.sin(blinkPhase * Math.PI * 2) * 0.5;
        
        // 検知レベルに応じて色と点滅速度を変更
        let moonColor = '#FFAA00'; // オレンジ
        switch (sonarState.detectionLevel) {
            case 'close':
                moonColor = '#FFFF00'; // 黄色
                moonAlpha = 0.7 + Math.sin(blinkPhase * Math.PI * 4) * 0.3; // 高速点滅
                break;
            case 'found':
                moonColor = '#00FF00'; // 緑色
                moonAlpha = 0.8 + Math.sin(blinkPhase * Math.PI * 6) * 0.2; // 超高速点滅
                break;
            case 'locked':
                moonColor = '#FFFFFF'; // 白色
                moonAlpha = 1; // 常時点灯
                break;
        }
        
        ctx.fillStyle = `rgba(255, 255, 0, ${moonAlpha})`;
        ctx.beginPath();
        ctx.arc(moonX, moonY, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // 検知レベルが高い場合は外輪を描画
        if (sonarState.detectionLevel !== 'scanning') {
            ctx.strokeStyle = moonColor.replace(')', ', 0.5)').replace('rgb', 'rgba');
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(moonX, moonY, 12, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    
    // 中央のスキャナードットを描画
    ctx.fillStyle = '#00FF00';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // スキャンライン（回転するライン）
    sonarState.animationPhase = (sonarState.animationPhase + 2) % 360;
    const scanAngle = sonarState.animationPhase * Math.PI / 180;
    const scanX = centerX + Math.cos(scanAngle) * maxRadius;
    const scanY = centerY + Math.sin(scanAngle) * maxRadius;
    
    const gradient = ctx.createLinearGradient(centerX, centerY, scanX, scanY);
    gradient.addColorStop(0, 'rgba(0, 255, 0, 0.8)');
    gradient.addColorStop(1, 'rgba(0, 255, 0, 0)');
    
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(scanX, scanY);
    ctx.stroke();
}

/**
 * 検知レベルに応じたビープ周波数を取得
 */
function getBeepFrequency(level: SonarState['detectionLevel']): number {
    switch (level) {
        case 'scanning': return 200;
        case 'close': return 400;
        case 'found': return 800;
        case 'locked': return 1200;
        default: return 200;
    }
}

/**
 * 検知レベルに応じたビープ継続時間を取得
 */
function getBeepDuration(level: SonarState['detectionLevel']): number {
    switch (level) {
        case 'scanning': return 0.1;
        case 'close': return 0.15;
        case 'found': return 0.2;
        case 'locked': return 0.3;
        default: return 0.1;
    }
}

/**
 * 検知レベルに応じた波の強度を取得
 */
function getWaveIntensity(level: SonarState['detectionLevel']): number {
    switch (level) {
        case 'scanning': return 0.3;
        case 'close': return 0.6;
        case 'found': return 0.9;
        case 'locked': return 1.0;
        default: return 0.3;
    }
}

/**
 * ダイアログを閉じる
 */
function closeDialog() {
    if (infoDialog) {
        infoDialog.style.opacity = '0';
        // フェードアウト後に非表示
        setTimeout(() => {
            infoDialog.style.display = 'none';
        }, 300);
    }
}

// ダイアログのイベントリスナー設定
if (infoButton) {
    infoButton.onclick = openDialog;
}

if (closeDialogButton) {
    closeDialogButton.onclick = closeDialog;
}

// ダイアログの背景をクリックしても閉じる
if (infoDialog) {
    infoDialog.onclick = (event) => {
        if (event.target === infoDialog) {
            closeDialog();
        }
    };
}

// ESCキーでダイアログを閉じる
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && infoDialog && infoDialog.style.display === 'flex') {
        closeDialog();
    }
});

/**
 * デバイスのベータ値から高度角を計算する（改良版）
 * @param beta デバイスの前後傾き（-180度〜180度）
 * @returns 高度角（-90度〜90度）
 */
function calculateDeviceElevation(beta: number): number {
    // betaを-180〜180度の範囲に正規化
    let normalizedBeta = beta;
    while (normalizedBeta > 180) normalizedBeta -= 360;
    while (normalizedBeta < -180) normalizedBeta += 360;
    
    // 改良されたbetaから高度角への変換
    // より直感的な操作感を実現するための調整
    
    if (normalizedBeta >= -90 && normalizedBeta <= 90) {
        // 通常の範囲：betaをそのまま高度として使用
        // beta: -90° = 後傾（下向き） → 高度: -90°
        // beta: 0° = 水平 → 高度: 0°
        // beta: 90° = 前傾（上向き） → 高度: 90°
        return normalizedBeta;
    } else if (normalizedBeta > 90 && normalizedBeta <= 180) {
        // 前に倒れすぎている場合：より自然な変換
        // 90°を超えた分を徐々に下向きに変換
        // beta: 91° → 高度: 89°、beta: 180° → 高度: 0°
        return 180 - normalizedBeta;
    } else {
        // 後ろに倒れすぎている場合：より自然な変換
        // -90°を超えた分を徐々に下向きに変換
        // beta: -91° → 高度: -89°、beta: -180° → 高度: 0°
        return -180 - normalizedBeta;
    }
}

/**
 * 高度インジケーターのマーカー位置を更新
 * @param deviceElevation デバイスの高度角（-90°〜90°）
 * @param moonAltitude 月の高度角（-90°〜90°）
 */
function updateAltitudeMarkers(deviceElevation: number, moonAltitude: number) {
    // 高度インジケーターのゲージ幅（CSSから取得）
    const gaugeWidth = 200; // px（CSSの#altitude-gaugeのwidthと一致）
    
    /**
     * 高度角（-90°〜90°）を高度ゲージの位置（0〜100%）に変換
     * @param altitude 高度角（-90°〜90°）
     * @returns ゲージ上の位置（0〜100%）
     */
    const altitudeToPosition = (altitude: number): number => {
        // -90°〜90°の範囲を0〜100%にマッピング
        // -90° → 0%（左端）
        // 0°（地平線） → 50%（中央）
        // 90° → 100%（右端）
        return ((altitude + 90) / 180) * 100;
    };
    
    // デバイス高度マーカーの位置を更新
    if (deviceAltitudeMarker) {
        const devicePosition = altitudeToPosition(deviceElevation);
        const deviceLeftPx = (devicePosition / 100) * gaugeWidth - 4; // マーカー幅の半分（8px/2）をオフセット
        deviceAltitudeMarker.style.left = `${deviceLeftPx}px`;
        
        console.log('Device altitude marker debug:', {
            deviceElevation: deviceElevation,
            devicePosition: devicePosition,
            deviceLeftPx: deviceLeftPx
        });
    }
    
    // 月高度マーカーの位置を更新
    if (moonAltitudeMarker) {
        const moonPosition = altitudeToPosition(moonAltitude);
        const moonLeftPx = (moonPosition / 100) * gaugeWidth - 4; // マーカー幅の半分（8px/2）をオフセット
        moonAltitudeMarker.style.left = `${moonLeftPx}px`;
        
        // 月の高度に応じて色を変更（地平線下/上）
        if (moonAltitude < 0) {
            // 地平線下では少し薄く表示
            moonAltitudeMarker.style.opacity = '0.7';
            moonAltitudeMarker.style.background = '#e67e22'; // オレンジ色に変更
        } else {
            // 地平線上では通常表示
            moonAltitudeMarker.style.opacity = '1';
            moonAltitudeMarker.style.background = '#2ecc71'; // 緑色
        }
        
        console.log('Moon altitude marker debug:', {
            moonAltitude: moonAltitude,
            moonPosition: moonPosition,
            moonLeftPx: moonLeftPx,
            isUnderHorizon: moonAltitude < 0
        });
    }
}

/**
 * ブラウザ固有の方位センサー補正（動的補正機能付き）
 * @param alpha 生の方位角
 * @param userAgent ユーザーエージェント文字列
 * @returns 補正された方位角
 */
function correctOrientationForBrowser(alpha: number | null, userAgent: string): number | null {
    if (alpha === null) return alpha;
    
    let correctedAlpha = alpha;
    
    // 基本的なブラウザ固有補正
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
        // iOS Safari での補正
        // 通常は追加補正不要
    } else if (userAgent.includes('Android')) {
        // Android では東西が逆転している場合がある
        if (orientationCorrection.isReversed) {
            correctedAlpha = 360 - alpha;
            console.log(`Android方位角補正: ${alpha}° → ${correctedAlpha}° (東西反転)`);
        }
    }
    
    // 動的オフセット補正を適用
    if (orientationCorrection.isCalibrated) {
        correctedAlpha = (correctedAlpha + orientationCorrection.offsetAngle) % 360;
        if (correctedAlpha < 0) correctedAlpha += 360;
    }
    
    return correctedAlpha;
}

/**
 * 方位角の東西反転を検出・補正する
 * @param alpha 現在の方位角
 */
function detectAndCorrectOrientation(alpha: number) {
    // サンプルを収集
    orientationCorrection.calibrationSamples.push({
        alpha: alpha,
        timestamp: Date.now()
    });
    
    // 古いサンプルを削除（10秒以上古いもの）
    const tenSecondsAgo = Date.now() - 10000;
    orientationCorrection.calibrationSamples = orientationCorrection.calibrationSamples
        .filter(sample => sample.timestamp > tenSecondsAgo);
    
    // 十分なサンプルが集まったら分析
    if (orientationCorrection.calibrationSamples.length >= CALIBRATION_SAMPLE_SIZE) {
        analyzeOrientationPattern();
    }
}

/**
 * 方位角のパターンを分析して東西反転を検出
 */
function analyzeOrientationPattern() {
    const samples = orientationCorrection.calibrationSamples;
    if (samples.length < CALIBRATION_SAMPLE_SIZE) return;
    
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
    
    // 東西反転の検出ロジック
    // 実際のデバイスの動きと逆方向に値が変化している場合、反転していると判断
    const changeRatio = positiveChanges / (positiveChanges + negativeChanges);
    
    console.log('方位角パターン分析:', {
        totalSamples: samples.length,
        totalChange: totalChange.toFixed(1),
        positiveChanges: positiveChanges,
        negativeChanges: negativeChanges,
        changeRatio: changeRatio.toFixed(2)
    });
    
    // ここで実際の検出ロジックを実装
    // 現在は手動でテストできるようにログ出力のみ
    console.log('東西反転の自動検出は実装中です。手動で設定してください。');
}

/**
 * コンパス座標系の計算をテストする関数（デバッグ用）
 */
function testCompassCoordinates() {
    console.log('=== コンパス座標系テスト ===');
    
    const testAngles = [0, 45, 90, 135, 180, 225, 270, 315];
    const radius = 65;
    
    testAngles.forEach(angle => {
        const radians = angle * Math.PI / 180;
        const x = Math.sin(radians) * radius;
        const y = -Math.cos(radians) * radius;
        
        let expectedDirection = '';
        switch(angle) {
            case 0: expectedDirection = '上（北）'; break;
            case 45: expectedDirection = '右上（北東）'; break;
            case 90: expectedDirection = '右（東）'; break;
            case 135: expectedDirection = '右下（南東）'; break;
            case 180: expectedDirection = '下（南）'; break;
            case 225: expectedDirection = '左下（南西）'; break;
            case 270: expectedDirection = '左（西）'; break;
            case 315: expectedDirection = '左上（北西）'; break;
        }
        
        console.log(`${angle}° → (${x.toFixed(1)}, ${y.toFixed(1)}) - ${expectedDirection}`);
    });
    
    console.log('========================');
}

/**
 * 手動で東西反転補正を設定/解除
 */
function toggleOrientationReverse() {
    orientationCorrection.isReversed = !orientationCorrection.isReversed;
    
    const status = orientationCorrection.isReversed ? '有効' : '無効';
    console.log(`方位角東西反転補正: ${status}`);
    
    // UI更新のために即座に月探知機を更新
    if (currentMoonData) {
        updateMoonDetector(currentMoonData);
    }
    
    return orientationCorrection.isReversed;
}

/**
 * 補正状態の表示を更新
 */
function updateCorrectionStatus() {
    if (correctionStatusElement) {
        const statusParts: string[] = [];
        
        if (orientationCorrection.isReversed) {
            statusParts.push('🔄 東西反転補正: 有効');
        }
        
        if (orientationCorrection.isCalibrated) {
            statusParts.push(`📐 オフセット: ${orientationCorrection.offsetAngle.toFixed(1)}°`);
        }
        
        if (statusParts.length === 0) {
            correctionStatusElement.textContent = '補正なし（通常モード）';
            correctionStatusElement.style.color = '#95a5a6';
        } else {
            correctionStatusElement.textContent = statusParts.join(' | ');
            correctionStatusElement.style.color = '#2ecc71';
        }
    }
    
    // ボタンの状態を更新
    if (toggleReverseBtn) {
        if (orientationCorrection.isReversed) {
            toggleReverseBtn.classList.add('active');
            toggleReverseBtn.textContent = '東西反転補正: ON';
        } else {
            toggleReverseBtn.classList.remove('active');
            toggleReverseBtn.textContent = '東西反転補正: OFF';
        }
    }
}

/**
 * 手動で東西反転補正を設定/解除（UI版）
 */
function toggleOrientationReverseUI() {
    const result = toggleOrientationReverse();
    updateCorrectionStatus();
    
    // フィードバックメッセージ
    const message = result ? 
        '✅ 東西反転補正を有効にしました' : 
        '❌ 東西反転補正を無効にしました';
    
    console.log(message);
    
    // 一時的にステータスにメッセージを表示
    if (correctionStatusElement) {
        const originalText = correctionStatusElement.textContent;
        correctionStatusElement.textContent = message;
        correctionStatusElement.style.color = result ? '#2ecc71' : '#e74c3c';
        
        setTimeout(() => {
            updateCorrectionStatus();
        }, 2000);
    }
    
    return result;
}

/**
 * 方位角補正をリセット（UI版）
 */
function resetOrientationCorrectionUI() {
    resetOrientationCorrection();
    updateCorrectionStatus();
    
    const message = '🔄 補正をリセットしました';
    console.log(message);
    
    // 一時的にステータスにメッセージを表示
    if (correctionStatusElement) {
        correctionStatusElement.textContent = message;
        correctionStatusElement.style.color = '#f39c12';
        
        setTimeout(() => {
            updateCorrectionStatus();
        }, 2000);
    }
}

/**
 * 方位角オフセットを手動で設定
 * @param offset オフセット角度（度）
 */
function setOrientationOffset(offset: number) {
    orientationCorrection.offsetAngle = offset;
    orientationCorrection.isCalibrated = true;
    
    console.log(`方位角オフセット設定: ${offset}°`);
    
    // UI更新のために即座に月探知機を更新
    if (currentMoonData) {
        updateMoonDetector(currentMoonData);
    }
}

/**
 * 方位角補正をリセット
 */
function resetOrientationCorrection() {
    orientationCorrection.isCalibrated = false;
    orientationCorrection.offsetAngle = 0;
    orientationCorrection.isReversed = false;
    orientationCorrection.calibrationSamples = [];
    orientationCorrection.lastKnownTrueDirection = null;
    
    console.log('方位角補正をリセットしました');
    
    // UI更新のために即座に月探知機を更新
    if (currentMoonData) {
        updateMoonDetector(currentMoonData);
    }
}

// グローバル関数として公開（デバッグ用）
(window as any).toggleOrientationReverse = toggleOrientationReverse;
(window as any).setOrientationOffset = setOrientationOffset;
(window as any).resetOrientationCorrection = resetOrientationCorrection;

// フォールバック制御用のデバッグ関数
(window as any).forceFallbackToRelative = () => {
    console.log('🔄 強制的にdeviceorientationセンサーに切り替えます');
    setupSensorListener('deviceorientation');
};

(window as any).resetToAbsoluteSensor = () => {
    if ('ondeviceorientationabsolute' in window) {
        console.log('🔄 deviceorientationabsoluteセンサーに戻します');
        setupSensorListener('deviceorientationabsolute');
    } else {
        console.warn('⚠️ deviceorientationabsoluteはサポートされていません');
    }
};

// デバッグ用：手動センサー値設定機能
(window as any).testSensorValues = (alpha: number, beta: number, gamma: number) => {
    console.log(`手動センサー値設定: Alpha=${alpha}°, Beta=${beta}°, Gamma=${gamma}°`);
    
    // 手動でイベントを作成してhandleOrientationを呼び出し
    const mockEvent = {
        alpha: alpha,
        beta: beta,
        gamma: gamma
    } as DeviceOrientationEvent;
    
    handleOrientation(mockEvent);
    
    console.log('センサー値を手動で設定しました。UIの変化を確認してください。');
};

// デバッグ用：現在のセンサー状態を表示
(window as any).getCurrentSensorStatus = () => {
    console.log('=== 現在のセンサー状態 詳細診断 ===');
    console.log('ブラウザ情報:');
    console.log('  User Agent:', navigator.userAgent);
    console.log('  プロトコル:', location.protocol);
    console.log('  ホスト:', location.hostname);
    
    console.log('API サポート状況:');
    console.log('  DeviceOrientationEvent:', !!window.DeviceOrientationEvent);
    console.log('  deviceorientationabsolute:', 'ondeviceorientationabsolute' in window);
    console.log('  requestPermission:', typeof (DeviceOrientationEvent as any).requestPermission === 'function');
    
    console.log('フォールバック状況:');
    console.log('  現在使用中のイベント:', currentEventType || '未設定');
    console.log('  null値カウント:', nullValueCount);
    console.log('  フォールバックタイマー:', fallbackTimer ? '動作中' : '停止中');
    
    console.log('現在のセンサー値:');
    console.log('  alpha (方位角):', deviceOrientation.alpha);
    console.log('  beta (前後傾き):', deviceOrientation.beta);
    console.log('  gamma (左右傾き):', deviceOrientation.gamma);
    
    console.log('設定状況:');
    console.log('  センサータイプ:', (window as any).currentSensorType);
    console.log('  絶対センサー:', (window as any).isAbsoluteSensor);
    
    console.log('環境診断:');
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        console.warn('  ⚠️ HTTPSでないため、センサーアクセスが制限される可能性があります');
    } else {
        console.log('  ✅ HTTPS または localhost で動作しています');
    }
    
    if (!('ontouchstart' in window) && !navigator.maxTouchPoints) {
        console.warn('  ⚠️ タッチデバイスではない可能性があります（PC等）');
        console.log('  💡 PC上では開発者ツールのSensorsタブを使用してください');
    } else {
        console.log('  ✅ タッチデバイスまたはシミュレーター');
    }
    
    console.log('推奨アクション:');
    if (deviceOrientation.alpha === null && deviceOrientation.beta === null && deviceOrientation.gamma === null) {
        console.log('  1. testSensorValues(90, 0, 0) でテスト値を設定');
        console.log('  2. 開発者ツール → Sensors → Orientation を設定');
        console.log('  3. 実機でのテスト実行');
        if (currentEventType === 'deviceorientationabsolute') {
            console.log('  4. forceFallbackToRelative() で強制的に相対センサーに切り替え');
        }
    } else {
        console.log('  ✅ センサー値は正常に取得できています');
    }
    console.log('=====================================');
};

// デバッグ用：センサーイベントの強制発火テスト
(window as any).testEventFiring = () => {
    console.log('=== センサーイベント強制発火テスト ===');
    
    // 通常のdeviceorientationイベントもテスト
    const testEvents = ['deviceorientation', 'deviceorientationabsolute'];
    
    testEvents.forEach(eventType => {
        console.log(`${eventType} イベントをテスト中...`);
        
        // イベントリスナーの存在確認
        const listeners = (window as any).getEventListeners ? (window as any).getEventListeners(window) : 'getEventListeners未対応';
        console.log(`  登録済みリスナー:`, listeners);
        
        // 手動でイベントを発火
        try {
            const testEvent = new Event(eventType);
            (testEvent as any).alpha = 45;
            (testEvent as any).beta = 10;
            (testEvent as any).gamma = 5;
            
            window.dispatchEvent(testEvent);
            console.log(`  ✅ ${eventType} イベントを手動発火しました`);
        } catch (error) {
            console.error(`  ❌ ${eventType} イベントの発火に失敗:`, error);
        }
    });
    
    console.log('========================================');
};

// UI操作のイベントリスナー設定
if (toggleReverseBtn) {
    toggleReverseBtn.onclick = toggleOrientationReverseUI;
}

if (resetCorrectionBtn) {
    resetCorrectionBtn.onclick = resetOrientationCorrectionUI;
}

// 初期状態の表示
updateCorrectionStatus();

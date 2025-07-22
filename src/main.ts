import { getMoonData, getMoonTimes, MoonData, calculateAngleDifference, resetBlinkTimer, testSunCalcCoordinates } from './moon';
import { CompassManager } from './components/CompassManager';
import { DialogManager } from './ui/DialogManager';
import { StateManager } from './state/StateManager';
import { LocationManager } from './location/LocationManager';
import { DeviceOrientationManager } from './sensors/DeviceOrientationManager';
import { AccuracyDisplayManager } from './accuracy/AccuracyDisplayManager';
import { MoonDisplayManager } from './display/MoonDisplayManager';

// 磁気コンパス関連の要素
const compassCanvas = document.getElementById('compass-canvas') as HTMLCanvasElement;
const compassVolumeSlider = document.getElementById('compass-volume-slider') as HTMLInputElement;
const compassMuteButton = document.getElementById('compass-mute-button') as HTMLButtonElement;
const sensitivitySlider = document.getElementById('sensitivity-slider') as HTMLInputElement;
const sensitivityValue = document.querySelector('.sensitivity-value') as HTMLElement;

// 方位角補正コントロール関連の要素
const toggleReverseBtn = document.getElementById('toggle-reverse-btn') as HTMLButtonElement;
const resetCorrectionBtn = document.getElementById('reset-correction-btn') as HTMLButtonElement;
const correctionStatusElement = document.getElementById('correction-status');

// マネージャーインスタンス
const stateManager = StateManager.getInstance();
const dialogManager = DialogManager.getInstance();
const locationManager = LocationManager.getInstance();
const orientationManager = DeviceOrientationManager.getInstance();
const accuracyManager = AccuracyDisplayManager.getInstance();
const moonDisplayManager = MoonDisplayManager.getInstance();
let compassManager: CompassManager | null = null;

/**
 * Canvasのサイズをレスポンシブに調整
 */
function resizeCanvas() {
    if (!compassCanvas) return;
    
    // ビューポートサイズに基づいてサイズを直接計算
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxSize = 800;
    
    // CSS と同じ計算: min(80vw, 80vh, 400px)
    const targetSize = Math.min(vw * 0.8, vh * 0.8, maxSize);
    
    // デバイスピクセル比を考慮した高解像度設定
    const dpr = window.devicePixelRatio || 1;
    const canvasSize = Math.floor(targetSize * dpr);
    
    // Canvasの実際の描画サイズを設定
    compassCanvas.width = canvasSize;
    compassCanvas.height = canvasSize;
    
    // CSSサイズを設定
    compassCanvas.style.width = targetSize + 'px';
    compassCanvas.style.height = targetSize + 'px';
    
    // デバッグ情報
    console.log(`Canvas resized: ${targetSize}px (canvas: ${canvasSize}px, dpr: ${dpr})`);
    
    // コンパス表示を再描画
    if (compassManager) {
        compassManager.drawCompass(compassCanvas, currentMoonData);
    }
}

// CompassManagerの初期化
async function initializeCompassManager() {
    try {
        compassManager = new CompassManager();
        await compassManager.initialize();
        console.log('✅ CompassManagerを初期化しました');
    } catch (error) {
        console.error('❌ CompassManagerの初期化に失敗:', error);
    }
}

// アプリケーション全体の初期化
async function initializeApp() {
    try {
        console.log('🚀 アプリケーションを初期化中...');
        
        // マネージャーの初期化
        dialogManager.initialize();
        await locationManager.initialize();
        await orientationManager.initialize();
        accuracyManager.initialize();
        moonDisplayManager.initialize();
        await initializeCompassManager();
        
        // イベントリスナーの設定
        setupEventListeners();
        
        // Canvas初期化
        resizeCanvas();
        
        // 音波探知機とCompassManagerを初期化
        await initializeSonar();
        
        // 点滅タイマーを初期化
        resetBlinkTimer();
        
        console.log('✅ アプリケーションの初期化が完了しました');
    } catch (error) {
        console.error('❌ アプリケーションの初期化に失敗:', error);
    }
}

let currentPosition: GeolocationPosition | null = null;
let currentMoonData: MoonData | null = null;

// イベントリスナーの設定
function setupEventListeners() {
    // 位置情報更新イベント
    window.addEventListener('locationUpdate', (event: any) => {
        const position = event.detail.position;
        handleLocationUpdate(position);
    });
    
    // デバイス方向更新イベント
    window.addEventListener('orientationUpdate', () => {
        handleOrientationUpdate();
    });
    
    // UI操作のイベントリスナー設定
    if (toggleReverseBtn) {
        toggleReverseBtn.onclick = () => toggleOrientationReverseUI();
    }

    if (resetCorrectionBtn) {
        resetCorrectionBtn.onclick = () => resetOrientationCorrectionUI();
    }
    
    // ウィンドウリサイズ時にCanvasサイズを調整（デバウンス付き）
    let resizeTimeout: number | null = null;
    window.addEventListener('resize', () => {
        if (resizeTimeout) {
            clearTimeout(resizeTimeout);
        }
        resizeTimeout = window.setTimeout(() => {
            resizeCanvas();
            resizeTimeout = null;
        }, 100); // 100ms のデバウンス
    });

    // 画面の向き変更時にもCanvasサイズを調整
    window.addEventListener('orientationchange', () => {
        setTimeout(resizeCanvas, 300); // 向き変更後の遅延を増加
    });
}

function handleLocationUpdate(position: GeolocationPosition) {
    currentPosition = position;
    
    // SunCalcの座標系をテスト（デバッグ用）
    testSunCalcCoordinates(position.coords.latitude, position.coords.longitude);
    
    // 位置情報表示を更新
    moonDisplayManager.updateLocationInfo(position);
    
    updateDisplay();
}

function handleOrientationUpdate() {
    // デバイス向きの更新処理
    updateDisplay();
    updateCorrectionStatus();
}

function updateDisplay() {
    if (!currentPosition) return;

    const { latitude, longitude } = currentPosition.coords;
    const moonData = getMoonData(latitude, longitude);
    const moonTimes = getMoonTimes(latitude, longitude);
    
    // 現在の月データを保存
    currentMoonData = moonData;
    
    // StateManagerに月データを設定
    stateManager.set('moonData', moonData);
    
    // デバイス向きを取得
    const deviceOrientation = orientationManager.getOrientation();
    
    // 月表示を更新
    moonDisplayManager.updateMoonDisplay(moonData, moonTimes, currentPosition, deviceOrientation);
    
    // 精度表示を更新
    updateAccuracyDisplay();
}

/**
 * 方向一致度と高度一致度の計算・表示更新
 */
function updateAccuracyDisplay() {
    const deviceOrientation = orientationManager.getOrientation();
    accuracyManager.updateAccuracyDisplay(currentMoonData, deviceOrientation);
}

/**
 * 磁気コンパスの更新
 */
function updateCompassDetector(totalAngleDiff: number, clampedMoonAltitude: number) {
    if (compassManager) {
        compassManager.updateCompassDetector(totalAngleDiff, clampedMoonAltitude);
    }
}

/**
 * 磁気コンパスの画面を描画
 */
function drawCompassDisplay(canvas: HTMLCanvasElement) {
    if (compassManager) {
        compassManager.drawCompass(canvas, currentMoonData);
    }
}

/**
 * 月探知機の定期的な更新（センサーの変化を即座に反映）
 */
setInterval(() => {
    const deviceOrientation = orientationManager.getOrientation();
    if (currentMoonData && (deviceOrientation.alpha !== null && deviceOrientation.beta !== null)) {
        const deviceElevation = accuracyManager.calculateDeviceElevation(deviceOrientation.beta);
        const angleDiff = calculateAngleDifference(
            deviceOrientation.alpha,
            deviceElevation,
            currentMoonData.azimuth,
            currentMoonData.altitude
        );
        
        // 磁気コンパス探知機の更新
        updateCompassDetector(angleDiff, currentMoonData.altitude);
    }
}, 100); // 100ms間隔で滑らかだが敏感すぎない制御

// 音波探知機の描画ループ
function startSonarAnimation() {
    function animate() {
        drawCompassDisplay(compassCanvas);
        requestAnimationFrame(animate);
    }
    animate();
}

// 音波探知機の初期化
async function initializeSonar() {
    // CompassManagerのオーディオシステムは内部で初期化される
    
    // 磁気コンパス音量スライダーのイベントリスナー
    if (compassVolumeSlider) {
        compassVolumeSlider.value = '45'; // 初期音量45%
        compassVolumeSlider.addEventListener('input', (e) => {
            const volume = parseInt((e.target as HTMLInputElement).value) / 100;
            if (compassManager) {
                compassManager.setVolume(volume);
            }
        });
    }
    
    // 磁気コンパスミュートボタンのイベントリスナー
    if (compassMuteButton) {
        compassMuteButton.addEventListener('click', () => {
            const isMuted = compassMuteButton.classList.contains('muted');
            if (compassManager) {
                compassManager.setMuted(!isMuted);
            }
            
            if (isMuted) {
                compassMuteButton.classList.remove('muted');
                compassMuteButton.textContent = '🔊';
            } else {
                compassMuteButton.classList.add('muted');
                compassMuteButton.textContent = '🔇';
            }
        });
    }
    
    // 磁気感度スライダーのイベントリスナー
    if (sensitivitySlider) {
        sensitivitySlider.value = '5'; // 初期感度
        sensitivitySlider.addEventListener('input', (e) => {
            const value = parseInt((e.target as HTMLInputElement).value);
            if (compassManager) {
                compassManager.setSensitivity(value);
            }
            if (sensitivityValue) {
                sensitivityValue.textContent = value.toString();
            }
        });
    }
    
    // アニメーション開始
    startSonarAnimation();
    
    console.log('✅ 磁気コンパスシステムを初期化しました');
}

/**
 * 補正状態の表示を更新
 */
function updateCorrectionStatus() {
    if (!correctionStatusElement) return;
    
    const correctionStatus = orientationManager.getCorrectionStatus();
    const statusParts: string[] = [];
    
    if (correctionStatus.isReversed) {
        statusParts.push('🔄 東西反転補正: 有効');
    }
    
    if (correctionStatus.isCalibrated) {
        statusParts.push(`📐 オフセット: ${correctionStatus.offsetAngle.toFixed(1)}°`);
    }
    
    if (statusParts.length === 0) {
        correctionStatusElement.textContent = '補正なし（通常モード）';
        correctionStatusElement.style.color = '#95a5a6';
    } else {
        correctionStatusElement.textContent = statusParts.join(' | ');
        correctionStatusElement.style.color = '#2ecc71';
    }
    
    // ボタンの状態を更新
    if (toggleReverseBtn) {
        if (correctionStatus.isReversed) {
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
    const result = orientationManager.toggleOrientationReverse();
    updateCorrectionStatus();
    
    // フィードバックメッセージ
    const message = result ? 
        '✅ 東西反転補正を有効にしました' : 
        '❌ 東西反転補正を無効にしました';
    
    console.log(message);
    
    // 一時的にステータスにメッセージを表示
    if (correctionStatusElement) {
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
    orientationManager.resetOrientationCorrection();
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

// デバッグ用関数をグローバルに公開
(window as any).toggleOrientationReverse = () => orientationManager.toggleOrientationReverse();
(window as any).setOrientationOffset = (offset: number) => orientationManager.setOrientationOffset(offset);
(window as any).resetOrientationCorrection = () => orientationManager.resetOrientationCorrection();
(window as any).resetToAbsoluteSensor = () => orientationManager.resetToAbsoluteSensor();
(window as any).testSensorValues = (alpha: number, beta: number, gamma: number) => orientationManager.testSensorValues(alpha, beta, gamma);

// 初期状態の表示
updateCorrectionStatus();

// アプリケーション初期化
initializeApp();

console.log('=== 方位角キャリブレーション機能 ===');
console.log('東西が逆の場合: toggleOrientationReverse()');
console.log('オフセット設定: setOrientationOffset(角度)');
console.log('リセット: resetOrientationCorrection()');
console.log('=====================================');

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

console.log('=== デバッグ用手動センサー設定 ===');
console.log('testSensorValues(alpha, beta, gamma) - 手動でセンサー値を設定');
console.log('例: testSensorValues(90, 0, 0) - 東向き水平');
console.log('例: testSensorValues(0, 45, 0) - 北向き上向き45度');
console.log('=====================================');

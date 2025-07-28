import { getMoonData, getMoonTimes, MoonData, calculateAngleDifference, resetBlinkTimer } from './moon';
import { CompassManager } from './components/CompassManager';
import { MoonStatusDisplay } from './components/MoonStatusDisplay';
import { NotificationPanel } from './components/NotificationPanel';
import { DialogManager } from './ui/DialogManager';
import { StateManager } from './state/StateManager';
import { LocationManager } from './location/LocationManager';
import { DeviceOrientationManager } from './sensors/DeviceOrientationManager';
import { AccuracyDisplayManager } from './accuracy/AccuracyDisplayManager';
import { MoonDisplayManager } from './display/MoonDisplayManager';
import { DOMTranslationManager } from './ui/DOMTranslationManager';
import { initializeI18n } from './i18n';
import { LanguageSelector } from './components/LanguageSelector';
import { I18nManager } from './i18n/I18nManager';

// 磁気コンパス関連の要素
const compassCanvas = document.getElementById('compass-canvas') as HTMLCanvasElement;
// 音量、ミュートコントロールはCompassManager内で管理されるため、ここでは取得しない

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
const domTranslationManager = DOMTranslationManager.getInstance();
const notificationPanel = NotificationPanel.getInstance();
const i18nManager = I18nManager.getInstance();
// HTML言語属性の初期化
i18nManager.initialize();
let compassManager: CompassManager | null = null;
let moonStatusDisplay: MoonStatusDisplay | null = null;

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

// MoonStatusDisplayの初期化
function initializeMoonStatusDisplay() {
    try {
        moonStatusDisplay = new MoonStatusDisplay();
        console.log('✅ MoonStatusDisplayを初期化しました');
    } catch (error) {
        console.error('❌ MoonStatusDisplayの初期化に失敗:', error);
    }
}

// アプリケーション全体の初期化
async function initializeApp() {
    try {
        console.log('🚀 アプリケーションを初期化中...');
        
        // 多言語化システムの初期化
        await initializeI18n();
        console.log('🌍 多言語化システムを初期化しました');
        
        // DOM翻訳マネージャーの初期化
        domTranslationManager.initialize();
        
        // 言語選択UIの初期化
        LanguageSelector.getInstance();
        
        // 言語変更時のサブスクリプション（補正ステータスも更新）
        i18nManager.subscribe(() => {
            updateCorrectionStatus();
            updateCompassModeButtonText();
        });
        
        // マネージャーの初期化
        dialogManager.initialize();
        await locationManager.initialize();
        await orientationManager.initialize();
        accuracyManager.initialize();
        moonDisplayManager.initialize();
        notificationPanel.initialize();
        await initializeCompassManager();
        initializeMoonStatusDisplay();
        
        // イベントリスナーの設定
        setupEventListeners();
        
        // Canvas初期化
        resizeCanvas();
        
        // 音波探知機とCompassManagerを初期化
        await initializeSonar();
        
        // 点滅タイマーを初期化
        resetBlinkTimer();
        
        // 初期UI状態を設定
        updateCorrectionStatus();
        updateCompassModeButtonText();
        
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
    
    const compassModeToggleButton = document.getElementById('compass-mode-toggle');
    if (compassModeToggleButton) {
        compassModeToggleButton.addEventListener('click', () => {
            const currentMode = stateManager.get('ui').compassMode;
            // 3つのモードを循環: moon → user → compass → moon
            let newMode: 'moon' | 'user' | 'compass';
            if (currentMode === 'moon') {
                newMode = 'user';
            } else if (currentMode === 'user') {
                newMode = 'compass';
            } else { // currentMode === 'compass'
                newMode = 'moon';
            }
            console.log(`🔄 コンパスモード変更: ${currentMode} → ${newMode}`);
            
            stateManager.update('ui', ui => ({ ...ui, compassMode: newMode }));

            // ボタンのテキストを更新（翻訳対応）
            updateCompassModeButtonText();
        });
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

    // 設定ダイアログが開いた時にコンパスモードボタンのテキストを更新
    window.addEventListener('settingsDialogOpened', () => {
        updateCompassModeButtonText();
    });
}

function handleLocationUpdate(position: GeolocationPosition) {
    currentPosition = position;
    
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
    
    // 月ステータス表示を更新
    if (moonStatusDisplay && compassManager) {
        const compassState = compassManager.getCompassState();
        moonStatusDisplay.updateStatus(compassState, moonTimes);
    }
    
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
    // 音量、ミュートコントロールはすべてCompassManager内で管理される
    
    // アニメーション開始
    startSonarAnimation();
    
    console.log('✅ 磁気コンパスシステムを初期化しました');
}

/**
 * コンパスモードボタンのテキストを更新
 */
function updateCompassModeButtonText() {
    const compassModeToggleButton = document.getElementById('compass-mode-toggle');
    if (compassModeToggleButton) {
        const currentMode = stateManager.get('ui').compassMode;
        let targetText: string;
        
        if (currentMode === 'moon') {
            targetText = i18nManager.t('compass.mode.moonFixed');
        } else if (currentMode === 'user') {
            targetText = i18nManager.t('compass.mode.userFixed');
        } else { // currentMode === 'compass'
            targetText = i18nManager.t('compass.mode.compassFixed');
        }
        
        console.log(`🔄 コンパスモードボタン更新: mode=${currentMode}, text="${targetText}"`);
        compassModeToggleButton.textContent = targetText;
    } else {
        console.warn('⚠️ コンパスモードボタンが見つかりません');
    }
}

/**
 * 補正状態の表示を更新
 */
function updateCorrectionStatus() {
    if (!correctionStatusElement) return;
    
    const correctionStatus = orientationManager.getCorrectionStatus();
    const statusParts: string[] = [];
    
    if (correctionStatus.isReversed) {
        statusParts.push(`🔄 ${i18nManager.t('status.correctionReversed', { status: i18nManager.t('status.enabled') })}`);
    }
    
    if (correctionStatus.isCalibrated) {
        statusParts.push(`📐 ${i18nManager.t('status.correctionOffset', { offset: correctionStatus.offsetAngle.toFixed(1) })}`);
    }
    
    if (statusParts.length === 0) {
        correctionStatusElement.textContent = i18nManager.t('label.noData');
        correctionStatusElement.style.color = '#95a5a6';
    } else {
        correctionStatusElement.textContent = statusParts.join(' | ');
        correctionStatusElement.style.color = '#2ecc71';
    }
    
    // ボタンの状態を更新（翻訳対応）
    if (toggleReverseBtn) {
        if (correctionStatus.isReversed) {
            toggleReverseBtn.classList.add('active');
            toggleReverseBtn.textContent = `${i18nManager.t('settings.eastWestReverse')}: ${i18nManager.t('settings.status.on')}`;
        } else {
            toggleReverseBtn.classList.remove('active');
            toggleReverseBtn.textContent = `${i18nManager.t('settings.eastWestReverse')}: ${i18nManager.t('settings.status.off')}`;
        }
    }
}

/**
 * 手動で東西反転補正を設定/解除（UI版）
 */
function toggleOrientationReverseUI() {
    const result = orientationManager.toggleOrientationReverse();
    updateCorrectionStatus();
    
    // フィードバックメッセージ（翻訳対応）
    const message = result ? 
        i18nManager.t('status.correctionEnabled') : 
        i18nManager.t('status.correctionDisabled');
        
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
    
    const message = i18nManager.t('status.correctionReset');
    
    // 一時的にステータスにメッセージを表示
    if (correctionStatusElement) {
        correctionStatusElement.textContent = message;
        correctionStatusElement.style.color = '#f39c12';
        
        setTimeout(() => {
            updateCorrectionStatus();
        }, 2000);
    }
}

// デバッグ用関数をグローバルに公開（開発モードのみ）
if (import.meta.env.DEV) {
    console.log('=== 開発モード検出 ===');
    console.log('デバッグ機能を有効化します');
    console.log('📱 deviceorientationセンサー（相対センサー）を使用中');
    console.log('🛠️  Chrome DevTools > Sensors パネルでセンサー値をシミュレート可能');
    
    (window as any).toggleOrientationReverse = () => orientationManager.toggleOrientationReverse();
    (window as any).setOrientationOffset = (offset: number) => orientationManager.setOrientationOffset(offset);
    (window as any).resetOrientationCorrection = () => orientationManager.resetOrientationCorrection();
    
    console.log('=== 方位角キャリブレーション機能 ===');
    console.log('東西が逆の場合: toggleOrientationReverse()');
    console.log('オフセット設定: setOrientationOffset(角度)');
    console.log('リセット: resetOrientationCorrection()');
    console.log('=====================================');
    
    console.log('=== Chrome DevTools でのセンサーテスト方法 ===');
    console.log('1. F12 で DevTools を開く');
    console.log('2. [...] メニュー → More tools → Sensors');
    console.log('3. Orientation を "Custom orientation" に設定');
    console.log('4. Alpha（方位角）、Beta（前後傾き）、Gamma（左右傾き）を調整');
    console.log('   - Alpha: 0°=北, 90°=東, 180°=南, 270°=西');
    console.log('   - Beta: -90°=下向き, 0°=水平, 90°=上向き');
    console.log('   - Gamma: -90°=左傾き, 0°=水平, 90°=右傾き');
    console.log('===============================================');
    
    console.log('デバッグ用関数をグローバルに公開しました');
} else {
    console.log('=== 本番モード ===');
    console.log('📱 deviceorientationabsoluteセンサー（絶対センサー）を使用中');
}

// アプリケーション初期化
initializeApp().then(() => {
    // 初期化完了後に初期状態の表示を設定
    updateCorrectionStatus();
    updateCompassModeButtonText();
});

console.log('=== 方位角キャリブレーション機能 ===');
console.log('東西が逆の場合: toggleOrientationReverse()');
console.log('オフセット設定: setOrientationOffset(角度)');
console.log('リセット: resetOrientationCorrection()');
console.log('=====================================');

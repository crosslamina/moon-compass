import { getMoonData, getMoonTimes, MoonData, drawMoonPhaseSmall, calculateAngleDifference, resetBlinkTimer, testSunCalcCoordinates } from './moon';
import { getDirectionName } from './direction';
import { CompassManager } from './components/CompassManager';
import { DOMManager } from './ui/DOMManager';
import { StateManager } from './state/StateManager';

// DOM要素の取得
const deviceOrientationElement = document.getElementById('device-orientation');
const geoInfoElement = document.getElementById('geo-info');
const illuminationElement = document.getElementById('illumination');
const moonDirectionElement = document.getElementById('moon-direction');
const distanceElement = document.getElementById('distance');
const currentTimeElement = document.getElementById('current-time');
const moonPhaseElement = document.getElementById('moon-phase');
const altitudeElement = document.getElementById('altitude');
const moonRiseElement = document.getElementById('moon-rise');
const moonSetElement = document.getElementById('moon-set');
const mapLinkElement = document.getElementById('map-link') as HTMLAnchorElement;

const permissionButton = document.getElementById('permission-button') as HTMLButtonElement;
const locationPermissionButton = document.getElementById('location-permission-button') as HTMLButtonElement;
const locationStatusElement = document.getElementById('location-status');

// 磁気コンパス関連の要素
const compassCanvas = document.getElementById('compass-canvas') as HTMLCanvasElement;
const compassVolumeSlider = document.getElementById('compass-volume-slider') as HTMLInputElement;
const compassMuteButton = document.getElementById('compass-mute-button') as HTMLButtonElement;
const sensitivitySlider = document.getElementById('sensitivity-slider') as HTMLInputElement;
const sensitivityValue = document.querySelector('.sensitivity-value') as HTMLElement;
const directionMatchDetailElement = document.getElementById('direction-match-detail');
const altitudeMatchDetailElement = document.getElementById('altitude-match-detail');

/**
 * Canvasのサイズをレスポンシブに調整
 */
function resizeCanvas() {
    if (!compassCanvas) return;
    
    // ビューポートサイズに基づいてサイズを直接計算
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxSize = 400;
    
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
    if (typeof drawCompassDisplay === 'function') {
        drawCompassDisplay(compassCanvas);
    }
}

// 方位角補正コントロール関連の要素
const toggleReverseBtn = document.getElementById('toggle-reverse-btn') as HTMLButtonElement;
const resetCorrectionBtn = document.getElementById('reset-correction-btn') as HTMLButtonElement;
const correctionStatusElement = document.getElementById('correction-status');

// ダイアログ関連の要素
const infoButton = document.getElementById('info-button') as HTMLButtonElement;
const infoDialog = document.getElementById('info-dialog');
const closeDialogButton = document.getElementById('close-dialog') as HTMLButtonElement;

// 設定ダイアログ関連の要素
const settingsButton = document.getElementById('settings-button') as HTMLButtonElement;
const settingsDialog = document.getElementById('settings-dialog');
const closeSettingsDialogButton = document.getElementById('close-settings-dialog') as HTMLButtonElement;

// マネージャーインスタンス
const domManager = DOMManager.getInstance();
const stateManager = StateManager.getInstance();
let compassManager: CompassManager | null = null;

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

// デバイスの向きを保存する変数（後でStateManagerに移行予定）
let deviceOrientation = {
    alpha: null as number | null,  // 方位角（コンパス方向）
    beta: null as number | null,   // 前後の傾き（高度に対応）
    gamma: null as number | null   // 左右の傾き
};

// 磁気コンパス用オーディオクラス
// CompassAudio class moved to CompassManager


let currentPosition: GeolocationPosition | null = null;
let currentMoonData: MoonData | null = null;

function updateDisplay() {
    // 位置情報の表示
    if (geoInfoElement && currentPosition) {
        const coords = currentPosition.coords;
        geoInfoElement.textContent = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
    }
    if (!currentPosition) return;

    const { latitude, longitude } = currentPosition.coords;

    const moonData = getMoonData(latitude, longitude);
    const moonTimes = getMoonTimes(latitude, longitude);
    const directionName = getDirectionName(moonData.azimuth);

    // 現在の月データを保存
    currentMoonData = moonData;
    
    // StateManagerに月データを設定
    stateManager.set('moonData', moonData);

    if (moonDirectionElement) {
        // 補正後のデバイス方位角と月の方位角の差分を計算
        const deviceAlpha = deviceOrientation.alpha ?? 0;
        let azimuthDiff = deviceAlpha - moonData.azimuth;
        
        // -180°〜180°の範囲に正規化（最短角度差）
        while (azimuthDiff > 180) azimuthDiff -= 360;
        while (azimuthDiff < -180) azimuthDiff += 360;
        
        const absDiff = Math.abs(azimuthDiff);
        const direction = azimuthDiff > 0 ? '左' : '右';
        
        moonDirectionElement.textContent = `${directionName} ${moonData.azimuth.toFixed(1)}°`;
        
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
    if (moonPhaseElement) {
        moonPhaseElement.textContent = `月齢: ${getPhaseName(moonData.phase)} (${(moonData.phase * 29.53).toFixed(1)})`;
    }
    if (illuminationElement ) {
        illuminationElement.textContent = `照明率: ${(moonData.illumination * 100).toFixed(1)}%`;
    }
    if (altitudeElement) {
        altitudeElement.textContent = `高度: ${moonData.altitude.toFixed(2)}°`;
    }
    
    // 月の出・月の入り時刻の表示（未来の場合は残り時間も表示）
    const now = new Date();
    if (moonRiseElement) {
        if (moonTimes.rise) {
            const riseTime = moonTimes.rise.toLocaleTimeString();
            if (moonTimes.rise > now) {
                const diffMs = moonTimes.rise.getTime() - now.getTime();
                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                moonRiseElement.textContent = `月の出: ${riseTime} (あと${hours}:${minutes})`;
            } else {
                moonRiseElement.textContent = `月の出: ${riseTime}`;
            }
        } else {
            moonRiseElement.textContent = `月の出: N/A`;
        }
    }
    if (moonSetElement) {
        if (moonTimes.set) {
            const setTime = moonTimes.set.toLocaleTimeString();
            if (moonTimes.set > now) {
                const diffMs = moonTimes.set.getTime() - now.getTime();
                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                moonSetElement.textContent = `月の入り: ${setTime} (あと${hours}:${minutes})`;
            } else {
                moonSetElement.textContent = `月の入り: ${setTime}`;
            }
        } else {
            moonSetElement.textContent = `月の入り: N/A`;
        }
    }
    if (mapLinkElement) {
        mapLinkElement.href = `https://www.google.com/maps?q=${latitude},${longitude}`;
    }
    
    // 精度表示を更新
    updateAccuracyDisplay();
}

/**
 * 磁気コンパスの更新
 */
function updateCompassDetector(moonAzimuth: number, totalAngleDiff: number, clampedMoonAltitude: number) {
    if (compassManager) {
        compassManager.updateCompassDetector(moonAzimuth, totalAngleDiff, clampedMoonAltitude);
    }
}

/**
 * 方向一致度と高度一致度の計算・表示更新
 */
function updateAccuracyDisplay() {
    // 方向一致度の計算
    let directionMatchPercentage = 0;
    let altitudeMatchPercentage = 0;
    let deviceDirection = 0;
    let moonDirection = 0;
    let deviceElevation = 0;
    let moonElevation = 0;
    
    if (currentMoonData && deviceOrientation.alpha !== null) {
        deviceDirection = deviceOrientation.alpha;
        moonDirection = (currentMoonData as MoonData).azimuth;
        let directionDiff = Math.abs(deviceDirection - moonDirection);
        if (directionDiff > 180) {
            directionDiff = 360 - directionDiff;
        }
        const maxDiff = 180; // 最大差180度
        directionMatchPercentage = Math.max(0, (1 - directionDiff / maxDiff) * 100);
    }
    
    // 高度一致度の計算
    if (currentMoonData && deviceOrientation.beta !== null) {
        deviceElevation = calculateDeviceElevation(deviceOrientation.beta);
        moonElevation = (currentMoonData as MoonData).altitude;
        const elevationDiff = Math.abs(deviceElevation - moonElevation);
        const maxElevationDiff = 180; // 最大差180度
        altitudeMatchPercentage = Math.max(0, (1 - elevationDiff / maxElevationDiff) * 100);
    }
    
    // 詳細情報ダイアログの方位一致度と高度一致度を更新
    if (directionMatchDetailElement) {
        directionMatchDetailElement.textContent = `方位精度: ${directionMatchPercentage.toFixed(1)}%`;
    }
    if (altitudeMatchDetailElement) {
        altitudeMatchDetailElement.textContent = `高度精度: ${altitudeMatchPercentage.toFixed(1)}%`;
    }
}

/**
 * 針の長さを高度から計算する共通関数
 * 高度-90度:20%, 高度0度:60% (地平線), 高度+90度:100%
 */
function calculateNeedleLength(altitude: number, compassRadius: number): number {
    const baseRadius = compassRadius - 30; // 共通のベース半径
    
    // 高度-90度から+90度を20%から100%にマッピング
    // 高度0度(地平線)が60%になるように線形補間
    let lengthPercentage: number;
    
    if (altitude >= 0) {
        // 正の高度: 0度(60%) → +90度(100%)
        lengthPercentage = 0.6 + 0.4 * (altitude / 90);
    } else {
        // 負の高度: -90度(20%) → 0度(60%)
        lengthPercentage = 0.2 + 0.4 * ((altitude + 90) / 90);
    }
    
    return baseRadius * lengthPercentage;
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
    if (currentMoonData && (deviceOrientation.alpha !== null && deviceOrientation.beta !== null)) {
        const deviceElevation = calculateDeviceElevation(deviceOrientation.beta);
        const angleDiff = calculateAngleDifference(
            deviceOrientation.alpha,
            deviceElevation,
            currentMoonData.azimuth,
            currentMoonData.altitude
        );
        
        // 磁気コンパス探知機の更新
        updateCompassDetector(currentMoonData.azimuth, angleDiff, currentMoonData.altitude);
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

// ページ読み込み時に音波探知機とCompassManagerを初期化
initializeSonar();
initializeCompassManager();

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

    // StateManagerにデバイス向きを設定
    stateManager.set('deviceOrientation', deviceOrientation);

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
        
        deviceOrientationElement.textContent = 
            `方位: ${correctedAlpha?.toFixed(1) ?? 'N/A'}° | 傾き: ${filteredBeta?.toFixed(1) ?? 'N/A'}°`;
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
            deviceOrientationElement.textContent = 'センサー未対応';
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
                            deviceOrientationElement.textContent = 'センサー許可拒否';
                        }
                    }
                } catch (error) {
                    console.error('Device orientation permission error:', error);
                    if (deviceOrientationElement) {
                        deviceOrientationElement.textContent = 'センサーエラー';
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
    
    // 位置情報取得成功時のステータス更新（表示を消す）
    if (locationStatusElement) {
        locationStatusElement.textContent = '';
        locationStatusElement.style.display = 'none';
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
        locationStatusElement.style.display = 'block';
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
        locationStatusElement.style.display = 'block';
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
 * ダイアログを開く
 */
function openDialog() {
    // 設定ダイアログが開いている場合は閉じる
    if (settingsDialog && settingsDialog.style.display === 'flex') {
        closeSettingsDialog();
    }
    
    if (infoDialog) {
        infoDialog.style.display = 'flex';
        // フェードイン効果
        setTimeout(() => {
            infoDialog.style.opacity = '1';
        }, 10);
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

/**
 * 設定ダイアログを開く
 */
function openSettingsDialog() {
    // 詳細情報ダイアログが開いている場合は閉じる
    if (infoDialog && infoDialog.style.display === 'flex') {
        closeDialog();
    }
    
    if (settingsDialog) {
        settingsDialog.style.display = 'flex';
        // フェードイン効果
        setTimeout(() => {
            settingsDialog.style.opacity = '1';
        }, 10);
    }
}

/**
 * 設定ダイアログを閉じる
 */
function closeSettingsDialog() {
    if (settingsDialog) {
        settingsDialog.style.opacity = '0';
        // フェードアウト後に非表示
        setTimeout(() => {
            settingsDialog.style.display = 'none';
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

// 設定ダイアログのイベントリスナー設定
if (settingsButton) {
    settingsButton.onclick = openSettingsDialog;
}

if (closeSettingsDialogButton) {
    closeSettingsDialogButton.onclick = closeSettingsDialog;
}

// ダイアログの背景をクリックしても閉じる
if (infoDialog) {
    infoDialog.onclick = (event) => {
        if (event.target === infoDialog) {
            closeDialog();
        }
    };
}

// 設定ダイアログの背景をクリックしても閉じる
if (settingsDialog) {
    settingsDialog.onclick = (event) => {
        if (event.target === settingsDialog) {
            closeSettingsDialog();
        }
    };
}

// ESCキーでダイアログを閉じる
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        if (infoDialog && infoDialog.style.display === 'flex') {
            closeDialog();
        } else if (settingsDialog && settingsDialog.style.display === 'flex') {
            closeSettingsDialog();
        }
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
    console.log('東西反転の自動検出は実装中です。手動で設定できるようにログ出力しています。');
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

// Canvasのレスポンシブ初期化
resizeCanvas();

// リサイズのデバウンス用タイマー
let resizeTimeout: number | null = null;

// ウィンドウリサイズ時にCanvasサイズを調整（デバウンス付き）
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

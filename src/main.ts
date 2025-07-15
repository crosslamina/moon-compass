const deviceOrientationElement = document.getElementById('device-orientation');
const geoInfoElement = document.getElementById('geo-info');
import { getMoonData, getMoonTimes, MoonData, MoonTimes, drawMoonPhase, calculateAngleDifference, calculateBlinkIntensity, resetBlinkTimer } from './moon';
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
        const azimuthDiff = Math.abs(deviceOrientation.alpha ?? 0 - moonData.azimuth);
        const shortestDiff = azimuthDiff > 180 ? 360 - azimuthDiff : azimuthDiff;
        moonDirectionElement.textContent = `方角: ${moonData.azimuth.toFixed(1)}° ${directionName} (差: ${shortestDiff.toFixed(1)}°)`;
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
    const rawAlpha = event.alpha;
    const rawBeta = event.beta;
    const rawGamma = event.gamma;

    // センサー値にフィルタを適用
    const filteredAlpha = applySensorFilter(rawAlpha, sensorFilter.alpha, lastFilteredValues.alpha);
    const filteredBeta = applySensorFilter(rawBeta, sensorFilter.beta, lastFilteredValues.beta);
    const filteredGamma = applySensorFilter(rawGamma, sensorFilter.gamma, lastFilteredValues.gamma);

    // フィルター済み値を保存
    lastFilteredValues.alpha = filteredAlpha;
    lastFilteredValues.beta = filteredBeta;
    lastFilteredValues.gamma = filteredGamma;

    // ブラウザ固有の補正を適用
    const correctedAlpha = correctOrientationForBrowser(filteredAlpha, navigator.userAgent);

    // デバイスの向きを保存
    deviceOrientation.alpha = correctedAlpha;
    deviceOrientation.beta = filteredBeta;
    deviceOrientation.gamma = filteredGamma;

    if (deviceOrientationElement) {
        const deviceElevationForDisplay = deviceOrientation.beta ? calculateDeviceElevation(deviceOrientation.beta) : null;
        deviceOrientationElement.innerHTML = 
            `デバイス方位（alpha/コンパス）: ${correctedAlpha?.toFixed(1) ?? 'N/A'}°<br>` +
            `前後傾き（beta）: ${filteredBeta?.toFixed(1) ?? 'N/A'}°<br>` +
            `計算された高度角: ${deviceElevationForDisplay?.toFixed(1) ?? 'N/A'}°<br>` +
            `左右傾き（gamma）: ${filteredGamma?.toFixed(1) ?? 'N/A'}°<br>` +
            `<small>alpha: 0°=北 90°=東 180°=南 270°=西<br>` +
            `beta: -90°=後傾 0°=水平 90°=前傾 ±180°=逆さま<br>` +
            `高度角: -90°=真下 0°=水平 90°=真上<br>` +
            `gamma: 0°=水平 90°=右傾 -90°=左傾<br>` +
            `フィルター: ${FILTER_SIZE}サンプル移動平均（閾値: ${CHANGE_THRESHOLD}°）適用</small>`;
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

/**
 * プラットフォーム固有のセンサー最適化を設定
 */
function optimizeSensorForPlatform() {
    const userAgent = navigator.userAgent;
    
    // iOS での最適化
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
        // iOS では deviceorientationabsolute イベントも試行
        if ('ondeviceorientationabsolute' in window) {
            window.addEventListener('deviceorientationabsolute', handleOrientation);
            console.log('iOS: deviceorientationabsolute イベントを使用');
        }
    }
    
    // Android での最適化
    if (userAgent.includes('Android')) {
        // Android では高頻度更新を試行
        if ('ondeviceorientationabsolute' in window) {
            window.addEventListener('deviceorientationabsolute', handleOrientation);
            console.log('Android: deviceorientationabsolute イベントを使用');
        }
    }
    
    // センサーの更新頻度をログ出力
    let eventCount = 0;
    let lastTime = Date.now();
    
    const originalHandler = handleOrientation;
    const frequencyTrackingHandler = function(event: DeviceOrientationEvent) {
        eventCount++;
        const now = Date.now();
        
        if (now - lastTime >= 5000) { // 5秒ごとに頻度をログ
            const frequency = eventCount / 5;
            console.log(`センサー更新頻度: ${frequency.toFixed(1)} Hz`);
            eventCount = 0;
            lastTime = now;
        }
        
        originalHandler(event);
    };
    
    // 頻度追跡ハンドラーをイベントリスナーとして設定
    window.addEventListener('deviceorientation', frequencyTrackingHandler);
}

// DeviceOrientationEventのサポート判定とイベント登録
async function setupDeviceOrientation() {
    if (!window.DeviceOrientationEvent) {
        if (deviceOrientationElement) {
            deviceOrientationElement.innerHTML = 'このブラウザはデバイスの向き取得（DeviceOrientationEvent）に対応していません。';
        }
        return;
    }

    // iOS 13+では権限要求が必要
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        // 権限ボタンを表示
        if (permissionButton) {
            permissionButton.style.display = 'block';
            permissionButton.onclick = async () => {
                try {
                    const permission = await (DeviceOrientationEvent as any).requestPermission();
                    if (permission === 'granted') {
                        window.addEventListener('deviceorientation', handleOrientation);
                        permissionButton.style.display = 'none';
                    } else {
                        if (deviceOrientationElement) {
                            deviceOrientationElement.innerHTML = 'デバイスの向き取得の許可が拒否されました。';
                        }
                    }
                } catch (error) {
                    console.error('Device orientation permission error:', error);
                    if (deviceOrientationElement) {
                        deviceOrientationElement.innerHTML = 'デバイスの向き取得でエラーが発生しました。';
                    }
                }
            };
        }
    } else {
        // Android等、権限要求が不要な場合
        window.addEventListener('deviceorientation', handleOrientation);
    }
}

// ページ読み込み時にセットアップ
setupDeviceOrientation();
optimizeSensorForPlatform();
optimizeSensorForPlatform();

// 点滅タイマーを初期化
resetBlinkTimer();

function positionUpdate(position: GeolocationPosition) {
    currentPosition = position;
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
        return;
    }

    const deviceAlpha = deviceOrientation.alpha;
    const deviceBeta = deviceOrientation.beta;

    if (deviceAlpha === null || deviceBeta === null) {
        detectorStatusElement.textContent = '📱 デバイスの向きセンサーが利用できません';
        detectorStatusElement.className = 'detector-inactive';
        return;
    }

    // 月の方位角と高度
    const moonAzimuth = moonData.azimuth;
    const moonAltitude = moonData.altitude;

    // === 直感的なコンパス更新 ===
    
    // コンパス針の回転（デバイスの向き）
    if (compassNeedle) {
        // コンパス針をデバイスの向きに合わせて回転
        // deviceAlpha: 0°=北, 90°=東, 180°=南, 270°=西
        // CSS: 上=0°, 右=90°, 下=180°, 左=270° (時計回り)
        // 両方の座標系が一致しているので、そのまま使用
        compassNeedle.style.transform = `translate(-50%, -100%) rotate(${deviceAlpha}deg)`;
    }
    
    // 月のターゲット位置（コンパス円周上）
    if (moonTarget) {
        // 月の方位角をコンパス円周上の位置に変換
        // moonAzimuth: 0°=北, 90°=東, 180°=南, 270°=西
        // CSS座標系: 上=0°, 右=90度 なので、-90度で調整
        const moonRadians = (moonAzimuth - 90) * Math.PI / 180;
        const radius = 65; // コンパス半径から少し内側
        const x = Math.cos(moonRadians) * radius;
        const y = Math.sin(moonRadians) * radius;
        moonTarget.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    }

    // === 高度インジケーター更新 ===
    
    const deviceElevation = calculateDeviceElevation(deviceBeta);
    const clampedMoonAltitude = Math.max(-90, Math.min(90, moonAltitude)); // 月の高度も-90〜90度に制限
    
    // デバイスセンサーの値をログ出力（デバッグ用）
    console.log('Device orientation debug:', {
        rawBeta: deviceBeta,
        deviceElevation: deviceElevation,
        alpha: deviceAlpha,  // コンパス方位
        gamma: deviceOrientation.gamma // 左右傾き
    });
    console.log('Moon position debug:', {
        azimuth: moonAzimuth, // 月の方位角
        altitude: moonAltitude, // 月の高度
        clampedAltitude: clampedMoonAltitude // 制限された月の高度
    });
    // === 角度差の計算 ===
    
    let azimuthDiff = Math.abs(deviceAlpha - moonAzimuth);
    if (azimuthDiff > 180) {
        azimuthDiff = 360 - azimuthDiff; // 最短角度差を計算
    }
    
    const altitudeDiff = Math.abs(deviceElevation - clampedMoonAltitude);
    const totalAngleDiff = calculateAngleDifference(deviceAlpha, deviceElevation, moonAzimuth, clampedMoonAltitude);
    
    // 詳細なデバッグ情報を追加
    console.log('Angle differences:', {
        deviceAlpha: deviceAlpha,
        moonAzimuth: moonAzimuth,
        rawAzimuthDiff: deviceAlpha - moonAzimuth,
        absAzimuthDiff: Math.abs(deviceAlpha - moonAzimuth),
        shortestAzimuthDiff: azimuthDiff,
        altitudeDiff: altitudeDiff,
        totalAngleDiff: totalAngleDiff
    });

    // === 探知状態の判定 ===
    
    const azimuthThreshold = 10; // 方向の許容差（度）
    const altitudeThreshold = 15; // 高度の許容差（度）

    if (azimuthDiff <= azimuthThreshold && altitudeDiff <= altitudeThreshold) {
        // 月を発見！
        if (moonAltitude < 0) {
            detectorStatusElement.textContent = '🌙 地平線下の月を発見しました！';
        } else {
            detectorStatusElement.textContent = '🌙 月を発見しました！';
        }
        detectorStatusElement.className = 'detector-found';
        
        // バイブレーション（対応デバイスのみ）
        if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
        }
    } else if (azimuthDiff <= azimuthThreshold * 2 && altitudeDiff <= altitudeThreshold * 2) {
        // 月に近づいている
        const blinkFreq = totalAngleDiff <= 20 ? '高速' : totalAngleDiff <= 40 ? '中速' : '低速';
        const locationText = moonAltitude < 0 ? '（地平線下）' : '';
        detectorStatusElement.textContent = `🔍 月に近づいています...${locationText}（${blinkFreq}点滅）`;
        detectorStatusElement.className = 'detector-close';
    } else {
        // 月を探している
        const blinkFreq = totalAngleDiff >= 80 ? '点滅なし' : totalAngleDiff >= 60 ? 'ゆっくり' : '低速';
        const locationText = moonAltitude < 0 ? '（地平線下）' : '';
        detectorStatusElement.textContent = `🔭 月を探しています...${locationText}（${blinkFreq}点滅）`;
        detectorStatusElement.className = 'detector-inactive';
    }

    // 月高度マーカーの表示調整（地平線下でも表示）
    if (moonAltitudeMarker) {
        if (moonAltitude < 0) {
            // 地平線下では少し薄く表示
            moonAltitudeMarker.style.opacity = '0.7';
            moonAltitudeMarker.style.background = '#e67e22'; // オレンジ色に変更
        } else {
            // 地平線上では通常表示
            moonAltitudeMarker.style.opacity = '1';
            moonAltitudeMarker.style.background = '#2ecc71'; // 緑色
        }
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

// ブラウザ環境での方位センサー補正とフィルタリング
let sensorFilter = {
    alpha: [] as number[],
    beta: [] as number[],
    gamma: [] as number[]
};

// 前回の値を保存（変化量チェック用）
let lastFilteredValues = {
    alpha: null as number | null,
    beta: null as number | null,
    gamma: null as number | null
};

const FILTER_SIZE = 10; // 移動平均のサンプル数（敏感さを抑制するため増加）
const CHANGE_THRESHOLD = 2; // 変化の最小閾値（度）- これ以下の変化は無視

/**
 * センサー値にローパスフィルターを適用
 * @param value 新しいセンサー値
 * @param filterArray フィルター用の配列
 * @param lastValue 前回のフィルター済み値
 * @returns フィルター済みの値
 */
function applySensorFilter(value: number | null, filterArray: number[], lastValue: number | null): number | null {
    if (value === null) return null;
    
    // 配列に新しい値を追加
    filterArray.push(value);
    
    // 配列サイズを制限
    if (filterArray.length > FILTER_SIZE) {
        filterArray.shift();
    }
    
    // 移動平均を計算
    const sum = filterArray.reduce((acc, val) => acc + val, 0);
    const filteredValue = sum / filterArray.length;
    
    // 前回値がある場合、変化量をチェック
    if (lastValue !== null) {
        const change = Math.abs(filteredValue - lastValue);
        
        // 変化が閾値以下の場合、前回値を返す（ノイズ除去）
        if (change < CHANGE_THRESHOLD) {
            return lastValue;
        }
        
        // 大きな変化の場合は指数移動平均でさらに滑らかにする
        if (change > 30) { // 30度以上の大きな変化
            const alpha = 0.3; // 指数移動平均の係数（小さいほど滑らか）
            return lastValue + alpha * (filteredValue - lastValue);
        }
    }
    
    return filteredValue;
}

/**
 * ブラウザ固有の方位センサー補正
 * @param alpha 生の方位角
 * @param userAgent ユーザーエージェント文字列
 * @returns 補正された方位角
 */
function correctOrientationForBrowser(alpha: number | null, userAgent: string): number | null {
    if (alpha === null) return null;
    
    // iOS Safari での補正
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
        // iOS では webkitCompassHeading が利用可能な場合がある
        return alpha;
    }
    
    // Android Chrome での補正
    if (userAgent.includes('Android') && userAgent.includes('Chrome')) {
        // Android では方位角が反転している場合がある
        return alpha;
    }
    
    return alpha;
}

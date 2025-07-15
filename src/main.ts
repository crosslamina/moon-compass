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
const azimuthDifferenceElement = document.getElementById('azimuth-difference');
const altitudeDifferenceElement = document.getElementById('altitude-difference');
const permissionButton = document.getElementById('permission-button') as HTMLButtonElement;
const locationPermissionButton = document.getElementById('location-permission-button') as HTMLButtonElement;
const locationStatusElement = document.getElementById('location-status');

// デバイスの向きを保存する変数
let deviceOrientation = {
    alpha: null as number | null,  // 方位角（コンパス方向）
    beta: null as number | null,   // 前後の傾き（高度に対応）
    gamma: null as number | null   // 左右の傾き
};

// 月探知機の更新をスロットリングするための変数
let lastDetectorUpdate = 0;
const DETECTOR_UPDATE_INTERVAL = 50; // 50ms間隔で更新（スムーズな応答性）


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
        moonDirectionElement.textContent = `方角: ${moonData.azimuth.toFixed(2)}° ${directionName}`;
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
            const deviceElevation = Math.max(0, Math.min(90, 90 - deviceOrientation.beta));
            
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
            const deviceElevation = Math.max(0, Math.min(90, 90 - deviceOrientation.beta));
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
}, 50); // 50ms間隔でより滑らかな点滅制御

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
    const alpha = event.alpha;
    const beta = event.beta;
    const gamma = event.gamma;

    // デバイスの向きを保存
    deviceOrientation.alpha = alpha;
    deviceOrientation.beta = beta;
    deviceOrientation.gamma = gamma;

    if (deviceOrientationElement) {
        deviceOrientationElement.innerHTML = 
            `デバイス方位（alpha/コンパス）: ${alpha?.toFixed(1) ?? 'N/A'}°<br>` +
            `前後傾き（beta）: ${beta?.toFixed(1) ?? 'N/A'}°<br>` +
            `左右傾き（gamma）: ${gamma?.toFixed(1) ?? 'N/A'}°<br>` +
            `<small>alpha: 0°=北 90°=東 180°=南 270°=西<br>` +
            `beta: 0°=水平 90°=前傾 -90°=後傾<br>` +
            `gamma: 0°=水平 90°=右傾 -90°=左傾</small>`;
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
 * 月探知機の状態を更新
 */
function updateMoonDetector(moonData: MoonData) {
    if (!detectorStatusElement || !azimuthDifferenceElement || !altitudeDifferenceElement) {
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

    // デバイスセンサーの値をログ出力（デバッグ用）
    console.log('Device orientation:', {
        alpha: deviceAlpha,  // コンパス方位
        beta: deviceBeta,    // 前後傾き  
        gamma: deviceOrientation.gamma // 左右傾き
    });
    console.log('Moon position:', {
        azimuth: moonAzimuth, // 月の方位角
        altitude: moonAltitude // 月の高度
    });

    // === 現在の実装: alpha ↔ azimuth, beta ↔ altitude ===
    let azimuthDiff = Math.abs(deviceAlpha - moonAzimuth);
    if (azimuthDiff > 180) {
        azimuthDiff = 360 - azimuthDiff; // 最短角度差を計算
    }

    // 方向の判定（最短方向）
    let azimuthDirection = '';
    if (azimuthDiff > 5) { // 5度以上の差がある場合のみ表示
        let angleDiff = moonAzimuth - deviceAlpha;
        if (angleDiff > 180) angleDiff -= 360;
        if (angleDiff < -180) angleDiff += 360;
        azimuthDirection = angleDiff > 0 ? '→右に' : '←左に';
    }

    // デバイスの傾き（beta）を月の高度と比較
    // betaは前後の傾き（0度=水平、90度=上向き、-90度=下向き）
    // 月の高度は水平線からの角度（0度=水平線、90度=天頂）
    const deviceElevation = Math.max(0, Math.min(90, 90 - deviceBeta)); // betaから高度に変換
    const altitudeDiff = Math.abs(deviceElevation - moonAltitude);

    // 全体の角度差を計算（点滅情報として表示）
    const totalAngleDiff = calculateAngleDifference(deviceAlpha, deviceElevation, moonAzimuth, moonAltitude);
    const blinkIntensity = calculateBlinkIntensity(totalAngleDiff, Date.now());
    
    // 点滅間隔を計算（より正確な表示）
    let blinkInterval = '';
    if (totalAngleDiff <= 3) {
        blinkInterval = '点滅停止';
    } else if (totalAngleDiff >= 120) {
        blinkInterval = '点滅なし';
    } else {
        const normalizedAngle = Math.max(0, Math.min(1, (120 - totalAngleDiff) / (120 - 3)));
        const blinkPeriod = 2000 - (normalizedAngle * 1700); // ms
        const intervalSeconds = (blinkPeriod / 1000).toFixed(1);
        blinkInterval = `${intervalSeconds}秒間隔（規則的）`;
    }
    
    // 方向差と高度差を表示（点滅情報を追加）
    const altitudeDirection = altitudeDiff > 5 ? (deviceElevation > moonAltitude ? '↓下に' : '↑上に') : '';
    
    azimuthDifferenceElement.innerHTML = `方向差: ${azimuthDiff.toFixed(1)}° ${azimuthDirection}<br>` +
        `デバイス: ${deviceAlpha.toFixed(1)}° / 月: ${moonAzimuth.toFixed(1)}°`;
    
    altitudeDifferenceElement.innerHTML = `高度差: ${altitudeDiff.toFixed(1)}° ${altitudeDirection}<br>` +
        `デバイス: ${deviceElevation.toFixed(1)}° / 月: ${moonAltitude.toFixed(1)}°<br>` +
        `<small>総角度差: ${totalAngleDiff.toFixed(1)}° (${blinkInterval})</small>`;

    // 探知状態の判定
    const azimuthThreshold = 10; // 方向の許容差（度）
    const altitudeThreshold = 15; // 高度の許容差（度）

    if (azimuthDiff <= azimuthThreshold && altitudeDiff <= altitudeThreshold) {
        // 月を発見！
        detectorStatusElement.textContent = '🌙 月を発見しました！';
        detectorStatusElement.className = 'detector-found';
        
        // バイブレーション（対応デバイスのみ）
        if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
        }
    } else if (azimuthDiff <= azimuthThreshold * 2 && altitudeDiff <= altitudeThreshold * 2) {
        // 月に近づいている
        const blinkFreq = totalAngleDiff <= 20 ? '高速' : totalAngleDiff <= 40 ? '中速' : '低速';
        detectorStatusElement.textContent = `🔍 月に近づいています...（${blinkFreq}点滅）`;
        detectorStatusElement.className = 'detector-close';
    } else {
        // 月を探している
        const blinkFreq = totalAngleDiff >= 80 ? '点滅なし' : totalAngleDiff >= 60 ? 'ゆっくり' : '低速';
        detectorStatusElement.textContent = `🔭 月を探しています...（${blinkFreq}点滅）`;
        detectorStatusElement.className = 'detector-inactive';
    }

    // 月が地平線下にある場合の処理
    if (moonAltitude < 0) {
        detectorStatusElement.textContent = '🌙 月は地平線下にあります';
        detectorStatusElement.className = 'detector-inactive';
        altitudeDifferenceElement.innerHTML += '<br><small>月は現在見えません</small>';
    }
}

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

    // フィルターを無効化：生のセンサー値をそのまま使用
    const filteredAlpha = rawAlpha;
    const filteredBeta = rawBeta;
    const filteredGamma = rawGamma;

    // ブラウザ固有の補正を適用
    const correctedAlpha = correctOrientationForBrowser(filteredAlpha, navigator.userAgent);

    // 動的補正のための分析（サンプル収集）
    if (filteredAlpha !== null) {
        detectAndCorrectOrientation(filteredAlpha);
    }

    // デバイスの向きを保存
    deviceOrientation.alpha = correctedAlpha;
    deviceOrientation.beta = filteredBeta;
    deviceOrientation.gamma = filteredGamma;

    if (deviceOrientationElement) {
        const deviceElevationForDisplay = deviceOrientation.beta ? calculateDeviceElevation(deviceOrientation.beta) : null;
        const sensorType = '絶対方位センサー（磁北基準）';
        
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
            `<strong>センサー種別: ${sensorType}</strong>${correctionInfo}<br>` +
            `デバイス方位（alpha/コンパス）: ${correctedAlpha?.toFixed(1) ?? 'N/A'}°<br>` +
            `前後傾き（beta）: ${filteredBeta?.toFixed(1) ?? 'N/A'}°<br>` +
            `計算された高度角: ${deviceElevationForDisplay?.toFixed(1) ?? 'N/A'}°<br>` +
            `左右傾き（gamma）: ${filteredGamma?.toFixed(1) ?? 'N/A'}°<br>` +
            `<small>alpha: 0°=北 90°=東 180°=南 270°=西<br>` +
            `beta: -90°=後傾 0°=水平 90°=前傾 ±180°=逆さま<br>` +
            `高度角: -90°=真下 0°=水平 90°=真上<br>` +
            `gamma: 0°=水平 90°=右傾 -90°=左傾<br>` +
            `<strong>フィルター: 無効（生センサー値使用）</strong><br>` +
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

// DeviceOrientationEventのサポート判定とイベント登録
async function setupDeviceOrientation() {
    if (!window.DeviceOrientationEvent) {
        if (deviceOrientationElement) {
            deviceOrientationElement.innerHTML = 'このブラウザはデバイスの向き取得（DeviceOrientationEvent）に対応していません。';
        }
        return;
    }

    // deviceorientationabsoluteが利用可能かチェック
    const hasAbsoluteOrientation = 'ondeviceorientationabsolute' in window;
    
    if (!hasAbsoluteOrientation) {
        if (deviceOrientationElement) {
            deviceOrientationElement.innerHTML = '❌ このブラウザは絶対方位センサー（deviceorientationabsolute）に対応していません。<br>磁北基準の正確な方位角が取得できません。';
        }
        console.error('deviceorientationabsolute は利用できません。このアプリには絶対方位センサーが必要です。');
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
                        // deviceorientationabsoluteのみを使用
                        window.addEventListener('deviceorientationabsolute', handleOrientation);
                        console.log('iOS: 絶対方位センサー（deviceorientationabsolute）を使用 - 磁北基準');
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
        // deviceorientationabsoluteのみを使用
        window.addEventListener('deviceorientationabsolute', handleOrientation);
        console.log('絶対方位センサー（deviceorientationabsolute）を使用 - 磁北基準の真の方位角');
    }
}

// ページ読み込み時にセットアップ
setupDeviceOrientation();

// キャリブレーション情報を表示
console.log('=== 方位角キャリブレーション機能 ===');
console.log('東西が逆の場合: toggleOrientationReverse()');
console.log('オフセット設定: setOrientationOffset(角度)');
console.log('リセット: resetOrientationCorrection()');
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
        // CSS rotate: 0°=上, 90°=右, 180°=下, 270°=左 (時計回り)
        // 両方の座標系が一致しているので、そのまま使用
        compassNeedle.style.transform = `translate(-50%, -100%) rotate(${deviceAlpha}deg)`;
        
        // デバッグ用：デバイス方位の詳細を出力
        console.log('Compass needle position debug:', {
            deviceAlpha: deviceAlpha,
            finalTransform: `translate(-50%, -100%) rotate(${deviceAlpha}deg)`
        });
    }
    
    // 月のターゲット位置（コンパス円周上）
    if (moonTarget) {
        // 月の方位角をコンパス円周上の位置に変換
        // moonAzimuth: 0°=北, 90°=東, 180°=南, 270°=西 (北から時計回り)
        // CSS rotate: 0°=上, 90°=右, 180°=下, 270°=左 (上から時計回り)
        // 
        // コンパス針と同じ座標系を使用するため、rotate変換を使用
        // 針と同様に、デバイスの方位角をそのまま使用
        moonTarget.style.transform = `translate(-50%, -50%) rotate(${moonAzimuth}deg) translateY(-65px)`;
        
        // デバッグ用：月の位置計算の詳細を出力
        console.log('Moon target position debug (rotate method):', {
            moonAzimuth: moonAzimuth,
            finalTransform: `translate(-50%, -50%) rotate(${moonAzimuth}deg) translateY(-65px)`
        });
    }

    // === 高度インジケーター更新 ===
    
    const deviceElevation = calculateDeviceElevation(deviceBeta);
    const clampedMoonAltitude = Math.max(-90, Math.min(90, moonAltitude)); // 月の高度も-90〜90度に制限
    
    // 高度インジケーターのマーカー位置を更新
    updateAltitudeMarkers(deviceElevation, clampedMoonAltitude);
    
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
    console.log('=== コンパス位置の詳細デバッグ ===');
    console.log('Angle differences:', {
        deviceAlpha: deviceAlpha,
        moonAzimuth: moonAzimuth,
        rawAzimuthDiff: deviceAlpha - moonAzimuth,
        absAzimuthDiff: Math.abs(deviceAlpha - moonAzimuth),
        shortestAzimuthDiff: azimuthDiff,
        altitudeDiff: altitudeDiff,
        totalAngleDiff: totalAngleDiff
    });
    
    // 方位角の方向名を表示（分かりやすさのため）
    const getDirectionFromAngle = (angle: number) => {
        if (angle >= 0 && angle < 22.5) return '北';
        if (angle >= 22.5 && angle < 67.5) return '北東';
        if (angle >= 67.5 && angle < 112.5) return '東';
        if (angle >= 112.5 && angle < 157.5) return '南東';
        if (angle >= 157.5 && angle < 202.5) return '南';
        if (angle >= 202.5 && angle < 247.5) return '南西';
        if (angle >= 247.5 && angle < 292.5) return '西';
        if (angle >= 292.5 && angle < 337.5) return '北西';
        return '北';
    };
    
    console.log('Direction comparison:', {
        deviceDirection: `${deviceAlpha.toFixed(1)}° (${getDirectionFromAngle(deviceAlpha)})`,
        moonDirection: `${moonAzimuth.toFixed(1)}° (${getDirectionFromAngle(moonAzimuth)})`,
        shouldPointSameWay: azimuthDiff < 5 ? 'YES - ほぼ同じ方向' : 'NO - 異なる方向'
    });
    
    console.log('Altitude comparison:', {
        deviceElevation: `${deviceElevation.toFixed(1)}° (${deviceElevation >= 0 ? '地平線上' : '地平線下'})`,
        moonAltitude: `${clampedMoonAltitude.toFixed(1)}° (${clampedMoonAltitude >= 0 ? '地平線上' : '地平線下'})`,
        altitudeDiff: `${altitudeDiff.toFixed(1)}°`,
        shouldPointSameElevation: altitudeDiff < 10 ? 'YES - ほぼ同じ高度' : 'NO - 異なる高度'
    });
    
    console.log('===========================');

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

// UI操作のイベントリスナー設定
if (toggleReverseBtn) {
    toggleReverseBtn.onclick = toggleOrientationReverseUI;
}

if (resetCorrectionBtn) {
    resetCorrectionBtn.onclick = resetOrientationCorrectionUI;
}

// 初期状態の表示
updateCorrectionStatus();

const deviceOrientationElement = document.getElementById('device-orientation');
const geoInfoElement = document.getElementById('geo-info');
import { getMoonData, getMoonTimes, MoonData, MoonTimes } from './moon';
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


let currentPosition: GeolocationPosition | null = null;

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

    if (moonDirectionElement) {
        moonDirectionElement.textContent = `方角: ${moonData.azimuth.toFixed(2)}° ${directionName}`;
    }
    if (distanceElement) {
        distanceElement.textContent = `距離: ${moonData.distance.toFixed(0)} km`;
    }
    if (currentTimeElement) {
        currentTimeElement.textContent = `現在時刻: ${new Date().toLocaleTimeString()}`;
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
}

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
    if (deviceOrientationElement) {
        deviceOrientationElement.innerHTML = `デバイス方位（alpha/方角）: ${alpha?.toFixed(1) ?? 'N/A'}°<br>` +
            `上下傾き（beta）: ${beta?.toFixed(1) ?? 'N/A'}°<br>` +
            `左右傾き（gamma）: ${gamma?.toFixed(1) ?? 'N/A'}°`;
    }
    if (alpha !== null && moonDirectionElement) {
        moonDirectionElement.style.transform = `rotate(${alpha}deg)`;
    }
}

// DeviceOrientationEventのサポート判定とイベント登録
if (window.DeviceOrientationEvent) {
    if (deviceOrientationElement) {
        window.addEventListener('deviceorientation', handleOrientation);
    }
} else {
    if (deviceOrientationElement) {
        deviceOrientationElement.innerHTML = 'このブラウザはデバイスの向き取得（DeviceOrientationEvent）に対応していません。';
    }
}

if (window.DeviceOrientationEvent) {
    if (deviceOrientationElement) {
        window.addEventListener('deviceorientation', handleOrientation);
    }
} else {
    if (deviceOrientationElement) {
        deviceOrientationElement.innerHTML = 'このブラウザはデバイスの向き取得（DeviceOrientationEvent）に対応していません。';
    }
}

function positionUpdate(position: GeolocationPosition) {
    currentPosition = position;
    updateDisplay();
}

if ('geolocation' in navigator) {
    const update = () => navigator.geolocation.getCurrentPosition(positionUpdate);
    setInterval(update, 1000);
    update();
} else {
    if (moonDirectionElement) {
        moonDirectionElement.textContent = 'Geolocation is not supported by your browser.';
    }
}

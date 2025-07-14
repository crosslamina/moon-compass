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
const suncalcRadioButton = document.getElementById('suncalc') as HTMLInputElement;
const astronomiaRadioButton = document.getElementById('astronomia') as HTMLInputElement;

let currentPosition: GeolocationPosition | null = null;

function updateDisplay() {
    if (!currentPosition) return;

    const { latitude, longitude } = currentPosition.coords;
const library = suncalcRadioButton.checked ? 'suncalc' : (astronomiaRadioButton.checked ? 'astronomia' : 'suncalc');

    const moonData = getMoonData(latitude, longitude, library);
    const moonTimes = getMoonTimes(latitude, longitude, library);
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
      console.log(moonData);
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
    if (alpha !== null && moonDirectionElement) {
        // This is a simplified representation. A real implementation would need more complex calculations.
        moonDirectionElement.style.transform = `rotate(${alpha}deg)`;
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

suncalcRadioButton.addEventListener('change', updateDisplay);

astronomiaRadioButton.addEventListener('change', updateDisplay);

import { I18nManager } from './i18n';

const directions = [
    { key: 'direction.north', min: 0, max: 11.25 },
    { key: 'direction.northeast', min: 11.25, max: 33.75 },  // NNE
    { key: 'direction.northeast', min: 33.75, max: 56.25 },  // NE
    { key: 'direction.northeast', min: 56.25, max: 78.75 },  // ENE
    { key: 'direction.east', min: 78.75, max: 101.25 },
    { key: 'direction.southeast', min: 101.25, max: 123.75 }, // ESE
    { key: 'direction.southeast', min: 123.75, max: 146.25 }, // SE
    { key: 'direction.southeast', min: 146.25, max: 168.75 }, // SSE
    { key: 'direction.south', min: 168.75, max: 191.25 },
    { key: 'direction.southwest', min: 191.25, max: 213.75 }, // SSW
    { key: 'direction.southwest', min: 213.75, max: 236.25 }, // SW
    { key: 'direction.southwest', min: 236.25, max: 258.75 }, // WSW
    { key: 'direction.west', min: 258.75, max: 281.25 },
    { key: 'direction.northwest', min: 281.25, max: 303.75 }, // WNW  
    { key: 'direction.northwest', min: 303.75, max: 326.25 }, // NW
    { key: 'direction.northwest', min: 326.25, max: 348.75 }, // NNW
    { key: 'direction.north', min: 348.75, max: 361.25 } // Wrap around to N
];

export function getDirectionName(azimuth: number): string {
    const i18n = I18nManager.getInstance();
    
    for (const direction of directions) {
        if (azimuth >= direction.min && azimuth < direction.max) {
            return i18n.t(direction.key);
        }
    }
    return i18n.t('label.unknown');
}

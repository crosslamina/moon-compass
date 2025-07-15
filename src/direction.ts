const directions = [
    { name: 'N', min: 348.75, max: 11.25 },
    { name: 'NNE', min: 11.25, max: 33.75 },
    { name: 'NE', min: 33.75, max: 56.25 },
    { name: 'ENE', min: 56.25, max: 78.75 },
    { name: 'E', min: 78.75, max: 101.25 },
    { name: 'ESE', min: 101.25, max: 123.75 },
    { name: 'SE', min: 123.75, max: 146.25 },
    { name: 'SSE', min: 146.25, max: 168.75 },
    { name: 'S', min: 168.75, max: 191.25 },
    { name: 'SSW', min: 191.25, max: 213.75 },
    { name: 'SW', min: 213.75, max: 236.25 },
    { name: 'WSW', min: 236.25, max: 258.75 },
    { name: 'W', min: 258.75, max: 281.25 },
    { name: 'WNW', min: 281.25, max: 303.75 },
    { name: 'NW', min: 303.75, max: 326.25 },
    { name: 'NNW', min: 326.25, max: 348.75 },
];

export function getDirectionName(azimuth: number): string {
    for (const direction of directions) {
        if (azimuth >= direction.min && azimuth < direction.max) {
            return direction.name;
        }
    }
    return '';
}

// ...existing code...

import * as SunCalc from 'suncalc';


export type MoonData = {
    azimuth: number;
    distance: number;
    phase: number;
    altitude: number;
    illumination: number; // 照明率
};

export type MoonTimes = {
    rise: Date | null;
    set: Date | null;
};

import { getMoonDataAstronomia } from './astronomia-wrapper';

export function getMoonData(lat: number, lon: number, library: 'suncalc' | 'astronomia' = 'suncalc'): MoonData {
  if (library === 'astronomia') {
    return getMoonDataAstronomia(lat, lon);
  } else {
    const now = new Date();
    const moonPosition = SunCalc.getMoonPosition(now, lat, lon);
    const moonIllumination = SunCalc.getMoonIllumination(now);

    const azimuthDegrees = (moonPosition.azimuth * 180 / Math.PI + 180) % 360;
    const altitudeDegrees = moonPosition.altitude * 180 / Math.PI;

    return {
      azimuth: azimuthDegrees,
      distance: moonPosition.distance,
      phase: moonIllumination.phase,
      illumination: moonIllumination.fraction,
      altitude: altitudeDegrees,
    };
  }
}

export function getMoonTimes(lat: number, lon: number, library: 'suncalc' | 'astronomia' = 'suncalc'): MoonTimes {

    const now = new Date();
    const moonTimes = SunCalc.getMoonTimes(now, lat, lon);
    return {
      rise: moonTimes.rise ?? null,
      set: moonTimes.set ?? null,
    };
  
}
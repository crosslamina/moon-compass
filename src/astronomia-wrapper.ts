function getMoonPhase(date: Date): number {
  const jd = astronomia.julian.DateToJD(date);
  const dyear = date.getFullYear() + (date.getMonth() + 1 - 0.5) / 12;
  const newMoonJD = astronomia.moonphase.newMoon(dyear);
  let age = jd - newMoonJD;
  if (age < 0) age += 29.53058867;
  return age / 29.53058867;
}
import * as astronomia from 'astronomia';
import * as SunCalc from 'suncalc';
console.log(astronomia.moonmaxdec)

function getMoonIllumination(lat: number, lon: number, date: Date = new Date()): number {
  const jd = astronomia.julian.DateToJD(date);

  // 月の位置（黄道座標）
  const moonPos = astronomia.moonposition.position(jd);

  // 太陽の位置（黄道経度・距離）
  const T = astronomia.base.J2000Century(jd);
  const lambdaSun = astronomia.solar.apparentLongitude(T);
  const rSun = astronomia.solar.radius(T) * astronomia.base.AU;
  const sunPos = new astronomia.base.Coord(lambdaSun, 0, rSun);

  // 位相角（黄道座標で計算）
  const phaseAngle = astronomia.moonillum.phaseAngleEcliptic(moonPos, sunPos);

  // 照明率（満ち欠けの割合）
  const illuminated = astronomia.base.illuminated(phaseAngle);

  console.log('Debug - Moon illuminated:', illuminated);

  return illuminated; // 0.0（新月）～1.0（満月）
}

export function getMoonDataAstronomia(lat: number, lon: number): { azimuth: number; altitude: number; phase: number; distance: number; illumination: number } {
  const date = new Date();
  const jd = astronomia.julian.DateToJD(date);
  
  // 月の黄道座標を取得
  const moonPos = astronomia.moonposition.position(jd);
  console.log('Debug - Moon Position values:', {
    ra: moonPos.ra,
    dec: moonPos.dec,
    range: moonPos.range,
  });
  
  
  // 正しい恒星時計算
  // astronomiaのsidereal関数は度単位で返すため、ラジアンに変換が必要
  const gmstDegRaw = astronomia.sidereal.apparent(jd);
  
  // 恒星時を0-360度の範囲に正規化
  const gmstDeg = ((gmstDegRaw % 360) + 360) % 360;
  const gmstRad = gmstDeg * Math.PI / 180;
  
  console.log('Debug - GMST raw (degrees):', gmstDegRaw);
  console.log('Debug - GMST normalized (degrees):', gmstDeg);
  console.log('Debug - GMST (radians):', gmstRad);
  
  // 地方恒星時 (LST) = GMST + 経度
  const lonRad = lon * Math.PI / 180;
  const lstRad = gmstRad + lonRad;
  
  // 時角の計算: H = LST - RA
  let H = lstRad - moonPos.ra;
  
  // 時角を-π〜+πの範囲に正規化
  while (H > Math.PI) H -= 2 * Math.PI;
  while (H < -Math.PI) H += 2 * Math.PI;
  
  console.log('Debug - Hour Angle (H):', H);
  
  // 緯度をラジアンに変換
  const φ = lat * Math.PI / 180;
  
  // Horizontal座標の計算 (Meeus 13.5, 13.6)
  const sH = Math.sin(H);
  const cH = Math.cos(H);
  const sφ = Math.sin(φ);
  const cφ = Math.cos(φ);
  const sδ = Math.sin(moonPos.dec);
  const cδ = Math.cos(moonPos.dec);
  
  // 方位角 A (13.5) - 南から西向きに測定
  const A = Math.atan2(sH, cH * sφ - (sδ / cδ) * cφ);
  
  // 高度 h (13.6)
  const h = Math.asin(sφ * sδ + cφ * cδ * cH);
  
  // 方位角をSunCalc互換（北基準）に変換
  // Meeusの公式では南から西回りが正なので、北基準に変換
  let azimuthDeg = (A * 180 / Math.PI + 180) % 360; // +180で南基準→北基準
  if (azimuthDeg < 0) azimuthDeg += 360;
  const altitudeDeg = h * 180 / Math.PI;
  
  console.log('Debug - Raw Azimuth (A):', A);
  console.log('Debug - Final Azimuth (deg):', azimuthDeg);
  console.log('Debug - Final Altitude (deg):', altitudeDeg);
  
  
  const illumination = getMoonIllumination(lat, lon, date);
  const phase = getMoonPhase(date);

  return {
    azimuth: azimuthDeg,
    altitude: altitudeDeg,
    phase: phase,
    distance: moonPos.range || 384400,
    illumination: illumination,
  };
}

export function getMoonTimesAstronomia(lat: number, lon: number): { rise: Date | null; set: Date | null } {
  const date = new Date();
  const moonTimes = SunCalc.getMoonTimes(date, lat, lon);
  return {
    rise: moonTimes.rise ?? null,
    set: moonTimes.set ?? null,
  };
}

import * as astronomia from 'astronomia';
import * as SunCalc from 'suncalc';

// 月齢を計算する関数（簡易版）
function getMoonAge(date: Date): number {
  // 既知の新月日付（2024年1月11日）からの経過日数を使用
  const knownNewMoon = new Date('2024-01-11T11:57:00Z');
  const lunarCycle = 29.53058867; // 朔望月の平均日数
  
  const daysSinceKnownNewMoon = (date.getTime() - knownNewMoon.getTime()) / (1000 * 60 * 60 * 24);
  const moonAge = daysSinceKnownNewMoon % lunarCycle;
  
  return moonAge >= 0 ? moonAge : moonAge + lunarCycle;
}

export function getMoonDataAstronomia(lat: number, lon: number): { azimuth: number; altitude: number; phase: number; distance: number; age: number } {
  const date = new Date();
  // 時刻を10秒単位で丸めて安定性を大幅に向上させる
  date.setSeconds(Math.floor(date.getSeconds() / 10) * 10);
  date.setMilliseconds(0);
  const jd = astronomia.julian.DateToJD(date);
  
  console.log('Debug - Date (10s rounded):', date.toISOString());
  console.log('Debug - JD:', jd);
  console.log('Debug - Lat/Lon:', lat, lon);
  
  // 月の黄道座標を取得
  const moonPos = astronomia.moonposition.position(jd);
  console.log('Debug - Moon Position values:', {
    ra: moonPos.ra,
    dec: moonPos.dec,
    range: moonPos.range,
  });
  
  // SunCalcとの比較用データ
  const suncalcMoon = SunCalc.getMoonPosition(date, lat, lon);
  console.log('Debug - SunCalc comparison:', {
    azimuth: (suncalcMoon.azimuth * 180 / Math.PI + 180) % 360,
    altitude: suncalcMoon.altitude * 180 / Math.PI
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
  
  // 月齢を計算
  const moonAge = getMoonAge(date);
  
  // SunCalcと同じ照明率計算を使用
  const suncalcIllum = SunCalc.getMoonIllumination(date);
  const illumination = suncalcIllum.fraction;

  return {
    azimuth: azimuthDeg,
    altitude: altitudeDeg,
    phase: illumination,
    distance: moonPos.range || 384400,
    age: moonAge,
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

const SunCalc = require('suncalc');
const astro = require('astronomia');

// 月齢を計算する関数（簡易版）
function getMoonAge(date) {
  // 既知の新月日付（2024年1月11日）からの経過日数を使用
  const knownNewMoon = new Date('2024-01-11T11:57:00Z');
  const lunarCycle = 29.53058867; // 朔望月の平均日数
  
  const daysSinceKnownNewMoon = (date.getTime() - knownNewMoon.getTime()) / (1000 * 60 * 60 * 24);
  const moonAge = daysSinceKnownNewMoon % lunarCycle;
  
  return moonAge >= 0 ? moonAge : moonAge + lunarCycle;
}

// 関数を抜き出して実行可能な形にするlc = require('suncalc');

// TypeScriptファイルを直接requireするためのモジュール
const fs = require('fs');
const path = require('path');

// TypeScriptファイルの内容を読み込んで評価
const tsContent = fs.readFileSync(path.join(__dirname, 'src', 'astronomia-wrapper.ts'), 'utf8');
const astronomia = require('astronomia');

// 関数を抜き出して実行可能な形にする
function getMoonDataAstronomia(lat, lon) {
  const date = new Date();
  const jd = astronomia.julian.DateToJD(date);
  
  const moonPos = astronomia.moonposition.position(jd);
  
  const moonEq = {
    ra: moonPos.ra,
    dec: moonPos.dec
  };
  
  const gmst = astronomia.sidereal.apparent(jd);
  const lst = gmst + (lon * Math.PI / 180);
  const ha = lst - moonEq.ra;
  const lat_rad = lat * Math.PI / 180;
  
  const alt = Math.asin(
    Math.sin(moonEq.dec) * Math.sin(lat_rad) + 
    Math.cos(moonEq.dec) * Math.cos(lat_rad) * Math.cos(ha)
  );
  
  const az = Math.atan2(
    Math.sin(ha),
    Math.cos(ha) * Math.sin(lat_rad) - Math.tan(moonEq.dec) * Math.cos(lat_rad)
  );
  
  const azimuthDeg = (az * 180 / Math.PI + 180) % 360;
  const altitudeDeg = alt * 180 / Math.PI;
  
  // 月齢を計算
  const moonAge = getMoonAge(date);
  
  // SunCalcと同じ照明率計算を使用（一貫性のため）
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

function test(lat, lon, name) {
  console.log(`=== ${name} ===`);
  const date = new Date();
  
  const suncalc = SunCalc.getMoonPosition(date, lat, lon);
  const suncalcPhase = SunCalc.getMoonIllumination(date);
  console.log('SunCalc    :', 
    ((suncalc.azimuth * 180 / Math.PI + 180) % 360).toFixed(1), 
    (suncalc.altitude * 180 / Math.PI).toFixed(1), 
    suncalcPhase.fraction.toFixed(3),
    'Age: N/A');
  
  try {
    const astro = getMoonDataAstronomia(lat, lon);
    console.log('Astronomia :', 
      astro.azimuth.toFixed(1), 
      astro.altitude.toFixed(1), 
      astro.phase.toFixed(3),
      `Age: ${astro.age.toFixed(2)}日`);
  } catch(e) {
    console.log('Error:', e.message);
  }
  console.log('');
}

test(35.6762, 139.6503, '東京');
test(40.7128, -74.0060, 'ニューヨーク');
test(51.5074, -0.1278, 'ロンドン');

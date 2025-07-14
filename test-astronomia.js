const astro = require('astronomia');
const SunCalc = require('suncalc');

function testLocation(lat, lon, name) {
  console.log(`=== ${name} (${lat}, ${lon}) ===`);
  const date = new Date();
  
  // SunCalc結果
  const suncalc = SunCalc.getMoonPosition(date, lat, lon);
  const suncalcIllum = SunCalc.getMoonIllumination(date);
  console.log('SunCalc - Az:', ((suncalc.azimuth * 180 / Math.PI + 180) % 360).toFixed(1), 
              'Alt:', (suncalc.altitude * 180 / Math.PI).toFixed(1),
              'Phase:', suncalcIllum.phase.toFixed(3));
  
  // Astronomia結果
  const jd = astro.julian.DateToJD(date);
  const moonPos = astro.moonposition.position(jd);
  
  // SunCalcに近いアプローチで座標変換
  const moonEq = {
    ra: moonPos.ra,
    dec: moonPos.dec
  };
  
  const gmst = astro.sidereal.apparent(jd);
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
  
  const astronomiaAz = (az * 180 / Math.PI + 180) % 360;
  
  // 位相計算（正しい方法）
  const sunEcl = astro.solar.apparentLongitude(jd);
  const moonEcl = moonPos.lon;
  let phaseAngle = Math.abs(moonEcl - sunEcl);
  if (phaseAngle > Math.PI) {
    phaseAngle = 2 * Math.PI - phaseAngle;
  }
  // SunCalcと同じ方式で照明率を計算
  const phase = (1 + Math.cos(phaseAngle)) / 2;
  
  console.log('Astronomia - Az:', astronomiaAz.toFixed(1), 
              'Alt:', (alt * 180 / Math.PI).toFixed(1),
              'Phase:', phase.toFixed(3));
  console.log('');
}

testLocation(35.6762, 139.6503, '東京');
testLocation(40.7128, -74.0060, 'ニューヨーク');
testLocation(51.5074, -0.1278, 'ロンドン');

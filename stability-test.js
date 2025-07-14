const astro = require('astronomia');

// 同じ時刻で複数回計算して安定性を確認
function testStability() {
  const fixedDate = new Date('2025-07-14T12:00:00Z');
  console.log('固定時刻での計算安定性テスト:');
  
  for (let i = 0; i < 3; i++) {
    const jd = astro.julian.DateToJD(fixedDate);
    const moonPos = astro.moonposition.position(jd);
    const gmst = astro.sidereal.apparent(jd);
    const lst = gmst + (139.6503 * Math.PI / 180);
    const ha = lst - moonPos.ra;
    
    const lat_rad = 35.6762 * Math.PI / 180;
    const az = Math.atan2(
      Math.sin(ha),
      Math.cos(ha) * Math.sin(lat_rad) - Math.tan(moonPos.dec) * Math.cos(lat_rad)
    );
    
    const azimuthDeg = (az * 180 / Math.PI + 180) % 360;
    console.log(`${i}: Az=${azimuthDeg.toFixed(6)}°`);
  }
  
  console.log('\n現在時刻での微小時間差テスト:');
  
  // 現在時刻の精度による影響を確認
  for (let i = 0; i < 3; i++) {
    const date = new Date();
    const jd = astro.julian.DateToJD(date);
    const moonPos = astro.moonposition.position(jd);
    const gmst = astro.sidereal.apparent(jd);
    const lst = gmst + (139.6503 * Math.PI / 180);
    const ha = lst - moonPos.ra;
    
    const lat_rad = 35.6762 * Math.PI / 180;
    const az = Math.atan2(
      Math.sin(ha),
      Math.cos(ha) * Math.sin(lat_rad) - Math.tan(moonPos.dec) * Math.cos(lat_rad)
    );
    
    const azimuthDeg = (az * 180 / Math.PI + 180) % 360;
    console.log(`${i}: Az=${azimuthDeg.toFixed(6)}°, JD=${jd.toFixed(10)}, GMST=${gmst.toFixed(8)}`);
  }
}

testStability();

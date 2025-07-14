const astro = require('astronomia');

function testAzimuthChanges() {
  let prev = null;
  
  for (let i = 0; i < 5; i++) {
    const date = new Date();
    const jd = astro.julian.DateToJD(date);
    const moonPos = astro.moonposition.position(jd);
    
    // 地方恒星時
    const gmst = astro.sidereal.apparent(jd);
    const lst = gmst + (139.6503 * Math.PI / 180);
    
    // 時角
    const ha = lst - moonPos.ra;
    
    // 方位角計算
    const lat_rad = 35.6762 * Math.PI / 180;
    const az = Math.atan2(
      Math.sin(ha),
      Math.cos(ha) * Math.sin(lat_rad) - Math.tan(moonPos.dec) * Math.cos(lat_rad)
    );
    
    const azimuthDeg = (az * 180 / Math.PI + 180) % 360;
    
    console.log(`${i}: Az=${azimuthDeg.toFixed(2)}°, GMST=${gmst.toFixed(6)}, HA=${ha.toFixed(6)}`);
    
    if (prev !== null) {
      const change = azimuthDeg - prev;
      console.log(`  変化: ${change.toFixed(3)}度`);
    }
    
    prev = azimuthDeg;
    
    // 1秒待機
    if (i < 4) {
      require('child_process').execSync('timeout /t 1 /nobreak > nul 2>&1', {stdio: 'ignore'});
    }
  }
}

testAzimuthChanges();

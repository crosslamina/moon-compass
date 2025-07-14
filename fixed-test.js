const { getMoonDataAstronomia } = require('./src/astronomia-wrapper.ts');

console.log('修正後の安定性テスト:');
let prev = null;

for (let i = 0; i < 5; i++) {
  try {
    const result = getMoonDataAstronomia(35.6762, 139.6503);
    const azimuth = result.azimuth;
    
    console.log(`${i}: 方位角=${azimuth.toFixed(2)}°`);
    
    if (prev !== null) {
      const change = Math.abs(azimuth - prev);
      console.log(`  変化: ${change.toFixed(3)}度`);
    }
    
    prev = azimuth;
  } catch (e) {
    console.log(`${i}: エラー - ${e.message}`);
  }
}

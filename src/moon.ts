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


export function getMoonData(lat: number, lon: number, ): MoonData {
    const now = new Date();
    const moonPosition = SunCalc.getMoonPosition(now, lat, lon);
    const moonIllumination = SunCalc.getMoonIllumination(now);

    // SunCalcの方位角を正しいコンパス方位角に変換
    // SunCalc実際の座標系:
    // - azimuth: 南=0, 西=+π/2, 北=±π, 東=-π/2 (南から時計回りに測定、-π〜+πの範囲)
    // - altitude: 地平線=0, 天頂=+π/2, 地平線下=-π/2
    // 目標のコンパス座標系:
    // - azimuth: 北=0°, 東=90°, 南=180°, 西=270° (北から時計回りに測定、0°〜360°)
    // - altitude: 地平線=0°, 天頂=90°, 地平線下=-90°
    
    // 変換手順:
    // 1. ラジアンを度に変換
    // 2. 南基準から北基準に変換（+180°）
    // 3. 0°〜360°の範囲に正規化
    let azimuthDegrees = (moonPosition.azimuth * 180 / Math.PI + 180);
    
    // 0°〜360°の範囲に正規化
    while (azimuthDegrees < 0) azimuthDegrees += 360;
    while (azimuthDegrees >= 360) azimuthDegrees -= 360;
    
    // デバッグ情報をログ出力
    console.log('SunCalc raw data:', {
        azimuthRadians: moonPosition.azimuth,
        azimuthDegrees: moonPosition.azimuth * 180 / Math.PI,
        convertedAzimuth: azimuthDegrees,
        altitudeRadians: moonPosition.altitude,
        altitudeDegrees: moonPosition.altitude * 180 / Math.PI
    });
    
    const altitudeDegrees = moonPosition.altitude * 180 / Math.PI;

    return {
      azimuth: azimuthDegrees,
      distance: moonPosition.distance,
      phase: moonIllumination.phase,
      illumination: moonIllumination.fraction,
      altitude: altitudeDegrees,
    };
  }

/**
 * SunCalcの座標系をテストするための関数
 */
export function testSunCalcCoordinates(lat: number, lon: number): void {
    const now = new Date();
    const sunPosition = SunCalc.getPosition(now, lat, lon);
    const moonPosition = SunCalc.getMoonPosition(now, lat, lon);
    
    console.log('=== SunCalc座標系テスト ===');
    console.log('現在時刻:', now.toLocaleString());
    console.log('位置:', { lat, lon });
    console.log('太陽位置 (ラジアン):', {
        azimuth: sunPosition.azimuth,
        altitude: sunPosition.altitude
    });
    console.log('太陽位置 (度):', {
        azimuth: sunPosition.azimuth * 180 / Math.PI,
        altitude: sunPosition.altitude * 180 / Math.PI
    });
    console.log('月位置 (ラジアン):', {
        azimuth: moonPosition.azimuth,
        altitude: moonPosition.altitude
    });
    console.log('月位置 (度):', {
        azimuth: moonPosition.azimuth * 180 / Math.PI,
        altitude: moonPosition.altitude * 180 / Math.PI
    });
    console.log('========================');
}


export function getMoonTimes(lat: number, lon: number, library: 'suncalc' | 'astronomia' = 'suncalc'): MoonTimes {

    const now = new Date();
    const moonTimes = SunCalc.getMoonTimes(now, lat, lon);
    return {
      rise: moonTimes.rise ?? null,
      set: moonTimes.set ?? null,
    };
  
}

/**
 * 月の形をキャンバスに描画する
 * @param canvas - 描画対象のcanvas要素
 * @param moonData - 月のデータ
 * @param blinkIntensity - 点滅の強度 (0-1)
 */
export function drawMoonPhase(canvas: HTMLCanvasElement, moonData: MoonData, blinkIntensity: number = 1): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 2 - 10;

    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 夜空の背景
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 2);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#0f0f1a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const phase = moonData.phase;
    const illumination = moonData.illumination;

    // 月の影の部分（暗い部分）
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fill();

    // 月の明るい部分
    ctx.fillStyle = '#f4d03f';
    
    // illuminationに基づいて月の形を描画、phaseで対称性を判定
    if (illumination < 0.01) {
        // 新月 - ほぼ暗い円のみ（わずかに輪郭を見せる）
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.stroke();
    } else {
        // 月の明るい部分を描画
        const isWaxing = phase < 0.5; // 上弦期（0〜0.5）か下弦期（0.5〜1）か
        drawMoonShape(ctx, centerX, centerY, radius, illumination, isWaxing);
    }

    // 月の輪郭
    ctx.strokeStyle = '#bdc3c7';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();

    // 点滅リングの描画（月の周辺）- 角度差が大きい時のみ表示
    if (blinkIntensity < 0.99) {
        drawBlinkRing(ctx, centerX, centerY, radius, blinkIntensity);
    }

    // アルファ値をリセット
    ctx.globalAlpha = 1;

    // 照明率、位相、月相名の情報表示
    ctx.fillStyle = '#ecf0f1';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`照明率: ${(illumination * 100).toFixed(1)}%`, centerX, canvas.height - 40);
    ctx.fillText(`位相: ${phase.toFixed(3)}`, centerX, canvas.height - 25);
    
    // 月相名を表示
    const phaseName = getPhaseName(phase, illumination);
    ctx.fillText(`${phaseName}`, centerX, canvas.height - 10);
}

/**
 * 月の周辺に点滅リングを描画（規則的なパターン）
 * @param ctx - 描画コンテキスト
 * @param centerX - 中心X座標
 * @param centerY - 中心Y座標
 * @param radius - 月の半径
 * @param blinkIntensity - 点滅強度（0-1）
 */
function drawBlinkRing(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    blinkIntensity: number
): void {
    // 点滅強度に基づいてリングの透明度を設定
    const alpha = blinkIntensity;
    
    // 固定サイズのリング（安定した表示）
    const outerRadius = radius + 12;
    const innerRadius = radius + 6;
    
    // グラデーションで光る効果を作成
    const gradient = ctx.createRadialGradient(
        centerX, centerY, innerRadius,
        centerX, centerY, outerRadius
    );
    
    // 点滅強度に応じて色を変化（規則的な色変化）
    if (blinkIntensity > 0.7) {
        // 非常に近い：明るい金色
        gradient.addColorStop(0, `rgba(255, 215, 0, ${alpha * 0.9})`);
        gradient.addColorStop(0.5, `rgba(255, 165, 0, ${alpha * 0.7})`);
        gradient.addColorStop(1, `rgba(255, 140, 0, 0)`);
    } else if (blinkIntensity > 0.4) {
        // 中程度：オレンジ色
        gradient.addColorStop(0, `rgba(255, 165, 0, ${alpha * 0.8})`);
        gradient.addColorStop(0.5, `rgba(255, 140, 0, ${alpha * 0.6})`);
        gradient.addColorStop(1, `rgba(255, 69, 0, 0)`);
    } else {
        // 遠い：青白い色
        gradient.addColorStop(0, `rgba(135, 206, 250, ${alpha * 0.7})`);
        gradient.addColorStop(0.5, `rgba(100, 149, 237, ${alpha * 0.5})`);
        gradient.addColorStop(1, `rgba(70, 130, 180, 0)`);
    }
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
    ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI, true); // 内側を切り抜く
    ctx.fill();
    
    // 内側のシャープなリング（規則的な太さ）
    const ringColor = blinkIntensity > 0.6 ? 
        `rgba(255, 215, 0, ${alpha})` : 
        `rgba(135, 206, 250, ${alpha})`;
    
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 5, 0, 2 * Math.PI);
    ctx.stroke();
}

/**
 * illuminationとphaseに基づいて月相名を取得
 */
function getPhaseName(phase: number, illumination: number): string {
    if (illumination < 0.01) {
        return '新月';
    } else if (illumination < 0.25) {
        return phase < 0.5 ? '三日月' : '有明月';
    } else if (illumination < 0.45) {
        return phase < 0.5 ? '上弦前' : '下弦後';
    } else if (illumination > 0.55 && illumination < 0.95) {
        return phase < 0.5 ? '上弦後' : '下弦前';
    } else if (illumination >= 0.95) {
        return '満月';
    } else {
        // illumination ≈ 0.5 の場合
        return phase < 0.5 ? '上弦の月' : '下弦の月';
    }
}

/**
 * illuminationに基づいて自然な月の形状を描画
 */
function drawMoonShape(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    illumination: number,
    isWaxing: boolean
): void {
    ctx.save();
    
    // クリッピングで円形にする
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.clip();

    if (illumination >= 0.99) {
        // 満月
        ctx.fillStyle = '#f4d03f';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();
    } else {
        // 月の位相に基づいた形状計算
        // illuminationから正確な位相角を計算
        const k = illumination; // illumination fraction (0-1)
        
        if (k <= 0.5) {
            // 三日月〜半月：月の右端または左端から光が当たり始める
            drawCrescentShape(ctx, centerX, centerY, radius, k, isWaxing);
        } else {
            // 半月〜満月：ギブス形状
            drawGibbousShape(ctx, centerX, centerY, radius, k, isWaxing);
        }
    }
    
    ctx.restore();
}

/**
 * 三日月形状を正確に描画
 */
function drawCrescentShape(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    illumination: number,
    isWaxing: boolean
): void {
    // illuminationから楕円の半径を計算
    // k = 0.5 * (1 + cos(θ)) より、cos(θ) = 2*k - 1
    const cosTheta = 2 * illumination - 1;
    const ellipseRadiusX = radius * Math.abs(cosTheta);
    
    ctx.fillStyle = '#f4d03f';
    ctx.beginPath();
    
    if (isWaxing) {
        // 上弦期：右側が明るい
        // 右端の半円弧
        ctx.arc(centerX, centerY, radius, -Math.PI/2, Math.PI/2, false);
        // 内側の楕円弧（左側）
        if (ellipseRadiusX > 0) {
            ctx.ellipse(centerX, centerY, ellipseRadiusX, radius, 0, Math.PI/2, -Math.PI/2, true);
        } else {
            // 非常に細い三日月の場合
            ctx.lineTo(centerX, centerY - radius);
        }
    } else {
        // 下弦期：左側が明るい
        // 左端の半円弧
        ctx.arc(centerX, centerY, radius, Math.PI/2, -Math.PI/2, false);
        // 内側の楕円弧（右側）
        if (ellipseRadiusX > 0) {
            ctx.ellipse(centerX, centerY, ellipseRadiusX, radius, 0, -Math.PI/2, Math.PI/2, true);
        } else {
            // 非常に細い三日月の場合
            ctx.lineTo(centerX, centerY + radius);
        }
    }
    
    ctx.closePath();
    ctx.fill();
}

/**
 * ギブス形状（ふくらんだ月）を正確に描画
 */
function drawGibbousShape(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    illumination: number,
    isWaxing: boolean
): void {
    // まず満月を描画
    ctx.fillStyle = '#f4d03f';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fill();
    
    // illuminationから楕円の半径を計算
    const cosTheta = 2 * illumination - 1;
    const ellipseRadiusX = radius * Math.abs(cosTheta);
    
    // 暗い部分を描画
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    
    if (isWaxing) {
        // 上弦期：左側に暗い部分
        // 左端の半円弧
        ctx.arc(centerX, centerY, radius, Math.PI/2, -Math.PI/2, false);
        // 内側の楕円弧
        if (ellipseRadiusX < radius) {
            ctx.ellipse(centerX, centerY, ellipseRadiusX, radius, 0, -Math.PI/2, Math.PI/2, true);
        }
    } else {
        // 下弦期：右側に暗い部分
        // 右端の半円弧
        ctx.arc(centerX, centerY, radius, -Math.PI/2, Math.PI/2, false);
        // 内側の楕円弧
        if (ellipseRadiusX < radius) {
            ctx.ellipse(centerX, centerY, ellipseRadiusX, radius, 0, Math.PI/2, -Math.PI/2, true);
        }
    }
    
    ctx.closePath();
    ctx.fill();
}

/**
 * デバイスの向きと月の位置の角度差を計算
 * @param deviceAzimuth - デバイスの方位角（度）
 * @param deviceAltitude - デバイスの高度角（度）
 * @param moonAzimuth - 月の方位角（度）
 * @param moonAltitude - 月の高度角（度）
 * @returns 角度差（度）
 */
export function calculateAngleDifference(
    deviceAzimuth: number,
    deviceAltitude: number,
    moonAzimuth: number,
    moonAltitude: number
): number {
    // 方位角の差（360度を考慮）
    let azimuthDiff = Math.abs(deviceAzimuth - moonAzimuth);
    if (azimuthDiff > 180) {
        azimuthDiff = 360 - azimuthDiff;
    }
    
    // 高度角の差
    const altitudeDiff = Math.abs(deviceAltitude - moonAltitude);
    
    // 3D空間での角度差を計算
    const totalDiff = Math.sqrt(azimuthDiff * azimuthDiff + altitudeDiff * altitudeDiff);
    
    return totalDiff;
}

// 点滅の基準時刻を保存（アプリ開始時に設定）
let blinkStartTime = Date.now();

/**
 * 点滅の基準時刻をリセット
 */
export function resetBlinkTimer(): void {
    blinkStartTime = Date.now();
}

/**
 * 角度差に基づいて点滅パターンを計算（完全に規則的な等間隔点滅）
 * @param angleDifference - 角度差（度）
 * @param timestamp - 現在時刻（ミリ秒）
 * @returns 点滅強度（0-1）
 */
export function calculateBlinkIntensity(angleDifference: number, timestamp: number): number {
    // 角度差が小さいほど高速点滅
    const maxAngle = 120; // 最大角度差
    const minAngle = 3;   // 最小角度差（これ以下で点滅停止）
    
    if (angleDifference <= minAngle) {
        // 非常に近い場合：点滅停止（リングも非表示）
        return 1;
    } else if (angleDifference >= maxAngle) {
        // 遠い場合：点滅なし
        return 1;
    } else {
        // 角度差を0-1の範囲に正規化（小さいほど1に近づく）
        const normalizedAngle = Math.max(0, Math.min(1, (maxAngle - angleDifference) / (maxAngle - minAngle)));
        
        // 規則的な点滅速度の計算（基準時刻からの経過時間を使用）
        const elapsedTime = timestamp - blinkStartTime;
        
        // 遠い時: 2秒間隔、近い時: 0.3秒間隔
        const blinkPeriod = 2000 - (normalizedAngle * 1700); // 2000ms → 300ms
        
        // 完全に規則的な点滅サイクルを計算
        const cyclePosition = (elapsedTime % blinkPeriod) / blinkPeriod; // 0-1の範囲
        
        // 点滅のON/OFF状態を明確にする（前半50%がON、後半50%がOFF）
        const isOn = cyclePosition < 0.5;
        
        if (isOn) {
            // 点灯時：距離に応じた明るさ（近いほど明るい）
            return 0.3 + (normalizedAngle * 0.7); // 30%〜100%の明るさ
        } else {
            // 消灯時：完全に暗く
            return 0.1; // ほぼ見えない状態
        }
    }
}
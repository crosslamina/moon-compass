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
 */
export function drawMoonPhase(canvas: HTMLCanvasElement, moonData: MoonData): void {
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
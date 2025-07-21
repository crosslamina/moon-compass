# 月が綺麗 (Tsuki ga Kirei)

月の位置を磁気コンパスで探知するWebアプリケーション

## 🌙 概要

このアプリケーションは、デバイスのセンサーを使用して月の方位と高度を検出し、視覚的・聴覚的なフィードバックを提供する磁気コンパスシミュレーターです。

## 📱 機能

- **リアルタイム月位置計算** - 現在地と時刻に基づく月の方位・高度
- **磁気コンパス表示** - 月とデバイスの方向を針で表示
- **音響フィードバック** - 磁場強度に応じたチック音
- **レスポンシブデザイン** - 様々な画面サイズに対応

## ⚙️ 重要な設定

### 針の長さ仕様

コンパスの針の長さは以下の仕様で固定されています：

| 高度 | 針の長さ | 説明 |
|------|----------|------|
| **90°** (天頂) | **100%** | コンパス半径と同じ長さ |
| **0°** (地平線) | **60%** | コンパス半径の60% |
| **-90°** (天底) | **20%** | コンパス半径の20% |

#### 計算式
```typescript
// 正規化された高度: (-90°→0, 0°→0.5, 90°→1)
const normalizedAltitude = (clampedAltitude + 90) / 180;

// 針の長さ: 20%～100%の範囲で線形補間
const needleLength = minLength + (maxLength - minLength) * normalizedAltitude;
```

この設定により、高度の変化が視覚的に明確に表現されます。

### 地平線表示仕様

地平線（高度0°のライン）はコンパス上に以下の仕様で描画されます：

- **位置**: コンパス半径の **60%** の円として表示
- **スタイル**: 白色の破線（透明度30%）
- **対応**: 高度0°の針の長さと一致

```typescript
const horizonRadius = compassRadius * 0.6; // 針の長さ60%と一致
```

月や太陽が地平線上にある時（高度0°）、針の先端が地平線の円と正確に重なります。

## 🏗️ アーキテクチャ

### コンポーネント構成

```
src/
├── components/           # UI コンポーネント
│   ├── CompassManager.ts    # コンパス描画・制御
│   └── MoonInfoDisplay.ts   # 月情報表示
├── sensors/             # センサー管理
│   └── DeviceOrientationManager.ts
├── location/            # 位置情報管理
│   └── LocationManager.ts
├── state/               # 状態管理
│   └── StateManager.ts
├── ui/                  # UI管理
│   ├── DOMManager.ts
│   └── DialogManager.ts
├── accuracy/            # 精度表示
│   └── AccuracyDisplayManager.ts
└── display/             # 表示管理
    └── MoonDisplayManager.ts
```

### 主要クラス

- **`CompassManager`** - コンパス描画、音響制御、針の長さ計算
- **`StateManager`** - アプリケーション状態の一元管理
- **`LocationManager`** - GPS位置情報の取得・管理
- **`DeviceOrientationManager`** - デバイス方向センサーの管理

## 🔧 技術仕様

- **TypeScript** - 型安全なコード開発
- **Canvas API** - 2D描画とアニメーション
- **Web APIs** - Geolocation, DeviceOrientation
- **Vite** - 高速ビルドツール

## 🎮 使用方法

1. ブラウザでアプリケーションにアクセス
2. 位置情報の許可を与える
3. デバイス方向センサーの許可を与える
4. デバイスを動かして月の方向を探索
5. 音響フィードバックと針の長さで月の位置を確認

## 📋 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

# 多言語化実装ガイド

## 概要

`月が綺麗`アプリケーションに包括的な多言語化（i18n）機能を実装しました。JSONベースの翻訳システムと動的な言語切り替え機能を提供します。

## 実装した機能

### 1. サポート言語

- **日本語 (ja)** - デフォルト言語
- **英語 (en)** - English
- **簡体中文 (zh-CN)** - 简体中文
- **繁體中文 (zh-TW)** - 繁體中文
- **韓国語 (ko)** - 한국어

*注：フランス語(fr)、スペイン語(es)、ドイツ語(de)の対応も技術的に準備済み*

### 2. 主要コンポーネント

#### I18nManager
- 翻訳システムの中核クラス
- ロケール管理、翻訳文字列の取得、ユーザー設定の保存
- JSONファイルの動的読み込み
- ネストされた翻訳構造のフラット化
- リアクティブな言語変更通知
- フォールバック機能（日本語）

#### LanguageSelector  
- 言語選択UIコンポーネント
- 設定ダイアログに統合
- 利用可能な言語のみ表示
- 自動でブラウザ言語を検出

#### DOMTranslationManager
- DOM要素の翻訳を自動更新
- 言語変更時のリアルタイム反映
- UI全体の一括翻訳更新

#### 翻訳定義ファイル（JSON形式）
- `src/i18n/locales/ja.json` - 日本語翻訳
- `src/i18n/locales/en.json` - 英語翻訳  
- `src/i18n/locales/zh-CN.json` - 簡体中文翻訳
- `src/i18n/locales/zh-TW.json` - 繁體中文翻訳
- `src/i18n/locales/ko.json` - 韓国語翻訳

### 3. 多言語化済みコンポーネント

- **UI全般** - ボタン、タイトル、ダイアログ
- **MoonInfoDisplay** - 月情報表示
- **MoonStatusDisplay** - 月の状態表示
- **CompassManager** - コンパス関連UI
- **AccuracyDisplayManager** - 精度表示
- **LocationManager** - 位置情報関連メッセージ
- **direction** モジュール - 方角名
- **設定画面** - 全ての設定項目

## 使用方法

### 基本的な翻訳の取得

```typescript
import { I18nManager } from './i18n';

const i18n = I18nManager.getInstance();
const translated = i18n.t('moon.direction'); // "方向" / "Direction" / "方向"
```

### パラメータ付きの翻訳

```typescript
const timeText = i18n.t('time.remaining', { hours: 2, minutes: 30 });
// "あと2:30" / "2:30 left" / "还有2:30"
```

### 翻訳ファイルの自動読み込み

システム起動時に自動的にJSONファイルから翻訳を読み込みます：

```typescript
// アプリケーション初期化時
const i18n = I18nManager.getInstance();
await i18n.loadTranslationsFromJSON('ja');
await i18n.loadTranslationsFromJSON('en');
await i18n.loadTranslationsFromJSON('zh-CN');
// その他の言語...
```

### 新しい翻訳の追加

1. 各言語のJSONファイルに翻訳キーを追加:

```json
// ja.json
{
  "newFeature": {
    "title": "新機能",
    "description": "これは新しい機能です"
  }
}

// en.json  
{
  "newFeature": {
    "title": "New Feature", 
    "description": "This is a new feature"
  }
}
```

2. コードで使用（ネストされたキーはドット記法で取得）:

```typescript
const title = i18n.t('newFeature.title');
const desc = i18n.t('newFeature.description');
```

### コンポーネントでの言語変更監視

```typescript
export class MyComponent {
    private unsubscribers: (() => void)[] = [];

    constructor() {
        this.i18n = I18nManager.getInstance();
        
        // 言語変更を監視
        const unsubscribe = this.i18n.subscribe(() => {
            this.updateAllTexts();
        });
        this.unsubscribers.push(unsubscribe);
    }

    destroy() {
        // メモリリークを防ぐため購読を解除
        this.unsubscribers.forEach(unsubscribe => unsubscribe());
    }
}
```

## 翻訳キー構造

### UI関連
- `ui.title` - アプリケーションタイトル
- `ui.settings` - 設定
- `ui.info` - 詳細情報
- `ui.close` - 閉じる

### 月情報関連
- `moon.direction` - 方向
- `moon.distance` - 距離  
- `moon.altitude` - 高度
- `moon.phase` - 月齢
- `moon.illumination` - 照明率
- `moon.rise` - 月の出
- `moon.set` - 月の入り

### 設定関連
- `settings.sensitivity` - 感度設定
- `settings.volume` - 音量
- `settings.orientationCorrection` - 方位角補正
- `settings.display` - 表示設定
- `settings.language` - 言語設定

### 精度・情報関連
- `info.azimuthAccuracy` - 方位精度
- `info.altitudeAccuracy` - 高度精度
- `info.viewOnMap` - 地図で確認
- `info.locationSensor` - 位置・センサー

### エラー・状態関連
- `error.sensorNotSupported` - センサーがサポートされていません
- `status.enabled` - 有効
- `status.disabled` - 無効

## 今後の拡張

### 新しい言語の追加

1. 新しい翻訳ファイルを作成 (例: `fr.json` for フランス語)

```json
{
  "ui": {
    "title": "Boussole Lunaire",
    "settings": "Paramètres"
  },
  "moon": {
    "direction": "Direction",
    "distance": "Distance"
  }
  // ... 他の翻訳
}
```

2. `I18nManager`で翻訳を読み込み:

```typescript
await i18n.loadTranslationsFromJSON('fr');
```

3. `LanguageSelector`の選択肢に自動追加（利用可能な翻訳があれば表示される）

### アーキテクチャの特徴

#### JSONベースの翻訳システム
- **階層構造** - ネストされたオブジェクトでカテゴリ分け
- **フラット化** - 内部的にドット記法のキーに変換
- **動的読み込み** - 必要な言語のみ読み込み
- **型安全** - TypeScriptの型定義でサポート

#### リアクティブ更新システム
- **Observer Pattern** - 言語変更をコンポーネントに通知
- **自動UI更新** - DOMTranslationManagerが一括更新
- **メモリ管理** - 購読解除でメモリリーク防止

#### ユーザー体験の向上
- **ブラウザ言語検出** - 初回訪問時の自動設定
- **設定永続化** - LocalStorageにユーザー選択を保存
- **フォールバック** - 翻訳が見つからない場合は日本語で表示

### 推奨される今後の多言語化対象

現在実装済みですが、さらに詳細化できる領域：

- **時間表示** - より自然な時間表現
- **数値フォーマット** - 地域に応じた数値表示
- **日付フォーマット** - ロケール固有の日付表示
- **通知メッセージ** - システム通知の多言語化

### HTMLの多言語化

DOMTranslationManagerを使用した動的更新：

```typescript
// 自動更新される要素の例
export class DOMTranslationManager {
    updateAllTranslations(): void {
        // タイトル更新
        document.title = this.i18n.t('ui.title');
        
        // ボタンテキスト更新
        const buttons = document.querySelectorAll('[data-i18n]');
        buttons.forEach(button => {
            const key = button.getAttribute('data-i18n');
            if (key) {
                button.textContent = this.i18n.t(key);
            }
        });
    }
}
```

## 実装のメリット

1. **ユーザーエクスペリエンス向上** - 5言語で母国語対応
2. **国際化対応** - アジア地域を中心としたグローバルユーザーベース
3. **保守性向上** - JSON形式の一元管理で翻訳が容易
4. **拡張性** - 新しい言語の追加が簡単（JSONファイル追加のみ）
5. **パフォーマンス最適化** - 必要な翻訳のみ動的読み込み
6. **リアルタイム言語切り替え** - ページリロード不要
7. **型安全性** - TypeScriptによる翻訳キーの型チェック

## 技術的特徴

- **TypeScript完全対応** - 型安全な翻訳システム
- **JSON形式** - 標準的で編集しやすい翻訳ファイル
- **階層構造** - ネストされたオブジェクトで整理
- **フラット化処理** - ドット記法による直感的なキー指定
- **リアクティブシステム** - Observer Patternによる自動UI更新
- **軽量実装** - 外部ライブラリに依存しない独自実装
- **ブラウザ言語検出** - navigator.language による自動言語設定
- **永続化機能** - LocalStorageでユーザー選択を保存
- **フォールバック機能** - 翻訳未対応時の日本語表示
- **動的読み込み** - 必要な言語ファイルのみ fetch で取得

## ファイル構成

```
src/i18n/
├── I18nManager.ts          # 翻訳システムの中核
├── index.ts                # エクスポート定義
└── locales/                # 翻訳ファイル
    ├── ja.json             # 日本語（デフォルト）
    ├── en.json             # 英語
    ├── zh-CN.json          # 簡体中文
    ├── zh-TW.json          # 繁體中文
    └── ko.json             # 韓国語

src/components/
└── LanguageSelector.ts     # 言語選択UI

src/ui/
└── DOMTranslationManager.ts # DOM要素の翻訳管理
```

## パフォーマンス考慮事項

- **遅延読み込み** - 翻訳ファイルは必要時にfetch
- **メモリ効率** - 使用しない言語は読み込まない
- **バンドルサイズ** - 翻訳データはJavaScriptバンドルに含めない
- **キャッシュ活用** - ブラウザキャッシュによる高速表示

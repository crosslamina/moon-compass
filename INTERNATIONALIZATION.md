# 多言語化実装ガイド

## 概要

`月が綺麗`アプリケーションに包括的な多言語化（i18n）機能を実装しました。

## 実装した機能

### 1. サポート言語

- **日本語 (ja)** - デフォルト
- **英語 (en)** - English
- **簡体中文 (zh-CN)** - 简体中文

### 2. 主要コンポーネント

#### I18nManager
- 翻訳システムの中核クラス
- ロケール管理、翻訳文字列の取得、ユーザー設定の保存
- リアクティブな言語変更通知

#### LanguageSelector  
- 言語選択UIコンポーネント
- 設定ダイアログに統合
- 自動でブラウザ言語を検出

#### 翻訳定義ファイル
- `src/i18n/locales/ja.ts` - 日本語翻訳
- `src/i18n/locales/en.ts` - 英語翻訳  
- `src/i18n/locales/zh-CN.ts` - 簡体中文翻訳

### 3. 多言語化済みコンポーネント

- **MoonInfoDisplay** - 月情報表示
- **direction** モジュール - 方角名

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

### 新しい翻訳の追加

1. 各言語ファイルに翻訳キーを追加:

```typescript
// ja.ts
'new.feature': '新機能'

// en.ts  
'new.feature': 'New Feature'

// zh-CN.ts
'new.feature': '新功能'
```

2. コードで使用:

```typescript
const text = i18n.t('new.feature');
```

### コンポーネントでの言語変更監視

```typescript
export class MyComponent {
    constructor() {
        this.i18n = I18nManager.getInstance();
        
        // 言語変更を監視
        const unsubscribe = this.i18n.subscribe(() => {
            this.updateAllTexts();
        });
    }
}
```

## 今後の拡張

### 新しい言語の追加

1. 新しい翻訳ファイルを作成 (例: `ko.ts` for 韓国語)
2. `i18n/index.ts` で翻訳を登録
3. `LanguageSelector` の選択肢に追加

### さらなる多言語化

以下のコンポーネントの多言語化が推奨されます:

- **LocationManager** - 位置情報エラーメッセージ
- **DeviceOrientationManager** - センサー関連メッセージ  
- **DialogManager** - ダイアログのタイトルとボタン
- **MoonStatusDisplay** - ステータス表示
- **CompassManager** - コンパス関連UI

### HTMLの多言語化

```typescript
// DOMManagerの拡張例
export class DOMManager {
    updateText(elementId: string, translationKey: string, params?: any) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = I18nManager.getInstance().t(translationKey, params);
        }
    }
}
```

## 実装のメリット

1. **ユーザーエクスペリエンス向上** - 母国語でアプリを利用可能
2. **国際化対応** - グローバルなユーザーベースに対応
3. **保守性** - 翻訳が一箇所に集約され管理が容易
4. **拡張性** - 新しい言語の追加が簡単
5. **パフォーマンス** - 必要な翻訳のみロード

## 技術的特徴

- **TypeScript完全対応** - 型安全な翻訳システム
- **リアクティブ** - 言語変更時の自動UI更新
- **軽量** - 外部ライブラリに依存しない独自実装
- **ブラウザ言語検出** - 初回訪問時の自動言語設定
- **永続化** - ユーザー選択をLocalStorageに保存

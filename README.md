# Custom X Pro

X Proで特定のユーザーの投稿を非表示にするTampermonkeyスクリプトです。

## 機能

- ユーザーIDを指定して投稿を非表示
- Tampermonkeyメニューから簡単にユーザーIDを追加
- 設定はブラウザに永続化

## 開発

### 前提条件

- Node.js (v16以上推奨)
- npm

### セットアップ

```bash
npm install
```

### ビルド

```bash
# 一度だけビルド
npm run build

# ファイル変更を監視して自動ビルド
npm run watch
```

ビルドされたファイルは `dist/main.js` に出力されます。

### インストール

1. `npm run build` でビルド
2. Tampermonkeyで `dist/main.js` の内容をコピー＆ペースト
3. X Proのデッキページで動作確認

### プロジェクト構成

```
custom_x_pro/
├── src/               # ソースコード
│   ├── config.js      # 設定定数
│   ├── ConfigManager.js
│   ├── FilterEngine.js
│   ├── App.js
│   └── index.js       # エントリーポイント
├── dist/              # ビルド出力
│   └── main.js        # Tampermonkeyスクリプト
├── test/              # テスト
└── AGENTS.md          # 開発ルール
```

### テスト

```bash
npm test
```

## ライセンス

MIT

# プロジェクト開発ルール（UTF-8）

## Git ワークフロー
- `main` では直接作業しない。日常開発は `develop`、大きな変更は `develop` から `feature/xxx` を切る。
- 作業前後に必ず現在のブランチを確認する（例: `git branch`）。

## コミットメッセージ
- Conventional Commits を使用する。書式: `<type>: <description>`（type は英語、description は日本語）。
- type: `feat` `fix` `docs` `style` `refactor` `perf` `test` `chore`。

## コーディング規約
- クラス・メソッド・複雑な関数には日本語で JSDoc を付ける。
- アーキテクチャ: 責務ごとにクラス分割し、`App` が全体を調整する。`ConfigManager`（設定の読み書き）、`FilterEngine`（判定ロジック）、`ColumnMediaFilter`（メディア専用カラム）。
- 文字コードは UTF-8 を使用する。

## 開発フロー
- ソースは `src/`。ビルド: `npm run build`（監視は `npm run watch`）。成果物は `dist/main.js`。
- Tampermonkey への適用: ビルド後に `dist/main.js` をエディタに貼り付け。
- テスト: `npm test`。挙動変更や機能追加時はテストを追加・更新し、実行結果を確認する。

## エクスポート / インポート仕様
- `version: 2` を使用し、必須フィールドに `hiddenPosts` を含める。
- `hiddenPosts` には `postId` と `expiresAt`（有効期限）を含む。
- 起動時に期限切れの `hiddenPosts` を削除し、マッチ時には期限を 30 日延長する（TTL 30 日固定）。再保存も行う。
- エクスポート/インポート対象: `hiddenUserIds` / `hiddenPosts` / `mediaFilterTargets` / `textFilterWords`。

## 非表示判定の対象と仕様
- `hiddenUserIds`: ユーザー ID が一致したら親/引用問わず非表示。
- `hiddenPosts`: ポスト ID が一致したら非表示。親/引用両方で判定し、マッチ時に TTL を延長。
- `ColumnMediaFilter`: メディアのみ表示するカラムでは、表示側にメディアがない場合に非表示（引用カード内のみメディアがある場合も非表示）。
- `NGワード`: `data-testid="tweetText"` 配下の本文に NG ワードが含まれる場合に非表示。大文字小文字は区別せず、親テキストと引用テキストをそれぞれ判定。NG ワードはメニューから追加でき、保存時は小文字化し、エクスポート/インポート対象とする。

## 作業完了時の確認
- 変更に伴い更新が必要なドキュメント（README、仕様書、コメント、AGENTS.md）があれば反映する。
- エクスポート仕様や設定フォーマットを変えた場合は説明をドキュメントに追記する。
- 作業完了後、追加すべきルールやナレッジがあれば AGENTS.md を更新する。

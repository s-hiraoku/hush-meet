# Hush Meet

Google Meet で話していない時に自動でミュートし、周囲の雑音が参加者に届くのを防ぐ Chrome 拡張機能です。

[English](README.md)

## インストール

[Chrome Web Store](https://chromewebstore.google.com/detail/hush-meet/afmigfhmekjdkbaceempfecmcefmlceb)

## 使い方

1. Google Meet の通話に参加
2. ツールバーの Hush Meet アイコンをクリック
3. モードを選択（Auto / Auto-Off / Push-to-Talk）
4. マイクのアクセス許可を求められたら「許可」する
5. `Ctrl+Shift+M` でミュート操作（Push-to-Talk では長押し）

### 動作モード

| モード       | 挙動                                                       |
| ------------ | ---------------------------------------------------------- |
| Off          | 拡張機能を無効化 — Meet のデフォルト動作                   |
| Auto         | 発話で自動ミュート解除、無音で自動ミュート                 |
| Auto-Off     | ミュート解除は手動またはショートカット、無音で自動ミュート |
| Push-to-Talk | ショートカットキー長押し中のみ発話可能、離すと即ミュート   |

### 設定項目

| 項目               | 説明                                   | デフォルト               |
| ------------------ | -------------------------------------- | ------------------------ |
| モード             | Off / Auto / Auto-Off / Push-to-Talk   | Auto                     |
| ショートカットキー | ミュート操作のキーボードショートカット | Ctrl+Shift+M             |
| 発話検出の感度     | 音量がこの値を超えたらミュート解除     | 0.025                    |
| 猶予時間           | 発話終了後、ミュートするまでの待機時間 | 1.5秒                    |
| マイク             | 音声監視に使うマイクデバイス           | システムデフォルト       |
| テーマ             | ポップアップの外観テーマ（4種類）      | Default                  |
| 言語               | UIの表示言語（7言語＋自動）            | 自動（ブラウザ言語）     |

## 仕組み

```
[マイク入力] → [Web Audio API (RMS)] → [発話状態判定] → [Meet ミュートボタン操作]
```

- Meet 本体とは別にマイクストリームを取得して音量を監視
- 発話開始 → ミュート解除、発話終了 + 猶予時間 → ミュート
- 音声帯域重み付けノイズゲート: 人声の周波数帯（300Hz〜3kHz）を重視し、キーボード音やファン音の誤検知を抑制
- 非対称閾値設計: 発話開始の閾値 > 無音判定の閾値（チャタリング防止）

## 開発

### 必要なもの

- Node.js 22.x
- pnpm

### セットアップ

```bash
pnpm install
```

### コマンド

| コマンド         | 説明                      |
| ---------------- | ------------------------- |
| `pnpm dev`       | 開発サーバー起動          |
| `pnpm build`     | プロダクションビルド      |
| `pnpm test`      | テスト実行                |
| `pnpm run check` | format / lint / typecheck |

### Chrome で読み込み

1. `pnpm build` を実行
2. Chrome で `chrome://extensions` を開く
3. **デベロッパーモード** をオン
4. **パッケージ化されていない拡張機能を読み込む** → `dist` フォルダを選択

## 技術スタック

- Chrome Extension Manifest V3
- React 19 + TypeScript
- Vite + CRXJS Vite Plugin
- Web Audio API (AnalyserNode)
- Chrome Storage API

## 既知の制限事項

- 音声検出は RMS（音量）ベースのため、大きな雑音で誤反応する可能性あり（Auto-Off モードで軽減可能）
- Google Meet の UI 変更でミュートボタンの検出が壊れる可能性あり
- 発話の最初の一瞬が切れる場合がある（感度で調整可能）
- ショートカットキーは Meet タブがフォーカスされている時のみ動作

## ドキュメント

- [Webサイト](https://s-hiraoku.github.io/hush-meet/) ([English](https://s-hiraoku.github.io/hush-meet/en/) / [Deutsch](https://s-hiraoku.github.io/hush-meet/de/) / [中文](https://s-hiraoku.github.io/hush-meet/zh/) / [한국어](https://s-hiraoku.github.io/hush-meet/ko/) / [Español](https://s-hiraoku.github.io/hush-meet/es/) / [Français](https://s-hiraoku.github.io/hush-meet/fr/))
- [技術ドキュメント](https://s-hiraoku.github.io/hush-meet/architecture.html)
- [プライバシーポリシー](https://s-hiraoku.github.io/hush-meet/privacy-policy.html)

## ライセンス

MIT

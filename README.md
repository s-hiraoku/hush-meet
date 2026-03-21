# Hush Meet

Google Meet で話していない時に自動でミュートし、周囲の雑音が参加者に届くのを防ぐ Chrome 拡張機能です。

## インストール

Chrome Web Store からインストール（準備中）

## 使い方

1. Google Meet の通話に参加する
2. ツールバーの Hush Meet アイコンをクリック
3. **「自動ミュート」トグルをオン** にする
4. マイクのアクセス許可を求められたら「許可」する

### 設定項目

| 項目 | 説明 | デフォルト |
|------|------|-----------|
| 発話検出の感度 | 音量がこの値を超えたらミュート解除 | 0.025 |
| 猶予時間 | 発話終了後、ミュートするまでの待機時間 | 1.5秒 |

## 仕組み

```
[マイク入力] → [Web Audio API (RMS)] → [発話状態判定] → [Meet ミュートボタン操作]
```

- Meet 本体とは別にマイクストリームを取得して音量を監視
- 発話開始 → ミュート解除、発話終了 + 猶予時間 → ミュート
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

| コマンド | 説明 |
|---------|------|
| `pnpm dev` | 開発サーバー起動（HMR対応） |
| `pnpm build` | プロダクションビルド |
| `pnpm zip` | ビルド + Chrome Web Store 提出用 zip 生成 |
| `pnpm lint` | ESLint によるコード検査 |

### 開発モードでの動作確認

1. `pnpm dev` を実行
2. Chrome で `chrome://extensions` を開く
3. 右上の **「デベロッパーモード」** をオンにする
4. **「パッケージ化されていない拡張機能を読み込む」** をクリック
5. `dist` フォルダを選択

## 技術スタック

- Chrome Extension Manifest V3
- React 19 + TypeScript
- Vite + CRXJS Vite Plugin
- Web Audio API (AnalyserNode)
- Chrome Storage API

## 既知の制限事項

- 音声検出は RMS（音量）ベースのため、大きな雑音で誤反応する可能性あり
- Google Meet の UI 変更でミュートボタンの検出が壊れる可能性あり
- 発話の最初の一瞬が切れる場合がある（閾値で調整）

## ドキュメント

- [技術ドキュメント](https://s-hiraoku.github.io/hush-meet/architecture.html)
- [プライバシーポリシー](https://s-hiraoku.github.io/hush-meet/privacy-policy.html)

## ライセンス

MIT

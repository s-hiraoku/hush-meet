# Changelog

## [1.0.0] - 2026-03-21

### Added

- Google Meet での自動ミュート機能
  - 発話検出による自動ミュート解除
  - 発話終了後の猶予時間経過で自動ミュート
  - 非対称閾値設計によるチャタリング防止
- Popup UI（React 19）
  - 自動ミュートの有効/無効トグル
  - リアルタイム音声レベルメーター
  - 発話検出感度の調整（0.005〜0.1、デフォルト: 0.025）
  - 猶予時間の調整（0.5秒〜4.0秒、デフォルト: 1.5秒）
  - 状態表示（ミュート中/発話中/猶予中）
- Chrome Extension Manifest V3 対応
- GitHub Pages ドキュメント
  - プライバシーポリシー
  - 技術ドキュメント（アーキテクチャ、状態マシン、データフロー）
- Chrome Web Store 提出用アセット

### Technical

- Vite+ (Rolldown) + CRXJS Vite Plugin によるビルド環境
- 共通定数ファイル（`src/constants.ts`）による設定値の一元管理
- TypeScript による型安全な実装
- Node.js 24 (Active LTS) 対応

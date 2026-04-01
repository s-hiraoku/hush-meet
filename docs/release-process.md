# Release Process

Hush Meet のリリース手順チェックリスト。

## 1. バージョン更新

以下の3ファイルのバージョンを更新:

- [ ] `package.json` → `"version": "X.Y.Z"`
- [ ] `src/manifest.ts` → `version: "X.Y.Z"`
- [ ] `src/constants.ts` → `export const APP_VERSION = "X.Y.Z"`

## 2. CHANGELOG 更新

- [ ] `CHANGELOG.md` に新しいバージョンのエントリを追加

## 3. ドキュメント更新（必要な場合）

- [ ] `README.md` / `README.ja.md`
- [ ] `docs/index.html`（日本語サイト）
- [ ] `docs/en/index.html`（英語サイト）

## 4. ビルド・テスト

```bash
pnpm test
pnpm build
```

## 5. zip 作成

```bash
cd dist && zip -r ../hush-meet-X.Y.Z.zip . -x '*.map'
```

## 6. コミット・プッシュ

```bash
git add <changed files>
git commit -m "feat: vX.Y.Z — <summary>"
git push
```

## 7. GitHub Release 作成

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
gh release create vX.Y.Z hush-meet-X.Y.Z.zip --title "vX.Y.Z" --notes "$(sed -n '/## \[X.Y.Z\]/,/## \[/{ /## \[X.Y.Z\]/d; /## \[/d; p; }' CHANGELOG.md)"
```

## 8. Chrome Web Store 更新

1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) を開く
2. Hush Meet を選択
3. 「パッケージ」→「新しいパッケージをアップロード」で `hush-meet-X.Y.Z.zip` をアップロード
4. 「送信して審査」をクリック

## 未リリースのバージョン

以下のバージョンは GitHub Release が未作成:

- v1.0.9
- v1.0.10
- v1.0.11

まとめてリリースする場合:

```bash
# タグ作成
git tag v1.0.9 c548e7f
git tag v1.0.10 85f1660
git tag v1.0.11 777ca1f
git push origin v1.0.9 v1.0.10 v1.0.11

# リリース作成
gh release create v1.0.9 hush-meet-1.0.9.zip --title "v1.0.9" --notes "Mode-aware toolbar icon, 2048 & Flappy Bird games, mic sensitivity max 0.25"
gh release create v1.0.10 hush-meet-1.0.10.zip --title "v1.0.10" --notes "Faster speech detection (20ms interval, FFT 512), initial mute on start, mute button cache"
gh release create v1.0.11 hush-meet-1.0.11.zip --title "v1.0.11" --latest --notes "Voice-weighted noise gate: emphasize 300Hz-3kHz to reduce false triggers from keyboard/fan noise"
```

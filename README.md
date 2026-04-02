# Hush Meet

A Chrome extension that automatically mutes your microphone on Google Meet when you're not speaking, preventing background noise from reaching other participants.

[日本語](README.ja.md)

## Install

[Chrome Web Store](https://chromewebstore.google.com/detail/hush-meet/afmigfhmekjdkbaceempfecmcefmlceb)

## Usage

1. Join a Google Meet call
2. Click the Hush Meet icon in the toolbar
3. Choose a mode (Auto, Auto-Off, or Push-to-Talk)
4. Allow microphone access when prompted
5. Use `Ctrl+Shift+M` to toggle mute or hold-to-talk (Push-to-Talk)

### Operating Modes

| Mode         | Behavior                                             |
| ------------ | ---------------------------------------------------- |
| Off          | Extension disabled — Meet default behavior           |
| Auto         | Speech-triggered unmute, auto-mute on silence        |
| Auto-Off     | Manual or shortcut unmute only, auto-mute on silence |
| Push-to-Talk | Hold shortcut key to speak, instant mute on release  |

### Settings

| Setting            | Description                          | Default                |
| ------------------ | ------------------------------------ | ---------------------- |
| Mode               | Off / Auto / Auto-Off / Push-to-Talk | Auto                   |
| Shortcut Key       | Keyboard shortcut for mute control   | Ctrl+Shift+M           |
| Speech Sensitivity | Volume threshold to trigger unmute   | 0.025                  |
| Grace Period       | Delay before re-muting after speech  | 1.5s                   |
| Microphone         | Audio input device                   | System Default         |
| Theme              | Popup visual theme (4 options)       | Default                |
| Language           | UI language (7 languages + Auto)     | Auto (browser language)|

## How It Works

```
[Mic Input] → [Web Audio API (RMS)] → [Speech Detection] → [Meet Mute Button Control]
```

- Monitors audio via a separate mic stream (independent from Meet)
- Speech detected → unmute; silence + grace period → mute
- Voice-weighted noise gate: emphasizes 300Hz–3kHz to reduce false triggers from keyboard/fan noise
- Asymmetric thresholds: speech threshold > silence threshold (prevents chattering)
- Manual mute safety: if you click Meet's mute button directly, the extension switches to Off mode to avoid interference

## Development

### Prerequisites

- Node.js 22.x
- pnpm

### Setup

```bash
pnpm install
```

### Commands

| Command          | Description               |
| ---------------- | ------------------------- |
| `pnpm dev`       | Start dev server          |
| `pnpm build`     | Production build          |
| `pnpm test`      | Run tests                 |
| `pnpm run check` | Format / lint / typecheck |

### Load in Chrome

1. Run `pnpm build`
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** → select `dist` folder

## Tech Stack

- Chrome Extension Manifest V3
- React 19 + TypeScript
- Vite + CRXJS Vite Plugin
- Web Audio API (AnalyserNode)
- Chrome Storage API

## Known Limitations

- RMS-based detection may trigger on loud ambient noise (use Auto-Off mode)
- Google Meet UI changes may break mute button detection
- First syllable may be clipped (adjustable via sensitivity)
- Shortcut keys only work when the Meet tab is focused

## Documentation

- [Website](https://s-hiraoku.github.io/hush-meet/en/) ([日本語](https://s-hiraoku.github.io/hush-meet/) / [Deutsch](https://s-hiraoku.github.io/hush-meet/de/) / [中文](https://s-hiraoku.github.io/hush-meet/zh/) / [한국어](https://s-hiraoku.github.io/hush-meet/ko/) / [Español](https://s-hiraoku.github.io/hush-meet/es/) / [Français](https://s-hiraoku.github.io/hush-meet/fr/))
- [Technical Docs](https://s-hiraoku.github.io/hush-meet/en/architecture.html)
- [Privacy Policy](https://s-hiraoku.github.io/hush-meet/en/privacy-policy.html)

## License

MIT

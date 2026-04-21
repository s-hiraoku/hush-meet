# Changelog

## [1.2.1] - 2026-04-21

### Fixed

- Mode switch shortcuts (`Ctrl+Shift+0-3`) now use physical key codes (`event.code`) instead of `event.key`, fixing the issue where Shift modified the key value on most keyboard layouts
- Mic toggle shortcut (`Ctrl+Shift+M`) no longer changes the mode when pressed in Off mode
- Shortcut events are no longer silently consumed when no action is taken

## [1.2.0] - 2026-04-15

### Added

- Fixed keyboard shortcuts to switch modes on the Meet tab: `Ctrl+Shift+0` (Off), `Ctrl+Shift+1` (Auto), `Ctrl+Shift+2` (Auto-Off), `Ctrl+Shift+3` (Push-to-Talk)
- The existing customizable mic-toggle shortcut (`Ctrl+Shift+M` by default) is preserved and continues to work alongside the new mode shortcuts

## [1.1.1] - 2026-04-12

### Fixed

- Stabilize popup mic toggle actions so repeated clicks and press/release actions are not dropped
- Improve popup shortcut hint timing cleanup to avoid stale UI state after repeated triggers

## [1.1.0] - 2026-04-03

### Added

- Per-mode sensitivity and grace period settings: each mode (Auto, Auto-Off, Push-to-Talk) now stores its own speech threshold and grace period values
- Switching modes automatically restores that mode's saved slider values
- Existing settings are automatically migrated to per-mode format on first load

## [1.0.11] - 2026-04-01

### Added

- Voice-weighted noise gate: speech detection now emphasizes human voice frequencies (300Hz–3kHz), reducing false triggers from keyboard, fan, and ambient noise

## [1.0.10] - 2026-03-31

### Improved

- Faster speech detection: analysis interval 50ms→20ms, FFT window 2048→512 for quicker onset response
- Cache mute button DOM lookup to reduce latency in the analysis loop
- Force mute on monitoring start to prevent mic leak when joining a call

### Fixed

- Initial mute state leak: UI no longer shows "Muted" when mute button is not yet found
- Stale retry timer: initial mute retry is now properly cancelled on mode/device changes

## [1.0.9] - 2026-03-31

### Added

- Mode-aware toolbar icon: icon color changes by mode (grey=Off, green=Auto, amber=Auto-Off, blue=PTT) with badge indicator
- 2048 puzzle mini-game
- Flappy Bird mini-game

### Changed

- Increase mic sensitivity slider max from 0.1 to 0.25

## [1.0.8] - 2026-03-27

### Added

- Add Off/Auto-Off/Push-to-Talk modes and customizable shortcut key (042c387)
- Push-to-talk instant mute, shortcut hint in popup, bump v1.0.8 (665603b)

## [1.0.5] - 2026-03-24

### Added

- Add retro-future Breakout mini-game (c698048)
- Add Space Invaders game and fix game launcher (2fb01a0)

### Documentation

- Add mini-games to site features list (72af660)
- Add English version of site with language switching (14bd70b)
- Add game sound thrill warning to site (c2dcb53)

### Testing

- Add tests for USER_MUTED, manual mute detection, mic selection (3431487)

## [1.0.4] - 2026-03-24

### Documentation

- Update site with v1.0.3 features (e737814)

### Fixed

- Enumerate mic devices from content script context (95cafc7)

### Miscellaneous

- Bump version to 1.0.4 (30fc50b)

## [1.0.3] - 2026-03-23

### Added

- Add mic device selector and manual mute detection (1189cdd)

### Miscellaneous

- Bump version to 1.0.3 (0a85b04)

## [1.0.2] - 2026-03-23

### Added

- Add i18n support for English and Japanese (c039157)
- Add manual language switcher (auto/en/ja) (2546bd9)

### Fixed

- Replace language icon with globe SVG (e3be552)
- Improve mic detection reliability and add error feedback (e61b79d)

### Miscellaneous

- Bump version to 1.0.2 (07cf587)

## [1.0.1] - 2026-03-21

### Added

- Add retro digital equalizer to popup (2d8df93)
- Add theme switcher with 4 distinctive visual themes (641e8cf)

### Fixed

- Persist settings and add spectrum data for equalizer (c43d825)

### Miscellaneous

- Add git-cliff, lefthook, Vitest, and GitHub Actions CI (1f54845)
- Bump version to 1.0.1 (f32e3fe)

## [1.0.0] - 2026-03-21

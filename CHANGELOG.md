# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/) and this project adheres to
[Semantic Versioning](https://semver.org/).

## [3.0.0] - 2026-06-28

### Added

- **Dual analysis**: separate tabs for "who doesn't follow you back" and
  "people you don't follow back" (fans), plus a mutual-followers count.
- **Rich profile cards**: avatar, full name, verified badge, and private-account
  indicator for every result.
- **Ignore list**: mark accounts you want to keep; they are hidden from the
  non-followers list and persisted across analyses.
- **Search box** to filter results by username or name.
- **Result persistence**: the last analysis is stored locally and restored when
  you reopen the popup, with a relative "last analysis" timestamp.
- **Determinate progress bar** with per-page progress.
- **Internationalization** (`_locales`): Portuguese (default) and English.
- **JSON export** alongside the existing CSV and copy-to-clipboard actions.
- **Developer tooling**: ESLint (flat config), Prettier, and an `npm run package`
  script that builds a distributable ZIP into `dist/`.

### Changed

- Project reorganized into `src/` (UI + content script) and `src/lib/` (shared
  helpers).
- Comparison now keys users by their numeric ID instead of username, which is
  more robust if a username changes during pagination.
- Network layer now retries transient failures and backs off on Instagram rate
  limiting (HTTP 429/503) instead of failing immediately.
- Added the `storage` permission (still no host permissions — the extension only
  acts on the active tab when you click it).

## [2.0.0]

### Changed

- Stopped depending on scrolling the followers/following modal.
- Collection now uses Instagram's internal web API with `max_id` pagination.
- The popup status shows progress per loaded page.

## [1.0.0]

- Initial release: compared following vs. followers via the on-page UI.

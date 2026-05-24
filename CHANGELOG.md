# Changelog

## v0.1.8

### Added

- Added this changelog as the release note source.
- Added changelog section extraction for GitHub release notes.
- Added regression tests for release note extraction and XPI package contents.

### Changed

- Updated the release workflow to publish release notes from `CHANGELOG.md`.
- Switched local and GitHub release packaging to a shared allowlist builder.
- Limited XPI contents to runtime extension files and `LICENSE`.

## v0.1.7

### Changed

- Refreshed the popup, compose assistant, settings, translation result, and daily rundown interfaces with a Thunderbird-native visual style.
- Reduced explanatory UI copy for a cleaner, quieter interface.
- Moved user-facing inline styles into shared and per-surface CSS files.
- Improved loading, success, and error states across assistant surfaces.
- Enhanced the release workflow with manual tag-triggered release support.

### Added

- Added UI markup regression coverage for shared CSS loading, responsive viewport metadata, and inline style cleanup.

## v0.1.6

### Changed

- Hardened AI provider requests, config loading, timeouts, and error handling.
- Added shared message text helpers for truncation, MIME extraction, and safe HTML/text conversion.
- Improved compose actions with write, reply, polish, shorten, copy, and safer insert.
- Preserved quoted reply content during draft insertion with confidence checks.
- Made translation handoff tokenized and cleaned up temporary stored content.
- Refreshed popup button styling.

# Changelog

## v0.1.9

### Added

- Added optional JEV (TypeSafe System One) assistance for the Daily Rundown, providing per-email category, needs-reply, time-sensitive, and priority judgments as auxiliary signals for the summary prompt.
- Added a "JEV Rundown Assistance" settings section with a JEV API key field and an opt-in toggle.
- Added JEV coverage to the settings connection test, which now validates both the AI provider and JEV when assistance is enabled.
- Added `https://api.typesafe.ai/*` to the host permissions and `lib/jev_service.js` to the packaged extension files.
- Added tests for the JEV service, the new settings fields, and the updated options markup.

### Changed

- Gated JEV requests behind the API key, the assistance toggle, and the existing data opt-in, so nothing is sent unless all three are set.
- Made rundown generation fall back to the standard summary with an inline notice when JEV assistance is unavailable.
- Updated the privacy opt-in wording to cover multiple configured AI providers.

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

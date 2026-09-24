# Changelog

## v0.1.11

### Fixed

- "Insert into Draft" now works in HTML compose mode for new messages. It used to refuse whenever no quoted reply was present, which is every fresh HTML email.
- Draft insertion keeps the quoted reply and the Thunderbird signature by locating them as DOM nodes instead of matching serialized markup, so it no longer fails when Thunderbird reformats attributes.
- Plain-text insertion keeps a `-- ` signature instead of overwriting it.
- Test Connection retries with `max_completion_tokens` when a provider rejects `max_tokens`, so newer OpenAI models no longer fail the check.
- The Daily Rundown skips unread mail that Thunderbird has marked as junk.
- Provider error messages show the provider's message text instead of the raw JSON envelope.

### Added

- Copy and Refresh buttons on the Daily Rundown window, plus a line showing how many emails were analyzed and when.
- A Copy to Clipboard button on the Translation Result window.
- Dark theme support across every page, following the Thunderbird / OS color scheme.
- A **Theme** setting (Follow Thunderbird, Light, Dark) in the new General section. Changes preview immediately and apply to every open InboxAI window once saved.
- A spinner on loading states so long requests do not look frozen.

### Changed

- Renamed the context-menu item from "InboxAI-Translate" to "Translate with InboxAI".
- The Daily Rundown request now allows 120 seconds instead of 60, and JEV lookups run at most 4 at a time to avoid rate-limit bursts.
- The popup menu chevron is drawn with CSS instead of a ">" character.
- Settings page layout: the Language section became General and now holds the Theme picker, the optional Smart Rundown Prioritization section is collapsed until configured, and the Save / Test Connection bar stays visible while scrolling.

## v0.1.10

### Removed

- Removed the unused `accountsRead` permission. The add-on never reads `MessageHeader.folder` or calls the accounts, folders, or identities APIs, so `messagesRead` alone covers every message call.

### Changed

- Renamed the JEV settings section to "Smart Rundown Prioritization (optional)" and added a plain-language explanation of what JEV is, what it does for the Daily Rundown, and that enabling it sends unread-email excerpts to TypeSafe (api.typesafe.ai).
- Extended the privacy note to name TypeSafe as a separate data recipient from the configured AI provider.
- Replaced the `JEV ...` prefixes in the rundown prompt with plain labels, and told the model not to repeat the prioritization hints in its output.
- Documented the Daily Rundown and Smart Rundown Prioritization in the README, and mentioned the Daily Rundown in the manifest description.

### Added

- Added the Thunderbird `webext-linter` as a submodule under `external/` and `make build`, `make test`, `make lint`, and `make check` targets that run it against the built XPI.

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

# JEV-assisted rundown

- [x] Add opt-in JEV API key and rundown checkbox settings.
- [x] Add a focused JEV System One client with unit tests.
- [x] Feed optional JEV judgments into the existing rundown prompt.
- [x] Preserve the existing rundown when JEV is disabled, incomplete, or unavailable.
- [x] Run the repository tests and package build.
- [x] Test JEV from the Options connection test when JEV assistance is enabled.

## Review

- Added a dedicated TypeSafe System One client using `jev-latest`.
- JEV runs only when the API key, rundown checkbox, and existing data opt-in are all set.
- A JEV failure falls back to the original rundown and shows a non-blocking notice.
- Verified unit tests, package contents, release tests, syntax, and one live synthetic JEV request.
- The connection button now tests both providers when JEV assistance is enabled, using a fixed synthetic JEV state.

# ATN review round (v0.1.9 submission)

- [x] Remove the unused `accountsRead` permission (reviewer item 1).
- [x] Explain the JEV feature in the settings page, README, and manifest description (reviewer item 2).
- [x] Name TypeSafe as a data recipient distinct from the configured AI provider.
- [x] Strip the `JEV` acronym from rundown prompt labels and user-facing status text.
- [x] Vendor `thunderbird/webext-linter` as a submodule under `external/` with `make lint` / `make check`.

## Review

- `accountsRead` was a regression: removed in b251b3f, reintroduced in 54b66cc with the Daily Rundown. Only `messagesRead` is needed; the code never touches `MessageHeader.folder`.
- The settings copy uses section-scoped `<p>` styled like `.privacy-section p`, because `tests/test_ui_markup.js` bans the `field-help` / `section-note` classes.
- `make check` is green: 8/8 tests pass, linter reports 0 errors / 0 holds / 0 warnings / 0 info across 76 checks.
- Version bump deferred to `make release v=0.1.10`; CHANGELOG entry is already in place.

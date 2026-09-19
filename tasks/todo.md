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

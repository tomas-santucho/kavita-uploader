# Changelog

All notable changes to Kavita Uploader are documented here.

## 1.0.0 — 2026-09-09

### Added

- Added a small SQLite-backed users table at `/data/uploader.sqlite`.
- Added first-user bootstrap through `AUTH_USERNAME` and `AUTH_PASSWORD` environment variables.
- Added a sign-in screen and login, logout, and session endpoints.
- Protected library listing and file upload endpoints with an HTTP-only, SameSite session cookie.
- Added Docker instructions for pulling the published GHCR image and running it with a mounted
  Kavita library.

### Security

- Passwords are stored as salted `scrypt` hashes rather than plaintext.
- Upload path components are sanitized so names cannot escape the configured data directory.
- File names are rendered as text in the browser instead of being interpolated into HTML.

### Changed

- Added configurable `DATA_DIR` and `PORT` settings.
- Moved Compose authentication settings into environment variables.
- Added clear errors for oversized uploads and general upload failures.
- Switched the start command to Bun because the server uses Bun's built-in SQLite driver.

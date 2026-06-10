# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-06-10

### Added

- Client (trader) mode with 26 tools against the public Trade Server API.
- Two client authentication styles: login+password with automatic token refresh, and static public API token.
- Duplicate-fill protection: order-placement POSTs never retry on connection errors.
- Targeted sign-in failure diagnostics surfaced in tool results (credential, server-version, and connectivity hints).
- 82-test suite using node:test, including golden HMAC vectors.
- stdio JSON-RPC regression harness (`scripts/regression-admin.mjs`) supporting both admin and client modes.

### Changed

- Admin mode is unchanged at 38 tools.

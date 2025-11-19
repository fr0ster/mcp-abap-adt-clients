# @mcp-abap-adt/adt-clients – Changelog

All notable changes to this package are documented here.  
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and the package follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Builder cleanup now logs every delete failure with its HTTP status and only skips tests when SAP returns **HTTP 423 Locked** (object edited by another user). Any other cleanup failure now fails the test, exposing errors instead of silently skipping them.
- Updated `docs/DELETION_ISSUES_ANALYSIS.md` with the new cleanup/logging policy so the behaviour is documented for contributors.
- TableBuilder test configuration (both `tests/test-config.yaml` and `.template`) now uses SAP-compliant annotations:  
  `@AbapCatalog.enhancement.category: #NOT_EXTENSIBLE`, `@AbapCatalog.dataMaintenance: #RESTRICTED`, and a mandatory `MANDT` key field. This prevents ADT from returning “Can’t save due to errors in source”.


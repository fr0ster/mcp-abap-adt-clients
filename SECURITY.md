# Security Policy

## Supported versions

Security fixes are released only for the latest `7.x` minor line. Older majors
are not maintained — upgrade to the latest `7.x`.

| Version | Supported          |
| ------- | ------------------ |
| 7.x     | :white_check_mark: |
| < 7.0   | :x:                |

## Reporting a vulnerability

**Please report security vulnerabilities privately — do not open a public issue
or PR.**

- **Preferred:** GitHub private vulnerability reporting — open the repository's
  **Security** tab → **Report a vulnerability**
  (https://github.com/fr0ster/mcp-abap-adt-clients/security/advisories/new).
- **Alternative:** email <oleksij.kyslytsja@gmail.com>.

Please include:

- the affected version(s),
- a description of the issue and its impact,
- steps to reproduce or a proof of concept.

You will receive an acknowledgement of the report. We will investigate,
coordinate a fix, and disclose responsibly once a patched release is available.
Credit will be given to reporters who wish to be acknowledged.

## Dependencies

Runtime dependencies are monitored with Dependabot; `npm audit` is expected to
report **0 vulnerabilities** on the default branch. Dependency security bumps are
shipped as patch releases.

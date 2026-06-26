# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | Yes |

## Reporting a vulnerability

Please do not report security vulnerabilities through public GitHub issues.

Send a description of the vulnerability to **krbavadiya11@gmail.com**. Include:

- A description of the issue and its potential impact
- Steps to reproduce or proof-of-concept code
- Any suggested mitigation

You should receive an acknowledgment within 48 hours. Once the issue is confirmed, a fix will be released as quickly as possible — typically within 7 days for critical issues. You will be credited in the release notes unless you prefer to remain anonymous.

## Scope

Issues in the following areas are in scope:

- `@xevrion/flock-server` — authentication bypass, remote code execution, privilege escalation, denial-of-service vectors that affect all users
- `@xevrion/flock-core` / `@xevrion/flock-react` — XSS risks from improperly handled server messages, data leakage across rooms

Self-hosted deployments that are misconfigured (for example, running without API key auth and exposing the server publicly) are out of scope, as the risk is to the operator's own data.

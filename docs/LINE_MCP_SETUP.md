# LINE Bot MCP setup

This repository includes a project-scoped MCP configuration for the official
[LINE Bot MCP server](https://github.com/line/line-bot-mcp-server). The launcher
keeps credentials out of `.mcp.json`, validates the destination ID, and maps the
repository's explicit environment-variable names to those expected by the
server.

## 1. Configure LINE Developers

1. Open the [LINE Developers Console](https://developers.line.biz/console/).
2. Create or select a provider, then create a **Messaging API** channel.
3. On the **Messaging API** tab, issue a channel access token. Prefer a token
   that can be revoked or rotated without changing application code.
4. Add the bot as a friend (or add it to the intended group/room), then obtain
   the destination ID. User IDs start with `U`, group IDs with `C`, and room IDs
   with `R`.

Do not use the channel secret here. The MCP server sends messages with a channel
access token; the channel secret is used to verify incoming webhook signatures.

## 2. Export credentials

Export credentials in the same shell/session that launches the MCP client:

```bash
export LINE_CHANNEL_ACCESS_TOKEN='replace-with-channel-access-token'
export LINE_DESTINATION_USER_ID='U0123456789abcdef0123456789abcdef'
```

`.env.example` documents the required names, but the launcher deliberately does
not source `.env`: sourcing a file as shell code is unsafe. If a process manager,
container, or secrets manager launches the MCP client, inject both variables
there instead. Never commit the token; local `.env*` files are ignored.

## 3. Start and approve the server

Open this repository with an MCP client that supports project `.mcp.json` files,
then review and approve the `line-bot` project server. The first start uses
`npx` to download `@line/line-bot-mcp-server`, so Node.js/npm and registry
network access are required.

For production or repeatable deployments, install and lock an audited package
version in the deployment image rather than allowing an unpinned `npx` download.
Restart the MCP client after changing environment variables. Revoke the channel
access token immediately if it is exposed.

## Verification

Before sending a real message, check the configuration without printing secrets:

```bash
jq empty .mcp.json
bash -n scripts/run-line-bot-mcp.sh
```

Then ask the MCP client to send a harmless test message to the configured
destination. Confirm it arrived in the expected chat before enabling automated
or high-volume sends.

## Webhook security note

This MCP setup only sends messages; it does not configure an inbound webhook.
If an n8n workflow receives LINE webhooks, verify the `x-line-signature` against
the **raw request body** with HMAC-SHA256 and the channel secret before parsing
or acting on an event. Add event-level idempotency, bounded retries/timeouts,
structured failure logs without message contents or credentials, and consistent
non-2xx responses for rejected requests.

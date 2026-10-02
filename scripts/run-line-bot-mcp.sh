#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${LINE_CHANNEL_ACCESS_TOKEN:-}" ]]; then
	printf '%s\n' 'LINE_CHANNEL_ACCESS_TOKEN is required' >&2
	exit 64
fi

if [[ -z "${LINE_DESTINATION_USER_ID:-}" ]]; then
	printf '%s\n' 'LINE_DESTINATION_USER_ID is required' >&2
	exit 64
fi

# LINE user, group, and room IDs begin with U, C, and R respectively. Reject
# malformed destinations before a tool call can send a message to the wrong ID.
if [[ ! "$LINE_DESTINATION_USER_ID" =~ ^[UCR][0-9a-fA-F]{32}$ ]]; then
	printf '%s\n' 'LINE_DESTINATION_USER_ID must be a LINE user, group, or room ID' >&2
	exit 64
fi

export CHANNEL_ACCESS_TOKEN="$LINE_CHANNEL_ACCESS_TOKEN"
export DESTINATION_USER_ID="$LINE_DESTINATION_USER_ID"

exec npx --yes @line/line-bot-mcp-server

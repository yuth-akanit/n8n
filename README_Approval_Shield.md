# Approval Shield Endpoints • v2

An n8n workflow that provides webhook endpoints for handling approval/rejection requests with confirmation screens.

## Overview

This workflow implements a two-step approval system with HTML confirmation pages. It's designed to prevent accidental approvals/rejections by requiring users to confirm their action before it's processed.

## Features

### Approval Flow
1. **GET /approval/approve** - Displays a Thai-language HTML confirmation page asking "ยืนยันการอนุมัติโพสต์?" (Confirm post approval?)
2. **POST /approval/approve/confirm** - Processes the approval, decodes the payload, and sends `{approved: true}` to the resume URL

### Rejection Flow
1. **GET /approval/reject** - Displays a Thai-language HTML confirmation page asking "ยืนยันการปฏิเสธโพสต์?" (Confirm post rejection?)
2. **POST /approval/reject/confirm** - Processes the rejection, decodes the payload, and sends `{approved: false}` to the resume URL

## Technical Details

### Payload Format
The workflow expects a base64url-encoded payload containing:
```json
{
  "resume": "https://your-webhook-url/path"
}
```

### Payload Decoding
- Converts base64url to standard base64 (replaces `-` with `+` and `_` with `/`)
- Adds padding if needed
- Decodes and parses JSON
- Extracts the resume URL

### Response Handling
- **Success (Approve)**: "✅ อนุมัติเรียบร้อย" (Approved successfully)
- **Success (Reject)**: "❌ ปฏิเสธเรียบร้อย" (Rejected successfully)
- **Error**: Returns JSON error if payload is missing

## Usage

1. Import `Approval_Shield_Endpoints_v2.json` into your n8n instance
2. Activate the workflow
3. Use the webhook URLs in your approval system
4. Pass the base64url-encoded payload as a query parameter: `?payload=YOUR_ENCODED_PAYLOAD`

## Workflow Nodes

| Node | Type | Purpose |
|------|------|---------|
| Approval GET • Approve | Webhook | Receives approval requests |
| Respond HTML • Approve | Respond to Webhook | Shows confirmation form |
| Approval POST • ApproveConfirm | Webhook | Receives approval confirmation |
| Decode Payload • Approve | Function | Decodes and processes payload |
| HTTP • Resume (Approve) | HTTP Request | Sends approval to resume URL |
| Respond OK • Approve | Respond to Webhook | Shows success message |
| Approval GET • Reject | Webhook | Receives rejection requests |
| Respond HTML • Reject | Respond to Webhook | Shows confirmation form |
| Approval POST • RejectConfirm | Webhook | Receives rejection confirmation |
| Decode Payload • Reject | Function | Decodes and processes payload |
| HTTP • Resume (Reject) | HTTP Request | Sends rejection to resume URL |
| Respond OK • Reject | Respond to Webhook | Shows success message |

## Security Considerations

- HTML forms use POST method to prevent accidental submissions via URL sharing
- Uses `noindex,nofollow` meta tags to prevent search engine indexing
- Includes viewport settings for mobile compatibility
- Uses UTF-8 charset for proper Thai language display

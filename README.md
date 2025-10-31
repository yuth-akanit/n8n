# n8n Workflows

This repository contains n8n workflow configurations.

## Workflows

### Approval Register + Approve Endpoint
**File:** `Approval-Register-Approve-Endpoint.json`

This workflow handles the approval process for content before posting to Facebook.

**Features:**
- Prepares review data with execution ID tracking
- Creates approval/rejection URLs with tokens
- Registers approval requests in Google Sheets (ReviewQueue)
- Posts approved content to Facebook with automated comments
- Forwards data to registration webhook

**Nodes:**
1. **Prepare Review Data** - Collects and structures data including executionId, title, shortContent, pageAccessToken
2. **Set • Action** - Configures approval/rejection URLs and status
3. **Append ReviewQueue** - Logs approval requests to Google Sheets
4. **Post to Facebook_comment** - Posts FAQ comment to Facebook
5. **Forward Data to Register** - Forwards data to webhook
6. **Webhook • Register** - Webhook endpoint for registration

**Environment Variables Required:**
- `APPROVAL_TOKEN` - Token for approval authentication

### สร้าง_Animation
**File:** `สร้าง_Animation.json`

Animation creation workflow (Note: This file currently has JSON syntax errors and needs repair)

## Setup

1. Import the workflow JSON files into your n8n instance
2. Configure required credentials (Facebook, Google Sheets, etc.)
3. Set environment variables
4. Activate the workflows

## Notes

- The `สร้าง_Animation.json` file has known JSON syntax errors (extra closing braces in parameter structures) and requires manual fixing before use
auto chat bot

# n8n Workflows - PA Cooling Services

This directory contains n8n workflow configurations for the PA Cooling Services booking system.

## Available Workflows

### 1. Job Start Webhook (`job-start-webhook.json`)

Handles technician job start submissions from the LIFF application.

**Endpoint:** `POST /webhook/job-start`

**Features:**
- Receives job start data from LIFF app
- Implements idempotency check (prevents duplicate starts)
- Updates Supabase booking status to "working"
- Creates booking event record
- Sends LINE notification to admin group
- Returns success response to LIFF app

**Setup:**
1. Import workflow into n8n
2. Verify Supabase credentials in "config" node
3. Configure LINE Messaging API credentials
4. Test with sample data (pinData included)

**Related Documentation:**
- `/docs/BOOKING_DATA_STRUCTURE.md` - Data structures and API

---

### 2. Job Close Webhook (`job-close-webhook.json`) ⭐ NEW

Handles job completion submissions with image uploads to S3/MinIO.

**Endpoint:** `POST /webhook/job-close`

**Features:**
- Receives job close data from LIFF app
- Uploads images to S3/MinIO with proper authentication
- Handles multiple images per job
- Updates Supabase booking status to "completed"
- Creates booking event record
- Sends LINE notification with job summary
- Returns uploaded image URLs to LIFF app

**Critical Setup Steps:**

#### Step 1: Configure S3/MinIO Credentials

Edit the **Config** node and replace:

```javascript
{
  "s3_access_key": "YOUR_S3_ACCESS_KEY",     // ← Replace with real key
  "s3_secret_key": "YOUR_S3_SECRET_KEY"      // ← Replace with real secret
}
```

To get credentials:
- **Option A:** MinIO Console → Access Keys → Create New
- **Option B:** MinIO CLI (see S3_UPLOAD_FIX.md)

#### Step 2: Configure n8n AWS Credentials

For the "Upload to S3" node:
1. Go to n8n **Credentials** → **Create New**
2. Select **AWS** credential type
3. Enter:
   - **Access Key ID**: (from MinIO)
   - **Secret Access Key**: (from MinIO)
   - **Region**: `us-east-1`
4. Assign to "Upload to S3" node

**Alternative:** If n8n doesn't support MinIO endpoints directly, you may need to use HTTP Request with AWS Signature v4.

#### Step 3: Verify MinIO Bucket Setup

```bash
# Test access with MinIO CLI
mc alias set myminio https://s3.paaair.online ACCESS_KEY SECRET_KEY
mc ls myminio/job-close-data/image-workjobs

# If bucket doesn't exist, create it
mc mb myminio/job-close-data
```

**Related Documentation:**
- `/docs/S3_UPLOAD_FIX.md` - Complete S3 setup guide
- `/docs/BOOKING_DATA_STRUCTURE.md` - Job close payload structure

---

## Import Instructions

### Using n8n Web UI

1. Open n8n dashboard
2. Go to **Workflows** → **Add Workflow** → **Import from File**
3. Select `job-start-webhook.json` or `job-close-webhook.json`
4. Click **Import**
5. Configure credentials (see setup steps above)
6. **Activate** the workflow

### Using n8n CLI

```bash
# Copy workflow file to n8n workflows directory
cp workflows/job-start-webhook.json ~/.n8n/workflows/

# Or use n8n import command
n8n import:workflow --input=workflows/job-start-webhook.json
```

---

## Testing Workflows

### Test Job Start Webhook

```bash
curl -X POST https://admin.paaair.online/webhook/job-start \
  -H "Content-Type: application/json" \
  -d '{
    "action": "job_start_submitted",
    "booking_id": "test-uuid-001",
    "job_number": "PA-2025-12-99999",
    "technician": {
      "technician_line_id": "Utest123",
      "technician_name": "Test Technician"
    },
    "location": {
      "lat": 13.7563,
      "lng": 100.5018
    },
    "summary": {
      "unit_planned": 2
    },
    "meta": {
      "liff_source": "test",
      "submitted_at": "2025-12-24T00:00:00.000Z"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "action": "job_started",
  "booking_id": "test-uuid-001",
  "job_number": "PA-2025-12-99999",
  "queue_number": "PA-2025-12-99999",
  "started_at": "..."
}
```

### Test Job Close Webhook (without images)

```bash
curl -X POST https://admin.paaair.online/webhook/job-close \
  -H "Content-Type: application/json" \
  -d '{
    "action": "job_close_submitted",
    "booking_id": "test-uuid-001",
    "job_number": "PA-2025-12-99999",
    "technician": {
      "technician_line_id": "Utest123",
      "technician_name": "Test Technician"
    },
    "status_action": "done",
    "summary": {
      "service_type": "ล้างแอร์",
      "unit_planned": 2,
      "unit_done": 2,
      "work_start_time": "2025-12-24T10:00:00.000Z",
      "work_end_time": "2025-12-24T11:30:00.000Z"
    },
    "payment": {
      "net_price": 1000,
      "payment_method": "cash"
    },
    "customer_feedback": {
      "rating": 5,
      "allow_photo_use": true,
      "comment": "ดีมาก"
    },
    "closed_at": "2025-12-24T11:30:00.000Z",
    "meta": {
      "liff_source": "test",
      "submitted_at": "2025-12-24T11:30:00.000Z"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "action": "job_closed",
  "booking_id": "test-uuid-001",
  "job_number": "PA-2025-12-99999",
  "closed_at": "2025-12-24T11:30:00.000Z",
  "photo_urls": []
}
```

---

## Workflow Architecture

### Job Start Flow

```
LIFF App → Webhook → Config → Normalize → Check booking_id
                                              ↓
                                         Idempotency Check
                                              ↓
                                      Already started?
                                       ↙           ↘
                                    Yes             No
                                     ↓               ↓
                              Return "already"   Update DB
                                                     ↓
                                                Insert Event
                                                     ↓
                                               LINE Notify
                                                     ↓
                                                Respond OK
```

### Job Close Flow

```
LIFF App → Webhook → Config → Normalize → Check booking_id
                                              ↓
                                      Has images?
                                       ↙           ↘
                                    Yes             No
                                     ↓               ↓
                              Prepare Upload     Update DB
                                     ↓
                               Upload to S3
                                     ↓
                              Collect URLs
                                     ↓
                                  Update DB → Insert Event → LINE Notify → Respond
```

---

## Credentials Management

### Supabase Credentials (Both Workflows)

Located in **Config** node:
- `supabase_url`: `https://zekkvwdejxryeiiihfcy.supabase.co`
- `supabase_apikey`: Service role key (JWT)
- `supabase_authorization`: Bearer token (same as apikey)

**Security Note:** These are service role keys with elevated permissions. In production:
- Store in n8n environment variables
- Use n8n credentials vault
- Never commit to public repositories

### S3/MinIO Credentials (Job Close Only)

Located in **Config** node:
- `s3_endpoint`: `https://s3.paaair.online`
- `s3_bucket`: `job-close-data`
- `s3_access_key`: **MUST BE CONFIGURED**
- `s3_secret_key`: **MUST BE CONFIGURED**

### LINE Messaging API (Both Workflows)

Credential name: `ห้องคิวงาน`
- Channel Access Token (Long-lived)
- Target: Group ID `C3c85d15973e816ded98a753949e0257f`

---

## Troubleshooting

### Job Start Issues

**Issue:** "No output data" error at Idempotency node

**Solution:** Ensure `alwaysOutputData: true` is set (already configured in workflow)

**Issue:** Duplicate job starts not prevented

**Solution:** Check Supabase unique index:
```sql
CREATE UNIQUE INDEX idx_booking_events_idempotency
ON booking_events(booking_id, action)
WHERE action = 'job_start_submitted';
```

### Job Close Issues

**Issue:** AccessDenied when uploading to S3

**Solutions:**
1. Verify S3 credentials are correct
2. Check bucket policy allows PutObject
3. Test credentials with MinIO CLI
4. See `/docs/S3_UPLOAD_FIX.md` for detailed troubleshooting

**Issue:** Images not uploading (no error)

**Solutions:**
1. Check if LIFF is sending images in `images[]` array
2. Verify base64 format: `data:image/jpeg;base64,...`
3. Check workflow execution log for "Prepare S3 Upload" output
4. Temporarily remove `continueOnFail` to see actual errors

**Issue:** LINE notification not sent

**Solutions:**
1. Verify LINE credential is valid
2. Check group ID is correct
3. Bot must be member of the group
4. Check n8n logs for LINE API errors

---

## Maintenance

### Monitoring

Check these metrics regularly:
- Workflow execution count (n8n dashboard)
- Error rate per workflow
- S3 upload success rate
- Supabase database size

### Backup

Export workflows regularly:
```bash
# From n8n UI: Workflow → ... → Download
# Or via CLI:
n8n export:workflow --all --output=./backups/
```

### Updates

When updating workflows:
1. Export current version (backup)
2. Make changes in n8n UI or JSON file
3. Test with sample data
4. Activate new version
5. Monitor for errors
6. Commit to git

---

## Support

For issues or questions:
- **Documentation:** `/docs/`
- **S3 Setup:** `/docs/S3_UPLOAD_FIX.md`
- **Data Structures:** `/docs/BOOKING_DATA_STRUCTURE.md`

---

**Last Updated:** 2025-12-24
**Workflows Version:** 2.0.0
**Author:** PA Cooling Services Development Team

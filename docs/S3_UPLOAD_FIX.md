# S3 Access Denied Fix - Job Close Webhook

## Problem Summary

The LIFF application was attempting to upload images directly to MinIO/S3 from the browser, resulting in:
- **405 Method Not Allowed** error
- **AccessDenied** error for bucket `job-close-data`

Error details:
```xml
<Error>
<Code>AccessDenied</Code>
<Message>Access Denied.</Message>
<Key>image-workjobs</Key>
<BucketName>job-close-data</BucketName>
<Resource>/job-close-data/image-workjobs</Resource>
</Error>
```

## Root Cause

Direct browser uploads to S3/MinIO fail because:
1. **CORS Policy**: MinIO server doesn't allow cross-origin POST/PUT from browsers
2. **Bucket Policy**: The bucket doesn't have public write permissions (security best practice)
3. **Authentication**: Browser doesn't have S3 access credentials

## Solution

Instead of uploading directly from browser → S3, we now use:
**Browser → n8n Webhook → S3**

The n8n workflow handles uploads server-side with proper credentials.

---

## Implementation

### 1. Job Close Webhook Workflow

Created: `/workflows/job-close-webhook.json`

**Workflow Flow:**
```
1. Receive webhook (LIFF job close data)
   ↓
2. Load config (Supabase + S3 credentials)
   ↓
3. Normalize data & extract images
   ↓
4. Check booking_id exists
   ↓
5. Check if images need upload
   ├─ Yes → Upload to S3 → Collect URLs
   └─ No  → Continue
   ↓
6. Update Supabase booking (status=completed)
   ↓
7. Insert booking_event (job_close_submitted)
   ↓
8. Build & send LINE notification
   ↓
9. Respond to LIFF with success + photo URLs
```

### 2. Key Features

- ✅ **Server-side S3 uploads** with proper authentication
- ✅ **Base64 image support** (LIFF sends images as base64)
- ✅ **Multiple image handling** (loops through all images)
- ✅ **Organized S3 structure**: `image-workjobs/{job_number}/{timestamp}_{filename}.jpg`
- ✅ **Public URL generation** for uploaded images
- ✅ **Database updates** with photo URLs
- ✅ **LINE notifications** with job completion summary
- ✅ **Error handling** with `continueOnFail` on S3 upload

---

## Configuration Required

### Step 1: Configure S3/MinIO Credentials in n8n

In the workflow's **Config** node, update these values:

```json
{
  "s3_endpoint": "https://s3.paaair.online",
  "s3_bucket": "job-close-data",
  "s3_access_key": "YOUR_ACTUAL_ACCESS_KEY",
  "s3_secret_key": "YOUR_ACTUAL_SECRET_KEY"
}
```

**How to get credentials:**

#### Option A: MinIO Console
1. Log in to MinIO Console at `https://s3.paaair.online` (or admin port)
2. Go to **Access Keys** → **Create New Access Key**
3. Save the Access Key and Secret Key
4. Update the Config node in n8n

#### Option B: Create via MinIO CLI
```bash
mc alias set myminio https://s3.paaair.online ADMIN_USER ADMIN_PASSWORD
mc admin user add myminio n8n-uploader YOUR_SECRET_KEY
mc admin policy attach myminio readwrite --user n8n-uploader
```

### Step 2: Configure n8n AWS Credentials

For the **Upload to S3** node to work:

1. Go to n8n **Credentials** → **Create New**
2. Select **AWS** (or **S3** if available)
3. Fill in:
   - **Access Key ID**: (from MinIO)
   - **Secret Access Key**: (from MinIO)
   - **Region**: `us-east-1` (default for MinIO)
   - **Custom Endpoint**: `https://s3.paaair.online` (if option available)

4. Link this credential to the "Upload to S3" node

**Note:** If n8n doesn't support custom S3 endpoints in AWS credentials, you may need to:
- Use the HTTP Request node with AWS Signature v4 authentication
- Or use a pre-signed URL approach

### Step 3: Set Bucket Permissions (MinIO)

Ensure the bucket allows uploads from n8n server:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": ["arn:aws:iam:::user/n8n-uploader"]
      },
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": ["arn:aws:s3:::job-close-data/image-workjobs/*"]
    }
  ]
}
```

Apply via MinIO Console or CLI:
```bash
mc anonymous set download myminio/job-close-data/image-workjobs
mc admin policy create myminio n8n-upload-policy policy.json
```

### Step 4: Enable CORS (Optional - for future direct uploads)

If you want to support presigned URLs later:

```bash
mc anonymous set-json myminio/job-close-data <<EOF
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://paaair.online"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF
```

---

## LIFF Application Changes Required

The LIFF app needs to send images to the webhook instead of directly to S3.

### Current (Broken) Flow:
```javascript
// ❌ DON'T DO THIS - Causes AccessDenied
fetch('https://s3.paaair.online/job-close-data/image-workjobs', {
  method: 'POST',
  body: imageFormData
});
```

### New (Working) Flow:

```javascript
// ✅ DO THIS - Send to n8n webhook
const payload = {
  action: "job_close_submitted",
  booking_id: bookingId,
  job_number: jobNumber,
  technician: technicianData,
  status_action: "done",
  summary: { /* ... */ },
  payment: { /* ... */ },
  checklist: { /* ... */ },
  customer_feedback: { /* ... */ },

  // Send images as base64 array
  images: [
    {
      base64: "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
      filename: "photo_1.jpg",
      contentType: "image/jpeg"
    },
    {
      base64: "data:image/jpeg;base64,iVBORw0KGgo...",
      filename: "photo_2.jpg",
      contentType: "image/jpeg"
    }
  ],

  meta: {
    liff_source: "job_close",
    submitted_at: new Date().toISOString(),
    version: 2.8
  }
};

// Send to n8n webhook
fetch('https://admin.paaair.online/webhook/job-close', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})
.then(res => res.json())
.then(data => {
  console.log('Success:', data);
  // data.photo_urls will contain uploaded S3 URLs
  // e.g., ["https://s3.paaair.online/job-close-data/image-workjobs/PA-2025-12-00029/1703462307_photo_1.jpg"]
});
```

### Example: Convert File to Base64 in LIFF

```javascript
async function convertImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Usage in LIFF
const fileInput = document.getElementById('photo-input');
const files = fileInput.files;
const images = [];

for (let file of files) {
  const base64 = await convertImageToBase64(file);
  images.push({
    base64: base64,
    filename: file.name,
    contentType: file.type
  });
}

// Add to payload
payload.images = images;
```

---

## Testing the Workflow

### Test 1: Without Images

```bash
curl -X POST https://admin.paaair.online/webhook/job-close \
  -H "Content-Type: application/json" \
  -d '{
    "action": "job_close_submitted",
    "booking_id": "72484ffa-0ddc-468a-853f-bb0810192aef",
    "job_number": "PA-2025-12-00029",
    "technician": {
      "technician_line_id": "Ufcb73f1eb6ff4547718a1a4784d04141",
      "technician_name": "Akanit P."
    },
    "status_action": "done",
    "summary": {
      "service_type": "ล้างแอร์",
      "unit_planned": 1,
      "unit_done": 1,
      "work_start_time": "2025-12-24T21:50:43.744Z",
      "work_end_time": "2025-12-24T21:51:47.578Z"
    },
    "payment": {
      "total_price": 0,
      "net_price": 0,
      "payment_method": "cash"
    },
    "customer_feedback": {
      "rating": 5,
      "allow_photo_use": true
    },
    "closed_at": "2025-12-24T21:51:47.578Z",
    "meta": {
      "liff_source": "job_close",
      "submitted_at": "2025-12-24T21:51:47.578Z"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "action": "job_closed",
  "booking_id": "72484ffa-0ddc-468a-853f-bb0810192aef",
  "job_number": "PA-2025-12-00029",
  "closed_at": "2025-12-24T21:51:47.578Z",
  "photo_urls": []
}
```

### Test 2: With Images

```bash
curl -X POST https://admin.paaair.online/webhook/job-close \
  -H "Content-Type: application/json" \
  -d '{
    "action": "job_close_submitted",
    "booking_id": "test-booking-001",
    "job_number": "PA-2025-12-00030",
    "technician": {
      "technician_line_id": "Utest123",
      "technician_name": "Test Technician"
    },
    "status_action": "done",
    "images": [
      {
        "base64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==",
        "filename": "test-photo.jpg",
        "contentType": "image/jpeg"
      }
    ],
    "summary": {
      "service_type": "ล้างแอร์",
      "unit_done": 1,
      "work_end_time": "2025-12-24T22:00:00.000Z"
    },
    "payment": { "net_price": 500 },
    "customer_feedback": { "rating": 5 },
    "closed_at": "2025-12-24T22:00:00.000Z"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "action": "job_closed",
  "booking_id": "test-booking-001",
  "job_number": "PA-2025-12-00030",
  "closed_at": "2025-12-24T22:00:00.000Z",
  "photo_urls": [
    "https://s3.paaair.online/job-close-data/image-workjobs/PA-2025-12-00030/1703462400000_test-photo.jpg"
  ]
}
```

---

## Troubleshooting

### Issue 1: Still Getting AccessDenied

**Symptoms:**
- Workflow fails at "Upload to S3" node
- Error: `AccessDenied` or `SignatureDoesNotMatch`

**Solutions:**
1. ✅ Verify S3 credentials are correct in Config node
2. ✅ Check bucket policy allows PutObject for your access key
3. ✅ Ensure n8n has AWS credentials configured correctly
4. ✅ Test credentials with MinIO CLI:
   ```bash
   mc alias set test https://s3.paaair.online ACCESS_KEY SECRET_KEY
   mc ls test/job-close-data
   ```

### Issue 2: Images Not Uploading

**Symptoms:**
- Workflow succeeds but `photo_urls` is empty
- No errors shown

**Solutions:**
1. ✅ Check if images are being sent in payload (check webhook execution data)
2. ✅ Verify base64 format is correct: `data:image/jpeg;base64,/9j/...`
3. ✅ Check "Prepare S3 Upload" node output
4. ✅ Enable error reporting by removing `continueOnFail` temporarily

### Issue 3: 405 Method Not Allowed

**Symptoms:**
- HTTP Request to S3 returns 405

**Solutions:**
1. ✅ Ensure using PUT method (not POST) for S3 uploads
2. ✅ Check S3 endpoint URL format: `https://s3.paaair.online/bucket/key`
3. ✅ Verify MinIO is configured to accept PUT requests

### Issue 4: CORS Error (if using presigned URLs)

**Solutions:**
1. ✅ Configure CORS on MinIO bucket (see Step 4 above)
2. ✅ Ensure allowed origins include `https://paaair.online`
3. ✅ Check allowed methods include PUT

---

## Alternative Approach: Presigned URLs

If you prefer the LIFF app to upload directly to S3 (bypassing n8n):

### Workflow Changes:
1. Add a "Generate Presigned URL" node
2. Return presigned URLs to LIFF app
3. LIFF uploads using PUT to presigned URL

### Benefits:
- Less load on n8n server
- Faster uploads (direct to S3)
- Better for large images

### Drawbacks:
- More complex LIFF code
- Requires CORS configuration
- Less control over upload process

**Implementation:** (To be added if requested)

---

## Database Schema Updates

The job close data is stored in Supabase:

### `bookings` table update:
```sql
-- Update booking status and payload
UPDATE bookings
SET
  status = 'completed',
  payload = jsonb_set(
    payload,
    '{job_close}',
    '{
      "status_action": "done",
      "closed_at": "2025-12-24T21:51:47.578Z",
      "summary": {...},
      "payment": {...},
      "media": {
        "photo_urls": [
          "https://s3.paaair.online/job-close-data/image-workjobs/..."
        ]
      }
    }'::jsonb
  ),
  updated_at = NOW()
WHERE id = 'booking-uuid';
```

### `booking_events` insert:
```sql
INSERT INTO booking_events (
  booking_id,
  action,
  started_at,
  location,
  meta
) VALUES (
  'booking-uuid',
  'job_close_submitted',
  '2025-12-24T21:51:47.578Z',
  '{"lat": 13.628895, "lng": 100.771557}'::jsonb,
  '{
    "job_close": {...},
    "job_number": "PA-2025-12-00029"
  }'::jsonb
);
```

---

## Security Considerations

1. **S3 Credentials**: Never expose in client-side code
   - ✅ Stored securely in n8n Config node
   - ✅ Not sent to browser/LIFF app

2. **Bucket Permissions**: Principle of least privilege
   - ✅ Only allow uploads to `image-workjobs/*` folder
   - ✅ Restrict by access key (not public)

3. **Image Validation**: (Future enhancement)
   - 📋 TODO: Validate image size (< 5MB)
   - 📋 TODO: Validate image type (only JPEG, PNG)
   - 📋 TODO: Scan for malware

4. **Rate Limiting**: (Future enhancement)
   - 📋 TODO: Limit uploads per technician per day
   - 📋 TODO: Implement webhook rate limiting

---

## Next Steps

- [x] Create job-close webhook workflow
- [x] Document S3 fix and configuration
- [ ] Update LIFF app to send images to webhook
- [ ] Configure S3/MinIO credentials
- [ ] Test with real data
- [ ] Deploy to production
- [ ] Monitor for errors

---

**Last Updated:** 2025-12-24
**Version:** 1.0.0
**Author:** PA Cooling Services Development Team

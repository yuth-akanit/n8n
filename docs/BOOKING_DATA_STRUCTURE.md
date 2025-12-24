# โครงสร้างข้อมูล Booking (PA Cooling Services)

## ภาพรวม

เอกสารนี้อธิบายโครงสร้างข้อมูลที่ใช้ในระบบการจัดการงานซ่อมแอร์และตู้แช่ของ PA Cooling Services โดยข้อมูลจะถูกส่งผ่าน LIFF Webhook และบันทึกลงฐานข้อมูล Supabase

---

## 1. Booking Data Structure

### 1.1 ข้อมูลหลัก (Main Booking Object)

```typescript
interface Booking {
  booking_id: string;           // UUID ของการจอง
  job_number: string;           // หมายเลขงาน เช่น "PA-2025-12-00007"
  queue_number: string;         // หมายเลขคิว (มักจะเหมือน job_number)
  technician: Technician;       // ข้อมูลช่างเทคนิค
  started_at: string;           // ISO 8601 timestamp เวลาเริ่มงาน
  updates: BookingUpdates;      // การอัพเดตสถานะและข้อมูล
  event: BookingEvent;          // เหตุการณ์ที่เกิดขึ้น
  original: any;                // ข้อมูลดิบจาก webhook
}
```

### 1.2 ข้อมูลช่างเทคนิค (Technician)

```typescript
interface Technician {
  technician_line_id: string;   // LINE User ID ของช่าง
  technician_name: string;      // ชื่อช่าง เช่น "Akanit P."
}
```

### 1.3 การอัพเดตข้อมูล (Booking Updates)

```typescript
interface BookingUpdates {
  status: 'pending' | 'working' | 'completed' | 'cancelled';
  payload: {
    job_start?: JobStartPayload;
    job_close?: JobClosePayload;
    // ... อื่นๆ
  };
}
```

### 1.4 ข้อมูลการเริ่มงาน (Job Start Payload)

```typescript
interface JobStartPayload {
  started_at: string;           // ISO 8601 timestamp
  technician: Technician;       // ข้อมูลช่าง
  location: Location;           // ตำแหน่ง GPS
  meta: {
    liff_source: string;        // แหล่งที่มาของข้อมูล เช่น "job_start_screen"
    submitted_at: string;       // เวลาที่ส่งข้อมูล
    version?: string;           // เวอร์ชันของ payload เช่น "jobstart-1.0"
  };
}
```

### 1.5 ตำแหน่ง GPS (Location)

```typescript
interface Location {
  lat: number;                  // ละติจูด
  lng: number;                  // ลองจิจูด
}
```

### 1.6 เหตุการณ์ (Booking Event)

```typescript
interface BookingEvent {
  booking_id: string;           // UUID ของการจอง
  action: string;               // ประเภทของการกระทำ เช่น "job_start_submitted"
  actor: string;                // ผู้ทำการกระทำ (ชื่อช่าง)
  reason: string;               // เหตุผล เช่น "working"
  meta: EventMeta;              // ข้อมูลเพิ่มเติม
}
```

### 1.7 ข้อมูลเพิ่มเติมของเหตุการณ์ (Event Meta)

```typescript
interface EventMeta {
  job_number: string;           // หมายเลขงาน
  queue_number: string;         // หมายเลขคิว
  job_type?: string | null;     // ประเภทงาน เช่น "ซ่อมแอร์", "ติดตั้งแอร์"
  started_at: string;           // เวลาเริ่มงาน
  gps: Location;                // ตำแหน่ง GPS
  liff_source: string;          // แหล่งที่มา
  submitted_at: string;         // เวลาที่ส่งข้อมูล
}
```

---

## 2. ตัวอย่างข้อมูลจริง

### 2.1 Webhook Payload (จาก LIFF)

```json
{
  "action": "job_start_submitted",
  "booking_id": "07ec021e-b6d0-4b1a-8964-8a9f17e803f2",
  "job_number": "PA-2025-12-00007",
  "started_at": "2025-12-24T21:56:07.588Z",
  "technician": {
    "technician_line_id": "Ufcb73f1eb6ff4547718a1a4784d04141",
    "technician_name": "Akanit P."
  },
  "location": {
    "lat": 13.628895148078154,
    "lng": 100.77155777448245
  },
  "summary": {
    "unit_planned": 4,
    "work_start_time": "2025-12-24T21:56:07.588Z"
  },
  "meta": {
    "liff_source": "job_start_screen",
    "submitted_at": "2025-12-24T21:56:07.588Z",
    "version": "jobstart-1.0"
  }
}
```

### 2.2 ข้อมูลที่บันทึกในฐานข้อมูล (Normalized)

```json
{
  "booking_id": "07ec021e-b6d0-4b1a-8964-8a9f17e803f2",
  "job_number": "PA-2025-12-00007",
  "queue_number": "PA-2025-12-00007",
  "technician": {
    "technician_line_id": "Ufcb73f1eb6ff4547718a1a4784d04141",
    "technician_name": "Akanit P."
  },
  "started_at": "2025-12-24T21:56:07.588Z",
  "updates": {
    "status": "working",
    "payload": {
      "job_start": {
        "started_at": "2025-12-24T21:56:07.588Z",
        "technician": {
          "technician_line_id": "Ufcb73f1eb6ff4547718a1a4784d04141",
          "technician_name": "Akanit P."
        },
        "location": {
          "lat": 13.628895148078154,
          "lng": 100.77155777448245
        },
        "meta": {
          "liff_source": "job_start_screen",
          "submitted_at": "2025-12-24T21:56:07.588Z",
          "version": "jobstart-1.0"
        }
      }
    }
  },
  "event": {
    "booking_id": "07ec021e-b6d0-4b1a-8964-8a9f17e803f2",
    "action": "job_start_submitted",
    "actor": "Akanit P.",
    "reason": "working",
    "meta": {
      "job_number": "PA-2025-12-00007",
      "queue_number": "PA-2025-12-00007",
      "job_type": null,
      "started_at": "2025-12-24T21:56:07.588Z",
      "gps": {
        "lat": 13.628895148078154,
        "lng": 100.77155777448245
      },
      "liff_source": "job_start_screen",
      "submitted_at": "2025-12-24T21:56:07.588Z"
    }
  }
}
```

---

## 3. Database Schema (Supabase)

### 3.1 ตาราง `bookings`

```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number TEXT UNIQUE NOT NULL,
  queue_number TEXT,
  status TEXT CHECK (status IN ('pending', 'working', 'completed', 'cancelled')),
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_bookings_job_number ON bookings(job_number);
CREATE INDEX idx_bookings_status ON bookings(status);
```

### 3.2 ตาราง `booking_events`

```sql
CREATE TABLE booking_events (
  id BIGSERIAL PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id),
  action TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  location JSONB,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_booking_events_booking_id ON booking_events(booking_id);
CREATE INDEX idx_booking_events_action ON booking_events(action);
CREATE INDEX idx_booking_events_created_at ON booking_events(created_at DESC);

-- Composite index สำหรับ Idempotency check
CREATE UNIQUE INDEX idx_booking_events_idempotency
ON booking_events(booking_id, action)
WHERE action = 'job_start_submitted';
```

---

## 4. API Endpoints (Supabase REST)

### 4.1 ตรวจสอบ Idempotency

**GET** `/rest/v1/booking_events`

**Query Parameters:**
- `select=id`
- `booking_id=eq.{booking_id}`
- `action=eq.job_start_submitted`
- `limit=1`

**Response:**
```json
[]                          // ยังไม่เคยเริ่มงาน
// หรือ
[{"id": 123}]              // เริ่มงานแล้ว
```

### 4.2 อัพเดตสถานะ Booking

**PATCH** `/rest/v1/bookings?id=eq.{booking_id}`

**Headers:**
- `Prefer: return=representation`

**Body:**
```json
{
  "status": "working",
  "payload": {
    "job_start": { /* ... */ }
  }
}
```

### 4.3 บันทึก Event

**POST** `/rest/v1/booking_events`

**Headers:**
- `Prefer: return=representation`

**Body:**
```json
{
  "booking_id": "uuid",
  "action": "job_start_submitted",
  "started_at": "timestamp",
  "location": { "lat": 0, "lng": 0 },
  "meta": { /* ... */ }
}
```

---

## 5. Workflow Logic (n8n)

### 5.1 ขั้นตอนการทำงาน

```
1. รับ Webhook (LIFF)
   ↓
2. Set Config (Supabase credentials)
   ↓
3. Normalize Data (แปลงข้อมูลให้เป็นรูปแบบมาตรฐาน)
   ↓
4. Has booking_id? (เช็คว่ามี booking_id หรือไม่)
   ↓
5. Idempotency Check (ตรวจสอบว่าเคยเริ่มงานแล้วหรือยัง)
   ↓
6. Already started? (มี record หรือไม่)
   ├─ true → Respond "already_started" (หยุด)
   └─ false → ทำงานต่อ
      ↓
7. Update Bookings (status = working)
   ↓
8. Insert Booking Event
   ↓
9. Build LINE Message
   ↓
10. Send LINE Notification
   ↓
11. Respond OK
```

### 5.2 การแก้ไขปัญหา "No output data"

**ปัญหา:** Node "Idempotency" คืนค่า `[]` (array ว่าง) ทำให้ workflow หยุด

**วิธีแก้:**
- เปิด `alwaysOutputData: true` ใน node "Idempotency"
- ลบ query parameters ที่ซ้ำซ้อนออก
- ใช้ query parameters เฉพาะใน `queryParameters` object

**Before:**
```json
{
  "url": "...?select=id&booking_id=eq.xxx&...",
  "queryParameters": { /* ซ้ำ */ },
  "alwaysOutputData": false
}
```

**After:**
```json
{
  "url": "...../booking_events",
  "queryParameters": {
    "parameters": [
      { "name": "select", "value": "id" },
      { "name": "booking_id", "value": "=eq.{{$json.booking_id}}" },
      { "name": "action", "value": "eq.job_start_submitted" },
      { "name": "limit", "value": "1" }
    ]
  },
  "alwaysOutputData": true
}
```

---

## 6. LINE Notification Format

### 6.1 รูปแบบข้อความ

```
🟢 เริ่มงาน
คิว: PA-2025-12-00007
ช่าง: Akanit P.
เวลา: 2025-12-24T21:56:07.588Z
งาน: ซ่อมแอร์ | 4 เครื่อง
ที่อยู่/หมายเหตุ:
[ที่อยู่ถ้ามี]
แผนที่: https://maps.google.com/?q=13.628895,100.771557
```

### 6.2 Code สำหรับสร้างข้อความ

อยู่ใน node "Build LINE message" (ดูใน workflow file)

---

## 7. การใช้งาน

### 7.1 Import Workflow เข้า n8n

1. เปิด n8n
2. ไปที่ Workflows > Import from File
3. เลือกไฟล์ `workflows/job-start-webhook.json`
4. ตรวจสอบ credentials:
   - LINE Messaging API
   - Supabase (ใน node "config")

### 7.2 การทดสอบ

ใช้ pinData ที่มีอยู่ใน workflow หรือส่ง POST request:

```bash
curl -X POST https://your-n8n-instance/webhook/job-start \
  -H "Content-Type: application/json" \
  -d '{
    "action": "job_start_submitted",
    "booking_id": "test-uuid",
    "job_number": "PA-2025-12-00999",
    "technician": {
      "technician_line_id": "Uxxxx",
      "technician_name": "Test Technician"
    },
    "location": {
      "lat": 13.7563,
      "lng": 100.5018
    },
    "meta": {
      "liff_source": "test",
      "submitted_at": "2025-12-24T00:00:00.000Z"
    }
  }'
```

---

## 8. หมายเหตุสำคัญ

1. **Idempotency:** ระบบป้องกันการเริ่มงานซ้ำโดยใช้ unique index `(booking_id, action)`
2. **Always Output Data:** ต้องเปิดใน node Idempotency เพื่อให้ทำงานต่อได้แม้ไม่มีข้อมูล
3. **Timezone:** ใช้ ISO 8601 timestamp (UTC) ทั้งหมด
4. **Security:** Service role key ควรเก็บไว้ใน environment variables หรือ credentials แทนการ hardcode

---

## 9. การอัพเดตในอนาคต

- [ ] เพิ่ม webhook สำหรับ job_close
- [ ] เพิ่มการส่ง photo/signature
- [ ] เพิ่มการคำนวณระยะเวลาทำงาน
- [ ] เพิ่ม dashboard สำหรับดูสถานะงาน
- [ ] เพิ่ม notification แบบ real-time

---

**Last Updated:** 2025-12-24
**Version:** 1.0.0
**Author:** PA Cooling Services Development Team

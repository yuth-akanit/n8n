# AI Token Monitor

Dashboard สำหรับ monitor การใช้งาน API token ของ AI ทุกเจ้า — OpenAI, Anthropic, Google Gemini, Groq, Meta Llama, Mistral

## Features

- **Real-time dashboard** — token usage, cost, API calls ตาม provider
- **Charts** — Token by provider (doughnut) + Usage over time (line chart)
- **Cost tracking** — คำนวณค่าใช้จ่ายอัตโนมัติตาม model pricing
- **Alert threshold** — แจ้งเตือนเมื่อค่าใช้จ่ายเกิน limit
- **Demo mode** — ทดสอบได้ทันทีโดยไม่ต้องเชื่อมต่อ database
- **Supabase backend** — เก็บข้อมูลผ่าน n8n webhook

## Supported Providers & Models

| Provider  | Models                                              |
|-----------|-----------------------------------------------------|
| OpenAI    | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo   |
| Anthropic | claude-3-5-sonnet, claude-3-5-haiku, claude-3-opus |
| Google    | gemini-1.5-pro, gemini-1.5-flash, gemini-2.0-flash |
| Groq      | llama-3.3-70b, llama-3.1-8b, mixtral-8x7b          |
| Meta      | llama-3.x (via any provider)                        |
| Mistral   | mistral-large, mistral-small                        |

---

## Setup

### 1. Supabase — สร้าง Table

ไปที่ **Supabase → SQL Editor** แล้วรัน:

```sql
-- ดูไฟล์ database/schema.sql
```

### 2. n8n — Import Workflow

1. เปิด n8n → Import workflow
2. เลือกไฟล์ `n8n-workflows/ai-token-tracker.json`
3. แก้ไข node **Config** ใส่ค่า:
   - `supabase_url`: URL ของ Supabase project
   - `supabase_key`: Service Role Key (ไม่ใช่ anon key)
4. Activate workflow → copy Webhook URL

### 3. Dashboard — เปิด index.html

เปิดไฟล์ `index.html` ในบราวเซอร์ (หรือ deploy บน web server ใดก็ได้)

กด **"ตั้งค่า"** แล้วกรอก:
- Supabase URL + Anon Key
- n8n Webhook URL (จากข้อ 2)
- Alert threshold (USD/วัน)

### 4. ส่ง token usage จาก n8n

ใน n8n workflow ที่เรียก AI API — เพิ่ม **HTTP Request node** ต่อท้าย:

```
POST {webhook_url}
Content-Type: application/json

{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "prompt_tokens": 234,
  "completion_tokens": 89,
  "workflow_name": "Customer Reply Bot",
  "node_name": "GPT Reply",
  "status": "success"
}
```

#### ตัวอย่าง — OpenAI Node

```javascript
// Code node หลัง OpenAI node
const usage = $('OpenAI').item.json.usage;
return [{
  json: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    workflow_name: 'My Workflow',
    status: 'success'
  }
}];
```

#### ตัวอย่าง — Anthropic Claude

```javascript
const usage = $('HTTP Request').item.json.usage;
return [{
  json: {
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    prompt_tokens: usage.input_tokens,
    completion_tokens: usage.output_tokens,
    workflow_name: 'My Workflow',
    status: 'success'
  }
}];
```

---

## File Structure

```
api-token-monitor/
├── index.html                      ← Dashboard (เปิดตรงได้เลย)
├── database/
│   └── schema.sql                  ← Supabase table + views
├── n8n-workflows/
│   └── ai-token-tracker.json       ← n8n webhook workflow
└── README.md
```

## Token Pricing Reference

| Model                         | Input ($/1K) | Output ($/1K) |
|-------------------------------|-------------|--------------|
| gpt-4o                        | $0.0025     | $0.0100      |
| gpt-4o-mini                   | $0.00015    | $0.00060     |
| claude-3-5-sonnet-20241022    | $0.0030     | $0.0150      |
| claude-3-5-haiku-20241022     | $0.00080    | $0.00400     |
| gemini-1.5-flash              | $0.000075   | $0.00030     |
| llama-3.3-70b (Groq)          | $0.00059    | $0.00079     |

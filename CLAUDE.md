# CLAUDE.md — AI Assistant Guide for PA Cooling Services Project

## Project Overview

This is the **PA Cooling Services** website and automation project — a static website for an AC repair, cleaning, and freezer service business located in Samut Prakan, Thailand. It integrates with **n8n** for workflow automation (booking management, LINE notifications) and **Supabase** for data persistence.

**This is NOT the official n8n monorepo.** It is a standalone project that uses n8n as its workflow automation engine.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES6+) |
| Workflow Engine | n8n (webhook-triggered automation) |
| Database | Supabase (PostgreSQL + REST API) |
| Messaging | LINE Messaging API |
| Hosting | Static file server (Nginx/Apache) |
| SEO | JSON-based keyword mapping, meta templates |

---

## Repository Structure

```
n8n/
├── website/                    # Main website application
│   ├── html/                   # 11 HTML pages (index, services, blog, contact)
│   ├── css/styles.css          # Single stylesheet (940 lines, CSS variables)
│   ├── js/
│   │   ├── main.js             # Site utilities, forms, navigation (314 lines)
│   │   └── chatbot.js          # Intent-based chatbot class (174 lines)
│   ├── robots.txt              # Crawling rules
│   └── sitemap.xml             # Site map for SEO
├── workflows/                  # n8n workflow definitions
│   └── job-start-webhook.json  # Job start notification pipeline
├── content/                    # Blog content and editorial planning
│   └── blog/                   # Post outlines, content calendar
├── seo/                        # SEO configuration and strategy
│   ├── keywords/               # Keyword mapping JSON
│   ├── templates/              # Meta tag templates JSON
│   └── strategies/             # Internal linking strategy docs
├── docs/                       # Technical documentation
│   └── BOOKING_DATA_STRUCTURE.md  # API, schema, and workflow docs
├── README.md                   # Project intro
├── README_WEBSITE.md           # Comprehensive deployment guide (513 lines)
└── SEO_IMPLEMENTATION_GUIDE.md # Full SEO strategy (569 lines)
```

---

## Key Files

| File | Purpose |
|------|---------|
| `website/html/index.html` | Homepage — hero section, service cards, CTAs |
| `website/js/main.js` | Mobile menu, form validation, analytics, lazy loading |
| `website/js/chatbot.js` | `ServiceChatbot` class with 9 intents (greeting, pricing, etc.) |
| `website/css/styles.css` | Full styling with CSS custom properties and responsive breakpoints |
| `workflows/job-start-webhook.json` | n8n workflow: webhook → Supabase → LINE notification |
| `docs/BOOKING_DATA_STRUCTURE.md` | Booking API schema, database design, workflow logic |
| `seo/keywords/keywords-mapping.json` | 100+ mapped SEO keywords (Thai language) |
| `seo/templates/meta-tags-templates.json` | Meta title/description templates per page |

---

## Development Setup

### Prerequisites

- A web browser for viewing static HTML files
- An n8n instance (cloud or self-hosted) for workflow management
- A Supabase project for database operations
- LINE Developer account for messaging integration

### Local Development

1. **View the website locally:**
   Open any HTML file in `website/html/` directly in a browser, or use a local HTTP server:
   ```bash
   cd website/html && python3 -m http.server 8080
   ```

2. **Import n8n workflow:**
   Import `workflows/job-start-webhook.json` into your n8n instance via the UI.

3. **No build step required** — all files are production-ready static assets.

---

## Code Conventions

### HTML

- Semantic HTML5 elements (`<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`)
- ARIA attributes for accessibility (`aria-expanded`, `aria-label`)
- Mobile viewport meta tag on all pages
- Structured data / Open Graph meta tags for SEO
- Content is primarily in **Thai language**

### CSS (`website/css/styles.css`)

- **CSS Custom Properties** defined in `:root` for theming:
  - Colors: `--primary-blue`, `--primary-green`, `--accent-orange`
  - Spacing scale: `--spacing-xs` through `--spacing-xxl`
  - Typography scale: `--font-size-xs` through `--font-size-xxxl`
  - Transitions: `--transition-normal`, `--transition-fast`
  - Border radii: `--border-radius-sm`, `--border-radius-md`, `--border-radius-lg`
- **Mobile-first** responsive design with breakpoints at `768px` and `480px`
- **BEM-inspired** class naming (e.g., `.service-card`, `.hero-section`, `.cta-button`)
- Grid/Flexbox for layouts; `auto-fit` with `minmax()` for responsive grids
- Print stylesheet included (`@media print`)

### JavaScript

- **ES6+ features**: classes, arrow functions, template literals, optional chaining (`?.`)
- **Class-based architecture** for complex components (e.g., `ServiceChatbot`)
- **DOMContentLoaded** event for initialization
- **No framework or bundler** — plain vanilla JS
- Phone validation uses Thai format regex: `/^(\+66|0)\d{8,9}$/`
- XSS protection via `escapeHtml()` in chatbot
- `IntersectionObserver` for lazy loading

### n8n Workflows

- **Expression syntax**: `={{ $json.field }}` for accessing data
- **Node references**: `{{ $('NodeName').item.json.field }}`
- **Node type versioning**: Always specify `typeVersion` for compatibility
- **Idempotency**: Use unique database constraints to prevent duplicate processing
- **Pin data**: Test data is stored alongside workflow definitions for debugging
- **Error handling**: Use `continueOnFail: true` on nodes that may return empty results

---

## n8n Workflow Architecture

The main workflow (`job-start-webhook.json`) follows this pipeline:

```
LIFF Webhook → Config Node → Normalize Data → Validate booking_id
    → Idempotency Check (Supabase query)
    → Update Booking Status (Supabase PATCH)
    → Insert Booking Event (Supabase POST)
    → Build LINE Message → Send to Admin Group → Respond OK
```

### Supabase API Patterns

- **Authentication**: `apikey` header + `Authorization: Bearer <JWT>` header
- **Filtering**: Query parameters like `?booking_id=eq.{id}`
- **Response preference**: `Prefer: return=representation`
- **JSONB payloads**: Complex nested data stored in `payload` columns

### Database Schema

Key tables (managed in Supabase):
- `bookings` — Booking state with status tracking
- `booking_events` — Audit trail with idempotency constraints

Indexes:
- `idx_bookings_status` on `bookings(status)`
- `idx_booking_events_booking_id` on `booking_events(booking_id)`
- Unique composite index for idempotency on `(booking_id, action)`

---

## SEO Configuration

SEO is managed through JSON configuration files, not code:

- **Keywords** (`seo/keywords/keywords-mapping.json`): Primary, local, long-tail, seasonal, and voice search keywords — all in Thai
- **Meta templates** (`seo/templates/meta-tags-templates.json`): Title (max 60 chars), description (max 160 chars), OG tags per page
- **Internal linking** (`seo/strategies/internal-linking-strategy.md`): Site hierarchy and anchor text guidelines
- **Content calendar** (`content/blog/content-calendar-2025.md`): 12-month publishing plan

---

## Content Pages

| Page | File | Purpose |
|------|------|---------|
| Homepage | `index.html` | Main landing page with service overview |
| AC Repair | `ac-repair.html` | AC repair service details and pricing |
| AC Cleaning | `ac-cleaning.html` | AC cleaning service details |
| Contact | `contact.html` | Contact form, business hours, location |
| Blog: Rainy Season | `blog-rainy-season.html` | Seasonal AC maintenance guide |
| Blog: Hot Season | `blog-hot-season.html` | Energy saving tips |
| Blog: Freezer Care | `blog-freezer-care.html` | Freezer maintenance guide |
| Blog: Choosing Tech | `blog-choosing-technician.html` | How to choose a technician |
| PA Air Index | `pa-air-index.html` | Alternative branding page |
| PA Air Pricing | `pa-air-pricing.html` | Detailed pricing |
| PA Air FAQ | `pa-air-faq.html` | FAQ section |

---

## Git Conventions

### Branching

- **Main branch**: `master`
- **Feature branches**: `claude/{feature-name}-{session-id}` (e.g., `claude/ac-freezer-service-data-JzTsq`)
- Merge to master via pull requests

### Commit Messages

- Use imperative mood: "Add booking data structure", "Update branding"
- Be descriptive with context when changes span multiple areas
- Reference PR numbers in merge commits

---

## Important Notes for AI Assistants

1. **No build system**: This is a static site — there is no `npm install`, no bundler, no compilation step. Edit files directly.

2. **No automated tests or linting**: There are no test frameworks, ESLint, or Prettier configured. Validate changes manually or by reviewing in a browser.

3. **Thai language content**: Most user-facing content is in Thai. Preserve existing language and tone when editing.

4. **Sensitive credentials**: The n8n workflow JSON may contain hardcoded API keys and JWT tokens. Never commit new secrets in plaintext — use n8n's credential management or environment variables.

5. **Supabase as backend**: All database operations go through Supabase REST API. Changes to data structure require updating both the workflow and the `docs/BOOKING_DATA_STRUCTURE.md` documentation.

6. **LINE integration**: Customer notifications are sent via LINE Messaging API through n8n workflows. Test changes against the LINE API sandbox before production.

7. **Mobile-first**: Always consider mobile viewports (320px–480px) when modifying CSS. The site targets both iPhone and Android users.

8. **Existing documentation is extensive**: Before creating new docs, check `README_WEBSITE.md`, `SEO_IMPLEMENTATION_GUIDE.md`, and `docs/BOOKING_DATA_STRUCTURE.md` — they likely already cover the topic.

9. **CSS changes**: Use existing CSS custom properties (`--primary-blue`, `--spacing-md`, etc.) rather than hardcoding values. This keeps the design system consistent.

10. **Chatbot intents**: When adding new chatbot capabilities, follow the existing intent pattern in `chatbot.js` — add keywords array and response string to the `this.intents` object.

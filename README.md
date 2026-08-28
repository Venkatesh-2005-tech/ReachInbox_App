# ReachInbox Email Scheduler

A full-stack email scheduling platform built as the ReachInbox.ai Software Development Intern assignment. Schedule bulk email campaigns to thousands of recipients with automatic rate limiting, retry handling, real-time job monitoring, and Slack notifications.

> **This project does not use cron.** All scheduling is handled exclusively by BullMQ delayed jobs backed by Redis. No `node-cron`, `agenda`, `setInterval`, or any cron-based mechanism is used anywhere.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Folder Structure](#3-folder-structure)
4. [Backend Setup](#4-backend-setup)
5. [Frontend Setup](#5-frontend-setup)
6. [Docker Setup](#6-docker-setup)
7. [PostgreSQL Setup](#7-postgresql-setup)
8. [Redis Setup](#8-redis-setup)
9. [Elasticsearch Setup](#9-elasticsearch-setup)
10. [Ethereal SMTP Setup](#10-ethereal-smtp-setup)
11. [Google OAuth Setup](#11-google-oauth-setup)
12. [Slack OAuth Setup](#12-slack-oauth-setup)
13. [Environment Variables](#13-environment-variables)
14. [BullMQ Architecture](#14-bullmq-architecture)
15. [Restart Persistence](#15-restart-persistence)
16. [Idempotency](#16-idempotency)
17. [Worker Concurrency](#17-worker-concurrency)
18. [Minimum Email Delay](#18-minimum-email-delay)
19. [Hourly Rate Limiting](#19-hourly-rate-limiting)
20. [Elasticsearch Indexing](#20-elasticsearch-indexing)
21. [Bull Board](#21-bull-board)
22. [Testing](#22-testing)
23. [Demo Instructions](#23-demo-instructions)

---

## 1. Project Overview

ReachInbox Email Scheduler lets you:

- **Schedule email campaigns** to hundreds or thousands of recipients via CSV upload
- **Control send rate** with per-sender hourly limits and configurable delays between emails
- **Monitor jobs** in real time via Bull Board at `/admin/queues`
- **Search emails** using full-text Elasticsearch search across recipient, subject, and body
- **Authenticate** via real Google OAuth 2.0
- **Receive Slack alerts** when hourly rate limits are reached and emails are rescheduled

All email delivery goes through **Ethereal SMTP** (a safe catch-all for development) so no real emails are sent during testing. Preview URLs are logged to the console.

---

## 2. Architecture

```
Browser (Next.js 14)
        │
        │  REST + cookies (session auth)
        ▼
Express.js API (port 5000)
        │
        ├── Passport.js (Google OAuth)
        ├── BullMQ Queue  ──────────► Redis (delayed jobs)
        ├── Prisma ORM    ──────────► PostgreSQL (source of truth)
        ├── Elasticsearch ──────────► Search index
        ├── Nodemailer    ──────────► Ethereal SMTP
        └── Slack API     ──────────► Slack workspace
```

**Key design decisions:**

- PostgreSQL is the **source of truth** for all email state
- Redis holds **BullMQ job state** — delayed jobs survive server restarts
- Elasticsearch is a **search replica** — its failure never blocks email delivery
- Workers use **atomic Redis Lua scripts** for rate limiting across multiple processes
- Every email has a **deterministic idempotency key** to prevent duplicate scheduling

---

## 3. Folder Structure

```
reachinbox/
├── apps/
│   ├── backend/
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── src/
│   │       ├── config/
│   │       │   ├── elasticsearch.ts  — ES client + index init
│   │       │   ├── env.ts            — Zod-validated env vars
│   │       │   ├── passport.ts       — Google OAuth strategy
│   │       │   ├── prisma.ts         — Prisma singleton
│   │       │   └── redis.ts          — IORedis connections
│   │       ├── controllers/
│   │       │   ├── authController.ts
│   │       │   ├── emailController.ts
│   │       │   ├── senderController.ts
│   │       │   └── slackController.ts
│   │       ├── middleware/
│   │       │   ├── auth.ts           — requireAuth guard
│   │       │   └── errorHandler.ts   — centralized error handler
│   │       ├── queues/
│   │       │   └── emailQueue.ts     — BullMQ Queue definition
│   │       ├── routes/
│   │       │   ├── auth.ts
│   │       │   ├── emails.ts
│   │       │   ├── senders.ts
│   │       │   └── slack.ts
│   │       ├── services/
│   │       │   ├── elasticsearchService.ts
│   │       │   ├── emailService.ts   — Nodemailer/Ethereal
│   │       │   ├── rateLimitService.ts — Redis Lua rate limiting
│   │       │   └── slackService.ts
│   │       ├── types/
│   │       │   └── index.ts
│   │       ├── utils/
│   │       │   ├── idempotency.ts    — SHA-256 key generation
│   │       │   ├── logger.ts
│   │       │   └── validation.ts
│   │       ├── workers/
│   │       │   └── emailWorker.ts    — BullMQ Worker
│   │       └── server.ts             — Express app entry point
│   │
│   └── frontend/
│       └── src/
│           ├── app/
│           │   ├── dashboard/page.tsx
│           │   ├── login/page.tsx
│           │   ├── layout.tsx
│           │   └── page.tsx          — redirects to /login
│           ├── components/
│           │   ├── auth/             — GoogleLoginButton, UserMenu
│           │   ├── email/            — ComposeEmail, CsvUploader, tables
│           │   ├── layout/           — Header, DashboardLayout
│           │   ├── slack/            — SlackConnection
│           │   └── ui/               — Button, Input, Modal, Table, …
│           ├── hooks/
│           │   ├── useAuth.ts
│           │   └── useEmails.ts
│           ├── lib/
│           │   ├── api.ts            — Axios client + typed API calls
│           │   ├── auth.ts
│           │   └── utils.ts
│           └── types/
│               ├── api.ts
│               ├── auth.ts
│               └── email.ts
│
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## 4. Backend Setup

### Prerequisites

- Node.js 18+
- npm 9+
- Docker (for infrastructure) or locally running PostgreSQL, Redis, Elasticsearch

### Install & run

```bash
cd apps/backend

# Copy environment file
cp ../../.env.example .env
# Edit .env with your credentials

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run database migrations (requires running PostgreSQL)
npm run prisma:migrate

# Start in development mode (hot reload)
npm run dev

# OR build and start production
npm run build
npm start
```

### Available scripts

| Script | Description |
|---|---|
| `npm run dev` | Start with ts-node-dev (hot reload) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled JS |
| `npm run prisma:generate` | Regenerate Prisma client after schema changes |
| `npm run prisma:migrate` | Run migrations against the database |
| `npm run prisma:push` | Push schema without migration history (dev only) |
| `npm run prisma:studio` | Open Prisma Studio GUI |

---

## 5. Frontend Setup

### Prerequisites

- Node.js 18+

### Install & run

```bash
cd apps/frontend

# Create local env
echo "NEXT_PUBLIC_API_URL=http://localhost:5000" > .env.local

# Install dependencies
npm install

# Start development server
npm run dev
# Opens on http://localhost:3000

# OR production build
npm run build
npm start
```

### Pages

| Route | Description |
|---|---|
| `/login` | Google OAuth login page |
| `/dashboard` | Main email scheduler dashboard |

---

## 6. Docker Setup

All infrastructure services are defined in `docker-compose.yml` at the project root.

```bash
# Start all services (PostgreSQL, Redis, Elasticsearch)
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f

# Stop services
docker compose down

# Stop and remove volumes (clean slate)
docker compose down -v
```

Services use named Docker volumes for persistence:
- `postgres_data` — PostgreSQL data directory
- `redis_data` — Redis append-only file
- `elasticsearch_data` — Elasticsearch indices

---

## 7. PostgreSQL Setup

The database is provisioned automatically by Docker Compose.

**Connection details (development):**

| Setting | Value |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| Database | `reachinbox` |
| Username | `postgres` |
| Password | `postgres` |
| URL | `postgresql://postgres:postgres@localhost:5432/reachinbox` |

### Run migrations

```bash
cd apps/backend
npm run prisma:migrate
```

This creates all tables defined in `prisma/schema.prisma`:
- `User` — authenticated users (Google ID, name, email, avatar)
- `Sender` — from-addresses used for sending
- `Email` — every scheduled/sent email with full status history
- `SlackConnection` — per-user Slack OAuth tokens

### Schema notes

- `Email.idempotencyKey` is a unique SHA-256 hash — prevents duplicate scheduling
- `Email.bullJobId` is unique — maps back to the BullMQ job
- `Email.status` is an enum: `SCHEDULED | PROCESSING | SENT | FAILED`
- Indexes on `userId`, `senderId`, `status`, `scheduledAt`, `recipient` for fast queries

---

## 8. Redis Setup

Redis is provisioned by Docker Compose with append-only persistence enabled.

**Connection details:**

| Setting | Value |
|---|---|
| Host | `localhost` |
| Port | `6379` |

Two IORedis connections are created:
1. **`redisConnection`** — BullMQ queue & worker (requires `maxRetriesPerRequest: null`)
2. **`redisClient`** — Rate limiting with Lua scripts

Redis key patterns used:

| Key | Purpose |
|---|---|
| `bull:email-queue:*` | BullMQ job state (managed automatically) |
| `email-rate:{senderId}:{hourWindow}` | Hourly send counter per sender |

---

## 9. Elasticsearch Setup

Elasticsearch runs in single-node development mode via Docker Compose.

**Connection details:**

| Setting | Value |
|---|---|
| URL | `http://localhost:9200` |
| Index | `emails` |

The index is created automatically on server startup if it does not already exist. Elasticsearch failure is **non-fatal** — the application logs a warning and continues.

**Indexed fields:**

| Field | Type | Used for |
|---|---|---|
| `id` | keyword | document ID |
| `recipient` | text + keyword | full-text search |
| `subject` | text | full-text search |
| `body` | text | full-text search |
| `senderId` | keyword | filtering |
| `userId` | keyword | per-user scoping |
| `status` | keyword | filtering |
| `scheduledAt` | date | sorting |
| `sentAt` | date | sorting |

**Search API:**

```
GET /api/emails/search?q=hello&page=1&limit=20
```

Uses `multi_match` with `fuzziness: AUTO` across `recipient`, `subject`, `body`.

---

## 10. Ethereal SMTP Setup

Ethereal is a fake SMTP service — it catches all emails without delivering them to real inboxes. Perfect for development and demos.

### Get credentials

1. Go to [https://ethereal.email/](https://ethereal.email/)
2. Click **Create Ethereal Account**
3. Copy the SMTP credentials shown

### Configure

Add to your `apps/backend/.env`:

```env
ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
ETHEREAL_USER=your.user@ethereal.email
ETHEREAL_PASSWORD=yourpassword
```

### Viewing sent emails

When an email is sent, the console logs a **preview URL**:

```
[INFO] Ethereal preview URL: https://ethereal.email/message/XXXX
```

Open that URL in a browser to see the full email exactly as it would appear in an inbox.

---

## 11. Google OAuth Setup

### Create OAuth credentials

1. Go to [https://console.cloud.google.com/](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth Client ID**
5. Application type: **Web application**
6. Authorized redirect URIs: `http://localhost:5000/auth/google/callback`
7. Copy the **Client ID** and **Client Secret**

### Configure

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback
```

### OAuth flow

```
/login → click "Continue with Google"
       → GET /auth/google (Passport redirect)
       → Google consent screen
       → GET /auth/google/callback
       → User upserted in PostgreSQL
       → Redirect to /dashboard
```

Session is stored in Redis via `connect-redis` with a 7-day TTL in an HTTP-only cookie.

### Protected routes

All `/api/*` routes require an authenticated session. Unauthenticated requests receive `401 Unauthorized`.

---

## 12. Slack OAuth Setup

### Create a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App → From scratch**
3. Name it `ReachInbox`, select your workspace
4. Go to **OAuth & Permissions**
5. Add OAuth Scopes under **Bot Token Scopes**: `chat:write`, `channels:read`
6. Add Redirect URL: `http://localhost:5000/api/slack/callback`
7. Install to workspace and copy **Bot User OAuth Token**
8. Go to **Basic Information** and copy **Client ID** and **Client Secret**

### Configure

```env
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_REDIRECT_URI=http://localhost:5000/api/slack/callback
```

### Slack API endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/slack/connect` | Start OAuth flow |
| `GET` | `/api/slack/callback` | Handle Slack redirect |
| `GET` | `/api/slack/status` | Check connection status |
| `DELETE` | `/api/slack/disconnect` | Remove connection |

### Rate limit notifications

When the hourly email limit is reached for a sender, a message is posted to the connected Slack channel:

```
⚠️ Email rate limit reached for sender `user@example.com`.
Emails have been rescheduled for the next available hour.
```

If Slack is not connected, this is silently skipped. Slack tokens are **never logged**.

---

## 13. Environment Variables

Full reference for `apps/backend/.env`:

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Runtime environment |
| `PORT` | No | `5000` | Express server port |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string |
| `REDIS_HOST` | No | `localhost` | Redis hostname |
| `REDIS_PORT` | No | `6379` | Redis port |
| `ELASTICSEARCH_URL` | No | `http://localhost:9200` | Elasticsearch URL |
| `FRONTEND_URL` | No | `http://localhost:3000` | CORS origin + redirect target |
| `WORKER_CONCURRENCY` | No | `5` | Parallel email jobs per worker process |
| `MIN_EMAIL_DELAY_MS` | No | `2000` | Minimum ms to wait before each send |
| `MAX_EMAILS_PER_HOUR` | No | `200` | Max emails per sender per hour |
| `ETHEREAL_HOST` | No* | — | Ethereal SMTP host |
| `ETHEREAL_PORT` | No* | `587` | Ethereal SMTP port |
| `ETHEREAL_USER` | No* | — | Ethereal username |
| `ETHEREAL_PASSWORD` | No* | — | Ethereal password |
| `GOOGLE_CLIENT_ID` | No* | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No* | — | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | No | `…/auth/google/callback` | OAuth callback URL |
| `SLACK_CLIENT_ID` | No* | — | Slack app client ID |
| `SLACK_CLIENT_SECRET` | No* | — | Slack app client secret |
| `SLACK_REDIRECT_URI` | No | `…/api/slack/callback` | Slack OAuth redirect |
| `SESSION_SECRET` | **Yes** | (insecure default) | Express session signing key |

*Required to use that specific feature. The server starts without them but those features will return errors.

Frontend (`apps/frontend/.env.local`):

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5000` | Backend API base URL |

---

## 14. BullMQ Architecture

BullMQ is the **only** scheduling mechanism in this project. No cron, no polling.

### Queue: `email-queue`

Defined in `src/queues/emailQueue.ts`. Connected to Redis via IORedis with `maxRetriesPerRequest: null` (required by BullMQ).

**Default job options:**
- `attempts: 5` — retry up to 5 times on failure
- `backoff: exponential, 5000ms` — retry delay doubles each time
- `removeOnComplete: { count: 1000 }` — keep last 1000 completed jobs
- `removeOnFail: { count: 500 }` — keep last 500 failed jobs

### Scheduling flow

```
POST /api/emails/schedule
  │
  ├─ Validate request
  ├─ Verify sender ownership
  ├─ For each recipient:
  │   ├─ Calculate scheduledAt = startTime + (index × delayBetweenEmails)
  │   ├─ Generate idempotencyKey = SHA-256(userId:senderId:recipient:subject:scheduledAt)
  │   ├─ Generate jobId = "email:{idempotencyKey}"
  │   ├─ INSERT Email row (idempotencyKey UNIQUE — safe to retry)
  │   └─ emailQueue.add('send-email', data, { jobId, delay: msFromNow })
  │
  └─ Return { scheduledCount, emails }
```

### Worker: `emailWorker.ts`

The worker runs in the same Node.js process (can be split to a separate process for scaling).

**Per-job flow:**
```
1. Load Email from PostgreSQL
2. Guard: skip if status is already SENT or FAILED
3. Atomic DB update: SCHEDULED → PROCESSING (updateMany with WHERE status=SCHEDULED)
   └── If count=0: another worker grabbed it, skip
4. Check Redis rate limit (atomic Lua script)
   └── If over limit:
       ├── Revert status to SCHEDULED
       ├── Calculate msUntilNextHour
       ├── Re-add job to queue with new delay
       ├── Send Slack notification
       └── Return (no throw — not a failure)
5. Sleep MIN_EMAIL_DELAY_MS
6. Send via Nodemailer/Ethereal
7. Update DB: status=SENT, sentAt=now, messageId=…
8. Update Elasticsearch document
```

**On failure:**
```
throw err
  └── BullMQ catches it, increments attempts
  └── Worker updates DB: attempts++, errorMessage=…
  └── If attempts >= 5: status=FAILED (permanent)
  └── Otherwise: BullMQ retries with exponential backoff
```

---

## 15. Restart Persistence

**BullMQ delayed jobs live in Redis, not in memory.**

When the server or worker restarts:
1. Redis still holds all delayed jobs in sorted sets keyed by their execution timestamp
2. The worker reconnects to Redis on startup
3. BullMQ automatically picks up jobs that are ready to execute
4. Jobs scheduled for the future remain in Redis until their time arrives

**No database scan on startup.** The server does not iterate PostgreSQL emails to rebuild jobs. This ensures O(1) startup time regardless of how many emails are scheduled.

The only scenario where a job could be lost is if Redis data is deleted (e.g., `docker compose down -v`). In that case, emails in `SCHEDULED` status in PostgreSQL have no corresponding BullMQ job. To recover, those rows can be re-queued manually.

---

## 16. Idempotency

Every email gets a **deterministic SHA-256 idempotency key**:

```typescript
SHA-256( userId + ":" + senderId + ":" + recipient + ":" + subject + ":" + scheduledAt.toISOString() )
```

This key is stored as a `UNIQUE` constraint on `Email.idempotencyKey`.

**Benefits:**
- Re-submitting the same schedule request is safe — `prisma.email.findUnique({ where: { idempotencyKey } })` returns the existing row instead of creating a duplicate
- The BullMQ job ID is derived from the same key: `"email:{idempotencyKey}"` — BullMQ deduplicates jobs with the same ID
- The worker checks `status === SENT` before sending — a completed email is never re-sent even if the job fires twice

**Nothing is stored in memory for idempotency** — it's fully backed by PostgreSQL and Redis.

---

## 17. Worker Concurrency

Controlled by the `WORKER_CONCURRENCY` environment variable (default: `5`).

```typescript
const worker = new Worker('email-queue', processEmailJob, {
  connection: redisConnection,
  concurrency: env.WORKER_CONCURRENCY,
});
```

This means the worker processes up to 5 jobs simultaneously within the same process. To scale further, run multiple worker processes — the Redis-backed rate limiting and DB-level status transitions handle concurrent workers safely.

**Scaling considerations:**
- Each worker process should have its own IORedis connection
- The `SCHEDULED → PROCESSING` transition uses `updateMany` with a `WHERE status=SCHEDULED` condition — only one worker can win the race for any given email
- Rate limit increments use an atomic Lua script — safe across any number of workers

---

## 18. Minimum Email Delay

`MIN_EMAIL_DELAY_MS` (default: `2000` ms) is enforced in the worker **after** the rate limit check passes and **before** the SMTP call:

```typescript
await sleep(env.MIN_EMAIL_DELAY_MS);
await sendEmail(...);
```

This ensures even if all jobs fire simultaneously, each individual send has at least a 2-second processing delay. Combined with BullMQ concurrency limits, this prevents overwhelming the SMTP server.

This is separate from the `delayBetweenEmails` parameter in the schedule request, which controls the **scheduled time gap** between recipients. `MIN_EMAIL_DELAY_MS` is a runtime floor enforced in the worker regardless of scheduling.

---

## 19. Hourly Rate Limiting

Rate limiting is implemented using **atomic Redis Lua scripts** to guarantee correctness across concurrent workers.

**Key format:**
```
email-rate:{senderId}:{YYYY-M-D-H}
```

The hour window resets automatically via Redis TTL (3600 seconds).

**Lua script (atomic check-and-increment):**
```lua
local current = redis.call('GET', KEYS[1])
if current and tonumber(current) >= tonumber(ARGV[1]) then
  return 0  -- over limit
end
local newVal = redis.call('INCR', KEYS[1])
if newVal == 1 then
  redis.call('EXPIRE', KEYS[1], 3600)
end
return 1  -- allowed
```

**When the limit is hit:**
1. The email is **not** permanently failed
2. The job is **not** deleted from the queue
3. The email status reverts to `SCHEDULED`
4. A new BullMQ delayed job is created targeting the start of the next UTC hour + 1s buffer
5. A Slack message is sent (if connected)
6. The original job completes normally (no throw)

This preserves delivery order as much as possible and ensures every email is eventually delivered.

---

## 20. Elasticsearch Indexing

Emails are indexed in two situations:

1. **On creation** — immediately after the DB insert in `POST /api/emails/schedule`
2. **On status change** — after SENT/FAILED transitions in the worker

ES calls are **always wrapped in try/catch**. Any Elasticsearch failure:
- Is logged as a warning
- Does not affect email delivery
- Does not throw to the caller

PostgreSQL remains the source of truth at all times.

**Search endpoint:**
```
GET /api/emails/search?q={query}&page=1&limit=20
```

Returns `{ hits: Email[], total: number }` from Elasticsearch.

If Elasticsearch is down, the endpoint returns `{ hits: [], total: 0 }` gracefully.

---

## 21. Bull Board

Bull Board provides a real-time web UI for inspecting the BullMQ email queue.

**URL:** [http://localhost:5000/admin/queues](http://localhost:5000/admin/queues)

Features visible in the UI:
- Active, waiting, delayed, completed, and failed jobs
- Job data (emailId, senderId, userId)
- Retry counts and error messages
- Ability to retry failed jobs manually
- Queue pause/resume controls

No authentication is added to Bull Board in this development build. For production, add middleware to restrict access.

---

## 22. Testing

### Manual testing (recommended for demo)

1. Start all infrastructure with Docker Compose
2. Run database migrations
3. Start the backend (`npm run dev`)
4. Start the frontend (`npm run dev`)
5. Log in via Google OAuth
6. Add a sender email address
7. Compose a new email campaign with a CSV of test addresses
8. Set start time to 1 minute from now
9. Watch Bull Board at `/admin/queues` for jobs entering and completing
10. Check the Scheduled and Sent tabs in the dashboard
11. View Ethereal preview URLs in the backend console

### Health check

```bash
curl http://localhost:5000/health
# {"status":"ok"}
```

### API smoke tests (curl)

```bash
# Check auth status
curl -c cookies.txt http://localhost:5000/auth/me

# After logging in via browser, copy the session cookie and:
curl -b cookies.txt http://localhost:5000/api/emails/scheduled
curl -b cookies.txt http://localhost:5000/api/emails/sent
curl -b cookies.txt "http://localhost:5000/api/emails/search?q=test"
curl -b cookies.txt http://localhost:5000/api/slack/status
```

### TypeScript validation

```bash
# Backend
cd apps/backend && npx tsc --noEmit

# Frontend
cd apps/frontend && node node_modules/next/dist/bin/next build
```

---

## 23. Demo Instructions

### Full demo in 10 minutes

**Step 1: Start infrastructure**
```bash
docker compose up -d
# Wait ~30 seconds for Elasticsearch to be ready
```

**Step 2: Configure environment**
```bash
cp .env.example apps/backend/.env
# Edit apps/backend/.env:
# - Set DATABASE_URL (already correct for Docker)
# - Add Ethereal credentials from https://ethereal.email/create
# - Add Google OAuth credentials from Google Cloud Console
# - Optionally add Slack credentials
```

**Step 3: Initialize database**
```bash
cd apps/backend
npm run prisma:migrate
```

**Step 4: Start backend**
```bash
cd apps/backend
npm run dev
# Backend starts on http://localhost:5000
# Worker starts automatically
```

**Step 5: Start frontend**
```bash
cd apps/frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:5000" > .env.local
npm run dev
# Frontend starts on http://localhost:3000
```

**Step 6: Log in**
- Open [http://localhost:3000](http://localhost:3000)
- Click **Continue with Google**
- Complete the OAuth flow

**Step 7: Schedule a campaign**
- Click **Compose New Email**
- Add a sender address (any email, e.g. `demo@example.com`)
- Enter subject and body
- Upload a CSV with test email addresses (one per line)
- Set start time to 2 minutes from now
- Set delay between emails to `2000` ms
- Click **Schedule Emails**

**Step 8: Monitor**
- Watch the **Scheduled Emails** tab update
- Open Bull Board: [http://localhost:5000/admin/queues](http://localhost:5000/admin/queues)
- See jobs move from Delayed → Active → Completed
- After jobs complete, check **Sent Emails** tab
- Check backend console for Ethereal preview URLs

**Step 9: Test rate limiting**
- Set `MAX_EMAILS_PER_HOUR=3` in `.env` and restart backend
- Schedule 5 emails — the first 3 send immediately, the remaining 2 reschedule to next hour
- If Slack is connected, a notification appears in your channel

**Step 10: Test restart persistence**
- Schedule emails for 5 minutes in the future
- Stop the backend (`Ctrl+C`)
- Restart it (`npm run dev`)
- Jobs are still in Redis — they execute on schedule without any DB scan

---

## Quick Reference

```bash
# Start everything
docker compose up -d
cd apps/backend && npm run prisma:migrate && npm run dev &
cd apps/frontend && npm run dev

# URLs
# Frontend:   http://localhost:3000
# Backend:    http://localhost:5000
# Bull Board: http://localhost:5000/admin/queues
# Health:     http://localhost:5000/health
```

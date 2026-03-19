# Cobra NATS


> **v0.1.0** — A modern, professional management UI for NATS and JetStream.

![Cobra NATS](./cobra_nats.png)


Cobra NATS is a web-based administration dashboard for [NATS](https://nats.io), built with Next.js. It lets you manage JetStream streams, Key-Value stores, publish messages, and monitor live traffic — all from a sleek, dark-mode UI without requiring any CLI tooling.

---

## ✨ Features

### 🔗 Connection Management
- Save multiple NATS server connections in your browser (persisted via `localStorage`)
- Support for `none`, `username/password`, and `token` authentication
- Quickly switch between connections from the sidebar
- Connection status indicator in the dashboard

### 📡 JetStream Streams
- **List** all streams with sortable columns (name, subjects, messages, size, created)
- **Create** streams with full configuration: retention policy, storage type, max messages/bytes/age, replicas, and discard policy
- **Delete** streams with confirmation
- **View details**: stream configuration, state, and all attached consumers
- Filter/search streams by name or subject

### 🗄️ Key-Value Stores
- **List** all KV buckets
- **Create** new KV buckets with configurable TTL and replication
- **Browse** all keys inside a bucket
- **Get** and **Put** key-value entries
- **Delete** buckets

### 📤 Publish
- Publish messages to any NATS subject
- Set custom **headers** (key/value pairs)
- **Request-Reply** mode: send a request and view the reply inline
- Full subject, payload, and header configuration

### 📺 Live Subject Monitor
- Subscribe to any subject pattern (e.g. `orders.>`, `>`)
- Real-time message stream via Server-Sent Events (SSE)
- **Pause** / **resume** the stream without disconnecting
- **Expand** messages to inspect full payload and headers
- **Copy** message payload to clipboard
- **Export** captured messages as JSON
- Keeps the last 500 messages in memory

### 👥 Consumer Management
- **List** all consumers on a JetStream stream
- **Create** new push/pull consumers
- **Delete** consumers

### 🎨 Settings & Theming
- **Dark/Light Mode** toggle
- Preferences and connection settings via a dedicated screen

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 |
| NATS Server | ≥ 2.10 (with JetStream enabled) |
| Docker (optional) | any |

### Option A: Docker Compose (Recommended)

Start a local NATS server with JetStream and monitoring enabled:

```bash
docker-compose up -d
```

This will expose:
- `4222` — NATS client port
- `8222` — HTTP monitoring port
- `6222` — cluster port

Data is persisted in a Docker volume (`nats_data`).

### Option B: Devbox

If you use [Devbox](https://www.jetpack.io/devbox/), a reproducible shell environment is included:

```bash
devbox shell
devbox run start-nats   # starts nats-server on port 4222
```

### Option C: Manual NATS Server

```bash
nats-server -js -m 8222
```

---

### Running the UI

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the dashboard will appear.

---

## ⚙️ Configuration

Cobra NATS is purely client-side for connection configuration. All settings are stored in your browser's `localStorage` under the key `cobra-nats-storage`.

### Adding a Connection

1. Click **"New Connection"** in the sidebar footer.
2. Enter a name, server URL(s) (comma-separated for clusters), and authentication type.
3. Click **Connect** — the connection is saved and activated.

### Authentication Types

| Type | Required Fields |
|------|----------------|
| `none` | — |
| `user_pass` | Username + Password |
| `token` | Token |

---

## 🏗️ Architecture & Tech Stack

```
cobra-nats/
├── src/
│   ├── app/
│   │   ├── (dashboard)/       # All UI pages
│   │   │   ├── page.tsx       # Dashboard
│   │   │   ├── streams/       # JetStream Stream management
│   │   │   ├── kv/            # Key-Value Store management
│   │   │   ├── publish/       # Message publishing
│   │   │   └── monitor/       # Live traffic monitor
│   │   ├── actions/           # Next.js Server Actions (NATS client)
│   │   │   ├── action-helpers.ts     # withNatsConnection / withJetStream wrappers
│   │   │   ├── stream-actions.ts
│   │   │   ├── kv-actions.ts
│   │   │   ├── consumer-actions.ts
│   │   │   └── publish-actions.ts
│   │   └── api/
│   │       └── monitor/route.ts      # SSE endpoint for live monitoring
│   ├── components/            # UI components (shadcn/ui based)
│   ├── lib/nats/              # NATS connection management & types
│   └── store/useNatsStore.ts  # Zustand global state
├── tests/                     # Playwright E2E tests
├── docker-compose.yml
└── devbox.json
```

### Key Technologies

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| NATS Client | [nats.js v2](https://github.com/nats-io/nats.js) |
| UI Components | [shadcn/ui](https://ui.shadcn.com/) + Radix UI |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) |
| State Management | [Zustand](https://zustand-demo.pmnd.rs/) |
| Forms | [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) |
| Data Tables | [TanStack Table v8](https://tanstack.com/table) |
| Toast Notifications | [Sonner](https://sonner.emilkowal.ski/) |
| E2E Testing | [Playwright](https://playwright.dev/) |

### Server Action Pattern

All NATS operations run as **Next.js Server Actions**, keeping credentials and connection logic server-side. A unified wrapper handles error handling and JSON serialization:

```typescript
// Standard response shape
type ActionResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// Example usage
const result = await createStream(activeConnection, streamConfig);
if (result.success) {
  // result.data is type-safe
}
```

---

## 🧪 Testing

Playwright is used for both UI smoke tests and functional E2E tests against a real NATS server.

### Run All Tests

```bash
npx playwright test
```

### Run Functional Tests (requires NATS server on `localhost:4222`)

```bash
npx playwright test tests/functional-streams.spec.ts tests/functional-messaging.spec.ts
```

### Test Suites

| File | Description |
|------|-------------|
| `connections.spec.ts` | Connection creation and management UI |
| `streams.spec.ts` | Stream list and table UI |
| `kv.spec.ts` | KV store UI |
| `messaging.spec.ts` | Publish page UI |
| `settings.spec.ts` | Application settings and theme toggle UI |
| `functional-streams.spec.ts` | **Real** stream creation via NATS |
| `functional-kv.spec.ts` | **Real** KV bucket operations via NATS |
| `functional-messaging.spec.ts` | **Real** publish and request-reply via NATS |

---

## 📦 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on port 3000 |
| `npm run build` | Build production bundle |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx playwright test` | Run all E2E tests |

---

## 🔒 Security Notes

- NATS credentials are **never stored in the browser in plain text beyond the connection config** — all actual NATS client connections are created on the Next.js server side via Server Actions.
- The `cobra-nats-storage` localStorage key stores only **connection metadata** (server URLs, auth type, name), not credentials in session memory form.
- For production use, ensure your Next.js server is running in a secure, private network alongside your NATS cluster.

---

## 🗺️ Roadmap

- [ ] Live dashboard with real-time stream stats
- [ ] NATS Cluster topology view
- [ ] Object Store support
- [ ] Multi-tab message comparison

---

## 📄 License

MIT

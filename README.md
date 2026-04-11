# Cobra NATS

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![NATS](https://img.shields.io/badge/NATS-2.10+-27AAE1?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDJMMiAyMmgyMEwxMiAyeiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=)](https://nats.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E_Tests-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)
[![Devbox](https://img.shields.io/badge/Devbox-reproducible_env-7C3AED?logo=nixos&logoColor=white)](https://www.jetpack.io/devbox/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **v0.5.2** — A modern, professional management UI for NATS and JetStream.

![Cobra NATS](./cobra_nats.png)


Cobra NATS is a web-based administration dashboard for [NATS](https://nats.io), built with Next.js. It lets you manage JetStream streams, Key-Value stores, Object Stores, publish messages, and monitor live traffic — all from a sleek, dark-mode UI without requiring any CLI tooling.

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

### 📦 Object Stores
- **List** all Object Store buckets with size, object count, and replica info
- **Create** new Object Store buckets with configurable replicas and description
- **Browse** stored objects with metadata (name, size, chunks, digest)
- **Upload** files into an Object Store bucket
- **Download** objects directly from the browser
- **Delete** individual objects or entire buckets
- **Seal** buckets to make them read-only

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
- **Create** new push/pull consumers via dialog
- **Delete** consumers
- **Browse** messages on a stream (message browser with payload/header inspection)

### ⚡ Productivity
- **Command Palette** (`Cmd/Ctrl+K`) — quick navigation across all features
- **Global Keyboard Shortcuts** with an in-app help dialog (`?`)
- **Auto-Breadcrumbs** derived from the current route
- **Auto-Refresh** selector on list views (configurable intervals)
- **URL-synced state** for filters and selections (deep-linkable views)
- **No-Connection Banner** when no active NATS connection is set

### 🎨 Settings & Theming
- **Dark/Light Mode** toggle with semantic color tokens
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

### Option B: Devbox (Recommended for Development)

[Devbox](https://www.jetpack.io/devbox/) provides a fully reproducible, Nix-based development environment — no global installations needed.

#### Included Packages

| Package | Purpose |
|---------|---------|
| `nats-server` | NATS server with JetStream |
| `natscli` | Official NATS CLI (`nats` command) |
| `nodejs_20` | Node.js 20 runtime |
| `jq` | JSON processing |
| `curl` | HTTP requests |

#### Getting Started

```bash
devbox shell                  # enter the environment
```

#### Available Scripts

| Command | Description |
|---------|-------------|
| `devbox run start-nats` | Start NATS server with JetStream on port 4222 |
| `devbox run nats-info` | Show NATS server info via CLI |
| `devbox run ui-dev` | Start Next.js dev server |
| `devbox run ui-build` | Build production bundle |
| `devbox run ui-start` | Start production server |

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

The project follows a **feature-based architecture**: every domain owns its UI, Server Actions, store, and feature-local components in a single folder under `src/features/`.

```
cobra-nats/
├── src/
│   ├── app/                         # Next.js routing & layouts only
│   │   ├── (dashboard)/             # All UI pages
│   │   │   ├── page.tsx             # Dashboard overview
│   │   │   ├── streams/             # Stream list + detail
│   │   │   ├── kv/                  # KV bucket list + detail
│   │   │   ├── os/                  # Object Store list + detail
│   │   │   ├── publish/             # Publish / Request-Reply
│   │   │   ├── monitor/             # Live traffic monitor
│   │   │   └── settings/            # Application settings
│   │   └── api/monitor/route.ts     # SSE endpoint (only REST route)
│   │
│   ├── features/                    # Domain modules — everything per feature
│   │   ├── connections/             # Zustand store, hook, actions, connect dialog
│   │   ├── dashboard/               # Dashboard overview component
│   │   ├── streams/                 # Streams + consumers + message browser
│   │   ├── kv/                      # KV bucket actions & UI
│   │   ├── os/                      # Object Store actions & UI
│   │   ├── publish/                 # Publish & request-reply actions & UI
│   │   └── monitor/                 # Live monitor view + SSE client (stream.ts)
│   │
│   ├── components/
│   │   ├── ui/                      # shadcn/ui primitives (never edit directly)
│   │   ├── layout/                  # app-sidebar, topbar, theme-toggle,
│   │   │                            # auto-breadcrumbs, command-palette,
│   │   │                            # global-shortcuts, help-dialog,
│   │   │                            # no-connection-banner
│   │   └── providers/               # Root & confirm-dialog providers
│   │
│   ├── lib/
│   │   ├── nats/manager.ts          # Singleton NatsManager (connection pool)
│   │   ├── server-action.ts         # withNatsConnection / withJetStream / ActionResponse
│   │   └── utils.ts
│   │
│   ├── hooks/                       # App-wide hooks
│   │   ├── use-mobile.ts
│   │   ├── use-keyboard-shortcuts.ts
│   │   ├── use-local-storage.ts
│   │   ├── use-auto-refresh.ts
│   │   └── use-url-state.ts
│   │
│   └── types/nats.ts                # Shared domain types & enums
│
├── tests/                           # Playwright E2E (flat, incl. functional-*)
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

All NATS operations run as **Next.js Server Actions** under `src/features/<domain>/actions.ts`, keeping credentials and connection logic server-side. A unified wrapper in `src/lib/server-action.ts` handles error handling, operation naming and JSON serialization:

```typescript
// Standard response shape
type ActionResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// Feature action (server side)
"use server";
import { withJetStream, type ActionResponse } from "@/lib/server-action";

export async function createStream(
  config: NatsConnectionConfig,
  opts: StreamOptions,
): Promise<ActionResponse<StreamInfo>> {
  return withJetStream(config, "createStream", async ({ jsm }) => {
    return jsm.streams.add(opts);
  });
}

// Client component
const res = await createStream(activeConnection, streamConfig);
if (!res.success) {
  toast.error(res.error);
  return;
}
// res.data is type-safe
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
| `os.spec.ts` | Object Store page UI |
| `messaging.spec.ts` | Publish page UI |
| `settings.spec.ts` | Application settings and theme toggle UI |
| `functional-streams.spec.ts` | **Real** stream creation via NATS |
| `functional-consumers-and-messages.spec.ts` | **Real** consumer + message browser flows |
| `functional-kv.spec.ts` | **Real** KV bucket operations via NATS |
| `functional-os.spec.ts` | **Real** Object Store operations via NATS |
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

- [x] Object Store support (browse, upload, download, delete, seal)
- [x] Command Palette & global keyboard shortcuts
- [x] Auto-refresh and URL-synced filter state
- [x] Message browser with consumer creation
- [ ] Live dashboard with real-time stream stats
- [ ] NATS Cluster topology view
- [ ] Multi-tab message comparison

---

## 📄 License

MIT

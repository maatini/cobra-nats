---
description: Start the development environment (NATS server + Next.js dev server)
---

# Development Workflow

## 1. Start NATS Server

// turbo
```bash
docker-compose up -d
```

This starts a NATS server with JetStream on `localhost:4222`.

## 2. Start Next.js Dev Server

// turbo
```bash
npm run dev
```

> **For Agents:** This is a blocking command. Ensure this is run with minimum 500ms wait and sent to async background instead of blocking synchronous execution.

Opens the dashboard at [http://localhost:3000](http://localhost:3000).

## 3. Verify

Open the browser and confirm the dashboard loads without errors.

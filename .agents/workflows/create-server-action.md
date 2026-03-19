---
description: Create a new Next.js Server Action for NATS operations
---

# Create Server Action Workflow

## 1. Create File & Structure

Create or update a file in `src/app/actions/` (e.g., `feature-actions.ts`).
Ensure you include the `'use server'` directive at the very top of the file.

## 2. Import Action Helpers

You must import the standard error handling and wrapper functions:
```typescript
import { withNatsConnection, withJetStream } from "./action-helpers";
import type { ActionResponse } from "./action-helpers";
```

## 3. Define the Action

Always wrap your logic in `withNatsConnection` (for general NATS/KV) or `withJetStream` (for JetStream specific operations). Every server action must strictly return `Promise<ActionResponse<T>>`.

**Example Pattern:**
```typescript
"use server";

import { NatsConnectionConfig } from "@/lib/nats/nats-types";
import { withJetStream, ActionResponse } from "./action-helpers";

export async function sampleFeatureAction(config: NatsConnectionConfig, param: string): Promise<ActionResponse<{ result: boolean }>> {
    return withJetStream(config, "sampleFeatureAction", async ({ js }) => {
        // Implement NATS logic using JetStream context `js`
        // const res = await js.doSomething(param);
        return { result: true }; 
    });
}
```

## 4. Run Lint

// turbo
```bash
npm run lint
```

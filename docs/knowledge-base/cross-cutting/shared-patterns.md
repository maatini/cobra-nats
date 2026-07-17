# Shared Patterns

Reusable conventions and patterns that span modules.

## Server Action Pattern

Every feature action follows this exact structure:

```ts
"use server";
import type { NatsConnectionConfig } from "@/types/nats";
import { withJetStream, type ActionResponse } from "@/lib/server-action";

export async function doSomething(
    config: NatsConnectionConfig,
    ...args
): Promise<ActionResponse<SomeType>> {
    return withJetStream(config, "doSomething", async ({ js, jsm }) => {
        // NATS operations here
        // Throw on error — the wrapper catches and returns ActionResponse
    });
}
```

**Key rules**:
- First param is always `NatsConnectionConfig`.
- Return type is always `ActionResponse<T>`.
- Use `withJetStream` for JetStream ops (streams, consumers, KV, OS).
- Use `withNatsConnection` for core NATS ops (publish, request, server info).
- Operation name string is used in error logs — make it descriptive.

## Client Component Pattern

Every client component that calls actions follows this:

```tsx
"use client";
import { useState } from "react";
import { toast } from "sonner";
import { useActiveConnection } from "@/features/connections/hooks";
import { doSomething } from "@/features/something/actions";

export function SomethingList() {
    const connection = useActiveConnection();
    const [loading, setLoading] = useState(false);

    async function handleAction() {
        if (!connection) return;
        setLoading(true);
        const res = await doSomething(connection, ...args);
        if (!res.success) {
            toast.error(res.error);
            setLoading(false);
            return;
        }
        // res.data is type-safe here
        setLoading(false);
    }
}
```

**Key rules**:
- Always `"use client"` directive.
- Always guard `if (!connection) return;` before calling actions.
- Always narrow `if (!res.success) { toast.error(res.error); return; }` before using `res.data`.
- No `res.data!` non-null assertions.

## Form Pattern (React Hook Form + Zod)

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const formSchema = z.object({
    name: z.string().min(1, "Required"),
    replicas: z.coerce.number().int().min(1).max(5).default(1),
});

type FormValues = z.infer<typeof formSchema>;

export function MyForm() {
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { replicas: 1 },
    });
    // Use shadcn FormField, FormItem, FormLabel, FormMessage
}
```

**Key rules**:
- Define Zod schema next to the component (not in a separate file).
- Use `z.coerce.number()` for numeric inputs from form fields.
- Use shadcn form primitives for consistent rendering.

## Import Order Convention

```ts
// 1. React / Next
// 2. Third-party libraries
// 3. Types (import type)
// 4. Lib / feature code
// 5. UI components
```

## Color Palette

| Domain | Tailwind color |
|---|---|
| General / Layout | `indigo` |
| Streams / Consumers | `amber` |
| Key-Value | `emerald` (rose in dashboard) |
| Object Store | `cyan` |
| Destructive / Error | `red` |
| Publish | `indigo` |
| Monitor | `rose` |

shadcn/ui New York style with Tailwind v4 semantic color tokens.

## NATS Stream Prefix Conventions

| NATS type | Stream prefix | Discovery in code |
|---|---|---|
| KV bucket `myBucket` | `KV_myBucket` | `listKVBuckets` filters on `KV_` |
| Object Store `myOs` | `OBJ_myOs` | `listOSBuckets` filters on `OBJ_` |

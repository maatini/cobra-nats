# Implementation brief — execute ranked actions except #2

Source: CrewAI executive brief `crewai/output/run-20261023T082111Z.md` (Cobra NATS 0.6.0).

This crew **implements** application and documentation changes in the local checkout.
It does **not** commit, push, or open pull requests.

## Hard skip — action 2

Do **not** implement, redesign, or “resolve” the credential trust model:

- Do not add caller authentication / multi-tenant authorization.
- Do not move connection secrets out of the browser store.
- Do not treat config id as a new authz scheme.

Factual documentation that profiles (including credentials) currently live in
`localStorage` key `cobra-nats-storage` is allowed under action 8.

## Coding laws (mandatory)

- NATS never in the browser. No `import "nats"` from client components.
- Server Actions in `src/features/<domain>/actions.ts`. First arg is `NatsConnectionConfig`. Return `ActionResponse<T>` via `withNatsConnection` / `withJetStream`.
- Intentional API exceptions: `/api/monitor` SSE, `/api/os/upload` multipart, `/api/os/download` stream.
- Types in `src/types/nats.ts`. UI: shadcn/ui New York, English strings.
- Tests: Playwright under `tests/*.spec.ts`; new unit tests may use Vitest next to source.
- TypeScript strict, no `any`, no `@ts-ignore`.
- Surgical diffs. Match existing style.

## Actions to implement (rank from the brief)

| Rank | Outcome |
|---:|---|
| **1** | Runtime Zod schemas for every client-callable Server Action and the three API routes. Bound batches and uploads. |
| **3** | Harden `NatsManager`: coalesce concurrent connect, bind JSM to connection generation, guard close/reconnect, bound unused entries. |
| **4** | Restrict `fetchHttpMonitoring` SSRF (protocol + destination policy that still allows localhost:8222). |
| **5** | Unit tests for manager lifecycle + schema/SSRF; API-route contract tests for malformed input. |
| **6** | Reliable cleanup on monitor abort/iterator failure, `testConnection` finally, OS download cancel / `request.signal`. |
| **7** | Playwright isolation (unique tmp files and resource names) plus high-impact deterministic coverage. |
| **8** | Docs match implementation (API routes, wrappers, pool caveats, monitor cleanup). Skip trust-model redesign. |
| **9** | Measure, then fix confirmed cheap wins (duplicate OS `os.list()` on detail load). No speculative rewrites. |
| **10** | Write a sequenced roadmap plan for the three open README epics. Do not build those features. |

## Key files

- `src/lib/nats/manager.ts`, `src/lib/server-action.ts`, `src/lib/nats/connect-options.ts`
- `src/features/{connections,streams,kv,os,publish}/actions.ts`
- `src/app/api/monitor/route.ts`, `src/app/api/os/upload/route.ts`, `src/app/api/os/download/route.ts`
- `src/features/monitor/stream.ts`, `src/features/dashboard/http-monitoring-card.tsx`
- `src/features/os/components/os-detail-view.tsx`, `src/features/os/actions.ts` (`getOSBucket` lists objects)
- `tests/helpers.ts`, `tests/functional-os.spec.ts` (shared `tmp/test-upload.txt`)
- `docs/knowledge-base/`, `README.md`, `CLAUDE.md`

## Verification

After code tasks: `npx tsc --noEmit`, then `npm run lint`. Targeted `npx vitest run` when unit tests exist.
Do not run the full Playwright suite unless a task explicitly requires a named spec.

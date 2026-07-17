# Maintenance — Knowledge Base

## When to update this knowledge base

Update these docs when you:

1. **Add a new feature domain** (e.g., a new `src/features/<name>/` folder)
   - Create a new `modules/<name>/` directory with `index.md`, `responsibility.md`, `dependencies.md`
   - Update `architecture/components.md` with the new component
   - Add relevant routes to `architecture/data-flows.md`
   - Register any new `@tag:...` concepts in `cross-cutting/tags.md`

2. **Change an action's signature** or add new actions
   - Update the corresponding `modules/<name>/responsibility.md` entry points table
   - Update `modules/<name>/interfaces.md` if it exists

3. **Add or change a dependency** (new npm package, new cross-feature import)
   - Update `modules/<name>/dependencies.md`
   - Update `architecture/dependencies.md` if the global graph changes

4. **Add a new architectural pattern** or change an existing one
   - Update `cross-cutting/shared-patterns.md`
   - Update `architecture/decisions.md` for significant architectural choices

5. **Change the data flow** (new API route, different SSE pattern, new provider)
   - Update `architecture/data-flows.md`

6. **Change package versions** (major upgrades)
   - Update `overview.md` tech stack table

## Formatting conventions

- **Files are short** — target 50-150 lines. Split into sub-files if longer.
- **Bullets and tables** over long paragraphs. Agents scan, not read.
- **Mermaid** for diagrams: `architecture/dependencies.md`, `architecture/data-flows.md`
- **Relative links** only — no absolute paths or external URLs except for source-of-truth docs
- **`@tag:...`** syntax for cross-cutting concepts registered in `cross-cutting/tags.md`
- **"Needs clarification"** marker when something is inferred but not confirmed in code

## File structure rules

- Every directory with child files must have an `index.md`
- `index.md` contains: 1-sentence folder purpose + bullet list of children with 1-sentence links
- `responsibility.md` answers: what does this own? what invariants must hold? what are the entry points?
- `dependencies.md` answers: what does this depend on? who depends on this? (use tables)

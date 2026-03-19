---
description: Add a new shadcn/ui component to the project
---

# Add UI Component Workflow

## 1. Identify Component Name

Determine which shadcn/ui component you want to add (e.g., `button`, `dialog`, `table`).

## 2. Run shadcn CLI

Run the following command in the project root:

```bash
npx shadcn@latest add <component-name>
```

> **For Agents:** Always append the `--yes` flag to bypass interactive prompts when installing a known component. For example: `npx shadcn@latest add button --yes`
// turbo
```bash
npx shadcn@latest add <component-name> --yes
```

## 3. Verify Installation

Check that the component was effectively created inside `src/components/ui/` and is exported correctly without any TypeScript errors.

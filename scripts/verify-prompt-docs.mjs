#!/usr/bin/env node
/**
 * Structural verifier for agent prompt docs.
 * Asserts always-load / agent / settings claims against the live repo
 * (package.json + filesystem). Exit 0 only when all checks pass.
 *
 * Run: node scripts/verify-prompt-docs.mjs
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const fail = [];
const pass = [];

function read(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) {
    fail.push(`missing file: ${rel}`);
    return "";
  }
  return readFileSync(p, "utf8");
}

function assert(cond, msg) {
  if (cond) pass.push(msg);
  else fail.push(msg);
}

const pkg = JSON.parse(read("package.json"));
const claude = read("CLAUDE.md");
const architecture = read(".claude/architecture.md");
const project = read(".claude/project.md");
const rules = read(".claude/rules.md");
const tags = read("docs/knowledge-base/cross-cutting/tags.md");

// --- Stack vs package.json ---
const ts = String(pkg.devDependencies?.typescript ?? "");
assert(ts.startsWith("^6") || ts.startsWith("6"), `package.json typescript major is 6 (got ${ts})`);
assert(/TypeScript 6/.test(claude), "CLAUDE.md states TypeScript 6");
assert(!/TypeScript 5/.test(claude + architecture + project + rules), "no TypeScript 5 in prompt docs");
assert(String(pkg.dependencies?.next ?? "").startsWith("16"), "next major 16");
assert(/Next\.js 16/.test(claude), "CLAUDE.md states Next.js 16");
assert(String(pkg.dependencies?.react ?? "").startsWith("19"), "react major 19");
assert(/React 19/.test(claude), "CLAUDE.md states React 19");
assert(String(pkg.dependencies?.nats ?? "").includes("2.29"), "nats ~2.29");

// --- API routes exist and are documented ---
const apiRoutes = [];
function walk(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (name === "route.ts") apiRoutes.push(relative(join(ROOT, "src/app/api"), full));
  }
}
walk(join(ROOT, "src/app/api"));
assert(
  apiRoutes.some((r) => r.includes("monitor")),
  `live api includes monitor (found: ${apiRoutes.join(", ")})`
);
assert(
  apiRoutes.some((r) => r.includes("os") && r.includes("upload")),
  `live api includes os/upload (found: ${apiRoutes.join(", ")})`
);

const promptBlob = claude + architecture + project;
assert(/api\/monitor|api\/.*monitor/.test(promptBlob), "prompts mention monitor API");
assert(/os\/upload|api\/os/.test(promptBlob), "prompts mention os/upload API");
const optimizedSurfaces =
  claude +
  architecture +
  project +
  rules +
  tags +
  read("docs/knowledge-base/overview.md");
assert(
  !/only REST endpoint|The only REST|lone REST|only REST route/i.test(optimizedSurfaces),
  "no false 'only REST' slogans in optimized prompts"
);
assert(
  !/ONLY place NATS operations execute/i.test(optimizedSurfaces),
  "no false 'ONLY place NATS operations execute' slogan"
);
assert(
  !/Every operation is a Server Action/i.test(optimizedSurfaces),
  "no false 'Every operation is a Server Action' slogan"
);

// --- Features + tests layout ---
const features = readdirSync(join(ROOT, "src/features")).filter((n) =>
  statSync(join(ROOT, "src/features", n)).isDirectory()
);
const expectedFeatures = [
  "connections",
  "dashboard",
  "streams",
  "kv",
  "os",
  "publish",
  "monitor",
];
for (const f of expectedFeatures) {
  assert(features.includes(f), `feature folder exists: ${f}`);
}
assert(/connections|streams|kv|os|publish|monitor|dashboard/.test(claude), "CLAUDE lists features");

const tests = readdirSync(join(ROOT, "tests")).filter((n) => n.endsWith(".spec.ts"));
assert(tests.length >= 5, `tests/*.spec.ts flat layout (count=${tests.length})`);
assert(!existsSync(join(ROOT, "tests/features")), "no tests/features/ subfolder");
assert(/tests\/\*\.spec\.ts/.test(claude + rules), "docs document flat tests layout");

// --- Storage key ---
const store = read("src/features/connections/store.ts");
assert(
  /CONNECTIONS_STORAGE_KEY\s*=\s*"cobra-nats-storage"/.test(store),
  "CONNECTIONS_STORAGE_KEY is cobra-nats-storage"
);
assert(
  /cobra-nats-storage/.test(project + rules),
  "project/rules document cobra-nats-storage"
);

// --- Agents: frontmatter + non-overlap signals ---
const agentDir = join(ROOT, ".claude/agents");
const agentFiles = readdirSync(agentDir).filter((n) => n.endsWith(".md"));
assert(agentFiles.length === 5, `five agent profiles (got ${agentFiles.length})`);

const agents = {};
for (const file of agentFiles) {
  const body = read(join(".claude/agents", file));
  const fm = body.match(/^---\n([\s\S]*?)\n---/);
  assert(!!fm, `${file}: has YAML frontmatter`);
  const name = fm?.[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const desc = fm?.[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
  assert(!!name, `${file}: frontmatter name`);
  assert(!!desc && desc.length > 40, `${file}: frontmatter description is actionable`);
  assert(/NOT for|not for|Does not own|Do not use/i.test(body + desc), `${file}: has when-not boundary`);
  agents[name] = { file, desc, body };
}

assert(agents["nats-jetstream-expert"], "agent nats-jetstream-expert present");
assert(agents["server-actions-agent"], "agent server-actions-agent present");
assert(agents["nextjs-frontend-agent"], "agent nextjs-frontend-agent present");
assert(agents["ui-shadcn-agent"], "agent ui-shadcn-agent present");
assert(agents["playwright-testing-agent"], "agent playwright-testing-agent present");

// Ownership: expert must NOT claim exclusive ownership of all feature actions
assert(
  !/Owns[\s\S]*all Server Actions that touch NATS/i.test(
    agents["nats-jetstream-expert"]?.body ?? ""
  ),
  "nats-jetstream-expert does not claim all Server Actions"
);
assert(
  /actions\.ts/.test(agents["server-actions-agent"]?.body ?? ""),
  "server-actions-agent owns actions.ts"
);
assert(
  /components\/ui/.test(agents["ui-shadcn-agent"]?.body ?? ""),
  "ui-shadcn-agent owns components/ui"
);
assert(
  /tests\/\*\.spec\.ts/.test(agents["playwright-testing-agent"]?.desc ?? ""),
  "playwright agent description mentions tests/*.spec.ts"
);

// tags.md alignment
assert(
  /@server-actions-agent/.test(tags) && /all feature Server Actions|feature Server Actions/i.test(tags),
  "tags.md assigns Server Actions to server-actions-agent"
);
assert(
  !/Owns NatsManager, shared types, all Server Actions that touch NATS directly/.test(tags),
  "tags.md no longer gives actions to nats-jetstream-expert"
);

// --- settings.local.json hygiene ---
const settingsPath = join(ROOT, ".claude/settings.local.json");
if (existsSync(settingsPath)) {
  const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  const allow = settings?.permissions?.allow ?? [];
  assert(Array.isArray(allow) && allow.length > 0, "settings.local.json has allow list");
  const joined = allow.join("\n");
  assert(/playwright|npm run/i.test(joined), "allow list covers npm/playwright workflows");
  assert(!/localhost:3005/.test(joined), "no stale localhost:3005 allow entry");
} else {
  fail.push("settings.local.json missing");
}


// --- Grok-native surfaces ---
assert(existsSync(join(ROOT, "AGENTS.md")), "AGENTS.md exists (Grok entry)");
const agentsMd = read("AGENTS.md");
assert(/subagent_type|server-actions-agent|playwright-testing-agent/i.test(agentsMd), "AGENTS.md has subagent routing");
assert(/api\/monitor|api\/os\/upload/.test(agentsMd), "AGENTS.md documents API exceptions");
const grokRules = join(ROOT, ".grok/rules");
assert(existsSync(grokRules), ".grok/rules/ exists");
const ruleFiles = readdirSync(grokRules).filter((n) => n.endsWith(".md"));
assert(ruleFiles.length >= 3, `.grok/rules has stubs (got ${ruleFiles.length})`);
for (const rf of ruleFiles) {
  const body = read(join(".grok/rules", rf));
  assert(/\.claude\//.test(body), `.grok/rules/${rf} points into .claude/`);
  assert(body.length < 800, `.grok/rules/${rf} stays short (no bulk dump)`);
}
const grokAgents = join(ROOT, ".grok/agents");
assert(existsSync(grokAgents), ".grok/agents/ exists");
for (const name of [
  "nats-jetstream-expert",
  "server-actions-agent",
  "nextjs-frontend-agent",
  "ui-shadcn-agent",
  "playwright-testing-agent",
]) {
  const p = join(grokAgents, name + ".md");
  assert(existsSync(p), `.grok/agents/${name}.md exists`);
}

// --- Report ---
console.log("verify-prompt-docs.mjs");
console.log(`PASS: ${pass.length}`);
for (const m of pass) console.log(`  ✓ ${m}`);
console.log(`FAIL: ${fail.length}`);
for (const m of fail) console.log(`  ✗ ${m}`);

if (fail.length) {
  process.exit(1);
}
console.log("\nAll structural prompt checks passed.");

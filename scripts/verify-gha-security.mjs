#!/usr/bin/env node
/**
 * Structural verifier for GitHub Actions workflow security.
 * Reads the shipped YAML under .github/workflows/ (or GHA_WORKFLOWS_DIR)
 * and fails if token scopes, action pins, checkout credentials, provenance,
 * or untrusted run-script interpolation regress.
 *
 * Run: node scripts/verify-gha-security.mjs
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const WORKFLOWS_DIR = process.env.GHA_WORKFLOWS_DIR
  ? resolve(process.env.GHA_WORKFLOWS_DIR)
  : join(ROOT, ".github/workflows");

const SHA_RE = /^[0-9a-f]{40}$/;
const USES_RE = /^uses:\s*(.+)$/;
const WRITE_PERM_RE = /^(read-all|write-all|[a-z][a-z0-9-]*)\s*:\s*(write|write-all)\s*$/;

const fail = [];
const pass = [];

function assert(cond, msg) {
  if (cond) pass.push(msg);
  else fail.push(msg);
}

function stripInlineComment(line) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle && line[i - 1] !== "\\") inDouble = !inDouble;
    else if (c === "#" && !inSingle && !inDouble) return line.slice(0, i).trimEnd();
  }
  return line;
}

function parseLines(text) {
  return text.split(/\n/).map((raw, i) => {
    const stripped = stripInlineComment(raw);
    const indent = (stripped.match(/^ */) || [""])[0].length;
    return { n: i + 1, raw, stripped, indent, trim: stripped.trim() };
  });
}

function blockAfter(lines, startIdx, parentIndent) {
  const out = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim) continue;
    if (line.indent <= parentIndent) break;
    out.push(line);
  }
  return out;
}

function topLevelBlock(lines, key) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.indent !== 0 || !line.trim.startsWith(`${key}:`)) continue;
    const inline = line.trim.slice(key.length + 1).trim();
    return { start: i, inline, children: blockAfter(lines, i, 0) };
  }
  return null;
}

function mappingChildren(lines) {
  const keys = [];
  if (!lines.length) return keys;
  const base = Math.min(...lines.map((l) => l.indent));
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.indent !== base) continue;
    const m = line.trim.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    keys.push({
      name: m[1],
      inline: m[2],
      line: line.n,
      children: blockAfter(lines, i, base),
    });
  }
  return keys;
}

function triggersPullRequest(onBlock) {
  if (!onBlock) return false;
  if (/\bpull_request_target\b/.test(onBlock.inline)) return true;
  if (/\bpull_request\b/.test(onBlock.inline)) return true;
  const blob = onBlock.children.map((l) => l.trim).join("\n");
  return /\bpull_request\b/.test(blob);
}

function jobRunsOnPullRequest(workflowHasPR, ifExpr) {
  if (!workflowHasPR) return false;
  if (!ifExpr) return true;
  const expr = ifExpr.replace(/\$\{\{\s*|\s*\}\}/g, "").trim();
  if (/github\.event_name\s*!=\s*['"]pull_request['"]/.test(expr)) return false;
  if (/github\.event_name\s*==\s*['"](?!pull_request)[^'"]+['"]/.test(expr)) return false;
  return true;
}

function permissionWrites(permKey) {
  const writes = [];
  if (!permKey) return writes;
  const inline = permKey.inline.trim();
  if (inline === "write-all") writes.push("write-all");
  if (inline === "write") writes.push("write");
  for (const line of permKey.children) {
    if (WRITE_PERM_RE.test(line.trim) || /:\s*write\s*$/.test(line.trim)) {
      writes.push(line.trim);
    }
  }
  return writes;
}

function parseSteps(stepsKey) {
  if (!stepsKey) return [];
  const lines = stepsKey.children;
  if (!lines.length) return [];
  const base = Math.min(...lines.map((l) => l.indent));
  const steps = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.indent === base && line.trim.startsWith("- ")) {
      if (current) steps.push(current);
      current = { line: line.n, fields: {}, runLines: [] };
      const rest = line.trim.slice(2);
      const kv = rest.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (kv) current.fields[kv[1]] = kv[2];
      continue;
    }
    if (!current) continue;
    const kv = line.trim.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, value] = kv;
    if (key === "run") {
      if (value === "|" || value === ">" || value === "|-" || value === ">-") {
        const body = blockAfter(lines, i, line.indent);
        current.runLines = body.map((l) => l.raw);
      } else {
        current.runLines = [value];
      }
    }
    if (key === "uses") current.fields.uses = value;
    if (key === "with") current.with = mappingChildren(blockAfter(lines, i, line.indent));
    current.fields[key] = value;
  }
  if (current) steps.push(current);
  return steps;
}

function isRemoteAction(ref) {
  if (!ref) return false;
  if (ref.startsWith("./") || ref.startsWith("docker://")) return false;
  return ref.includes("/") && ref.includes("@");
}

function checkWorkflowFile(relPath, text) {
  const lines = parseLines(text);
  const fileLabel = relPath;

  const onBlock = topLevelBlock(lines, "on");
  const onBlob = `${onBlock?.inline ?? ""}\n${(onBlock?.children ?? []).map((l) => l.trim).join("\n")}`;
  assert(!/\bpull_request_target\b/.test(onBlob), `${fileLabel}: no pull_request_target trigger`);

  assert(
    !/^\s*provenance:\s*false\s*$/m.test(text),
    `${fileLabel}: provenance is not disabled`
  );

  const workflowHasPR = triggersPullRequest(onBlock);
  const jobsBlock = topLevelBlock(lines, "jobs");
  assert(!!jobsBlock, `${fileLabel}: has jobs:`);
  if (!jobsBlock) return;

  const jobs = mappingChildren(jobsBlock.children);
  assert(jobs.length > 0, `${fileLabel}: declares at least one job`);

  for (const job of jobs) {
    const props = mappingChildren(job.children);
    const byName = Object.fromEntries(props.map((p) => [p.name, p]));
    assert(!!byName.permissions, `${fileLabel} job '${job.name}': explicit permissions:`);

    const writes = permissionWrites(byName.permissions);
    const ifExpr = byName.if?.inline ?? "";
    const onPR = jobRunsOnPullRequest(workflowHasPR, ifExpr);
    if (onPR) {
      assert(
        writes.length === 0,
        `${fileLabel} job '${job.name}': no write scopes on pull_request (found: ${writes.join(", ") || "none"})`
      );
    } else if (writes.length) {
      pass.push(
        `${fileLabel} job '${job.name}': write scopes allowed (does not run on pull_request): ${writes.join(", ")}`
      );
    }

    const steps = parseSteps(byName.steps);
    for (const step of steps) {
      const uses = (step.fields.uses || "").trim();
      if (uses && isRemoteAction(uses)) {
        const at = uses.lastIndexOf("@");
        const pin = uses.slice(at + 1).trim();
        assert(
          SHA_RE.test(pin),
          `${fileLabel} job '${job.name}' line ${step.line}: uses: pinned to 40-char SHA (got ${uses})`
        );
      }

      if (uses && /\/checkout@/.test(uses)) {
        const persist = (step.with || []).find((k) => k.name === "persist-credentials");
        const val = (persist?.inline ?? "").trim();
        assert(
          val === "false" || val === `"false"` || val === "'false'",
          `${fileLabel} job '${job.name}' line ${step.line}: checkout persist-credentials: false`
        );
      }

      if ((step.runLines || []).length) {
        const runBlob = step.runLines.join("\n");
        assert(
          !/\$\{\{\s*github\.event\./.test(runBlob),
          `${fileLabel} job '${job.name}' line ${step.line}: no \${{ github.event. }} interpolation in run:`
        );
      }
    }
  }
}

function main() {
  assert(existsSync(WORKFLOWS_DIR), `workflows dir exists: ${WORKFLOWS_DIR}`);
  if (!existsSync(WORKFLOWS_DIR)) return report();

  const files = readdirSync(WORKFLOWS_DIR)
    .filter((n) => n.endsWith(".yml") || n.endsWith(".yaml"))
    .sort();
  assert(files.length > 0, `found workflow YAML in ${WORKFLOWS_DIR}`);

  for (const name of files) {
    const full = join(WORKFLOWS_DIR, name);
    if (!statSync(full).isFile()) continue;
    const text = readFileSync(full, "utf8");
    checkWorkflowFile(name, text);
  }

  report();
}

function report() {
  console.log("verify-gha-security.mjs");
  console.log(`dir: ${WORKFLOWS_DIR}`);
  console.log(`PASS: ${pass.length}`);
  for (const m of pass) console.log(`  ✓ ${m}`);
  console.log(`FAIL: ${fail.length}`);
  for (const m of fail) console.log(`  ✗ ${m}`);
  if (fail.length) process.exit(1);
  console.log("\nAll GitHub Actions security checks passed.");
}

main();

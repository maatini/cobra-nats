#!/usr/bin/env node
/**
 * Drives scripts/verify-gha-security.mjs on the shipped workflows (must pass)
 * and on a mutated temp copy (must fail). Does not re-implement the assertions.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECKER = join(ROOT, "scripts/verify-gha-security.mjs");
const SHIPPED = join(ROOT, ".github/workflows");

function run(dir) {
  return spawnSync(process.execPath, [CHECKER], {
    encoding: "utf8",
    cwd: ROOT,
    env: { ...process.env, GHA_WORKFLOWS_DIR: dir },
  });
}

const shipped = run(SHIPPED);
if (shipped.status !== 0) {
  console.error("expected shipped workflows to pass\n", shipped.stdout, shipped.stderr);
  process.exit(1);
}
if (!/All GitHub Actions security checks passed/.test(shipped.stdout)) {
  console.error("shipped run missing pass banner\n", shipped.stdout);
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), "gha-security-"));
try {
  cpSync(SHIPPED, tmp, { recursive: true });
  const target = join(tmp, "e2e.yml");
  const broken = readFileSync(target, "utf8").replace(
    /actions\/checkout@[0-9a-f]{40}/,
    "actions/checkout@v7"
  );
  if (broken === readFileSync(target, "utf8")) {
    console.error("failed to mutate a checkout SHA pin in the temp copy");
    process.exit(1);
  }
  writeFileSync(target, broken);

  const negative = run(tmp);
  if (negative.status === 0) {
    console.error("expected mutated workflow to fail\n", negative.stdout, negative.stderr);
    process.exit(1);
  }
  if (!/pinned to 40-char SHA/.test(negative.stdout)) {
    console.error("negative run did not report SHA pin failure\n", negative.stdout);
    process.exit(1);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log("verify-gha-security.test.mjs: shipped pass + unpinned fail");

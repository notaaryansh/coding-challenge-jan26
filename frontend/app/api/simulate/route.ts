import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Fires `scripts/simulate.mjs` as a detached background process.
 * The script writes its own progress into `system:init`, which `InitOverlay`
 * polls — so this endpoint just kicks it off and returns immediately.
 *
 * stdout/stderr go to /tmp/simulate.log so silent crashes can be inspected.
 */
export async function POST() {
  try {
    const projectRoot = path.resolve(process.cwd(), "..");
    const scriptPath = path.join(projectRoot, "scripts", "simulate.mjs");
    const logPath = "/tmp/simulate.log";
    const logFd = openSync(logPath, "a");

    const child = spawn("node", [scriptPath], {
      cwd: projectRoot,
      detached: true,
      stdio: ["ignore", logFd, logFd],
      env: process.env,
    });
    child.unref();

    return NextResponse.json({ ok: true, pid: child.pid, log: logPath });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to start simulation" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Fires `scripts/simulate.mjs` as a detached background process.
 * The script writes its own progress into `system:init`, which `InitOverlay`
 * polls — so this endpoint just kicks it off and returns immediately.
 */
export async function POST() {
  try {
    // `pnpm dev` runs from frontend/, so the script lives one level up.
    const projectRoot = path.resolve(process.cwd(), "..");
    const scriptPath = path.join(projectRoot, "scripts", "simulate.mjs");

    const child = spawn("node", [scriptPath], {
      cwd: projectRoot,
      detached: true,
      stdio: "ignore",
      env: process.env,
    });
    child.unref();

    return NextResponse.json({ ok: true, pid: child.pid });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to start simulation" },
      { status: 500 },
    );
  }
}

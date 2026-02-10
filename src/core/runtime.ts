import fs from "fs/promises";
import path from "path";

interface RuntimeState {
  pid: number;
  startedAt: number;
}

const runtimePath = path.resolve(process.cwd(), ".mockpay", "runtime.json");

export async function writeRuntime(pid: number): Promise<void> {
  await fs.mkdir(path.dirname(runtimePath), { recursive: true });
  const state: RuntimeState = { pid, startedAt: Date.now() };
  await fs.writeFile(runtimePath, JSON.stringify(state, null, 2), "utf-8");
}

export async function readRuntime(): Promise<RuntimeState | null> {
  try {
    const content = await fs.readFile(runtimePath, "utf-8");
    return JSON.parse(content) as RuntimeState;
  } catch {
    return null;
  }
}

export async function clearRuntime(): Promise<void> {
  try {
    await fs.unlink(runtimePath);
  } catch {
    // ignore
  }
}

export function isPidRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
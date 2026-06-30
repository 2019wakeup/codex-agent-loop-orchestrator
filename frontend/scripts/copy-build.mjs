import { cp, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDir, "..");
const repoRoot = resolve(frontendRoot, "..");
const source = resolve(frontendRoot, "dist");
const targetName = process.env.CALO_UI_TARGET || "ui";
const target = resolve(repoRoot, "src", "calo", targetName);

await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });

import { rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const env = {
  ...process.env,
  DB_PATH: process.env.DB_PATH || "data/e2e.sqlite",
};

await rm(env.DB_PATH, { force: true });
await rm(`${env.DB_PATH}-shm`, { force: true });
await rm(`${env.DB_PATH}-wal`, { force: true });

execFileSync(process.execPath, ["scripts/migrate.js", "up"], {
  env,
  stdio: "inherit",
});

execFileSync(process.execPath, ["scripts/seed.js"], {
  env,
  stdio: "inherit",
});

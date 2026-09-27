/**
 * Local development PostgreSQL, via `embedded-postgres` — a real Postgres
 * binary run as a plain child process. No Docker or admin rights required
 * in this environment (see docs/DECISIONS.md D011). Production still
 * targets a normal self-hosted PostgreSQL instance on the VPS; this is
 * dev/test tooling only and is never used at runtime by the app itself.
 *
 * Usage:
 *   node scripts/dev-db.mjs start   # idempotent — safe to call repeatedly
 *   node scripts/dev-db.mjs stop
 *   node scripts/dev-db.mjs status
 */
import EmbeddedPostgres from "embedded-postgres";
import path from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", ".data", "pgdata");

export const DEV_DB_CONFIG = {
  host: "127.0.0.1",
  port: 55432,
  user: "servino",
  password: "servino_dev_local_only",
};

export const DEV_DATABASE_NAME = "servino_dev";
export const TEST_DATABASE_NAME = "servino_test";

function makeInstance() {
  return new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: DEV_DB_CONFIG.user,
    password: DEV_DB_CONFIG.password,
    port: DEV_DB_CONFIG.port,
    persistent: true,
  });
}

async function isPortOpen(port, host) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host, timeout: 500 });
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

export function connectionUrl(database) {
  const { host, port, user, password } = DEV_DB_CONFIG;
  return `postgresql://${user}:${password}@${host}:${port}/${database}?schema=public`;
}

async function start() {
  const alreadyRunning = await isPortOpen(DEV_DB_CONFIG.port, DEV_DB_CONFIG.host);
  if (alreadyRunning) {
    console.log(`Postgres already listening on ${DEV_DB_CONFIG.host}:${DEV_DB_CONFIG.port}`);
    return;
  }

  const pg = makeInstance();
  await pg.initialise();
  await pg.start();

  for (const db of [DEV_DATABASE_NAME, TEST_DATABASE_NAME]) {
    try {
      await pg.createDatabase(db);
      console.log(`Created database "${db}"`);
    } catch {
      // Already exists — fine.
    }
  }

  console.log(`Postgres started on ${DEV_DB_CONFIG.host}:${DEV_DB_CONFIG.port}`);
  console.log(`Dev URL:  ${connectionUrl(DEV_DATABASE_NAME)}`);
  console.log(`Test URL: ${connectionUrl(TEST_DATABASE_NAME)}`);
  console.log("This process stays in the foreground — leave it running, or use a detached shell.");

  // Keep process alive since embedded-postgres runs as a child process
  // owned by this script.
  process.stdin.resume();
  process.on("SIGINT", async () => {
    await pg.stop();
    process.exit(0);
  });
}

async function stop() {
  // The embedded-postgres API stops the instance it started, but since
  // `start` runs as its own long-lived process, stopping is done by
  // terminating that process (Ctrl+C / kill). This subcommand is a
  // best-effort fallback using pg_ctl directly against the data dir.
  const pg = makeInstance();
  try {
    await pg.stop();
    console.log("Postgres stopped.");
  } catch (err) {
    console.log("Nothing to stop (or already stopped):", err.message);
  }
}

async function status() {
  const open = await isPortOpen(DEV_DB_CONFIG.port, DEV_DB_CONFIG.host);
  console.log(open ? "Postgres is running." : "Postgres is not running.");
}

const command = process.argv[2];
if (command === "start") await start();
else if (command === "stop") await stop();
else if (command === "status") await status();
else {
  console.error("Usage: node scripts/dev-db.mjs <start|stop|status>");
  process.exit(1);
}

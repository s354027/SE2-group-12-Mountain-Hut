const { execFile, spawn } = require("node:child_process");
const { promisify } = require("node:util");
const { resolve } = require("node:path");

const execFileAsync = promisify(execFile);
const mailpitUrl = "http://127.0.0.1:8025/api/v1/info";
const mailpitImage = "axllent/mailpit:latest";
const startupTimeoutMs = 120_000;

async function isMailpitReady() {
  try {
    const response = await fetch(mailpitUrl, {
      signal: AbortSignal.timeout(2_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForMailpit() {
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    if (await isMailpitReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Mailpit did not become ready at ${mailpitUrl}`);
}

async function startMailpit() {
  try {
    const { stdout } = await execFileAsync("docker", [
      "run",
      "--detach",
      "--rm",
      "--publish",
      "127.0.0.1:1025:1025",
      "--publish",
      "127.0.0.1:8025:8025",
      mailpitImage,
    ]);
    return stdout.trim();
  } catch (error) {
    throw new Error(`Could not start Mailpit with Docker: ${error.message}`);
  }
}

async function runPlaywright() {
  const cliPath = resolve(__dirname, "..", "node_modules", "playwright", "cli.js");
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [cliPath, "test", ...process.argv.slice(2)],
      { stdio: "inherit" },
    );
    child.once("error", reject);
    child.once("close", (code, signal) => {
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}

async function main() {
  let containerId;
  let testExitCode = 1;

  try {
    if (!(await isMailpitReady())) {
      if (process.env.CI) {
        await waitForMailpit();
      } else {
        containerId = await startMailpit();
        await waitForMailpit();
      }
    }

    testExitCode = await runPlaywright();
  } finally {
    if (containerId) {
      try {
        await execFileAsync("docker", ["stop", containerId]);
      } catch (error) {
        throw new Error(`Could not stop the Mailpit container: ${error.message}`);
      }
    }
  }

  process.exitCode = testExitCode;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

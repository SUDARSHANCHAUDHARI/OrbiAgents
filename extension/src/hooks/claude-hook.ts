import * as fs from "fs";
import * as http from "http";
import * as os from "os";
import * as path from "path";

const SERVER_JSON = path.join(os.homedir(), ".orbiagents", "server.json");

interface ServerConfig {
  port: number;
  token: string;
}

async function main(): Promise<void> {
  // Read the hook event payload that Claude Code writes to stdin
  let input = "";
  for await (const chunk of process.stdin) input += chunk;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(input);
  } catch {
    process.exit(0); // Malformed JSON — exit silently
  }

  // Discover the running OrbiAgents server
  let server: ServerConfig;
  try {
    server = JSON.parse(fs.readFileSync(SERVER_JSON, "utf-8")) as ServerConfig;
  } catch {
    process.exit(0); // No server running — exit silently, don't block Claude
  }

  const body = JSON.stringify(data);
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: server.port,
        path: "/api/hooks/claude",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Authorization: `Bearer ${server.token}`,
        },
        timeout: 2000,
      },
      () => resolve(),
    );
    req.on("error", () => resolve());
    req.on("timeout", () => {
      req.destroy();
      resolve();
    });
    req.end(body);
  });
}

main().catch(() => {}).finally(() => process.exit(0));

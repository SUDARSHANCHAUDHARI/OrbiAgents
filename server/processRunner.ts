import { spawn } from "node:child_process";

export interface ProcessRequest {
  command: string;
  args: string[];
  cwd: string;
  stdin?: string;
  signal?: AbortSignal;
  onStdout?: (chunk: string) => void | Promise<void>;
  onStderr?: (chunk: string) => void | Promise<void>;
}

export interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ProcessRunner {
  run(request: ProcessRequest): Promise<ProcessResult>;
}

export class SpawnProcessRunner implements ProcessRunner {
  constructor(private readonly allowedCommands: ReadonlySet<string>) {}

  run(request: ProcessRequest): Promise<ProcessResult> {
    if (!this.allowedCommands.has(request.command)) {
      return Promise.reject(new Error(`Command is not allowlisted: ${request.command}`));
    }
    if (request.signal?.aborted) {
      return Promise.reject(request.signal.reason ?? new Error("Process cancelled"));
    }

    return new Promise((resolve, reject) => {
      const child = spawn(request.command, request.args, {
        cwd: request.cwd,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
        env: process.env,
      });
      let stdout = "";
      let stderr = "";
      let callbackChain = Promise.resolve();
      const abort = () => child.kill("SIGTERM");

      request.signal?.addEventListener("abort", abort, { once: true });
      child.stdout.on("data", (value: Buffer) => {
        const chunk = value.toString("utf8");
        stdout += chunk;
        if (request.onStdout) callbackChain = callbackChain.then(() => request.onStdout!(chunk));
      });
      child.stderr.on("data", (value: Buffer) => {
        const chunk = value.toString("utf8");
        stderr += chunk;
        if (request.onStderr) callbackChain = callbackChain.then(() => request.onStderr!(chunk));
      });
      child.once("error", reject);
      child.once("close", (code) => {
        request.signal?.removeEventListener("abort", abort);
        callbackChain.then(() => {
          if (request.signal?.aborted) {
            reject(request.signal.reason ?? new Error("Process cancelled"));
          } else if (code !== 0) {
            reject(new Error(`${request.command} exited with code ${code}: ${stderr.trim()}`));
          } else {
            resolve({ stdout, stderr, exitCode: code ?? 0 });
          }
        }, reject);
      });
      child.stdin.end(request.stdin ?? "");
    });
  }
}

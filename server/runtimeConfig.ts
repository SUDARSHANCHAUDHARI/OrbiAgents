import path from "node:path";
import { SpawnProcessRunner } from "./processRunner";
import {
  apiRuntime,
  claudeCliDescriptor,
  codexCliDescriptor,
  LocalCliRuntimeAdapter,
  RuntimeAdapter,
} from "./runtimeAdapter";
import { GitCliWorktreeCommandRunner, GitWorktreeIsolation, WorkspaceIsolation } from "./workspaceIsolation";

export type RuntimeId = "provider-api" | "codex-cli" | "claude-cli";

export interface RuntimeExecution {
  runtime: RuntimeAdapter;
  workspaceIsolation?: WorkspaceIsolation;
}

export function availableRuntimeIds(env: NodeJS.ProcessEnv = process.env): RuntimeId[] {
  return env.LOCAL_CLI_ENABLED === "true"
    ? ["provider-api", "codex-cli", "claude-cli"]
    : ["provider-api"];
}

export function createRuntimeExecution(
  runtimeId: RuntimeId = "provider-api",
  env: NodeJS.ProcessEnv = process.env
): RuntimeExecution {
  if (runtimeId === "provider-api") return { runtime: apiRuntime };
  if (!availableRuntimeIds(env).includes(runtimeId)) {
    throw new Error(`Runtime is not enabled: ${runtimeId}`);
  }

  const repoPath = requiredAbsolutePath("LOCAL_CLI_REPO_PATH", env.LOCAL_CLI_REPO_PATH);
  const worktreeRoot = requiredAbsolutePath("LOCAL_CLI_WORKTREE_ROOT", env.LOCAL_CLI_WORKTREE_ROOT);
  const relativeRoot = path.relative(repoPath, worktreeRoot);
  if (relativeRoot === "" || (!relativeRoot.startsWith(`..${path.sep}`) && relativeRoot !== "..")) {
    throw new Error("LOCAL_CLI_WORKTREE_ROOT must be outside LOCAL_CLI_REPO_PATH");
  }
  const runner = new SpawnProcessRunner(new Set(["codex", "claude", "git"]));
  const descriptor = runtimeId === "codex-cli"
    ? codexCliDescriptor(true)
    : claudeCliDescriptor(true);
  return {
    runtime: new LocalCliRuntimeAdapter(descriptor, runner),
    workspaceIsolation: new GitWorktreeIsolation(
      repoPath,
      worktreeRoot,
      new GitCliWorktreeCommandRunner(runner)
    ),
  };
}

function requiredAbsolutePath(name: string, value: string | undefined): string {
  if (!value?.trim()) throw new Error(`${name} is required when local CLI execution is enabled`);
  const resolved = path.resolve(value);
  if (!path.isAbsolute(value) || resolved !== path.normalize(value)) {
    throw new Error(`${name} must be an absolute normalized path`);
  }
  return resolved;
}

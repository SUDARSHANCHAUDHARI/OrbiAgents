import { DEFAULT_PROVIDER, OnChunk, Provider, StreamResult, streamMessage } from "./ai";
import { ProcessRunner } from "./processRunner";

export type RuntimeKind = "api" | "local-cli";

export interface RuntimeRequest {
  systemPrompt: string;
  userMessage: string;
  onChunk: OnChunk;
  provider?: Provider;
  workspacePath?: string;
  signal?: AbortSignal;
}

export interface RuntimeAdapter {
  readonly id: string;
  readonly kind: RuntimeKind;
  isAvailable(): Promise<boolean>;
  execute(request: RuntimeRequest): Promise<StreamResult>;
}

export class ApiRuntimeAdapter implements RuntimeAdapter {
  readonly id = "provider-api";
  readonly kind = "api" as const;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  execute(request: RuntimeRequest): Promise<StreamResult> {
    return streamMessage(
      request.systemPrompt,
      request.userMessage,
      request.onChunk,
      request.provider ?? DEFAULT_PROVIDER,
      request.signal
    );
  }
}

export interface LocalCliDescriptor {
  id: string;
  command: string;
  enabled: boolean;
  args: string[];
}

export class LocalCliRuntimeAdapter implements RuntimeAdapter {
  readonly kind = "local-cli" as const;

  constructor(
    private readonly descriptor: LocalCliDescriptor,
    private readonly runner?: ProcessRunner
  ) {}

  get id(): string {
    return this.descriptor.id;
  }

  async isAvailable(): Promise<boolean> {
    return this.descriptor.enabled && this.runner != null;
  }

  async execute(request: RuntimeRequest): Promise<StreamResult> {
    if (!this.descriptor.enabled || !this.runner) {
      throw new Error(`${this.descriptor.id} local CLI execution is not enabled`);
    }
    if (!request.workspacePath) {
      throw new Error(`${this.descriptor.id} requires an isolated workspace`);
    }
    const prompt = `${request.systemPrompt}\n\n${request.userMessage}`;
    const result = await this.runner.run({
      command: this.descriptor.command,
      args: this.descriptor.args,
      cwd: request.workspacePath,
      stdin: prompt,
      signal: request.signal,
      onStdout: request.onChunk,
    });
    return {
      text: result.stdout,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      costUsd: 0,
      provider: request.provider ?? DEFAULT_PROVIDER,
      model: this.descriptor.id,
    };
  }
}

export function codexCliDescriptor(enabled: boolean): LocalCliDescriptor {
  return {
    id: "codex-cli",
    command: "codex",
    enabled,
    args: ["exec", "-", "--sandbox", "workspace-write", "--ask-for-approval", "never", "--ephemeral", "--color", "never"],
  };
}

export function claudeCliDescriptor(enabled: boolean): LocalCliDescriptor {
  return {
    id: "claude-cli",
    command: "claude",
    enabled,
    args: ["-p", "--output-format", "text", "--permission-mode", "acceptEdits"],
  };
}

export const apiRuntime = new ApiRuntimeAdapter();

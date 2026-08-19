import { DEFAULT_PROVIDER, OnChunk, Provider, StreamResult, streamMessage } from "./ai";

export type RuntimeKind = "api" | "local-cli";

export interface RuntimeRequest {
  systemPrompt: string;
  userMessage: string;
  onChunk: OnChunk;
  provider?: Provider;
  workspacePath?: string;
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
      request.provider ?? DEFAULT_PROVIDER
    );
  }
}

export interface LocalCliDescriptor {
  id: string;
  command: string;
  enabled: boolean;
}

export class LocalCliRuntimeAdapter implements RuntimeAdapter {
  readonly kind = "local-cli" as const;

  constructor(private readonly descriptor: LocalCliDescriptor) {}

  get id(): string {
    return this.descriptor.id;
  }

  async isAvailable(): Promise<boolean> {
    return this.descriptor.enabled;
  }

  async execute(_request: RuntimeRequest): Promise<StreamResult> {
    throw new Error(
      `${this.descriptor.id} local CLI execution is not enabled; configure a secured process runner first`
    );
  }
}

export const apiRuntime = new ApiRuntimeAdapter();

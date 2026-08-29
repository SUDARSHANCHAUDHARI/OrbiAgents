export interface PtyExitEvent {
  exitCode: number;
  signal?: number;
}

export interface PtyProcess {
  readonly pid: number;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
  onData(listener: (data: string) => void): { dispose(): void };
  onExit(listener: (event: PtyExitEvent) => void): { dispose(): void };
}

export interface PtySpawnOptions {
  cwd: string;
  cols: number;
  rows: number;
  env: Record<string, string>;
}

export interface PtyAdapter {
  spawn(command: string, args: string[], options: PtySpawnOptions): PtyProcess;
}

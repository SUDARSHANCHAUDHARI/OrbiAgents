import type { AgentSession } from "../../shared/contracts";

export class AgentRegistry {
  private readonly sessions = new Map<string, AgentSession>();

  constructor(initial: AgentSession[] = [], private readonly onChange: (sessions: AgentSession[]) => void = () => undefined) {
    for (const session of initial) this.sessions.set(session.id, { ...session });
  }

  add(session: AgentSession): AgentSession {
    if (this.sessions.has(session.id)) throw new Error(`Agent ${session.id} already exists`);
    this.sessions.set(session.id, { ...session });
    this.onChange(this.list());
    return this.require(session.id);
  }

  update(id: string, patch: Partial<AgentSession>): AgentSession {
    const current = this.require(id);
    const next = { ...current, ...patch, id: current.id };
    this.sessions.set(id, next);
    this.onChange(this.list());
    return { ...next };
  }

  get(id: string): AgentSession | undefined {
    const session = this.sessions.get(id);
    return session ? { ...session } : undefined;
  }

  require(id: string): AgentSession {
    const session = this.get(id);
    if (!session) throw new Error(`Unknown agent ${id}`);
    return session;
  }

  list(): AgentSession[] {
    return [...this.sessions.values()].map((session) => ({ ...session }));
  }
}

import type { AgentSession } from "../../shared/contracts";

export class AgentRegistry {
  private readonly sessions = new Map<string, AgentSession>();

  constructor(initial: AgentSession[] = [], private readonly onChange: (sessions: AgentSession[]) => void = () => undefined) {
    for (const session of initial) this.sessions.set(session.id, copySession(session));
  }

  add(session: AgentSession): AgentSession {
    if (this.sessions.has(session.id)) throw new Error(`Agent ${session.id} already exists`);
    this.sessions.set(session.id, copySession(session));
    this.onChange(this.list());
    return this.require(session.id);
  }

  update(id: string, patch: Partial<AgentSession>): AgentSession {
    const current = this.require(id);
    const next = copySession({ ...current, ...patch, id: current.id });
    this.sessions.set(id, next);
    this.onChange(this.list());
    return { ...next };
  }

  get(id: string): AgentSession | undefined {
    const session = this.sessions.get(id);
    return session ? copySession(session) : undefined;
  }

  require(id: string): AgentSession {
    const session = this.get(id);
    if (!session) throw new Error(`Unknown agent ${id}`);
    return session;
  }

  list(): AgentSession[] {
    return [...this.sessions.values()].map(copySession);
  }
}

function copySession(session: AgentSession): AgentSession { return { ...session, profile: session.profile ? { ...session.profile, capabilities: [...session.profile.capabilities] } : undefined }; }

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
export type Locale = "en" | "zh-CN" | "ar";
const englishMessages = {
    locale: "Interface language", help: "OrbiAgents uses only the language selected here and never reads the operating-system locale.", subtitle: "Local command deck · authenticated runtime telemetry", active: "active", hire: "Hire agent",
    commandCenter: "Command Center", operate: "Operate", coordinate: "Coordinate", observe: "Observe", system: "System",
    floor: "Floor", terminals: "Terminals", files: "Files", repository: "Repository", tasks: "Tasks", messages: "Messages", approvals: "Approvals", memory: "Memory", skills: "Skills", activity: "Activity", costs: "Costs", recovery: "Recovery", workspaces: "Workspaces", settings: "Settings", updates: "Updates", setup: "Setup",
    hireTitle: "Hire orbital agent", fleetConfiguration: "Fleet configuration", configureSpecialist: "Configure a specialist", profileRetention: "Profiles are validated and retained with the local agent session.", importHire: "Import hire", copyHire: "Copy hire", close: "Close", localGallery: "Local agent gallery", role: "Role",
    generalist: "Generalist", generalistDetail: "Balanced execution", planner: "Planner", plannerDetail: "Break down missions", builder: "Builder", builderDetail: "Implement changes", reviewer: "Reviewer", reviewerDetail: "Audit and verify", researcher: "Researcher", researcherDetail: "Investigate evidence",
    callSign: "Call sign", agentName: "Agent name", runtime: "Runtime", agentRuntime: "Agent runtime", workspace: "Workspace", workspacePath: "Agent workspace path", workspacePlaceholder: "/absolute/path/to/project", timebox: "Timebox", planningTimebox: "Agent planning timebox", minutes30: "30 minutes", hour1: "1 hour", hours2: "2 hours", hours4: "4 hours", missionGoal: "Mission goal", missionGoalLabel: "Agent mission goal", missionGoalPlaceholder: "Describe the outcome this agent owns",
    capabilities: "Capabilities", planning: "planning", coding: "coding", review: "review", research: "research", testing: "testing", signalColor: "Signal color", cyan: "cyan", violet: "violet", green: "green", gold: "gold", rose: "rose", isolatedWorktree: "Isolated worktree", useIsolatedWorktree: "Use isolated worktree", launching: "Launching…", launchAgent: "Launch agent", roleSuffix: "role", capabilitySuffix: "capability", colorSuffix: "signal color",
    hireLinkImported: "Hire link imported. Review it and choose a workspace before launching.", hireLinkCopied: "Hire link copied. Workspace paths and credentials are never included.", profileImported: "Profile imported. Review it and choose a workspace before launching.", profileSelected: "profile selected. Review before launching.",
    commandComposer: "Agent command composer", command: "Command", agentCommand: "Agent command", sendInstruction: "Send an instruction to", selectRunningAgent: "Select a running agent", queue: "Queue", workspaceAttachment: "Workspace file attachment", attachWorkspaceFile: "Attach workspace file…", attach: "Attach", remove: "Remove", queuedEncrypted: "queued · encrypted local resume", sending: "Sending…", sendAll: "Send all", filesCount: "files", retry: "Retry", send: "Send",
    agentRoster: "Agent roster", agentFleet: "Agent fleet", registered: "registered", emptyFleet: "Launch your first agent to populate the command deck.", workspaceSuffix: "workspace", agentActivity: "Agent activity", signalLog: "Signal log", liveTelemetry: "live telemetry", emptySignals: "Runtime signals will appear here.",
} as const;
export type MessageKey = keyof typeof englishMessages;
export type MessageCatalog = Record<MessageKey, string>;
const Context = createContext<{ locale: Locale; setLocale(locale: Locale): void; t(key: MessageKey): string }>({ locale: "en", setLocale: () => undefined, t: (key) => englishMessages[key] });
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => { try { const saved = localStorage.getItem("orbiagents.locale"); return saved === "zh-CN" || saved === "ar" ? saved : "en"; } catch { return "en"; } });
  const [catalog, setCatalog] = useState<MessageCatalog>(englishMessages);
  useEffect(() => {
    document.documentElement.lang = locale; document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    try { localStorage.setItem("orbiagents.locale", locale); } catch { /* optional */ }
    let current = true;
    if (locale === "en") setCatalog(englishMessages);
    else void (locale === "zh-CN" ? import("./locales/zh-CN") : import("./locales/ar")).then((module) => { if (current) setCatalog(module.default); });
    return () => { current = false; };
  }, [locale]);
  const value = useMemo(() => ({ locale, setLocale, t: (key: MessageKey) => catalog[key] }), [catalog, locale]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useI18n() { return useContext(Context); }

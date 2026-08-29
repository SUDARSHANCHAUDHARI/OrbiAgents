import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import type { AgentSession } from "../../../shared/contracts";

export function TerminalPanel({ agent }: { agent: AgentSession | null }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!agent || !hostRef.current) return;
    const terminal = new Terminal({
      cursorBlink: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      screenReaderMode: true,
      convertEol: true,
      fontFamily: "SFMono-Regular, Menlo, Consolas, monospace",
      fontSize: 13,
      theme: { background: "#080d16", foreground: "#dbeafe", cursor: "#67e8f9" },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(hostRef.current);
    fit.fit();
    terminal.write(agent.outputTail);

    const input = terminal.onData((data) => {
      if (agent.status === "running") void window.orbi.agents.write({ id: agent.id, data });
    });
    const removeOutput = window.orbi.agents.onOutput((event) => {
      if (event.id === agent.id) terminal.write(event.data);
    });
    const resize = () => {
      fit.fit();
      if (agent.status === "running") {
        void window.orbi.agents.resize({ id: agent.id, cols: terminal.cols, rows: terminal.rows });
      }
    };
    window.addEventListener("resize", resize);
    resize();

    return () => {
      window.removeEventListener("resize", resize);
      removeOutput();
      input.dispose();
      terminal.dispose();
    };
  }, [agent?.id, agent?.status]);

  if (!agent) return <div className="terminal-empty">Select or launch an agent to open its terminal.</div>;
  return <div className="terminal-host" ref={hostRef} aria-label={`${agent.name} terminal`} />;
}

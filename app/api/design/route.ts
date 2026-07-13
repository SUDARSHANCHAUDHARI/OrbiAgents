import Anthropic from "@anthropic-ai/sdk";
import { guard, safeError, extractText, safeJson } from "../../../lib/apiGuard";
import { NextRequest, NextResponse } from "next/server";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
export async function POST(req: NextRequest) {
  const _guard = guard(req);
  if (_guard) return _guard;
  const { goal, constraints, agentCount, framework } = await req.json();
  if (!goal?.trim()) return NextResponse.json({ error: "Goal required" }, { status: 400 });
  const prompt = `You are a multi-agent system architect. Design an optimal agent network for this goal.
Goal: ${goal} | Agent count: ${agentCount || "AI decides"} | Framework: ${framework || "Any"} | Constraints: ${constraints || "None"}
Return JSON: { "systemName": "string", "agents": [{ "name": "string", "role": "string", "responsibilities": ["string"], "tools": ["string"], "inputFrom": ["string"], "outputTo": ["string"], "model": "string" }], "orchestrator": "string", "workflow": [{ "step": number, "agent": "string", "action": "string", "output": "string" }], "communicationPattern": "string", "failureModes": ["string"], "successCriteria": ["string"], "implementationCode": "string", "estimatedCost": "string", "summary": "string" }
Return ONLY valid JSON.`;
  try {
    const msg = await client.messages.create({ model: "claude-sonnet-4-6", max_tokens: 2000, messages: [{ role: "user", content: prompt }] });
    return NextResponse.json(safeJson(extractText(msg)));
  } catch (e) { return safeError(e); }
}

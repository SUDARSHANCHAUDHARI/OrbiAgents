"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, signup, setToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const fn = mode === "login" ? login : signup;
      const { token } = await fn(email.trim(), password);
      setToken(token);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0d0907",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "monospace",
    }}>
      {/* Scanline overlay */}
      <div className="px-scanlines" style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />

      <div style={{ width: 340, position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 32, height: 32,
            background: "#7C3AED",
            border: "2px solid #A78BFA",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: "bold", color: "#EDE9FE",
            imageRendering: "pixelated",
            boxShadow: "0 0 12px #7C3AED88",
          }}>O</div>
          <div>
            <div style={{ color: "#E9D5FF", fontSize: 12, letterSpacing: "0.1em" }}>ORBIAGENTS</div>
            <div style={{ color: "#7C3AED", fontSize: 7, letterSpacing: "0.3em" }}>WORKSPACE</div>
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: "#1a1208",
          border: "2px solid #3D2409",
          padding: "24px 20px",
          boxShadow: "0 0 0 1px #1C1208, 0 8px 32px rgba(0,0,0,0.8)",
        }}>
          <div style={{ color: "#E9D5FF", fontSize: 11, letterSpacing: "0.05em", marginBottom: 4 }}>
            {mode === "login" ? "WELCOME BACK" : "CREATE ACCOUNT"}
          </div>
          <div style={{ color: "#7A5230", fontSize: 8, marginBottom: 20, letterSpacing: "0.05em" }}>
            {mode === "login" ? "Sign in to your OrbiAgents workspace" : "Start building AI agent workflows"}
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div className="px-label" style={{ marginBottom: 4 }}>EMAIL</div>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoFocus placeholder="you@example.com"
                className="px-input" style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <div className="px-label" style={{ marginBottom: 4 }}>PASSWORD</div>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                required minLength={8}
                placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
                className="px-input" style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>

            {error && <div style={{ color: "#F87171", fontSize: 8 }}>{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="px-btn px-btn-primary"
              style={{ width: "100%", padding: "10px", fontSize: 9, letterSpacing: "0.15em" }}
            >
              {loading ? "PLEASE WAIT..." : mode === "login" ? "▶ SIGN IN" : "▶ CREATE ACCOUNT"}
            </button>
          </form>

          <div style={{ marginTop: 16, textAlign: "center" }}>
            <button
              onClick={() => { setMode(m => m === "login" ? "signup" : "login"); setError(null); }}
              style={{ background: "none", border: "none", color: "#7A5230", fontSize: 8, cursor: "pointer", letterSpacing: "0.05em" }}
            >
              {mode === "login" ? "NO ACCOUNT? SIGN UP" : "ALREADY HAVE AN ACCOUNT? SIGN IN"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

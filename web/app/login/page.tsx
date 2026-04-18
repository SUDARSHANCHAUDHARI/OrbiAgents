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
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(37,99,235,0.14), transparent 26%), linear-gradient(180deg, #0B0F14 0%, #0F172A 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "linear-gradient(180deg, rgba(0,0,0,0.8), rgba(0,0,0,0.25))",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          width: 420,
          maxWidth: "calc(100vw - 32px)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              background: "#111827",
              border: "1px solid #374151",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#E5E7EB",
              fontSize: 18,
              fontWeight: 700,
              boxShadow: "0 10px 24px rgba(0,0,0,0.24)",
            }}
          >
            O
          </div>
          <div>
            <div style={{ color: "#E5E7EB", fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}>
              OrbiAgents
            </div>
            <div
              style={{
                color: "#9CA3AF",
                fontSize: 12,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Workspace
            </div>
          </div>
        </div>

        <div
          style={{
            background: "rgba(15,23,42,0.94)",
            border: "1px solid #374151",
            borderRadius: 20,
            padding: 24,
            boxShadow: "0 24px 60px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.04)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: "#E5E7EB", fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>
              {mode === "login" ? "Welcome back" : "Create your workspace"}
            </div>
            <div style={{ color: "#9CA3AF", fontSize: 14, lineHeight: 1.6, marginTop: 8 }}>
              {mode === "login"
                ? "Sign in to your OrbiAgents dashboard and continue managing your agent office."
                : "Start building a clean AI agent workspace with replay, workflows, and live observability."}
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ color: "#E5E7EB", fontSize: 14, fontWeight: 500 }}>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="you@example.com"
                className="orbi-input"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  minHeight: 44,
                  background: "#1F2937",
                  border: "1px solid #374151",
                  borderRadius: 10,
                  padding: "0 16px",
                  color: "#E5E7EB",
                  fontSize: 16,
                }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ color: "#E5E7EB", fontSize: 14, fontWeight: 500 }}>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
                className="orbi-input"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  minHeight: 44,
                  background: "#1F2937",
                  border: "1px solid #374151",
                  borderRadius: 10,
                  padding: "0 16px",
                  color: "#E5E7EB",
                  fontSize: 16,
                }}
              />
            </label>

            {error && (
              <div
                style={{
                  color: "#FECACA",
                  fontSize: 14,
                  background: "rgba(127,29,29,0.65)",
                  border: "1px solid #EF4444",
                  borderRadius: 10,
                  padding: "10px 12px",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="orbi-control"
              style={{
                width: "100%",
                minHeight: 44,
                background: "#2563EB",
                border: "1px solid #1D4ED8",
                borderRadius: 10,
                color: "#F8FAFC",
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 14px 28px rgba(37,99,235,0.24)",
              }}
            >
              {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div style={{ marginTop: 18, textAlign: "center" }}>
            <button
              onClick={() => {
                setMode((current) => (current === "login" ? "signup" : "login"));
                setError(null);
              }}
              style={{
                background: "none",
                border: "none",
                color: "#9CA3AF",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {mode === "login" ? "No account? Create one" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

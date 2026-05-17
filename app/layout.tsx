import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "OrbiAgents", description: "Design multi-agent systems with AI" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="bg-[#0a0a0f] antialiased">{children}</body></html>;
}

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const el = document.getElementById("root");
if (!el) throw new Error("OrbiAgents: #root element not found in webview HTML");
const root = createRoot(el);
root.render(<App />);

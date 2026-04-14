/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: {
        // Agent floats gently when active
        "orbi-float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":       { transform: "translateY(-5px)" },
        },
        // Slow premium glow wave (replaces the harsh animate-pulse)
        "orbi-glow": {
          "0%, 100%": { opacity: "0.55", filter: "brightness(1)" },
          "50%":       { opacity: "1",    filter: "brightness(1.3)" },
        },
        // Status dot ripple
        "orbi-ping": {
          "0%":        { transform: "scale(1)",   opacity: "0.8" },
          "70%, 100%": { transform: "scale(2.2)", opacity: "0" },
        },
        // Workflow arrow flow (dashed offset animation)
        "orbi-flow": {
          "0%":   { strokeDashoffset: "40" },
          "100%": { strokeDashoffset: "0" },
        },
        // State badge slide-in
        "orbi-slide-up": {
          "0%":   { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Ambient floor particle drift
        "orbi-drift": {
          "0%":   { transform: "translate(0, 0) scale(1)",   opacity: "0.2" },
          "50%":  { transform: "translate(8px, -12px) scale(1.2)", opacity: "0.5" },
          "100%": { transform: "translate(0, 0) scale(1)",   opacity: "0.2" },
        },
        // Shimmer on cards
        "orbi-shimmer": {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "orbi-float":    "orbi-float 3s ease-in-out infinite",
        "orbi-glow":     "orbi-glow 2s ease-in-out infinite",
        "orbi-ping":     "orbi-ping 1.4s cubic-bezier(0,0,0.2,1) infinite",
        "orbi-flow":     "orbi-flow 1s linear infinite",
        "orbi-slide-up": "orbi-slide-up 0.2s ease-out both",
        "orbi-drift":    "orbi-drift 6s ease-in-out infinite",
        "orbi-shimmer":  "orbi-shimmer 2.5s linear infinite",
      },
    },
  },
  plugins: [],
};

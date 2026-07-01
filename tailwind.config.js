/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        panel: "#0b0f14",
        surface: "#11161d",
        border: "#1f2833",
        accent: "#22d3ee",
        danger: "#f87171",
        warn: "#facc15",
        ok: "#4ade80",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Hyperliquid brand palette
        panel:   "#080B11",   // main background
        surface: "#0D1117",   // card background
        surface2:"#131A22",   // elevated surface / input bg
        border:  "#1C2533",   // subtle border
        accent:  "#00D4AA",   // HL teal-green
        danger:  "#FF4560",   // error red
        warn:    "#F7A600",   // warning amber
        ok:      "#00D4AA",   // positive (same as accent)
        muted:   "#4A5568",   // muted labels
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'DM Sans'", "sans-serif"],
        mono: ["'DM Mono'", "monospace"],
        display: ["'Syne'", "sans-serif"],
      },
      colors: {
        bg:      "#0a0a0f",
        surface: "#12121a",
        card:    "#1a1a26",
        border:  "#2a2a3d",
        accent:  "#7c6fff",
        accent2: "#ff6f91",
        text:    "#e8e8f0",
        muted:   "#7070a0",
        success: "#4ade80",
        warn:    "#facc15",
        danger:  "#f87171",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-up":   "slideUp 0.3s ease-out",
        "fade-in":    "fadeIn 0.4s ease-out",
      },
      keyframes: {
        slideUp: {
          "0%":   { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)",   opacity: "1" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

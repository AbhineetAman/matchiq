/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#060912",
          900: "#0A0E1A",
          800: "#131929",
          700: "#1C2438",
          600: "#27314A",
          500: "#3A4663",
        },
        gold: "#FFD700",
        pitch: "#00FF87",
        danger: "#FF4D6D",
        amber: "#FFB020",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      keyframes: {
        livepulse: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.8)" },
        },
      },
      animation: {
        livepulse: "livepulse 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

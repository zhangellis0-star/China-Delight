import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        china: {
          red: "#b91c1c",
          deep: "#7f1d1d",
          gold: "#f6c453",
          ink: "#1f1712",
          paper: "#fffaf0"
        }
      },
      boxShadow: {
        warm: "0 18px 50px rgba(80, 24, 17, 0.14)"
      }
    }
  },
  plugins: []
};

export default config;

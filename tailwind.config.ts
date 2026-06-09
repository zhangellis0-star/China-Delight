import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        china: {
          red: "#c92f4b",
          deep: "#7a1d20",
          gold: "#f5b642",
          orange: "#ef7d24",
          aqua: "#dff4f2",
          green: "#7ba85b",
          ink: "#211714",
          paper: "#f4fbfb"
        }
      },
      boxShadow: {
        warm: "0 18px 50px rgba(122, 29, 32, 0.16)"
      }
    }
  },
  plugins: []
};

export default config;

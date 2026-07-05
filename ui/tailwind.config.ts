import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#0D1117",
        card:    "#161B22",
        border:  "#30363D",
        accent:  "#58A6FF",
        risk: { low:"#3FB950", medium:"#F0883E", high:"#FF4545", critical:"#FF1744" },
      },
      fontFamily: { sans: ["Inter","system-ui","sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;

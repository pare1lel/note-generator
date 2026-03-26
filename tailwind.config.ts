import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0f0f0f",
        surface: "#1a1a1a",
        "surface-light": "#262626",
        border: "#333333",
        primary: "#e5e5e5",
        secondary: "#a3a3a3",
        "accent-gold": "#d4a574",
        "accent-teal": "#5eead4",
        "accent-rose": "#f472b6",
      },
      fontFamily: {
        serif: ["Crimson Pro", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;

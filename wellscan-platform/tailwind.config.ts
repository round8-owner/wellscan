import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Pretendard", "Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f4f7ee",
          100: "#e8efdb",
          500: "#8aab4d",
          600: "#718f3c",
          700: "#526b2b",
          900: "#1e2717",
        },
      },
      boxShadow: {
        soft: "0 8px 28px rgba(20, 25, 16, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;

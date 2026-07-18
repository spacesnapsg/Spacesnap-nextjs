import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0e14",
        card: "#151a23",
        border: "#1f2937",
        "body-text": "#e5e7eb",
        "muted-text": "#9ca3af",
        "hint-text": "#6b7280",
        "user-teal-start": "#1a9d96",
        "user-teal-end": "#4db8b0",
        "supplier-purple-start": "#9333ea",
        "supplier-purple-end": "#6b21a8",
        "admin-red-start": "#ef4444",
        "admin-orange-end": "#f97316",
        "success-green": "#22c55e",
        "error-red": "#ef4444",
        amber: "#f59e0b",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "12px",
        card: "16px",
      },
    },
  },
  plugins: [],
} satisfies Config;

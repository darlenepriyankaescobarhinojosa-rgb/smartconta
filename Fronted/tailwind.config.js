/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F172A",
        panel: "#F8FAFC",
        muted: "#64748B",
        brand: "#2563EB",
        cyan: "#DBEAFE",
        blush: "#E0F2FE",
        peach: "#F1F5F9",
        cream: "#FFFFFF",
        butter: "#F59E0B",
        mint: "#16A34A",
        danger: "#DC2626",
        pending: "#7C3AED",
        info: "#0284C7",
      },
    },
  },
  plugins: [],
}

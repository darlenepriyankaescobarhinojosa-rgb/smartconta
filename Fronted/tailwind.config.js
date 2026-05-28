/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1D1D1D",
        panel: "#EEF3EF",
        muted: "#6E756E",
        brand: "#D8F36B",
        cyan: "#CFEF8A",
        blush: "#DDE8DE",
        peach: "#F4F7F4",
        cream: "#FFFFFF",
        butter: "#D8F36B",
        mint: "#CFEF8A",
      },
    },
  },
  plugins: [],
}

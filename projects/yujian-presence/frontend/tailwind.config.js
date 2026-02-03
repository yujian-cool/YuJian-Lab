/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#00ff99",
        bg: "#0a0a0b",
        surface: "#161618",
        text: "#e1e1e6",
        secondary: "#888",
      }
    },
  },
  plugins: [],
}

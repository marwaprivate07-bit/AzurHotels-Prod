/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        navy: "#1E3A8A",
        "navy-light": "#2563EB",
      },
    },
  },
  plugins: [],
};

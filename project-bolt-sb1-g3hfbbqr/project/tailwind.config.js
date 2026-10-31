/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bjk: {
          black: "#0a0a0a",
          darker: "#050505",
          dark: "#121212",
          gray: "#1a1a1a",
          white: "#ffffff",
          offwhite: "#f5f5f5",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Oswald", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

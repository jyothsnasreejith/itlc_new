/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#127cf6",
        "background-light": "#f5f7f8",
        "background-dark": "#101822"
      },
      fontFamily: {
        display: ["Be Vietnam Pro", "sans-serif"]
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px"
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms')
  ]
}

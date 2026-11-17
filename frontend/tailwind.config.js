/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ocean: {
          900: '#060d17',
          800: '#0b192c',
          700: '#142a45',
          600: '#1e3e62',
        },
        oil: {
          cyan: '#00f2fe',
          teal: '#4facfe',
          neon: '#00ffff',
        }
      }
    },
  },
  plugins: [],
};


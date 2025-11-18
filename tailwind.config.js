/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#22A0A0',
        'primary-dark': '#1a7d7d',
        'primary-light': '#2bb8b8',
        dark: '#333333',
        'dark-light': '#4a4a4a',
      },
    },
  },
  plugins: [],
};

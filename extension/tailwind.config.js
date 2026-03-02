/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx,html}', './public/**/*.html'],
  theme: {
    extend: {
      colors: {
        'x-blue': '#1d9bf0',
        'x-dark': '#15202b',
        'x-darker': '#0d1117',
        'x-gray': '#71767b',
        'x-border': '#2f3336',
        'x-hover': '#1e2732',
      },
    },
  },
  plugins: [],
};

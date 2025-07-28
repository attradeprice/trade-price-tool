/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#135364',
          hover: '#0f4250', // A slightly darker shade for hover effects
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

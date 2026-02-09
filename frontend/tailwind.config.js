/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pichincha: {
          yellow: '#FFD100',
          dark: '#1A1A1A',
          blue: '#003087',
          lightBlue: '#0066CC',
          gray: '#F5F5F5',
        },
        deuna: {
          primary: '#6366F1',
          secondary: '#8B5CF6',
          accent: '#EC4899',
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

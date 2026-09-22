/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sla: {
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
          surface: '#0f172a',
          card: '#1e293b',
        },
      },
    },
  },
  plugins: [],
}

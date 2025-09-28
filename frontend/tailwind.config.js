/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        slateglass: 'rgba(15,23,42,0.65)',
        accent: '#36bffa',
        accentSoft: '#22d3ee',
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'studio-gradient':
          'radial-gradient(circle at 20% 20%, rgba(56,189,248,0.18), transparent 55%), radial-gradient(circle at 80% 10%, rgba(139,92,246,0.18), transparent 45%), linear-gradient(135deg, #0f172a, #111827)',
      },
    },
  },
  plugins: [],
}

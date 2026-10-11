/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pharmacy: {
          primary: '#1FA47A',
          primaryDark: '#15906B',
          deep: '#0D2420',
          mint: '#E5F5EF',
          softMint: '#E9F8F1',
          background: '#F7F7F5',
          surface: '#FFFFFF',
          ink: '#0D2420',
          muted: '#7A817E',
          border: '#ECECE8',
          warning: '#E35B2D',
          danger: '#C64536',
          softWarning: '#FDE5D8',
          softDanger: '#FCE8E2',
          peach: '#FCE4D7',
          aqua: '#CFF2E7',
        },
      },
      fontFamily: {
        sans: [
          'Cairo',
          'Tajawal',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

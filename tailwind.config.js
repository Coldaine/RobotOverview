/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Engineering HUD palette — deep slate with instrument accents.
        void: '#05070d',
        hull: '#0a0e17',
        panel: '#10151f',
        'panel-2': '#161c29',
        rim: '#1f2937',
        grid: '#11202e',
        ink: '#c7d3e3',
        'ink-dim': '#7f8ea7',
        amber: {
          DEFAULT: '#ffb020',
          soft: '#ffc658',
          deep: '#b06f00',
        },
        cyan: {
          DEFAULT: '#36e0e0',
          soft: '#7af2f2',
          deep: '#0c8c8c',
        },
        signal: {
          ok: '#34d399',
          warn: '#fbbf24',
          crit: '#fb5b5b',
          idle: '#566073',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        display: ['"Orbitron"', '"Rajdhani"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'hud': '0 0 0 1px rgba(54,224,224,0.08), 0 18px 50px -20px rgba(0,0,0,0.9)',
        'hud-amber': '0 0 0 1px rgba(255,176,32,0.18), 0 0 28px -6px rgba(255,176,32,0.35)',
        'hud-cyan': '0 0 0 1px rgba(54,224,224,0.22), 0 0 30px -6px rgba(54,224,224,0.35)',
        'inset-rim': 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 0 0 1px rgba(255,255,255,0.02)',
      },
      backgroundImage: {
        'blueprint': 'linear-gradient(rgba(54,224,224,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(54,224,224,0.05) 1px, transparent 1px)',
        'radial-glow': 'radial-gradient(circle at 50% 0%, rgba(54,224,224,0.10), transparent 60%)',
        'panel-sheen': 'linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0) 40%)',
      },
      backgroundSize: {
        'grid-sm': '22px 22px',
        'grid-lg': '88px 88px',
      },
      keyframes: {
        'pulse-trace': {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '1' },
        },
        'dash': {
          to: { strokeDashoffset: '-24' },
        },
        'scan': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'flicker': {
          '0%, 100%': { opacity: '1' },
          '92%': { opacity: '1' },
          '94%': { opacity: '0.6' },
          '96%': { opacity: '1' },
        },
        'rise': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'sweep': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'pulse-trace': 'pulse-trace 2.4s ease-in-out infinite',
        'dash': 'dash 1s linear infinite',
        'scan': 'scan 7s linear infinite',
        'flicker': 'flicker 6s linear infinite',
        'rise': 'rise 0.5s cubic-bezier(0.16,1,0.3,1) both',
        'sweep': 'sweep 4s linear infinite',
      },
    },
  },
  plugins: [],
};

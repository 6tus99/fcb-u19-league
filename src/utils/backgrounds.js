// Aquatic app background — layered water: soft sunlight, a glow of light
// through the surface, gentle waves, and a navy-to-aqua depth gradient.
// Light mode = sunlit lagoon; dark mode = deep sea at night.

const wave = (a, b) =>
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320' preserveAspectRatio='none'%3E%3Cpath fill='rgba(255,255,255," +
  a +
  ")' d='M0,200 C240,158 480,242 720,200 C960,158 1200,242 1440,200 V320 H0 Z'/%3E%3Cpath fill='rgba(255,255,255," +
  b +
  ")' d='M0,252 C240,216 480,288 720,252 C960,216 1200,288 1440,252 V320 H0 Z'/%3E%3C/svg%3E";

export const AQUATIC_LIGHT = [
  // sunlight falling through the surface
  'radial-gradient(90% 50% at 75% -5%, rgba(147,197,253,0.22) 0%, rgba(147,197,253,0) 60%)',
  // a patch of light rays on the left
  'radial-gradient(55% 35% at 12% 10%, rgba(96,165,250,0.14) 0%, rgba(96,165,250,0) 55%)',
  // gentle waves
  `url("${wave('0.10', '0.06')}")`,
  // deeper navy depths, calmer aqua at the bottom
  'linear-gradient(180deg, #0e2a5e 0%, #164a86 38%, #2a6396 68%, #4580a8 88%, #6ea3bd 100%)',
].join(', ');

export const AQUATIC_DARK = [
  // moonlight on the surface
  'radial-gradient(80% 45% at 70% -5%, rgba(56,130,190,0.25) 0%, rgba(56,130,190,0) 60%)',
  // faint teal shimmer
  'radial-gradient(50% 30% at 18% 14%, rgba(45,212,191,0.10) 0%, rgba(45,212,191,0) 55%)',
  // quiet waves
  `url("${wave('0.055', '0.04')}")`,
  // deep sea at night
  'linear-gradient(180deg, #050d24 0%, #0a1c3f 40%, #10315c 70%, #17496f 90%, #1d5b7d 100%)',
].join(', ');

export const AQUATIC_BASE = {
  light: '#0e2a5e',
  dark: '#050d24',
};

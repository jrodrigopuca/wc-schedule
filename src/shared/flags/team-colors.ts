// Per-team primary colors used by the featured-card derby halo and the
// matchcard halo. Picked-one-primary policy: many national flags carry
// multiple equally-valid primary colors (France blue/white/red, Italy
// green/white/red, Germany black/red/gold). We commit to ONE color per team
// for visual cohesion in the derby tableau. Choices are best-effort and
// can be refined per-team without touching consumers.
//
// ISO codes without an explicit entry fall back to FALLBACK_GLOW (brand
// accent) so the surface stays cohesive regardless.

// Brand accent in light mode (matches --accent token, design.md §13/§14).
export const FALLBACK_GLOW = '#16A34A'

export const TEAM_COLORS: Readonly<Record<string, string>> = {
  ar: '#6CB4EE', // Argentina — celeste
  au: '#FFCD00', // Australia — oro (Socceroos)
  be: '#ED2939', // Bélgica — rojo (Diables Rouges)
  br: '#FFDF00', // Brasil — amarillo
  ca: '#FF0000', // Canadá — rojo
  cd: '#007FFF', // RD Congo — azul
  ch: '#DA291C', // Suiza — rojo
  ci: '#FF8200', // Costa de Marfil — naranja (Les Éléphants)
  cl: '#D52B1E', // Chile — rojo (La Roja)
  cm: '#007A5E', // Camerún — verde (Indomitable Lions)
  cn: '#DE2910', // China — rojo
  co: '#FCD116', // Colombia — amarillo
  cr: '#CE1126', // Costa Rica — rojo (Los Ticos)
  cv: '#003893', // Cabo Verde — azul
  cz: '#11457E', // República Checa — azul
  de: '#DD0000', // Alemania — rojo (franja central de la bandera)
  dk: '#C60C30', // Dinamarca — rojo (Dannebrog)
  dz: '#006233', // Argelia — verde (Les Fennecs)
  ec: '#FFD100', // Ecuador — amarillo (La Tri)
  eg: '#C8102E', // Egipto — rojo (Pharaohs)
  es: '#C60B1E', // España — rojo (La Roja)
  fr: '#002395', // Francia — azul (Les Bleus)
  'gb-eng': '#DC143C', // Inglaterra — rojo (cruz de San Jorge)
  'gb-sct': '#0065BD', // Escocia — azul (Tartan Army)
  'gb-wls': '#C8102E', // Gales — rojo
  gh: '#FCD116', // Ghana — amarillo (Black Stars — pero amarillo es lo más visible)
  hn: '#0073CF', // Honduras — azul
  hr: '#DC143C', // Croacia — rojo (Vatreni)
  iq: '#CE1126', // Irak — rojo
  ir: '#239F40', // Irán — verde
  it: '#0066CC', // Italia — azul (Azzurri)
  jm: '#009B3A', // Jamaica — verde (Reggae Boyz)
  jo: '#CE1126', // Jordania — rojo (triángulo de la bandera)
  jp: '#BC002D', // Japón — rojo
  kr: '#C8102E', // Corea del Sur — rojo (Red Devils)
  ma: '#C1272D', // Marruecos — rojo
  mx: '#006847', // México — verde
  ng: '#008753', // Nigeria — verde (Super Eagles)
  nl: '#FF6600', // Países Bajos — naranja (Oranje)
  no: '#BA0C2F', // Noruega — rojo
  nz: '#00247D', // Nueva Zelanda — azul (kit blanco, halo desde bandera)
  pa: '#DA121A', // Panamá — rojo
  pl: '#DC143C', // Polonia — rojo
  pt: '#006233', // Portugal — verde (Seleção)
  py: '#D52B1E', // Paraguay — rojo (La Albirroja)
  qa: '#8B1538', // Catar — granate
  rs: '#C6363C', // Serbia — rojo
  sa: '#006C35', // Arabia Saudita — verde (Green Falcons)
  sn: '#00853F', // Senegal — verde (Lions of Teranga)
  tn: '#C8102E', // Túnez — rojo
  tr: '#E30A17', // Turquía — rojo
  us: '#BD2031', // Estados Unidos — rojo
  uy: '#4B91CD', // Uruguay — celeste (La Celeste, más oscuro que el argentino)
  uz: '#1EB53A', // Uzbekistán — verde
  ve: '#7C2333', // Venezuela — vinotinto (La Vinotinto)
  ye: '#DC143C', // Yemen — rojo
  za: '#007749', // Sudáfrica — verde (Bafana Bafana)
}

export function resolveGlow(iso: string): string {
  return TEAM_COLORS[iso.toLowerCase()] ?? FALLBACK_GLOW
}

// Per-team primary colors used by the featured-card derby halo.
//
// Picked-one-primary policy: many national flags carry multiple equally-valid
// primary colors (France blue/white/red, Germany black/red/gold, Italy
// green/white/red). We commit to ONE color per team for visual cohesion in
// the derby tableau and accept that the choice may read as off-brand for
// ambiguous cases. ISO codes without an explicit entry fall back to the
// brand accent (FALLBACK_GLOW) so the surface stays cohesive regardless.
//
// TODO: confirm primary color for the following ISOs (flag present, no entry):
//   au, be, ci, cl, co, cr, cv, cz, cd, cn, dk, dz, ec, eg, es, gb-eng,
//   gb-sct, gb-wls, gh, hn, hr, iq, ir, it, jm, jo, kr, ng, nl, no, nz, pa,
//   pl, pt, py, qa, rs, sa, sn, tn, tr, uy, uz, ve, ye, za
// Designer pass should fill these in; in the meantime they pick up
// FALLBACK_GLOW at runtime via resolveGlow().

// Brand accent in light mode (matches --accent token, design.md §13/§14).
// Used whenever an ISO has no explicit primary in the table below.
export const FALLBACK_GLOW = '#16A34A'

export const TEAM_COLORS: Readonly<Record<string, string>> = {
  ar: '#6CB4EE', // Argentina — celeste
  br: '#FFDF00', // Brasil — amarillo
  ca: '#FF0000', // Canadá — rojo
  cm: '#007A5E', // Camerún — verde
  fr: '#002395', // Francia — azul
  jp: '#BC002D', // Japón — rojo
  ma: '#C1272D', // Marruecos — rojo
  mx: '#006847', // México — verde
  ch: '#DA291C', // Suiza — rojo
  us: '#BD2031', // Estados Unidos — rojo
}

export function resolveGlow(iso: string): string {
  return TEAM_COLORS[iso.toLowerCase()] ?? FALLBACK_GLOW
}

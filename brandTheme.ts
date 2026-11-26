/**
 * Brand theming — one source of truth for the visual separation of the two companies.
 *
 * Why: the panel, the monitor and the analytics all mixed UNITEC (sky/teal, Medellín,
 * COP) with BUILDING INNOVATION (emerald, Doral FL, USD) in the same neutral grey UI,
 * so an operator reading "Alertas" could not tell which company they were looking at.
 * Every surface that shows brand data must read its colour and label from here.
 */

export type BrandId = 'unitec' | 'building';

export interface BrandTheme {
  id: BrandId;
  label: string;          // full legal-ish name
  short: string;          // chip label
  country: string;        // operating market, shown next to the name
  language: 'es' | 'en';
  currency: 'COP' | 'USD';
  accent: string;         // primary hex
  accentDark: string;
  accentSoft: string;     // soft background hex
  accentText: string;     // hex for text on soft bg
  gradient: string;       // tailwind gradient classes for hero bands
  chip: string;           // tailwind classes for small chips
  ring: string;           // tailwind ring/border accent
  dot: string;            // tailwind dot
}

export const BRAND_THEME: Record<BrandId, BrandTheme> = {
  unitec: {
    id: 'unitec',
    label: 'UNITEC USA DESIGN',
    short: 'UNITEC',
    country: 'Colombia / Florida',
    language: 'es',
    currency: 'COP',
    accent: '#0c4a6e',
    accentDark: '#082f49',
    accentSoft: '#e0f2fe',
    accentText: '#075985',
    gradient: 'from-sky-900 via-sky-800 to-cyan-700',
    chip: 'bg-sky-100 text-sky-800 border-sky-200',
    ring: 'ring-sky-500/30 border-sky-300',
    dot: 'bg-sky-500',
  },
  building: {
    id: 'building',
    label: 'BUILDING INNOVATION',
    short: 'BUILDING INNOVATION',
    country: 'Doral, Miami, FL',
    language: 'en',
    currency: 'USD',
    accent: '#065f46',
    accentDark: '#043d2e',
    accentSoft: '#d1fae5',
    accentText: '#047857',
    gradient: 'from-emerald-900 via-emerald-800 to-teal-700',
    chip: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    ring: 'ring-emerald-500/30 border-emerald-300',
    dot: 'bg-emerald-500',
  },
};

export const themeFor = (brand?: string | null): BrandTheme =>
  BRAND_THEME[brand === 'building' ? 'building' : 'unitec'];

/** Session rows are brand-tagged by /api/_record-chat-turn.js. Legacy rows have no tag and are UNITEC. */
export const sessionBrand = (s: any): BrandId =>
  (s?.brandId === 'building' ? 'building' : 'unitec');

export const filterByBrand = <T extends { brandId?: string }>(rows: T[], brand: BrandId): T[] =>
  rows.filter((r) => sessionBrand(r) === brand);

import { alertAnomaly } from './anomaly-alert.js';

const WEBSITE = 'https://www.unitecusadesign.com/';
const EMBED = 'https://unitec-front-desk.vercel.app/?embed=true&brandId=unitec';
const EMBED_MARK = 'unitec-front-desk.vercel.app?embed=true&brandId=unitec';

async function fetchText(url, timeout = 15000) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'UniTEC-widget-watch' },
    signal: AbortSignal.timeout(timeout),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text, headers: res.headers };
}

export async function checkWidget() {
  const checks = {
    websiteUp: false,
    embedSnippet: false,
    embedLoads: false,
    embedFrameable: false,
  };
  const problems = [];

  try {
    const home = await fetchText(WEBSITE);
    checks.websiteUp = home.ok;
    if (!home.ok) problems.push(`sitio ${home.status}`);
    else {
      const srcs = [...home.text.matchAll(/src="(\/_next\/static\/chunks\/[^"]+)"/g)].map((m) => m[1]).slice(0, 20);
      const found = await Promise.all(srcs.map(async (src) => {
        try {
          const chunk = await fetchText(new URL(src, WEBSITE).href, 8000);
          return chunk.text.includes(EMBED_MARK);
        } catch {
          return false;
        }
      }));
      checks.embedSnippet = found.some(Boolean);
      if (!checks.embedSnippet) problems.push('el sitio ya no incluye el widget');
    }
  } catch (e) {
    problems.push(`sitio no responde: ${e.message}`);
  }

  try {
    const embed = await fetchText(EMBED);
    checks.embedLoads = embed.ok;
    const frame = (embed.headers.get('x-frame-options') || '').toLowerCase();
    checks.embedFrameable = embed.ok && frame !== 'deny' && frame !== 'sameorigin';
    if (!checks.embedLoads) problems.push(`iframe ${embed.status}`);
    if (!checks.embedFrameable) problems.push('el iframe está bloqueado');
  } catch (e) {
    problems.push(`iframe no responde: ${e.message}`);
  }

  const ok = problems.length === 0;
  return { ok, website: 'unitecusadesign.com', embedHost: 'unitec-front-desk.vercel.app', checks, problems };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const report = await checkWidget();
  if (!report.ok) {
    await alertAnomaly('WIDGET_WEB', report.problems.join('; ')).catch(() => {});
  }
  return res.status(200).json(report);
}

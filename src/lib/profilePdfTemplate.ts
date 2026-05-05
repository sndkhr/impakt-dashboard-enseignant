/* eslint-disable @typescript-eslint/no-explicit-any */
// =====================================================
// PDF MAGAZINE TEMPLATE — Fiche profil candidat
// =====================================================
// Génère le HTML imprimable A4 (6 pages) à partir des données du profil.
// Le HTML est ouvert dans une nouvelle fenêtre puis window.print() est
// déclenché — le navigateur produit un PDF vectoriel parfait avec
// gradients, typographie et SVG.

const stripBraces = (s: unknown): string =>
  typeof s === 'string' ? s.replace(/[{}]/g, '').trim() : '';

const escapeHtml = (s: unknown): string => {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

const fmtDateFull = (iso?: string): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return '—'; }
};

const fmtDateShort = (iso?: string): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return '—'; }
};

const fmtDateAbbr = (iso?: string): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

const fmtTime = (totalSeconds: number): string => {
  if (!totalSeconds || totalSeconds <= 0) return '—';
  if (totalSeconds < 60) return `${totalSeconds}s`;
  if (totalSeconds < 3600) return `${Math.floor(totalSeconds / 60)} min`;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}h ${('0' + m).slice(-2)}`;
};

// ====== RIASEC ======
const RIASEC_LABELS: Record<string, { name: string; sub: string }> = {
  E: { name: 'Entreprenant',  sub: "Leadership · prise d'initiative · persuasion" },
  I: { name: 'Investigateur', sub: 'Analyse · résolution · curiosité technique' },
  C: { name: 'Conventionnel', sub: 'Méthode · organisation · rigueur' },
  R: { name: 'Réaliste',      sub: 'Concret · manuel · technique de terrain' },
  A: { name: 'Artistique',    sub: 'Créativité · expression' },
  S: { name: 'Social',        sub: 'Aide · accompagnement · pédagogie' },
};

interface RiasecEntry { code: string; name: string; sub: string; score: number; pct: number; isTop: boolean; }

function buildRiasec(rp: Record<string, unknown> | null | undefined): { rows: RiasecEntry[]; codeDominant: string; codeSubLine: string; hex: Record<string, number> } {
  const scores: Record<string, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  if (rp && typeof rp === 'object') {
    Object.entries(rp).forEach(([k, v]) => {
      const code = k.toUpperCase();
      if (code in scores) scores[code] = Number(v) || 0;
    });
  }
  const max = Math.max(...Object.values(scores), 1);
  // Tri par score décroissant ; en cas d'égalité, on respecte l'ordre dans
  // lequel les codes apparaissent dans `rp` (= ordre choisi par l'algorithme
  // d'orientation), avec fallback sur l'ordre canonique RIASEC.
  const sourceOrder: Record<string, number> = {};
  if (rp && typeof rp === 'object') {
    Object.keys(rp).forEach((k, i) => { sourceOrder[k.toUpperCase()] = i; });
  }
  const CANONICAL: Record<string, number> = { R: 0, I: 1, A: 2, S: 3, E: 4, C: 5 };
  const sorted = Object.entries(scores).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    const oa = sourceOrder[a[0]] ?? CANONICAL[a[0]] + 100;
    const ob = sourceOrder[b[0]] ?? CANONICAL[b[0]] + 100;
    return oa - ob;
  });
  const top3 = sorted.slice(0, 3).map(([k]) => k);

  const rows: RiasecEntry[] = sorted.map(([code, score]) => ({
    code,
    name: RIASEC_LABELS[code]?.name || code,
    sub: RIASEC_LABELS[code]?.sub || '',
    score,
    pct: Math.round((score / max) * 100),
    isTop: top3.includes(code),
  }));
  const codeDominant = top3.join('');
  const codeSubLine = top3.map(c => RIASEC_LABELS[c]?.name || c).join(' · ');
  return { rows, codeDominant, codeSubLine, hex: scores };
}

// Coordonnées des 6 sommets de l'hexagramme (R en haut, sens horaire)
const HEX_VERTICES: Record<string, [number, number]> = {
  R: [150, 30],
  I: [254, 90],
  A: [254, 210],
  S: [150, 270],
  E: [46, 210],
  C: [46, 90],
};

function hexPolygonPoints(scores: Record<string, number>): string {
  const max = Math.max(...Object.values(scores), 1);
  const order: Array<keyof typeof HEX_VERTICES> = ['R', 'I', 'A', 'S', 'E', 'C'];
  return order.map(code => {
    const [vx, vy] = HEX_VERTICES[code];
    const cx = 150, cy = 150;
    const ratio = (scores[code] || 0) / max;
    const px = cx + (vx - cx) * ratio;
    const py = cy + (vy - cy) * ratio;
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(' ');
}

// =====================================================
// CSS de la fiche (extrait de Profil Noah Tixier A4 (1).html)
// =====================================================
const CSS = `
:root{--violet:#7F4997;--magenta:#E84393;--violet-deep:#5D2A78;--grad:linear-gradient(135deg,#7F4997 0%,#E84393 100%);--grad-deep:linear-gradient(135deg,#5D2A78 0%,#E84393 100%);--black:#0A0A0A;--g-900:#262626;--g-700:#525252;--g-500:#737373;--g-300:#A3A3A3;--g-100:#F4F5F9;--white:#FFFFFF}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#1a1a1a;font-family:'Montserrat',sans-serif;color:var(--g-900);-webkit-font-smoothing:antialiased}
.page{width:794px;height:1123px;margin:24px auto;background:var(--white);position:relative;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.3);page-break-after:always}
.page--gradient{background:var(--grad-deep);color:var(--white)}
.page--soft{background:var(--g-100)}
.page--dark{background:var(--g-100);color:var(--black)}
.doc-header{position:absolute;top:0;left:0;right:0;padding:18px 48px;display:flex;align-items:center;justify-content:space-between;font-family:'Montserrat',sans-serif;font-weight:600;font-size:6.5pt;letter-spacing:.18em;text-transform:uppercase;color:var(--g-500)}
.page--gradient .doc-header{color:rgba(255,255,255,.7)}
.doc-header .logo{display:flex;align-items:center;gap:10px}
.doc-header .logo svg{height:14px;width:auto}
.doc-footer{position:absolute;bottom:0;left:0;right:0;padding:16px 48px;display:flex;align-items:center;justify-content:space-between;font-weight:600;font-size:6.5pt;letter-spacing:.18em;text-transform:uppercase;color:var(--g-500);border-top:1px solid var(--g-100)}
.page--gradient .doc-footer{color:rgba(255,255,255,.7);border-top-color:rgba(255,255,255,.18)}
.eyebrow{font-weight:600;font-size:6.5pt;letter-spacing:.18em;text-transform:uppercase;color:var(--violet);margin-bottom:14px;display:flex;align-items:center;gap:12px}
.eyebrow::before{content:'';width:24px;height:2px;background:var(--grad);border-radius:2px}
.page--gradient .eyebrow{color:var(--white)}.page--gradient .eyebrow::before{background:var(--white)}
.page--dark .eyebrow{color:var(--violet)}
h1,h2,h3{font-family:'Montserrat',sans-serif}
.p1-body{height:100%;padding:90px 64px 84px;display:flex;flex-direction:column;position:relative}
.p1-toprow{display:flex;justify-content:space-between;align-items:flex-start;gap:30px;padding-bottom:22px;border-bottom:1px solid rgba(255,255,255,.25);margin-bottom:60px}
.p1-toprow .ref{font-weight:700;font-size:7pt;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.85)}
.p1-toprow .date{text-align:right;font-weight:700;font-size:7pt;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.85)}
.p1-toprow .date small{display:block;font-weight:400;font-size:8pt;letter-spacing:0;text-transform:none;color:rgba(255,255,255,.7);margin-top:6px}
.p1-eyebrow{font-weight:700;font-size:7pt;letter-spacing:.28em;text-transform:uppercase;color:rgba(255,255,255,.85);margin-bottom:28px}
.p1-display{font-family:'Montserrat',sans-serif;font-weight:900;font-size:108pt;line-height:.88;letter-spacing:-.045em;color:var(--white);margin:0;word-break:break-word}
.p1-display .light{font-weight:300;opacity:.85}
.p1-tag{font-weight:400;font-size:15pt;line-height:1.4;color:rgba(255,255,255,.92);max-width:460px;margin:40px 0 0;letter-spacing:-.005em}
.p1-tag b{font-weight:700}
.p1-card{margin-top:auto;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);border-radius:4px;padding:26px 30px;display:grid;grid-template-columns:repeat(4,1fr);gap:0}
.p1-card .stat{padding:0 20px 0 0;border-right:1px solid rgba(255,255,255,.22)}
.p1-card .stat:last-child{border-right:0;padding-right:0}
.p1-card .stat:not(:first-child){padding-left:20px}
.p1-card .lbl{font-weight:600;font-size:6.5pt;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.75);margin-bottom:8px}
.p1-card .val{font-weight:700;font-size:17pt;line-height:1.05;letter-spacing:-.02em;color:var(--white)}
.p1-card .val small{display:block;font-weight:400;font-size:8pt;color:rgba(255,255,255,.8);letter-spacing:0;text-transform:none;margin-top:5px}
.p1-meta{margin-top:26px;display:flex;gap:18px;font-weight:500;font-size:9pt;color:rgba(255,255,255,.85);letter-spacing:.02em;flex-wrap:wrap}
.p1-meta .dot{color:rgba(255,255,255,.5)}
.p2-body{padding:78px 56px 80px}
.p2-grid{display:grid;grid-template-columns:1fr 280px;gap:40px;margin-top:18px}
.h1-title{font-weight:800;font-size:36pt;line-height:1.05;letter-spacing:-.025em;color:var(--black);margin:0 0 22px}
.h1-title .grad-text{background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:var(--magenta)}
.lede{font-weight:400;font-size:13pt;line-height:1.55;color:var(--g-700);margin:0 0 26px;max-width:480px;letter-spacing:-.005em}
.summary{font-weight:400;font-size:9.5pt;line-height:1.65;color:var(--g-900)}
.summary p{margin:0 0 12px}.summary b{font-weight:700;color:var(--black)}
.id-card{background:var(--g-100);border-radius:6px;padding:22px 24px;position:relative;overflow:hidden}
.id-card::before{content:'';position:absolute;left:0;right:0;top:0;height:3px;background:var(--grad)}
.id-card h4{font-weight:700;font-size:7pt;letter-spacing:.2em;text-transform:uppercase;color:var(--violet);margin:0 0 18px}
.id-card dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:10px 14px}
.id-card dt{font-weight:600;font-size:7pt;letter-spacing:.12em;text-transform:uppercase;color:var(--g-500);padding-top:2px}
.id-card dd{margin:0;font-weight:600;font-size:9.5pt;color:var(--black);word-break:break-word}
.id-card dd.accent{color:var(--magenta)}
.status-row{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-top:34px;border-top:1px solid var(--g-100);border-bottom:1px solid var(--g-100)}
.status-row .col{padding:18px 16px 18px 0;border-right:1px solid var(--g-100)}
.status-row .col:last-child{border-right:0}
.status-row .col:not(:first-child){padding-left:16px}
.status-row .lbl{font-weight:600;font-size:6.5pt;letter-spacing:.18em;text-transform:uppercase;color:var(--g-500);margin-bottom:8px}
.status-row .val{font-weight:800;font-size:13pt;line-height:1.1;letter-spacing:-.02em;color:var(--black)}
.status-row .val small{display:block;font-weight:500;font-size:8pt;color:var(--g-700);letter-spacing:0;margin-top:4px}
.status-row .col.highlight .val{background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:var(--magenta)}
.pill{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:100px;font-weight:600;font-size:7pt;letter-spacing:.12em;text-transform:uppercase;line-height:1}
.pill--grad{background:var(--grad);color:var(--white)}
.pill--violet{background:var(--violet);color:var(--white)}
.pill--soft{background:var(--g-100);color:var(--g-700)}
.pill--outline{border:1px solid var(--g-300);color:var(--g-700)}
.riasec-board{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:8px 0 26px}
.riasec-list{display:flex;flex-direction:column;gap:0}
.riasec-row{display:grid;grid-template-columns:28px 1fr 140px 32px;gap:14px;align-items:center;padding:5px 0;border-bottom:1px solid var(--g-100)}
.riasec-row .letter{font-weight:900;font-size:22pt;line-height:1;letter-spacing:-.04em;color:var(--g-300)}
.riasec-row.top .letter{background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:var(--magenta)}
.riasec-row .name{font-weight:700;font-size:9.5pt;color:var(--black);letter-spacing:-.005em}
.riasec-row .name small{display:block;font-weight:400;font-size:7.5pt;color:var(--g-500);margin-top:2px;letter-spacing:0;line-height:1.3}
.riasec-row .bar{height:6px;background:var(--g-100);border-radius:100px;position:relative;overflow:hidden}
.riasec-row .bar i{position:absolute;left:0;top:0;bottom:0;background:var(--g-300);border-radius:100px}
.riasec-row.top .bar i{background:var(--grad)}
.riasec-row .score{font-weight:800;font-size:11pt;text-align:right;color:var(--black);letter-spacing:-.02em}
.hex-card{background:var(--g-100);border-radius:6px;padding:18px 20px;display:flex;flex-direction:column}
.hex-card h4{font-weight:700;font-size:7pt;letter-spacing:.2em;text-transform:uppercase;color:var(--violet);margin:0 0 4px}
.hex-card .sub{font-weight:600;font-size:11pt;color:var(--black);letter-spacing:-.01em;margin-bottom:14px}
.hex-card .sub b{background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:var(--magenta);font-weight:800}
.secteurs-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.secteur{padding:14px 16px;border-radius:6px;background:var(--white);border:1px solid var(--g-100);position:relative;overflow:hidden}
.secteur::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--grad)}
.secteur .idx{font-weight:700;font-size:6.5pt;letter-spacing:.18em;color:var(--violet);margin-bottom:8px}
.secteur h5{font-family:'Montserrat',sans-serif;font-weight:800;font-size:11pt;line-height:1.15;letter-spacing:-.02em;color:var(--black);margin:0 0 6px}
.secteur p{font-weight:400;font-size:7.5pt;line-height:1.45;margin:0;color:var(--g-700)}
.metiers-split{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:14px 0 24px}
.metiers-col{background:var(--white);border:1px solid var(--g-100);border-radius:6px;padding:18px 22px 14px}
.metiers-col.featured{background:var(--g-100);color:var(--black);border-color:var(--g-100);position:relative;overflow:hidden}
.col-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding-bottom:14px;margin-bottom:14px;border-bottom:1px solid var(--g-100);position:relative;z-index:2}
.metiers-col.featured .col-head{border-bottom-color:rgba(0,0,0,.08)}
.col-head h3{font-weight:800;font-size:16pt;line-height:1.05;letter-spacing:-.025em;margin:0;color:var(--black)}
.col-head h3 em{font-style:normal;background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:var(--magenta)}
.col-head .tag{font-weight:700;font-size:6pt;letter-spacing:.18em;text-transform:uppercase;color:var(--g-500);white-space:nowrap;flex-shrink:0;padding-top:4px}
.metiers-list{list-style:none;padding:0;margin:0;position:relative;z-index:2}
.metiers-list li{display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--g-100);font-weight:500;font-size:8.5pt;line-height:1.3;letter-spacing:-.005em;align-items:flex-start}
.metiers-col.featured .metiers-list li{border-bottom-color:rgba(0,0,0,.06)}
.metiers-list li:last-child{border-bottom:0}
.metiers-list li .num{font-weight:700;font-size:7.5pt;color:var(--g-300);min-width:22px;padding-top:1px;letter-spacing:.05em;flex-shrink:0}
.metiers-list li .txt{flex:1}
.metiers-list li.flag{font-weight:700;color:var(--black)}
.metiers-list li.flag .num{color:var(--magenta)}
.metiers-list li.flag .dot{color:var(--magenta);margin-left:auto;font-size:9pt;flex-shrink:0}
.matching-banner{background:var(--grad);color:var(--white);border-radius:6px;padding:22px 28px;display:grid;grid-template-columns:auto 1fr auto;gap:28px;align-items:center;margin-bottom:22px}
.matching-banner .lbl{font-weight:700;font-size:6.5pt;letter-spacing:.2em;text-transform:uppercase;opacity:.85;margin-bottom:4px}
.matching-banner .big{font-weight:900;font-size:56pt;line-height:.9;letter-spacing:-.04em}
.matching-banner .big small{font-weight:700;font-size:16pt;margin-left:4px;letter-spacing:-.02em}
.matching-banner .txt{font-weight:400;font-size:9pt;line-height:1.5;max-width:320px}
.matching-banner .arrow{font-weight:300;font-size:36pt;opacity:.9}
.key-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.key-card{border:1px solid var(--g-100);border-radius:6px;padding:14px 18px;background:var(--white)}
.key-card .lbl{font-weight:700;font-size:6.5pt;letter-spacing:.18em;text-transform:uppercase;color:var(--violet);margin-bottom:6px}
.key-card .v{font-weight:700;font-size:11pt;line-height:1.18;color:var(--black);letter-spacing:-.015em}
.offres-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid var(--g-100);border-radius:6px;overflow:hidden;margin:22px 0 22px;background:var(--white)}
.offres-summary .cell{padding:16px 18px;border-right:1px solid var(--g-100)}
.offres-summary .cell:last-child{border-right:0}
.offres-summary .cell.highlight{background:var(--grad);color:var(--white)}
.offres-summary .lbl{font-weight:700;font-size:6.5pt;letter-spacing:.18em;text-transform:uppercase;color:var(--g-500);margin-bottom:8px}
.offres-summary .cell.highlight .lbl{color:rgba(255,255,255,.85)}
.offres-summary .val{font-weight:800;font-size:22pt;line-height:1.05;letter-spacing:-.03em;color:var(--black);white-space:nowrap}
.offres-summary .cell.highlight .val{color:var(--white)}
.offres-summary .val small{display:block;font-weight:500;font-size:7.5pt;margin-left:0;margin-top:4px;color:var(--g-500);letter-spacing:0;white-space:normal;line-height:1.25}
.offres-summary .cell.highlight .val small{color:rgba(255,255,255,.85)}
.offres-table{width:100%;border-collapse:collapse;font-size:8pt;background:var(--white);border-radius:6px;overflow:hidden}
.offres-table thead th{text-align:left;font-weight:700;font-size:6.5pt;letter-spacing:.2em;text-transform:uppercase;padding:10px 12px;border-bottom:1px solid var(--black);color:var(--black);background:var(--white)}
.offres-table tbody td{padding:8px 12px;border-bottom:1px solid var(--g-100);vertical-align:top;line-height:1.3}
.offres-table tbody tr.fav td:first-child{border-left:3px solid var(--magenta);padding-left:12px}
.offres-table .role{font-weight:700;font-size:8.5pt;color:var(--black);max-width:280px;letter-spacing:-.005em}
.offres-table .corp{color:var(--g-500);font-size:7.5pt;margin-top:3px;font-weight:500}
.offres-table .loc{font-weight:600;font-size:7.5pt;color:var(--g-700);white-space:nowrap}
.offres-table .sal{font-weight:600;font-size:8pt;color:var(--black)}
.offres-table .sal small{color:var(--g-500);display:block;font-size:7pt;font-weight:500;margin-top:2px;letter-spacing:0}
.offres-table .status{display:inline-flex;gap:8px;align-items:center;justify-content:flex-end;width:100%}
.offres-table .status .ico{width:22px;height:22px;border-radius:50%;display:inline-grid;place-items:center;background:transparent;border:1px solid var(--g-300);color:var(--g-300);flex-shrink:0}
.offres-table .status .ico svg{width:12px;height:12px;display:block}
.offres-table .status .ico.on{background:var(--grad);border-color:transparent;color:var(--white)}
.insight-note{margin-top:22px;padding:18px 22px;background:var(--white);border-radius:6px;border-left:3px solid var(--magenta)}
.insight-note .lbl{font-weight:700;font-size:6.5pt;letter-spacing:.2em;text-transform:uppercase;color:var(--violet);margin-bottom:6px}
.insight-note p{margin:0;font-weight:500;font-size:9pt;line-height:1.5;color:var(--g-900)}
.insight-note p b{font-weight:700}
.engagement-hero{display:grid;grid-template-columns:1.1fr 1fr;gap:32px;margin:22px 0 28px}
.progress-list{display:flex;flex-direction:column}
.progress-row{display:grid;grid-template-columns:28px 1fr auto;gap:14px;align-items:center;padding:14px 0;border-bottom:1px solid var(--g-100)}
.progress-row:first-child{border-top:1px solid var(--g-100)}
.progress-row .check{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;color:var(--white);background:var(--grad)}
.progress-row .check.off{background:var(--g-100);color:var(--g-300);border:1px solid var(--g-300)}
.progress-row .label{font-weight:700;font-size:11pt;color:var(--black);letter-spacing:-.015em}
.progress-row .label span{display:inline;font-weight:400;color:var(--g-500);font-size:9pt;margin-left:6px;letter-spacing:0}
.progress-row .date{font-weight:600;font-size:7pt;letter-spacing:.12em;color:var(--g-500)}
.stats-card{background:var(--grad-deep);border-radius:6px;padding:26px 28px;display:flex;flex-direction:column;gap:18px}
.stats-card .lbl{font-weight:700;font-size:6.5pt;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.85);margin-bottom:4px}
.stats-card .stat{padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.18)}
.stats-card .stat:last-child{border-bottom:0;padding-bottom:0}
.stats-card .num{font-weight:900;font-size:40pt;line-height:.9;letter-spacing:-.04em;color:var(--white)}
.stats-card .num small{font-weight:600;font-size:11pt;margin-left:4px;color:rgba(255,255,255,.85);letter-spacing:-.01em}
.notes-block{background:var(--white);border:1px solid var(--g-100);border-radius:6px;padding:20px 24px 26px}
.notes-head{font-weight:700;font-size:6.5pt;letter-spacing:.2em;text-transform:uppercase;color:var(--violet);margin-bottom:18px;display:flex;align-items:center;gap:10px}
.notes-head::after{content:'';flex:1;height:1px;background:var(--g-100)}
.notes-lines{display:flex;flex-direction:column;gap:26px;padding:8px 0 6px}
.note-line{height:1px;background:var(--g-300);opacity:.55}
.closing{margin-top:38px;padding-top:24px;border-top:1px solid var(--g-100);display:grid;grid-template-columns:1fr auto;align-items:end;gap:30px}
.closing h3{font-weight:800;font-size:18pt;line-height:1.2;letter-spacing:-.02em;margin:0;color:var(--black);max-width:460px}
.closing h3 em{font-style:normal;background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:var(--magenta)}
.closing .sig{text-align:right;font-weight:600;font-size:7pt;letter-spacing:.15em;text-transform:uppercase;color:var(--g-500);line-height:1.7}
.closing .sig strong{color:var(--black);display:block;font-weight:800;font-size:8pt;margin-bottom:2px}
.sheet{width:210mm;height:297mm;margin:24px auto;background:white;box-shadow:0 8px 40px rgba(0,0,0,.3);overflow:hidden;position:relative;page-break-after:always;break-after:page}
.sheet>.page{width:794px;height:1123px;margin:0!important;box-shadow:none!important;transform:scale(calc(210mm / 794px));transform-origin:top left}
@page{size:A4 portrait;margin:0}
@media print{html,body{background:white!important;margin:0!important;padding:0!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.sheet{margin:0!important;box-shadow:none!important;page-break-after:always!important;break-after:page!important}.sheet:last-child{page-break-after:auto!important;break-after:auto!important}}
`;

const LOGO_SVG = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><symbol id="impakt-mark" viewBox="0 0 770.62 628.17"><path d="M644.93,210.94c-4.19-15.87-8.86-23.49-21-34-28.26-24.47-69.12-21.59-94,7-10.51,12.07-16.97,25.92-24.52,39.98-20.65,38.44-41.41,79.34-60.34,118.66-2.88,5.99-5.53,12.25-8.14,18.36-.63.1-1.35-.07-2,0,.02-7.71-1.21-15.36-2-23-3.6-34.69-6.75-69.64-12-104-4.8-31.36-12.67-58.96-46.78-69.72-46.7-14.72-79.48,13.6-95.39,55.04l-63.82,145.68-1.07-3.38.07-171.62h-84l.38,69.92c-.71,37.91-1,77.85.62,114.08.01.33-.02.67,0,1,1.06,19.32,9.28,37.85,21.58,52.49.11.15.24.32.42.51,37.92,44.55,97.38,33.34,123.86-16.64,16.54-31.22,30.39-65.27,45.12-98.23,3.91-8.46,7.81-16.92,11.72-25.4,1.14-2.37,2.28-4.74,3.44-7.08l10.86-21.64c.11.26-.09.67,0,1,1.61,5.57,2.29,16.21,2.99,22.51,3.91,35.17,4.71,73.06,10.28,107.72,2.48,15.42,6.45,27.32,15.72,39.78,26.9,36.13,84.82,32.62,110.41-3.09,2.93-4.09,5.63-9.41,8.11-13.89,22.88-41.35,45.39-88.46,65.66-131.34,3.07-6.49,9.27-18.3,10.82-24.68h1v189h76l.04-209.54c-1.02-8.78-1.78-16.88-4.04-25.46Z" fill="currentColor"/><ellipse cx="170.32" cy="102.19" rx="57.08" ry="56.78" fill="currentColor"/></symbol></defs></svg>`;

// =====================================================
// BUILDERS PAR PAGE
// =====================================================

function buildHeader(rightLabel: string, color: 'dark' | 'light' = 'dark'): string {
  const c = color === 'light' ? '#fff' : '#0A0A0A';
  return `<header class="doc-header"><div class="logo"><svg class="logo-mark" width="22" height="18" style="color:${c}"><use href="#impakt-mark"/></svg><span style="color:${color === 'light' ? '#fff' : 'inherit'}">IMPAKT&nbsp;·&nbsp;INTELLIGENCE</span></div><span style="color:${color === 'light' ? '#fff' : 'inherit'}">${escapeHtml(rightLabel)}</span></header>`;
}

function buildFooter(left: string, page: number, total: number): string {
  return `<footer class="doc-footer"><span>${escapeHtml(left)}</span><span>${('0' + page).slice(-2)}&nbsp;/&nbsp;${('0' + total).slice(-2)}</span></footer>`;
}

interface ProfileVM {
  prenom: string;
  nom: string;
  age?: number;
  ageStr: string;
  ville: string;
  codePostal: string;
  codeDepartement: string;
  villeFull: string;
  email: string;
  dateNaissance: string;
  gender: string;
  diplome: string;
  diplomeDomaine: string;
  inscriptionDate: string;
  inscriptionDateShort: string;
  isMinor: boolean;
  refCode: string;
  situationLabel: string;
  isJobSeeker: boolean;
  wantsFast: boolean;
  wantsFC: boolean;
  wantsReprise: boolean;
  experienceLine: string;
  experienceMain: { duree: string; label: string } | null;
  riasec: ReturnType<typeof buildRiasec>;
  hasQuiz: boolean;
  careerPaths: Array<{ name: string; description: string }>;
  topMetiersSansFormation: string[];
  topMetiersAvecFormation: string[];
  flaggedSet: Set<number>;
  flaggedSetFC: Set<number>;
  jobOffers: Array<{ title: string; company: string; location: string; salary: string; salarySub: string; viewed: boolean; favorited: boolean }>;
  totalOffers: number;
  viewedOffers: number;
  favoriteOffers: number;
  favoriteCompany: string;
  medianSalary: string;
  rooms: Array<{ label: string; sub: string; date: string; done: boolean }>;
  quizCompletedDate: string;
  connexions: number;
  totalAppTimeRaw: number;
  totalAppTimeStr: string;
  lastConn: string;
  summary: string;
  generatedDate: string;
}

function pickJobOffers(offers: any[]): ProfileVM['jobOffers'] {
  // Limite à 8 offres pour rester dans la hauteur d'une page A4 avec
  // l'insight-note + footer en dessous.
  return (offers || []).slice(0, 8).map((o: any) => {
    const sal = o.salaire || o.salary || '';
    const salParts = sal.split(/\s+sur\s+|·|\n/);
    return {
      title: stripBraces(o.title || o.intitule || '—') || '—',
      company: stripBraces(o.company || o.entreprise?.nom || ''),
      location: stripBraces(o.location || o.lieuTravail?.libelle || '—'),
      salary: salParts[0] || (sal || '—'),
      salarySub: salParts.length > 1 ? salParts.slice(1).join(' ').trim() : '',
      viewed: !!o.viewed,
      favorited: !!o.favorited,
    };
  });
}

function buildSummary(d: any): string {
  const isFem = d.gender === 'femme' || d.gender === 'F';
  const il = isFem ? 'elle' : 'il';
  const Il = isFem ? 'Elle' : 'Il';
  const interesse = isFem ? 'intéressée' : 'intéressé';
  const demandeur = isFem ? 'demandeuse' : 'demandeur';
  const ouvert = isFem ? 'ouverte' : 'ouvert';

  const parts: string[] = [];
  const prenom = (d.prenom || '').trim();
  const ageStr = d.age ? `${d.age} ans` : '';
  const dipl = (d.typeDiplome || d.niveauEtudes || d.classe || '').toString().trim();
  const lower = dipl.toLowerCase();
  let intro = `<b>${escapeHtml(prenom || 'Le candidat')}</b>`;
  if (ageStr) intro += `, ${ageStr}`;
  if (dipl) {
    if (lower.startsWith('niveau')) intro += `, ${escapeHtml(lower)}`;
    else intro += `, titulaire d'un <b>${escapeHtml(dipl)}</b>`;
  }
  parts.push(`<p>${intro}.</p>`);

  const expsRaw: any[] = Array.isArray(d.experiencesPro) ? d.experiencesPro : [];
  const exps = expsRaw.map(e => ({
    label: (e.label || e.domaineLabel || e.secteur || '').trim(),
    duree: (e.duree || e.duration || '').trim(),
  })).filter(e => e.label || e.duree);
  if (exps.length > 0) {
    const e0 = exps[0];
    let txt = '';
    if (e0.duree && e0.label) txt = `<b>${escapeHtml(e0.duree)}</b> dans le secteur <b>${escapeHtml(e0.label)}</b>`;
    else if (e0.label) txt = `dans le secteur <b>${escapeHtml(e0.label)}</b>`;
    else txt = `<b>${escapeHtml(e0.duree)}</b>`;
    parts.push(`<p>${Il} a accumulé ${txt}.</p>`);
  }

  const dispos = Array.isArray(d.dispoFormation) ? d.dispoFormation : (d.dispoFormation ? [d.dispoFormation] : []);
  const isJobSeeker = d.situation === 'sans_emploi' || d.situation === 'sansEmploi';
  const wantsFast = dispos.includes('travailler_vite');
  const wantsFC = dispos.includes('formation_courte');
  const wantsReprise = dispos.includes('reprendre_etudes');

  if (isJobSeeker) {
    let s = `${Il} se déclare aujourd'hui <b>${demandeur} d'emploi</b>`;
    const wants: string[] = [];
    if (wantsFast) wants.push('souhaite reprendre une activité rapidement');
    if (wantsFC) wants.push(`reste ${ouvert} à une formation courte certifiante`);
    if (wantsReprise) wants.push('envisage de reprendre des études');
    if (wants.length === 1) s += ` et ${wants[0]}`;
    else if (wants.length > 1) s += ` : ${il} ${wants.slice(0, -1).join(', ')} et ${wants[wants.length - 1]}`;
    parts.push(`<p>${s}.</p>`);
  }

  const careerPaths = d.orientationLLM?.careerPaths;
  if (Array.isArray(careerPaths) && careerPaths.length > 0) {
    const sectors = careerPaths.map((p: any) => stripBraces(p?.name)).filter(Boolean).slice(0, 4);
    if (sectors.length >= 1) {
      let s = `Les secteurs identifiés par l'algorithme IMPAKT comme les plus alignés avec son profil sont `;
      const bolded = sectors.map(x => `<b>${escapeHtml(x)}</b>`);
      if (bolded.length === 1) s += bolded[0];
      else if (bolded.length === 2) s += `${bolded[0]} et ${bolded[1]}`;
      else s += `${bolded.slice(0, -1).join(', ')} ainsi que ${bolded[bolded.length - 1]}`;
      parts.push(`<p>${Il} est ${interesse} par ces voies. ${s}.</p>`);
    }
  }

  return parts.join('');
}

function buildVM(d: any): ProfileVM {
  const ageStr = d.age ? `${d.age} ans` : '—';
  const ville = (d.ville || '').toString();
  const cp = (d.codePostal || '').toString();
  const dept = (d.codeDepartement || '').toString();
  const villeFull = ville ? `${ville}${cp ? ' ' + cp : ''}` : '—';

  const dipl = stripBraces(d.typeDiplome || d.niveauEtudes || d.classe || '—') || '—';
  const diplDomaine = stripBraces(d.domaineDiplome || '');

  const inscription = d.inscriptionDate ? new Date(d.inscriptionDate) : null;
  const inscriptionLabel = inscription ? fmtDateFull(d.inscriptionDate) : '—';
  const inscriptionShort = inscription
    ? `${('0' + inscription.getDate()).slice(-2)}${('0' + (inscription.getMonth() + 1)).slice(-2)}`
    : '0000';
  const initials = ((d.prenom || '?')[0] + (d.nom || '?')[0]).toUpperCase();
  const refCode = `${initials}—${inscriptionShort}—${dept || '00'}`;

  const isJobSeeker = d.situation === 'sans_emploi' || d.situation === 'sansEmploi';
  const situationLabel = isJobSeeker ? "Demandeur d'emploi" : (d.situation || '—');
  const dispos = Array.isArray(d.dispoFormation) ? d.dispoFormation : (d.dispoFormation ? [d.dispoFormation] : []);
  const wantsFast = dispos.includes('travailler_vite');
  const wantsFC = dispos.includes('formation_courte');
  const wantsReprise = dispos.includes('reprendre_etudes');

  const expsRaw: any[] = Array.isArray(d.experiencesPro) ? d.experiencesPro : [];
  const exps = expsRaw.map(e => ({
    label: stripBraces(e.label || e.domaineLabel || e.secteur || ''),
    duree: stripBraces(e.duree || e.duration || ''),
  })).filter(e => e.label || e.duree);
  const experienceMain = exps[0] || null;
  const experienceLine = exps.length > 0
    ? exps.map(e => `${e.duree || ''}${e.duree && e.label ? ' en ' : ''}${e.label || ''}`.trim()).filter(Boolean).join(' · ')
    : (d.metierActuel ? `Actuel : ${stripBraces(d.metierActuel)}` : '—');

  const rp = d.riasecProfile || d.orientationScore?.riasec || null;
  const hasQuiz = !!d.quizCompleted || !!rp;
  const riasec = buildRiasec(rp);

  const careerPathsRaw: any[] = Array.isArray(d.orientationLLM?.careerPaths) ? d.orientationLLM.careerPaths : [];
  const careerPaths = careerPathsRaw.slice(0, 4).map(p => ({
    name: stripBraces(p?.name) || '—',
    description: stripBraces(p?.description) || '',
  }));

  const llm = d.orientationLLM;
  const llmFC = d.orientationLLMFormationCourte;
  const sansFormationRaw: string[] = (llm && Array.isArray(llm.top10_titles))
    ? llm.top10_titles.map(stripBraces)
    : (Array.isArray(d.topMetiers) ? d.topMetiers.map((m: any) => typeof m === 'string' ? stripBraces(m) : stripBraces(m?.title || m?.name)) : []);
  const avecFormationRaw: string[] = (llmFC && Array.isArray(llmFC.top10_titles))
    ? llmFC.top10_titles.map(stripBraces)
    : [];

  const topMetiersSansFormation = sansFormationRaw.filter(Boolean).slice(0, 10);
  const topMetiersAvecFormation = avecFormationRaw.filter(Boolean).slice(0, 10);

  // Pas de "score de matching" : on n'a pas de vraie métrique. On marque
  // seulement les 3 premiers de chaque colonne comme "métiers signalés"
  // (haut du classement IA), sans inventer de pourcentage.
  const flaggedSet = new Set<number>([0, 1, 2]);
  const flaggedSetFC = new Set<number>([0, 1, 2]);

  const offersRaw: any[] = Array.isArray(d.matchedJobOffers) ? d.matchedJobOffers : [];
  const jobOffers = pickJobOffers(offersRaw);
  const totalOffers = offersRaw.length;
  const viewedOffers = offersRaw.filter(o => o.viewed).length;
  const favs = offersRaw.filter(o => o.favorited);
  const favoriteOffers = favs.length;
  const favoriteCompany = favs[0]?.company || favs[0]?.entreprise?.nom || '—';
  // Salaire médian très approximatif (texte libre côté France Travail)
  const salNumbers: number[] = [];
  offersRaw.forEach(o => {
    const s = (o.salaire || o.salary || '').toString();
    const m = s.match(/(\d{4,5})/);
    if (m) salNumbers.push(parseInt(m[1], 10));
  });
  const medianSalary = salNumbers.length > 0
    ? `${Math.round(salNumbers.sort((a, b) => a - b)[Math.floor(salNumbers.length / 2)] / 100) * 100}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
    : '—';

  const rooms = [
    { label: "Quiz d'orientation", sub: 'complété', done: !!d.quizCompleted, date: fmtDateShort(d.quizCompletedAt || d.completedAt) },
    { label: 'Room 01', sub: 'Personnalité', done: !!d.room1Completed, date: fmtDateShort(d.room1CompletedAt) },
    { label: 'Room 02', sub: "Univers d'affinité", done: !!d.room2Completed, date: fmtDateShort(d.room2CompletedAt) },
    { label: 'Room 03', sub: 'Vision du travail', done: !!d.room3Completed, date: fmtDateShort(d.room3CompletedAt) },
  ];

  return {
    prenom: stripBraces(d.prenom || '') || 'Candidat',
    nom: stripBraces(d.nom || '') || '',
    age: d.age,
    ageStr,
    ville: ville || '—',
    codePostal: cp,
    codeDepartement: dept,
    villeFull,
    email: stripBraces(d.email || '') || '—',
    dateNaissance: d.dateNaissance ? fmtDateFull(d.dateNaissance) : '—',
    gender: d.gender === 'homme' ? 'Homme' : (d.gender === 'femme' ? 'Femme' : (d.gender || '—')),
    diplome: dipl,
    diplomeDomaine: diplDomaine,
    inscriptionDate: inscriptionLabel,
    inscriptionDateShort: inscription ? fmtDateFull(d.inscriptionDate) : '—',
    isMinor: !!d.isMinor,
    refCode,
    situationLabel,
    isJobSeeker,
    wantsFast, wantsFC, wantsReprise,
    experienceLine,
    experienceMain,
    riasec,
    hasQuiz,
    careerPaths,
    topMetiersSansFormation,
    topMetiersAvecFormation,
    flaggedSet,
    flaggedSetFC,
    jobOffers,
    totalOffers,
    viewedOffers,
    favoriteOffers,
    favoriteCompany,
    medianSalary,
    rooms,
    quizCompletedDate: fmtDateShort(d.quizCompletedAt || d.completedAt),
    connexions: d.connexions || 0,
    totalAppTimeRaw: d.totalAppTime || 0,
    totalAppTimeStr: fmtTime(d.totalAppTime || 0),
    lastConn: d.lastActive ? fmtDateAbbr(d.lastActive) : '—',
    summary: buildSummary(d),
    generatedDate: fmtDateFull(new Date().toISOString()),
  };
}

// =====================================================
// PAGE BUILDERS
// =====================================================

function pageCover(vm: ProfileVM): string {
  const tagDescription = vm.riasec.codeDominant.length >= 2
    ? `Profil <b>${RIASEC_LABELS[vm.riasec.codeDominant[0]]?.name}–${RIASEC_LABELS[vm.riasec.codeDominant[1]]?.name}</b>, attiré par les voies identifiées.`
    : `Profil en cours de définition.`;
  const tagLine1 = vm.age
    ? `${vm.age} ans, ${vm.isJobSeeker ? 'en recherche active' : 'en projet'}${vm.ville && vm.ville !== '—' ? ` à ${vm.ville}` : ''}.`
    : `${vm.isJobSeeker ? 'En recherche active' : 'En projet'}${vm.ville && vm.ville !== '—' ? ` à ${vm.ville}` : ''}.`;

  const expVal = vm.experienceMain
    ? `${escapeHtml(vm.experienceMain.duree || '—')}<small>${escapeHtml(vm.experienceMain.label || '')}</small>`
    : `Aucune<small>Première expérience à venir</small>`;

  const riasecVal = vm.riasec.codeDominant
    ? `${escapeHtml(vm.riasec.codeDominant)}<small>${escapeHtml(vm.riasec.codeSubLine)}</small>`
    : `—<small>Quiz non terminé</small>`;

  return `
<section class="page page--gradient">
  <div class="p1-body">
    <div class="p1-toprow">
      <div class="logo" style="display:flex;align-items:center;gap:12px">
        <svg class="logo-mark" width="28" height="22" style="color:#fff"><use href="#impakt-mark"/></svg>
        <span style="color:#fff;font-weight:700;font-size:7pt;letter-spacing:.28em;text-transform:uppercase">IMPAKT&nbsp;·&nbsp;Intelligence</span>
      </div>
      <div class="date">Édition&nbsp;V1.0<small>${escapeHtml(vm.generatedDate)}</small></div>
    </div>
    <div>
      <div class="p1-eyebrow">Fiche profil candidat</div>
      <h1 class="p1-display"><span class="light">${escapeHtml(vm.prenom)}</span>${vm.nom ? `<br/>${escapeHtml(vm.nom)}.` : '.'}</h1>
      <p class="p1-tag">${escapeHtml(tagLine1)}<br/>${tagDescription}</p>
      <div class="p1-meta">
        ${vm.ville !== '—' ? `<span>${escapeHtml(vm.villeFull)}</span><span class="dot">·</span>` : ''}
        ${vm.diplome !== '—' ? `<span>${escapeHtml(vm.diplome)}</span><span class="dot">·</span>` : ''}
        <span>Inscrit le ${escapeHtml(vm.inscriptionDate)}</span>
        <span class="dot">·</span>
        <span>Réf. ${escapeHtml(vm.refCode)}</span>
      </div>
    </div>
    <div class="p1-card">
      <div class="stat"><div class="lbl">Situation</div><div class="val">${escapeHtml(vm.situationLabel)}<small>${vm.wantsFast ? 'Souhaite travailler vite' : (vm.wantsFC ? 'Ouvert à une formation courte' : '—')}</small></div></div>
      <div class="stat"><div class="lbl">Expérience</div><div class="val">${expVal}</div></div>
      <div class="stat"><div class="lbl">Type RIASEC</div><div class="val">${riasecVal}</div></div>
      <div class="stat"><div class="lbl">Secteurs</div><div class="val">${vm.careerPaths.length || '—'}<small>${vm.careerPaths.length > 0 ? 'identifiés par l\'IA' : 'à analyser'}</small></div></div>
    </div>
  </div>
  ${buildFooter("Innover l'orientation pour construire un avenir épanouissant.", 1, 6)}
</section>`;
}

function pageResume(vm: ProfileVM): string {
  const pills: string[] = [];
  if (vm.wantsFast) pills.push('<span class="pill pill--grad">Disponibilité immédiate</span>');
  if (vm.ville && vm.ville !== '—') pills.push(`<span class="pill pill--violet">Mobilité ${escapeHtml(vm.ville)}</span>`);
  if (vm.wantsFC) pills.push('<span class="pill pill--outline">Ouvert formation courte</span>');
  if (vm.wantsReprise) pills.push('<span class="pill pill--soft">Envisage des études</span>');
  if (pills.length === 0) pills.push('<span class="pill pill--soft">Profil renseigné</span>');

  return `
<section class="page">
  ${buildHeader(`${vm.prenom.toUpperCase()}${vm.nom ? ' ' + vm.nom.toUpperCase() : ''} · RÉSUMÉ`, 'dark')}
  <div class="p2-body">
    <div class="eyebrow">01&nbsp;·&nbsp;Synthèse du profil</div>
    <h1 class="h1-title">Une voie cohérente,<br/><span class="grad-text">accessible rapidement.</span></h1>
    <p class="lede">${vm.careerPaths.length > 0 ? `${vm.careerPaths.length} secteurs ressortent` : 'Profil en cours de matching'} — accessibles, certaines sans formation supplémentaire, d'autres via un parcours court et certifiant.</p>
    <div class="p2-grid">
      <div class="summary">
        ${vm.summary || '<p>Profil en cours de complétion.</p>'}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:18px">
          ${pills.join('')}
        </div>
      </div>
      <aside class="id-card">
        <h4>Identité</h4>
        <dl>
          <dt>Email</dt><dd style="font-size:8pt">${escapeHtml(vm.email)}</dd>
          <dt>Ville</dt><dd>${escapeHtml(vm.ville)}${vm.codePostal ? `<br/><span style="font-weight:500;color:var(--g-500);font-size:8pt">${escapeHtml(vm.codePostal)}${vm.codeDepartement ? ` — Dépt. ${escapeHtml(vm.codeDepartement)}` : ''}</span>` : ''}</dd>
          <dt>Né le</dt><dd>${escapeHtml(vm.dateNaissance)}</dd>
          <dt>Genre</dt><dd>${escapeHtml(vm.gender)}</dd>
          <dt>Diplôme</dt><dd>${escapeHtml(vm.diplome)}${vm.diplomeDomaine ? `<br/><span style="font-weight:500;color:var(--g-500);font-size:8pt">${escapeHtml(vm.diplomeDomaine)}</span>` : ''}</dd>
          <dt>Inscrit</dt><dd class="accent">${escapeHtml(vm.inscriptionDate)}</dd>
          <dt>Mineur</dt><dd>${vm.isMinor ? 'Oui' : 'Non'}</dd>
        </dl>
      </aside>
    </div>
    <div class="status-row">
      <div class="col"><div class="lbl">Situation</div><div class="val">${escapeHtml(vm.isJobSeeker ? 'Demandeur' : vm.situationLabel)}<small>${escapeHtml(vm.isJobSeeker ? "d'emploi" : '')}</small></div></div>
      <div class="col highlight"><div class="lbl">Disponibilité</div><div class="val">${vm.wantsFast ? 'Rapide' : (vm.wantsFC ? 'Formation' : '—')}<small>${vm.wantsFast ? 'Souhaite travailler vite' : (vm.wantsFC ? 'Ouvert formation courte' : '')}</small></div></div>
      <div class="col"><div class="lbl">Expérience</div><div class="val">${escapeHtml(vm.experienceMain?.duree || '—')}<small>${escapeHtml(vm.experienceMain?.label || '')}</small></div></div>
      <div class="col"><div class="lbl">Code RIASEC</div><div class="val">${escapeHtml(vm.riasec.codeDominant || '—')}<small>${escapeHtml(vm.riasec.codeSubLine)}</small></div></div>
    </div>
  </div>
  ${buildFooter(`Fiche générée le ${vm.generatedDate}`, 2, 6)}
</section>`;
}

function pageRiasec(vm: ProfileVM): string {
  const rows = vm.riasec.rows.map(r => `
    <div class="riasec-row${r.isTop ? ' top' : ''}">
      <div class="letter">${r.code}</div>
      <div class="name">${escapeHtml(r.name)}<small>${escapeHtml(r.sub)}</small></div>
      <div class="bar"><i style="width:${r.pct}%"></i></div>
      <div class="score">${r.score}</div>
    </div>`).join('');

  const hexPoints = hexPolygonPoints(vm.riasec.hex);
  const hexLabels = ['R', 'I', 'A', 'S', 'E', 'C'].map(code => {
    const [vx, vy] = HEX_VERTICES[code];
    const labelOffset = code === 'R' ? -10 : code === 'S' ? 14 : 0;
    const xOffset = code === 'I' || code === 'A' ? 14 : code === 'E' || code === 'C' ? -14 : 0;
    return `<text x="${vx + xOffset}" y="${vy + labelOffset}">${code} · ${vm.riasec.hex[code] || 0}</text>`;
  }).join('');

  const hexCircles = ['R', 'I', 'A', 'S', 'E', 'C'].map(code => {
    const [vx, vy] = HEX_VERTICES[code];
    const cx = 150, cy = 150;
    const max = Math.max(...Object.values(vm.riasec.hex), 1);
    const ratio = (vm.riasec.hex[code] || 0) / max;
    const px = cx + (vx - cx) * ratio;
    const py = cy + (vy - cy) * ratio;
    const r = (vm.riasec.hex[code] || 0) >= max - 0.1 ? 5 : 3;
    return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r}"/>`;
  }).join('');

  const sectors = vm.careerPaths.length > 0
    ? vm.careerPaths.map((p, i) => `
      <div class="secteur">
        <div class="idx">${('0' + (i + 1)).slice(-2)}&nbsp;/&nbsp;${('0' + vm.careerPaths.length).slice(-2)}</div>
        <h5>${escapeHtml(p.name)}</h5>
        <p>${escapeHtml(p.description)}</p>
      </div>`).join('')
    : `<div class="secteur" style="grid-column:1/-1"><div class="idx">—</div><h5>Aucun secteur identifié</h5><p>Le candidat n'a pas encore complété l'analyse d'orientation.</p></div>`;

  return `
<section class="page page--soft">
  ${buildHeader(`${vm.prenom.toUpperCase()}${vm.nom ? ' ' + vm.nom.toUpperCase() : ''} · PROFIL PSYCHOMÉTRIQUE`, 'dark')}
  <div class="p2-body">
    <div class="eyebrow">02&nbsp;·&nbsp;Modèle Holland · Aptitudes naturelles</div>
    <h1 class="h1-title">Profil <span class="grad-text">RIASEC.</span></h1>
    <p class="lede">Modèle scientifique éprouvé sur six dimensions, croisé avec ses préférences déclarées.</p>
    <div class="riasec-board">
      <div class="riasec-list">${rows}</div>
      <div class="hex-card">
        <h4>Hexagramme</h4>
        <div class="sub">Code dominant&nbsp;<b>${escapeHtml(vm.riasec.codeDominant || '—')}</b></div>
        <svg viewBox="0 0 300 290" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="hexGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#7F4997"/><stop offset="100%" stop-color="#E84393"/></linearGradient></defs>
          <g fill="none" stroke="#A3A3A3" stroke-opacity="0.25" stroke-width="0.7">
            <polygon points="150,30 254,90 254,210 150,270 46,210 46,90"/>
            <polygon points="150,54 233,102 233,198 150,246 67,198 67,102"/>
            <polygon points="150,78 213,114 213,186 150,222 87,186 87,114"/>
            <polygon points="150,102 192,126 192,174 150,198 108,174 108,126"/>
            <polygon points="150,126 171,138 171,162 150,174 129,162 129,138"/>
          </g>
          <g stroke="#A3A3A3" stroke-opacity="0.2" stroke-width="0.5">
            <line x1="150" y1="150" x2="150" y2="30"/><line x1="150" y1="150" x2="254" y2="90"/>
            <line x1="150" y1="150" x2="254" y2="210"/><line x1="150" y1="150" x2="150" y2="270"/>
            <line x1="150" y1="150" x2="46" y2="210"/><line x1="150" y1="150" x2="46" y2="90"/>
          </g>
          <polygon points="${hexPoints}" fill="url(#hexGrad)" stroke="url(#hexGrad)" stroke-width="2" fill-opacity="0.28"/>
          <g fill="#7F4997">${hexCircles}</g>
          <g font-family="Montserrat,sans-serif" font-size="9" fill="#262626" text-anchor="middle" font-weight="700">${hexLabels}</g>
        </svg>
      </div>
    </div>
    <div class="eyebrow" style="margin-top:0;margin-bottom:18px">03&nbsp;·&nbsp;${vm.careerPaths.length > 0 ? `${vm.careerPaths.length} voies prioritaires` : 'Voies prioritaires'}</div>
    <h1 class="h1-title" style="font-size:22pt;margin-bottom:22px">Secteurs identifiés.</h1>
    <div class="secteurs-grid">${sectors}</div>
  </div>
  ${buildFooter('Modèle Holland (1959) · Données déclaratives · API France Travail', 3, 6)}
</section>`;
}

function pageMetiers(vm: ProfileVM): string {
  const renderList = (items: string[], flagged: Set<number>) => {
    if (items.length === 0) {
      return '<li style="color:var(--g-500);font-style:italic">Liste à venir</li>';
    }
    return items.map((m, i) => {
      const num = ('0' + (i + 1)).slice(-2);
      const isFlag = flagged.has(i);
      return `<li${isFlag ? ' class="flag"' : ''}><span class="num">${num}</span><span class="txt">${escapeHtml(m)}</span>${isFlag ? '<span class="dot">●</span>' : ''}</li>`;
    }).join('');
  };

  return `
<section class="page">
  ${buildHeader(`${vm.prenom.toUpperCase()}${vm.nom ? ' ' + vm.nom.toUpperCase() : ''} · MÉTIERS RECOMMANDÉS`, 'dark')}
  <div class="p2-body">
    <div class="eyebrow">04&nbsp;·&nbsp;Top 10 × 2 voies</div>
    <h1 class="h1-title">Vingt métiers <span class="grad-text">alignés.</span></h1>
    <p class="lede">Deux trajectoires possibles selon l'effort de formation acceptable. Toutes croisent personnalité, secteur d'affinité et employabilité réelle.</p>
    <div class="metiers-split">
      <div class="metiers-col">
        <div class="col-head"><h3>Sans <em>formation</em></h3><span class="tag">Immédiat</span></div>
        <ol class="metiers-list">${renderList(vm.topMetiersSansFormation, vm.flaggedSet)}</ol>
      </div>
      <div class="metiers-col featured">
        <div class="col-head"><h3>Avec <em>formation courte</em></h3><span class="tag">Certifiante</span></div>
        <ol class="metiers-list">${renderList(vm.topMetiersAvecFormation, vm.flaggedSetFC)}</ol>
      </div>
    </div>
    <div class="matching-banner">
      <div><div class="lbl">Métiers identifiés</div><div class="big">${vm.topMetiersSansFormation.length + vm.topMetiersAvecFormation.length}<small></small></div></div>
      <div><div class="lbl">Lecture</div><div class="txt">Les métiers signalés (●) sont en haut du classement IA — ils croisent ses aptitudes RIASEC, ses secteurs d'affinité et un marché actif${vm.codeDepartement ? ` sur le ${escapeHtml(vm.codeDepartement)}` : ''}.</div></div>
      <div class="arrow">→</div>
    </div>
    <div class="key-cards">
      <div class="key-card"><div class="lbl">Aptitudes</div><div class="v">${vm.riasec.rows.slice(0, 3).map(r => r.name).join(', ')}</div></div>
      <div class="key-card"><div class="lbl">Environnement</div><div class="v">${vm.experienceMain?.label || 'Polyvalent'}</div></div>
      <div class="key-card" style="background:var(--g-100);border-color:var(--g-100)"><div class="lbl">Recommandation</div><div class="v">${vm.wantsFC ? 'Formation courte<br/>6 à 9 mois' : (vm.wantsFast ? 'Recherche directe<br/>poste accessible' : 'Bilan d\'orientation<br/>à approfondir')}</div></div>
    </div>
  </div>
  ${buildFooter(`Pondération RIASEC × secteur × employabilité${vm.codeDepartement ? ' département ' + vm.codeDepartement : ''}`, 4, 6)}
</section>`;
}
function pageOffres(vm: ProfileVM): string {
  // Icônes inline : œil (vu) / œil barré (non vu) + cœur plein (favori) / cœur contour (non favori).
  const eyeOnSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const eyeOffSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="2" y1="2" x2="22" y2="22"/></svg>';
  const heartOnSvg = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  const heartOffSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  const ico = (on: boolean, kind: 'eye' | 'heart', title: string) => {
    const svg = kind === 'eye' ? (on ? eyeOnSvg : eyeOffSvg) : (on ? heartOnSvg : heartOffSvg);
    return `<span class="ico${on ? ' on' : ''}" title="${title}">${svg}</span>`;
  };

  const rows = vm.jobOffers.length > 0
    ? vm.jobOffers.map((o) => `
      <tr${o.favorited ? ' class="fav"' : ''}>
        <td><div class="role">${escapeHtml(o.title)}</div>${o.company ? `<div class="corp">${escapeHtml(o.company)}</div>` : ''}</td>
        <td class="loc">${escapeHtml(o.location)}</td>
        <td class="sal">${escapeHtml(o.salary)}${o.salarySub ? `<small>${escapeHtml(o.salarySub)}</small>` : ''}</td>
        <td><div class="status">${ico(o.viewed, 'eye', o.viewed ? 'Vue' : 'Non vue')}${ico(o.favorited, 'heart', o.favorited ? 'En favori' : 'Pas en favori')}</div></td>
      </tr>`).join('')
    : `<tr><td colspan="4" style="padding:24px;text-align:center;color:var(--g-500);font-style:italic">Aucune offre matchée pour ce profil.</td></tr>`;

  return `
<section class="page page--soft">
  ${buildHeader(`${vm.prenom.toUpperCase()}${vm.nom ? ' ' + vm.nom.toUpperCase() : ''} · MARCHÉ EN TEMPS RÉEL`, 'dark')}
  <div class="p2-body">
    <div class="eyebrow">05&nbsp;·&nbsp;France Travail${vm.ville !== '—' ? ` · ${escapeHtml(vm.ville)}` : ''}</div>
    <h1 class="h1-title">Le marché, <span class="grad-text">aujourd'hui.</span></h1>
    <p class="lede">Extraction de l'API France Travail${vm.codeDepartement ? ` filtrée sur le département ${escapeHtml(vm.codeDepartement)}` : ''} et croisée avec le profil de ${escapeHtml(vm.prenom)}.</p>
    <div class="offres-summary">
      <div class="cell"><div class="lbl">Offres analysées</div><div class="val">${('0' + vm.totalOffers).slice(-2)}</div></div>
      <div class="cell"><div class="lbl">Vues</div><div class="val">${('0' + vm.viewedOffers).slice(-2)}<small>${vm.viewedOffers > 0 ? 'consulté' : 'aucune'}</small></div></div>
      <div class="cell highlight"><div class="lbl">Mis en favori</div><div class="val">${('0' + vm.favoriteOffers).slice(-2)}<small>${escapeHtml(vm.favoriteCompany)}</small></div></div>
      <div class="cell"><div class="lbl">Salaire médian</div><div class="val">${escapeHtml(vm.medianSalary)}<small>${vm.medianSalary !== '—' ? '€/mois' : ''}</small></div></div>
    </div>
    <table class="offres-table">
      <thead><tr><th style="width:42%">Offre &amp; entreprise</th><th style="width:18%">Lieu</th><th style="width:24%">Rémunération</th><th style="width:16%;text-align:right">Vu&nbsp;·&nbsp;Favori</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="insight-note">
      <div class="lbl">Lecture algorithmique</div>
      <p>${vm.totalOffers > 0 ? `Sur ${vm.totalOffers} offres analysées, ${vm.favoriteOffers} ${vm.favoriteOffers > 1 ? 'ont été misées' : 'a été misée'} en favori${vm.viewedOffers > 0 ? ` et ${vm.viewedOffers} consultée${vm.viewedOffers > 1 ? 's' : ''}` : ''}.` : 'Aucune offre matchée pour le moment.'} ${vm.careerPaths.length > 0 ? `Les offres alignées avec <b>${escapeHtml(vm.careerPaths[0].name)}</b> sont à prioriser.` : ''}</p>
    </div>
  </div>
  ${buildFooter(`Données API France Travail — extraites le ${vm.generatedDate}`, 5, 6)}
</section>`;
}

function pageEngagement(vm: ProfileVM): string {
  const rooms = vm.rooms.map(r => `
    <div class="progress-row">
      <div class="check${r.done ? '' : ' off'}">${r.done ? '✓' : '·'}</div>
      <div class="label">${escapeHtml(r.label)} <span>${escapeHtml(r.sub)}</span></div>
      <div class="date">${r.done ? escapeHtml(r.date) : '—'}</div>
    </div>`).join('');

  // Zone notes manuscrites : 10 lignes pour que le conseiller écrive à la main pendant le RDV.
  const notesLines = Array.from({ length: 10 }, () => '<div class="note-line"></div>').join('');

  return `
<section class="page page--dark">
  ${buildHeader(`${vm.prenom.toUpperCase()}${vm.nom ? ' ' + vm.nom.toUpperCase() : ''} · ENGAGEMENT & NOTES`, 'dark')}
  <div class="p2-body" style="height:100%;display:flex;flex-direction:column;padding-bottom:48px">
    <div class="eyebrow">06&nbsp;·&nbsp;Parcours dans l'application</div>
    <h1 class="h1-title">Engagement <span class="grad-text">&amp; progression.</span></h1>
    <p class="lede">${vm.connexions} session${vm.connexions > 1 ? 's' : ''}, ${vm.totalAppTimeStr} dans l'application${vm.rooms.filter(r => r.done).length === 4 ? ", l'intégralité du parcours d'orientation accompli" : ", parcours d'orientation en cours"}.</p>
    <div class="engagement-hero">
      <div class="progress-list">${rooms}</div>
      <div class="stats-card">
        <div class="stat"><div class="lbl">Connexions</div><div class="num">${vm.connexions}<small>session${vm.connexions > 1 ? 's' : ''}</small></div></div>
        <div class="stat"><div class="lbl">Temps total</div><div class="num">${escapeHtml(vm.totalAppTimeStr)}</div></div>
        <div class="stat"><div class="lbl">Dernière connexion</div><div style="font-weight:700;font-size:14pt;color:var(--white);letter-spacing:-0.02em">${escapeHtml(vm.lastConn)}</div></div>
      </div>
    </div>
    <div class="notes-block">
      <div class="notes-head">Notes du conseiller</div>
      <div class="notes-lines">${notesLines}</div>
    </div>
    <div class="closing" style="margin-top:auto">
      <h3>Une orientation <span class="grad-text">vraiment</span> alignée — accompagnée par <span class="grad-text">IMPAKT</span>.</h3>
      <div class="sig">
        <strong>IMPAKT Intelligence</strong>
        www.impakt-tech.fr<br/>
        Dossier ${escapeHtml(vm.refCode)}<br/>
        Édition · ${escapeHtml(vm.generatedDate)}
      </div>
    </div>
  </div>
  ${buildFooter("Innover l'orientation pour construire un avenir épanouissant.", 6, 6)}
</section>`;
}

// =====================================================
// EXPORT PRINCIPAL
// =====================================================

export function buildProfilePdfHtml(d: any): string {
  const vm = buildVM(d);
  const fileTitle = `Profil — ${vm.prenom} ${vm.nom}`.trim() + ' · IMPAKT';

  const sheets = [
    pageCover(vm),
    pageResume(vm),
    pageRiasec(vm),
    pageMetiers(vm),
    pageOffres(vm),
    pageEngagement(vm),
  ].map(p => `<div class="sheet">${p}</div>`).join('\n');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(fileTitle)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
</head>
<body>
${LOGO_SVG}
${sheets}
</body>
</html>`;
}

// =====================================================
// TELECHARGEMENT DIRECT — html2canvas + jsPDF
// =====================================================
// Génère le HTML magazine, le rend dans un container caché, capture chaque
// page en canvas haute résolution, puis compose un PDF A4 6 pages
// téléchargé directement sur le poste du conseiller (pas de dialogue).

export async function downloadProfilePdf(d: any): Promise<void> {
  const html = buildProfilePdfHtml(d);
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  if (!styleMatch) throw new Error('Template HTML invalide');

  // Rendu dans un iframe isolé : aucun impact sur la page principale
  // (pas de chargement de fonts dans le document parent, pas de reflow,
  // pas de pollution du scroll). Le glitch visuel disparaît.
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-100000px;top:0;width:794px;height:1123px;border:0;visibility:hidden';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  // Override CSS : html2canvas ne supporte pas background-clip:text → magenta plein
  const overrideCss = `
    .grad-text, .col-head h3 em, .hex-card .sub b,
    .status-row .col.highlight .val, .riasec-row.top .letter {
      background: none !important;
      -webkit-background-clip: initial !important;
      background-clip: initial !important;
      -webkit-text-fill-color: #E84393 !important;
      color: #E84393 !important;
    }
    .sheet { margin: 0 !important; box-shadow: none !important; }
    .sheet > .page { transform: none !important; }
  `;
  const htmlWithOverride = html.replace('</style>', overrideCss + '</style>');

  try {
    // Attendre que l'iframe soit prêt
    await new Promise<void>(resolve => {
      iframe.addEventListener('load', () => resolve(), { once: true });
      const idoc = iframe.contentDocument;
      if (idoc) {
        idoc.open();
        idoc.write(htmlWithOverride);
        idoc.close();
      }
    });

    const idoc = iframe.contentDocument!;
    // Attendre que les fonts du iframe soient chargées
    if ((idoc as any).fonts && (idoc as any).fonts.ready) {
      await (idoc as any).fonts.ready;
    }
    // Petit délai pour le rendu final
    await new Promise(resolve => setTimeout(resolve, 250));

    const html2canvas = (await import('html2canvas-pro')).default;
    const { default: jsPDF } = await import('jspdf');

    const sheets = idoc.querySelectorAll('.sheet');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const PDF_W = 210, PDF_H = 297;

    for (let i = 0; i < sheets.length; i++) {
      const page = sheets[i].querySelector('.page') as HTMLElement;
      if (!page) continue;
      const canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
        width: 794,
        height: 1123,
        windowWidth: 794,
        windowHeight: 1123,
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, PDF_W, PDF_H, undefined, 'FAST');
    }

    const fname = `profil_${(d.prenom || 'candidat').toLowerCase()}_${(d.nom || '').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.pdf`;
    pdf.save(fname);
  } finally {
    iframe.remove();
  }
}

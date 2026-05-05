/* ============================================================
   TRENDS — calcule des series temporelles depuis le tableau users
   pour alimenter les sparklines et deltas des KPI.

   Toutes les fonctions retournent un tableau de N nombres
   (du plus ancien au plus recent) + un delta % vs periode precedente.
   ============================================================ */

const DAY_MS = 86400000;

// Renvoie minuit UTC de la date donnee (pour bucketiser)
function dayKey(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Compte les users qui ont fait `predicate(u) -> Date|string|number|null` dans les N derniers jours
// Retourne { series: [n_d-(N-1), ..., n_d-0], delta: pct vs N jours precedents }
function bucketByDay(items, getDate, days = 7) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayKey = today.getTime();

  // Init buckets pour les `days` derniers jours
  const series = Array(days).fill(0);
  const prevSeries = Array(days).fill(0);

  for (const it of items) {
    const raw = getDate(it);
    if (!raw) continue;
    const ts = typeof raw === 'object' && raw._seconds ? raw._seconds * 1000 : new Date(raw).getTime();
    if (Number.isNaN(ts)) continue;
    const key = dayKey(ts);
    const offset = Math.floor((todayKey - key) / DAY_MS);
    if (offset >= 0 && offset < days) {
      // index 0 = jour le plus ancien, index days-1 = aujourd'hui
      series[days - 1 - offset] += 1;
    } else if (offset >= days && offset < days * 2) {
      prevSeries[days * 2 - 1 - offset] += 1;
    }
  }

  const sum = arr => arr.reduce((a, b) => a + b, 0);
  const cur = sum(series);
  const prev = sum(prevSeries);
  const delta = prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100);

  return { series, delta };
}

// === Helpers publics ===

// Inscriptions des N derniers jours
export function inscriptionsTrend(users = [], days = 7) {
  return bucketByDay(users, u => u.inscriptionDate, days);
}

// Quiz demarres
export function startedTrend(users = [], days = 7) {
  return bucketByDay(users.filter(u => u.quizStarted), u => u.quizStartedAt || u.inscriptionDate, days);
}

// Quiz completes
export function completedTrend(users = [], days = 7) {
  return bucketByDay(users.filter(u => u.quizCompleted), u => u.quizCompletedAt || u.completedAt, days);
}

// Activite (lastActive) — combien de users actifs par jour
export function activeTrend(users = [], days = 7) {
  return bucketByDay(users, u => u.lastActive, days);
}

// === Tendances pathway logs ===
// Total generations par jour
export function pathwayGenTrend(logs = [], days = 7) {
  return bucketByDay(logs, l => l.startedAt, days);
}

// Echecs par jour
export function pathwayFailTrend(logs = [], days = 7) {
  return bucketByDay(logs.filter(l => l.success === false), l => l.startedAt, days);
}

// Taux de reussite par jour (en %, donc on calcule diff)
export function pathwaySuccessRateTrend(logs = [], days = 7) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayKey = today.getTime();
  const buckets = Array(days).fill(null).map(() => ({ ok: 0, total: 0 }));
  let prevOk = 0, prevTotal = 0;

  for (const l of logs) {
    const raw = l.startedAt;
    if (!raw) continue;
    const ts = typeof raw === 'object' && raw._seconds ? raw._seconds * 1000 : new Date(raw).getTime();
    if (Number.isNaN(ts)) continue;
    const offset = Math.floor((todayKey - dayKey(ts)) / DAY_MS);
    if (offset >= 0 && offset < days) {
      const b = buckets[days - 1 - offset];
      b.total += 1;
      if (l.success !== false) b.ok += 1;
    } else if (offset >= days && offset < days * 2) {
      prevTotal += 1;
      if (l.success !== false) prevOk += 1;
    }
  }

  const series = buckets.map(b => b.total > 0 ? Math.round((b.ok / b.total) * 100) : null);
  // Comble les nulls par interpolation simple (prend la derniere valeur connue)
  let last = 0;
  const filled = series.map(v => { if (v === null) return last; last = v; return v; });

  const totalNow = buckets.reduce((a, b) => a + b.total, 0);
  const okNow = buckets.reduce((a, b) => a + b.ok, 0);
  const curRate = totalNow > 0 ? (okNow / totalNow) * 100 : 0;
  const prevRate = prevTotal > 0 ? (prevOk / prevTotal) * 100 : 0;
  const delta = prevRate === 0 ? 0 : Math.round(curRate - prevRate);

  return { series: filled, delta };
}

// Pour un nombre absolu sans serie (ex temps moyen) :
// Compare moyenne du temps app sur les users actifs des N derniers jours vs les N precedents.
export function avgAppTimeTrend(users = [], days = 7) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayKey = today.getTime();
  const series = Array(days).fill(null).map(() => ({ sum: 0, n: 0 }));
  let prevSum = 0, prevN = 0;

  for (const u of users) {
    if (!u.lastActive || !u.totalAppTime) continue;
    const ts = new Date(u.lastActive).getTime();
    if (Number.isNaN(ts)) continue;
    const key = dayKey(ts);
    const offset = Math.floor((todayKey - key) / DAY_MS);
    if (offset >= 0 && offset < days) {
      series[days - 1 - offset].sum += u.totalAppTime;
      series[days - 1 - offset].n += 1;
    } else if (offset >= days && offset < days * 2) {
      prevSum += u.totalAppTime;
      prevN += 1;
    }
  }

  const seriesAvg = series.map(b => b.n > 0 ? b.sum / b.n : 0);
  const curAvg = seriesAvg.reduce((a, b) => a + b, 0) / Math.max(1, seriesAvg.filter(v => v > 0).length || 1);
  const prevAvg = prevN > 0 ? prevSum / prevN : 0;
  const delta = prevAvg === 0 ? 0 : Math.round(((curAvg - prevAvg) / prevAvg) * 100);

  return { series: seriesAvg, delta };
}

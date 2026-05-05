interface TrendResult { series: number[]; delta: number }
export function inscriptionsTrend(users?: unknown[], days?: number): TrendResult;
export function startedTrend(users?: unknown[], days?: number): TrendResult;
export function completedTrend(users?: unknown[], days?: number): TrendResult;
export function activeTrend(users?: unknown[], days?: number): TrendResult;
export function avgAppTimeTrend(users?: unknown[], days?: number): TrendResult;

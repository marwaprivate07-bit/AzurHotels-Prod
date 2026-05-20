// Currency formatter for UI (TND)
// Full format: 24 754 364.963 TND
export function formatMoney(value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return "0.000 TND";
  const formatted = v.toLocaleString('en-GB', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).replace(/,/g, ' ');
  return `${formatted} TND`;
}

// Compact format for chart axes: 3M, 1.5M, 500K
export function formatMoneyCompact(value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return "0";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
}

export default formatMoney;

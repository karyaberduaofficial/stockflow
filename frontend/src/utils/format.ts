export function formatIDR(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.round(Math.abs(value));
  return `${sign}Rp ${abs.toLocaleString('id-ID')}`;
}

export function formatCompactIDR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}Rp ${(abs / 1_000_000_000).toFixed(2)} M`;
  }
  if (abs >= 1_000_000) {
    return `${sign}Rp ${(abs / 1_000_000).toFixed(1)} Jt`;
  }
  return formatIDR(value);
}

export function formatNumber(value: number): string {
  return value.toLocaleString('id-ID');
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function maskNik(nik: string, unmasked: boolean): string {
  if (unmasked) return nik;
  if (nik.length < 8) return '••••••••';
  return `${nik.slice(0, 4)}••••••••${nik.slice(-4)}`;
}

export function maskNpwp(npwp: string, unmasked: boolean): string {
  if (unmasked) return npwp;
  if (npwp.length < 8) return '••.•••.•••';
  return `${npwp.slice(0, 5)}•••••••${npwp.slice(-3)}`;
}

export function maskBankAccount(account: string, unmasked: boolean): string {
  if (unmasked) return account;
  if (account.length <= 4) return '••••';
  return `••••••${account.slice(-4)}`;
}

export function getTotalProductStock(stockByWarehouse: Record<number, number>): number {
  return Object.values(stockByWarehouse).reduce((acc, qty) => acc + qty, 0);
}

export function calculateReorderPoint(avgDailyDemand: number, leadTimeDays: number, safetyStock: number): number {
  return Math.ceil(avgDailyDemand * leadTimeDays + safetyStock);
}

export function calculateMovingAverage(series: number[], periods = 3): number {
  if (series.length === 0) return 0;
  const slice = series.slice(-periods);
  return Math.round(slice.reduce((a, b) => a + b, 0) / slice.length);
}

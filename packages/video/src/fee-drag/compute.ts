import type { FeeDragConfig } from './config';

export interface YearlyBalances {
  years: number[];
  advA: number[];
  advB: number[];
  endA: number;
  endB: number;
  gap: number;
}

export function computeYearlyBalances(cfg: FeeDragConfig): YearlyBalances {
  const { startingBalance: P, annualContribution: PMT, grossReturn: r, horizonYears: n } = cfg;
  const netA = r - cfg.advisorA.totalFee;
  const netB = r - cfg.advisorB.totalFee;

  const years: number[] = [];
  const advA: number[] = [];
  const advB: number[] = [];

  let balA = P;
  let balB = P;

  for (let year = 0; year <= n; year++) {
    years.push(year);
    advA.push(balA);
    advB.push(balB);
    if (year < n) {
      balA = balA * (1 + netA) + PMT;
      balB = balB * (1 + netB) + PMT;
    }
  }

  const endA = advA[advA.length - 1];
  const endB = advB[advB.length - 1];
  return { years, advA, advB, endA, endB, gap: endB - endA };
}

export function formatMillions(value: number): string {
  return `$${(value / 1_000_000).toFixed(2)}M`;
}

export function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

export function formatLongDollars(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

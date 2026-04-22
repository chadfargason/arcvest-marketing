import { describe, it, expect } from 'vitest';
import { computeYearlyBalances } from './compute';
import { feeDragConfig } from './config';

describe('computeYearlyBalances', () => {
  const result = computeYearlyBalances(feeDragConfig);

  it('returns 31 years of balances (year 0 through year 30)', () => {
    expect(result.years).toHaveLength(31);
    expect(result.advA).toHaveLength(31);
    expect(result.advB).toHaveLength(31);
    expect(result.years[0]).toBe(0);
    expect(result.years[30]).toBe(30);
  });

  it('starts both lines at the starting balance', () => {
    expect(result.advA[0]).toBe(500_000);
    expect(result.advB[0]).toBe(500_000);
  });

  it('Advisor A ends within $500 of $4,302,825', () => {
    expect(result.endA).toBeGreaterThan(4_302_325);
    expect(result.endA).toBeLessThan(4_303_325);
  });

  it('ArcVest ends within $500 of $5,466,575', () => {
    expect(result.endB).toBeGreaterThan(5_466_075);
    expect(result.endB).toBeLessThan(5_467_075);
  });

  it('gap is within $500 of $1,163,750', () => {
    expect(result.gap).toBeGreaterThan(1_163_250);
    expect(result.gap).toBeLessThan(1_164_250);
  });

  it('ArcVest always beats Advisor A after year 0', () => {
    for (let i = 1; i < result.years.length; i++) {
      expect(result.advB[i]).toBeGreaterThan(result.advA[i]);
    }
  });
});

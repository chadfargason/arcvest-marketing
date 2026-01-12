/**
 * ArcVest Marketing Automation System
 * Asset Ranges Configuration
 *
 * Defines the asset ranges used for lead qualification.
 */

import type { AssetRange } from '../types';

export interface AssetRangeDefinition {
  id: AssetRange;
  label: string;
  min: number;
  max: number | null;
}

export interface AssetRangesConfig {
  ranges: AssetRangeDefinition[];
  default: AssetRange;
}

export const assetRangesConfig: AssetRangesConfig = {
  ranges: [
    {
      id: 'under_500k',
      label: 'Under $500K',
      min: 0,
      max: 499999,
    },
    {
      id: '500k_to_2m',
      label: '$500K - $2M',
      min: 500000,
      max: 1999999,
    },
    {
      id: 'over_2m',
      label: '$2M+',
      min: 2000000,
      max: null, // No upper limit
    },
  ],
  default: 'under_500k',
};

/**
 * Get asset range definition by ID
 */
export function getAssetRange(id: AssetRange): AssetRangeDefinition | undefined {
  return assetRangesConfig.ranges.find((range) => range.id === id);
}

/**
 * Get asset range label by ID
 */
export function getAssetRangeLabel(id: AssetRange): string {
  const range = getAssetRange(id);
  return range?.label ?? 'Unknown';
}

/**
 * Determine asset range from a dollar amount
 */
export function getAssetRangeFromAmount(amount: number): AssetRange {
  for (const range of assetRangesConfig.ranges) {
    const inMinRange = amount >= range.min;
    const inMaxRange = range.max === null || amount <= range.max;
    if (inMinRange && inMaxRange) {
      return range.id;
    }
  }
  return assetRangesConfig.default;
}

/**
 * Get all asset range options (for dropdowns)
 */
export function getAssetRangeOptions(): Array<{ value: AssetRange; label: string }> {
  return assetRangesConfig.ranges.map((range) => ({
    value: range.id,
    label: range.label,
  }));
}

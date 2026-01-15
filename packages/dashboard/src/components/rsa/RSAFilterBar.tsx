'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { PERSONAS, VOICES, type RSAAssetFilters } from '@/lib/rsa/types';

interface RSAFilterBarProps {
  filters: RSAAssetFilters;
  onChange: (filters: RSAAssetFilters) => void;
  onReset?: () => void;
}

export function RSAFilterBar({ filters, onChange, onReset }: RSAFilterBarProps) {
  const updateFilter = <K extends keyof RSAAssetFilters>(
    key: K,
    value: RSAAssetFilters[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  const hasActiveFilters =
    (filters.personas && filters.personas.length > 0) ||
    (filters.voices && filters.voices.length > 0) ||
    (filters.status && filters.status !== 'all') ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.favoritesOnly ||
    (filters.minRating && filters.minRating > 0) ||
    filters.search;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex-1 min-w-[200px] max-w-[300px]">
          <Input
            placeholder="Search assets..."
            value={filters.search || ''}
            onChange={(e) => updateFilter('search', e.target.value)}
          />
        </div>

        {/* Persona */}
        <Select
          value={filters.personas?.[0] || 'all'}
          onValueChange={(value) =>
            updateFilter('personas', value === 'all' ? [] : [value])
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Personas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Personas</SelectItem>
            {PERSONAS.map((persona) => (
              <SelectItem key={persona.id} value={persona.id}>
                {persona.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Voice */}
        <Select
          value={filters.voices?.[0] || 'all'}
          onValueChange={(value) =>
            updateFilter('voices', value === 'all' ? [] : [value])
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Voices" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Voices</SelectItem>
            {VOICES.map((voice) => (
              <SelectItem key={voice.id} value={voice.id}>
                {voice.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status */}
        <Select
          value={filters.status || 'all'}
          onValueChange={(value) =>
            updateFilter('status', value as RSAAssetFilters['status'])
          }
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
          </SelectContent>
        </Select>

        {/* Favorites Only */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="favorites"
            checked={filters.favoritesOnly || false}
            onCheckedChange={(checked) =>
              updateFilter('favoritesOnly', checked === true)
            }
          />
          <Label htmlFor="favorites" className="text-sm cursor-pointer">
            Favorites
          </Label>
        </div>

        {/* Reset */}
        {hasActiveFilters && onReset && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            Clear Filters
          </Button>
        )}
      </div>

      {/* Date Range (secondary row) */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">Date range:</span>
        <Input
          type="date"
          className="w-[150px]"
          value={filters.dateFrom || ''}
          onChange={(e) => updateFilter('dateFrom', e.target.value || undefined)}
        />
        <span className="text-muted-foreground">to</span>
        <Input
          type="date"
          className="w-[150px]"
          value={filters.dateTo || ''}
          onChange={(e) => updateFilter('dateTo', e.target.value || undefined)}
        />

        {/* Min Rating */}
        <span className="text-muted-foreground ml-4">Min rating:</span>
        <Select
          value={filters.minRating?.toString() || '0'}
          onValueChange={(value) =>
            updateFilter('minRating', parseInt(value) || undefined)
          }
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any</SelectItem>
            <SelectItem value="1">1+ stars</SelectItem>
            <SelectItem value="2">2+ stars</SelectItem>
            <SelectItem value="3">3+ stars</SelectItem>
            <SelectItem value="4">4+ stars</SelectItem>
            <SelectItem value="5">5 stars</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

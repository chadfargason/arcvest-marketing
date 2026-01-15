'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  RSAAssetCard,
  RSAFilterBar,
  AssetDetailDialog,
  BulkActionDialog,
  ExportDialog,
  PersonaVoiceBadges,
  type ExportOptions,
} from '@/components/rsa';
import type { RSAAsset, RSAAssetFilters, BulkActionType } from '@/lib/rsa/types';
import { getPersonaName, getVoiceName } from '@/lib/rsa/types';

interface AssetGroup {
  persona_id: string | null;
  voice_id: string | null;
  created_date: string;
  master_count: number;
  variation_count: number;
  total_count: number;
  approved_count: number;
  favorited_count: number;
  assets: Array<{
    id: string;
    name: string;
    status: string;
    is_favorite: boolean;
    rating: number | null;
    compliance_passed: boolean;
    created_at: string;
  }>;
}

export default function RSAAssetsPage() {
  const [activeTab, setActiveTab] = useState('recent');

  // Data states
  const [assets, setAssets] = useState<RSAAsset[]>([]);
  const [batches, setBatches] = useState<AssetGroup[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Selection states
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [detailAsset, setDetailAsset] = useState<RSAAsset | null>(null);

  // Dialog states
  const [bulkAction, setBulkAction] = useState<BulkActionType | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<RSAAssetFilters>({});

  // Fetch batches for Recent tab
  const fetchBatches = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/rsa/batches?days=7');
      const data = await res.json();
      setBatches(data.data || []);
    } catch (error) {
      console.error('Failed to fetch batches:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch assets for Library tab
  const fetchAssets = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.personas?.length) params.set('personas', filters.personas.join(','));
      if (filters.voices?.length) params.set('voices', filters.voices.join(','));
      if (filters.status && filters.status !== 'all') params.set('status', filters.status);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.favoritesOnly) params.set('favorites', 'true');
      if (filters.minRating) params.set('minRating', filters.minRating.toString());
      if (filters.search) params.set('search', filters.search);
      params.set('limit', '50');

      const res = await fetch(`/api/rsa/assets?${params.toString()}`);
      const data = await res.json();
      setAssets(data.data || []);
      setTotalCount(data.count || 0);
    } catch (error) {
      console.error('Failed to fetch assets:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'recent') {
      fetchBatches();
    } else if (activeTab === 'library') {
      fetchAssets();
    }
  }, [activeTab, fetchBatches, fetchAssets]);

  // Handlers
  const handleSelectAsset = (assetId: string, selected: boolean) => {
    const newSelected = new Set(selectedAssets);
    if (selected) {
      newSelected.add(assetId);
    } else {
      newSelected.delete(assetId);
    }
    setSelectedAssets(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedAssets.size === assets.length) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(assets.map((a) => a.id)));
    }
  };

  const handleUpdateAsset = async (assetId: string, updates: Partial<RSAAsset>) => {
    try {
      const res = await fetch(`/api/rsa/assets/${assetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        // Refresh data
        if (activeTab === 'recent') {
          fetchBatches();
        } else {
          fetchAssets();
        }
        // Update detail if open
        if (detailAsset?.id === assetId) {
          const data = await res.json();
          setDetailAsset({ ...detailAsset, ...data });
        }
      }
    } catch (error) {
      console.error('Failed to update asset:', error);
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedAssets.size === 0) return;

    setIsProcessing(true);
    try {
      const res = await fetch('/api/rsa/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetIds: Array.from(selectedAssets),
          action: bulkAction,
        }),
      });
      if (res.ok) {
        setSelectedAssets(new Set());
        setBulkAction(null);
        fetchAssets();
      }
    } catch (error) {
      console.error('Bulk action failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async (options: ExportOptions) => {
    if (selectedAssets.size === 0) return;

    setIsProcessing(true);
    try {
      const res = await fetch('/api/rsa/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetIds: Array.from(selectedAssets),
          format: options.format,
          campaignName: options.campaignName,
          adGroupName: options.adGroupName,
          finalUrl: options.finalUrl,
        }),
      });

      if (res.ok) {
        if (options.format === 'google_ads_csv') {
          // Download CSV
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `rsa-export-${Date.now()}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          // JSON response
          const data = await res.json();
          console.log('Export data:', data);
        }
        setShowExportDialog(false);
        setSelectedAssets(new Set());
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    try {
      const res = await fetch(`/api/rsa/assets/${assetId}`, { method: 'DELETE' });
      if (res.ok) {
        setDetailAsset(null);
        fetchAssets();
      }
    } catch (error) {
      console.error('Failed to delete asset:', error);
    }
  };

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">RSA Asset Library</h1>
          <p className="text-muted-foreground">
            Browse, manage, and export generated RSA ads
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href="/dashboard/creative">Back to Creative Studio</a>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="recent">Recent</TabsTrigger>
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        {/* Recent Tab */}
        <TabsContent value="recent" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Generations from the last 7 days, grouped by persona and voice
          </p>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : batches.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No recent generations found.</p>
                <Button variant="link" asChild className="mt-2">
                  <a href="/dashboard/creative">Generate RSA Ads</a>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {batches.map((batch, idx) => (
                <Card key={idx}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-base">
                          {new Date(batch.created_date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </CardTitle>
                        <PersonaVoiceBadges
                          personaId={batch.persona_id}
                          voiceId={batch.voice_id}
                        />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {batch.master_count} master · {batch.variation_count} variations ·{' '}
                        {batch.approved_count} approved
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2">
                      {batch.assets.slice(0, 3).map((asset) => (
                        <div
                          key={asset.id}
                          className="flex items-center justify-between p-2 bg-muted/50 rounded"
                        >
                          <span className="text-sm truncate">{asset.name}</span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                asset.status === 'approved'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {asset.status}
                            </span>
                            {asset.is_favorite && (
                              <span className="text-yellow-500">★</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {batch.assets.length > 3 && (
                        <p className="text-xs text-muted-foreground text-center">
                          +{batch.assets.length - 3} more
                        </p>
                      )}
                    </div>
                    <div className="flex justify-end mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFilters({
                            personas: batch.persona_id ? [batch.persona_id] : [],
                            voices: batch.voice_id ? [batch.voice_id] : [],
                            dateFrom: batch.created_date,
                            dateTo: batch.created_date,
                          });
                          setActiveTab('library');
                        }}
                      >
                        View All
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Library Tab */}
        <TabsContent value="library" className="space-y-4">
          <RSAFilterBar
            filters={filters}
            onChange={setFilters}
            onReset={() => setFilters({})}
          />

          {/* Bulk Actions Bar */}
          {selectedAssets.size > 0 && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">
                {selectedAssets.size} selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkAction('approve')}
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkAction('favorite')}
                >
                  Favorite
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExportDialog(true)}
                >
                  Export
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkAction('archive')}
                >
                  Archive
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => setSelectedAssets(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          )}

          {/* Results summary */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {totalCount} asset{totalCount !== 1 ? 's' : ''} found
            </p>
            {assets.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                {selectedAssets.size === assets.length
                  ? 'Deselect All'
                  : 'Select All'}
              </Button>
            )}
          </div>

          {/* Asset Grid */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : assets.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  No assets match your filters.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {assets.map((asset) => (
                <RSAAssetCard
                  key={asset.id}
                  asset={asset}
                  selected={selectedAssets.has(asset.id)}
                  onSelect={(selected) => handleSelectAsset(asset.id, selected)}
                  onFavorite={(isFavorite) =>
                    handleUpdateAsset(asset.id, { is_favorite: isFavorite })
                  }
                  onRate={(rating) => handleUpdateAsset(asset.id, { rating })}
                  onStatusChange={(status) =>
                    handleUpdateAsset(asset.id, { status: status as RSAAsset['status'] })
                  }
                  onViewDetails={() => setDetailAsset(asset)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Export Tab */}
        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Export to Google Ads</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Select assets from the Library tab, then use the Export button to
                generate a Google Ads bulk upload CSV.
              </p>
              <div className="bg-muted/50 p-4 rounded-lg">
                <h3 className="font-medium mb-2">How it works:</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Go to the Library tab</li>
                  <li>Select the assets you want to export</li>
                  <li>Click the Export button in the bulk actions bar</li>
                  <li>Configure campaign and ad group settings</li>
                  <li>Download the CSV and upload to Google Ads</li>
                </ol>
              </div>
              <Button onClick={() => setActiveTab('library')}>
                Go to Library
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Asset Detail Dialog */}
      <AssetDetailDialog
        asset={detailAsset}
        open={!!detailAsset}
        onOpenChange={(open) => !open && setDetailAsset(null)}
        onUpdate={(updates) =>
          detailAsset && handleUpdateAsset(detailAsset.id, updates)
        }
        onDelete={() => detailAsset && handleDeleteAsset(detailAsset.id)}
      />

      {/* Bulk Action Dialog */}
      <BulkActionDialog
        open={!!bulkAction}
        onOpenChange={(open) => !open && setBulkAction(null)}
        action={bulkAction}
        selectedCount={selectedAssets.size}
        onConfirm={handleBulkAction}
        isLoading={isProcessing}
      />

      {/* Export Dialog */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        selectedCount={selectedAssets.size}
        onExport={handleExport}
        isLoading={isProcessing}
      />
    </div>
  );
}

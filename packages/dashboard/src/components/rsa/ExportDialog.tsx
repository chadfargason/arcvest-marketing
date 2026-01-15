'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onExport: (options: ExportOptions) => void;
  isLoading?: boolean;
}

export interface ExportOptions {
  format: 'google_ads_csv' | 'json';
  campaignName: string;
  adGroupName: string;
  finalUrl: string;
}

export function ExportDialog({
  open,
  onOpenChange,
  selectedCount,
  onExport,
  isLoading,
}: ExportDialogProps) {
  const [format, setFormat] = useState<'google_ads_csv' | 'json'>('google_ads_csv');
  const [campaignName, setCampaignName] = useState('ArcVest Campaign');
  const [adGroupName, setAdGroupName] = useState('RSA Ad Group');
  const [finalUrl, setFinalUrl] = useState('https://arcvest.com');

  const handleExport = () => {
    onExport({
      format,
      campaignName,
      adGroupName,
      finalUrl,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export RSA Assets</DialogTitle>
          <DialogDescription>
            Export {selectedCount} selected asset{selectedCount !== 1 ? 's' : ''} for
            use in Google Ads.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Format */}
          <div className="space-y-2">
            <Label>Export Format</Label>
            <Select
              value={format}
              onValueChange={(v) => setFormat(v as typeof format)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google_ads_csv">
                  Google Ads CSV (Bulk Upload)
                </SelectItem>
                <SelectItem value="json">JSON (Data Export)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {format === 'google_ads_csv' && (
            <>
              {/* Campaign Name */}
              <div className="space-y-2">
                <Label htmlFor="campaignName">Campaign Name</Label>
                <Input
                  id="campaignName"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Enter campaign name"
                />
              </div>

              {/* Ad Group Name */}
              <div className="space-y-2">
                <Label htmlFor="adGroupName">Ad Group Name</Label>
                <Input
                  id="adGroupName"
                  value={adGroupName}
                  onChange={(e) => setAdGroupName(e.target.value)}
                  placeholder="Enter ad group name"
                />
              </div>

              {/* Final URL */}
              <div className="space-y-2">
                <Label htmlFor="finalUrl">Final URL</Label>
                <Input
                  id="finalUrl"
                  type="url"
                  value={finalUrl}
                  onChange={(e) => setFinalUrl(e.target.value)}
                  placeholder="https://arcvest.com"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isLoading}>
            {isLoading ? 'Exporting...' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

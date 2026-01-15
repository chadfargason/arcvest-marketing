'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { HeadlineList } from './HeadlineList';
import { DescriptionList } from './DescriptionList';
import { RatingStars } from './RatingStars';
import { RSAStatusBadge } from './RSAStatusBadge';
import { ComplianceBadge } from './ComplianceBadge';
import { PersonaVoiceBadges } from './PersonaVoiceBadges';
import type { RSAAsset } from '@/lib/rsa/types';
import { useState } from 'react';

interface AssetDetailDialogProps {
  asset: RSAAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: (updates: Partial<RSAAsset>) => void;
  onDelete?: () => void;
}

export function AssetDetailDialog({
  asset,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: AssetDetailDialogProps) {
  const [notes, setNotes] = useState(asset?.notes || '');

  if (!asset) return null;

  const headlines = asset.content?.headlines || [];
  const descriptions = asset.content?.descriptions || [];

  const handleSaveNotes = () => {
    if (onUpdate) {
      onUpdate({ notes });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="truncate">{asset.name}</span>
            <RSAStatusBadge status={asset.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Meta info */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <PersonaVoiceBadges
              personaId={asset.persona_id}
              voiceId={asset.voice_id}
              showLabels
            />
            <div className="flex items-center gap-4">
              <ComplianceBadge
                passed={asset.compliance_passed}
                issues={asset.compliance_issues}
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rating:</span>
                <RatingStars
                  value={asset.rating}
                  onChange={(rating) => onUpdate?.({ rating })}
                  readonly={!onUpdate}
                />
              </div>
              <Button
                variant={asset.is_favorite ? 'default' : 'outline'}
                size="sm"
                onClick={() => onUpdate?.({ is_favorite: !asset.is_favorite })}
                disabled={!onUpdate}
              >
                {asset.is_favorite ? 'Favorited' : 'Add to Favorites'}
              </Button>
            </div>
          </div>

          {/* Headlines */}
          <div>
            <h3 className="font-semibold mb-3">Headlines ({headlines.length}/15)</h3>
            <div className="bg-muted/50 rounded-lg p-4">
              <HeadlineList headlines={headlines} showType />
            </div>
          </div>

          {/* Descriptions */}
          <div>
            <h3 className="font-semibold mb-3">Descriptions ({descriptions.length}/4)</h3>
            <div className="bg-muted/50 rounded-lg p-4">
              <DescriptionList descriptions={descriptions} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add notes about this asset..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2"
              rows={3}
            />
            {notes !== (asset.notes || '') && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={handleSaveNotes}
              >
                Save Notes
              </Button>
            )}
          </div>

          {/* Metadata */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Created: {new Date(asset.created_at).toLocaleString()}</p>
            <p>Updated: {new Date(asset.updated_at).toLocaleString()}</p>
            {asset.exported_at && (
              <p>Last exported: {new Date(asset.exported_at).toLocaleString()}</p>
            )}
            {asset.variation_type && (
              <p>
                Type: {asset.variation_type}
                {asset.variation_number && ` #${asset.variation_number}`}
              </p>
            )}
            {asset.generation_method && <p>Generated via: {asset.generation_method}</p>}
          </div>

          {/* Performance */}
          {(asset.impressions > 0 || asset.clicks > 0 || asset.conversions > 0) && (
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Performance</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{asset.impressions.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Impressions</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{asset.clicks.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Clicks</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{asset.conversions.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Conversions</p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              {onUpdate && asset.status === 'draft' && (
                <Button onClick={() => onUpdate({ status: 'approved' })}>
                  Approve
                </Button>
              )}
              {onUpdate && asset.status === 'approved' && (
                <Button variant="outline" onClick={() => onUpdate({ status: 'draft' })}>
                  Reject
                </Button>
              )}
            </div>
            {onDelete && (
              <Button variant="destructive" onClick={onDelete}>
                Delete Asset
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

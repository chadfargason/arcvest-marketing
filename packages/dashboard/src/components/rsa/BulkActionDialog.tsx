'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { BulkActionType } from '@/lib/rsa/types';

interface BulkActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: BulkActionType | null;
  selectedCount: number;
  onConfirm: () => void;
  isLoading?: boolean;
}

const ACTION_CONFIG: Record<
  BulkActionType,
  { title: string; description: string; confirmText: string; variant: 'default' | 'destructive' }
> = {
  approve: {
    title: 'Approve Assets',
    description: 'This will mark the selected assets as approved and ready for use.',
    confirmText: 'Approve',
    variant: 'default',
  },
  reject: {
    title: 'Reject Assets',
    description: 'This will return the selected assets to draft status.',
    confirmText: 'Reject',
    variant: 'default',
  },
  favorite: {
    title: 'Add to Favorites',
    description: 'This will add the selected assets to your favorites.',
    confirmText: 'Add to Favorites',
    variant: 'default',
  },
  unfavorite: {
    title: 'Remove from Favorites',
    description: 'This will remove the selected assets from your favorites.',
    confirmText: 'Remove from Favorites',
    variant: 'default',
  },
  archive: {
    title: 'Archive Assets',
    description: 'This will mark the selected assets as retired. They will no longer appear in active lists.',
    confirmText: 'Archive',
    variant: 'default',
  },
  delete: {
    title: 'Delete Assets',
    description: 'This will permanently delete the selected assets. This action cannot be undone.',
    confirmText: 'Delete',
    variant: 'destructive',
  },
};

export function BulkActionDialog({
  open,
  onOpenChange,
  action,
  selectedCount,
  onConfirm,
  isLoading,
}: BulkActionDialogProps) {
  if (!action) return null;

  const config = ACTION_CONFIG[action];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>
            {config.description}
            <br />
            <strong className="text-foreground">
              {selectedCount} asset{selectedCount !== 1 ? 's' : ''} selected.
            </strong>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant={config.variant}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : config.confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

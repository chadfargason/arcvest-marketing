'use client';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, CheckCircle, XCircle, Trash2 } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkStatusChange: (status: string) => void;
  onBulkDelete: () => void;
}

export function BulkActionBar({
  selectedCount,
  onClearSelection,
  onBulkStatusChange,
  onBulkDelete,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-30">
      <div className="flex items-center gap-3 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-xl">
        <span className="text-sm">
          <strong>{selectedCount}</strong> selected
        </span>

        <div className="h-4 w-px bg-gray-600" />

        {/* Quick Status Actions */}
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:text-green-400 hover:bg-gray-800"
          onClick={() => onBulkStatusChange('approved')}
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          Approve
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:text-orange-400 hover:bg-gray-800"
          onClick={() => onBulkStatusChange('review')}
        >
          <XCircle className="h-4 w-4 mr-1" />
          Back to Review
        </Button>

        {/* Status Dropdown */}
        <Select onValueChange={onBulkStatusChange}>
          <SelectTrigger className="w-32 h-8 text-xs bg-gray-800 border-gray-600 text-white">
            <SelectValue placeholder="Set status..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="review">Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>

        <div className="h-4 w-px bg-gray-600" />

        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:text-red-400 hover:bg-gray-800"
          onClick={onBulkDelete}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>

        <div className="h-4 w-px bg-gray-600" />

        <Button
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-white hover:bg-gray-800"
          onClick={onClearSelection}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

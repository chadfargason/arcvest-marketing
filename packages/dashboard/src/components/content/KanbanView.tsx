'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Eye, Edit, GripVertical } from 'lucide-react';

interface ContentItem {
  id: string;
  title: string | null;
  content_type: string;
  status: string;
  scheduled_date: string | null;
  topic: string | null;
  target_keyword: string | null;
  outline: string | null;
  draft: string | null;
  final_content: string | null;
  meta_description: string | null;
  keywords: string[] | null;
  published_url: string | null;
  published_at: string | null;
  views: number;
  engagements: number;
  leads_attributed: number;
  created_at: string;
}

interface KanbanViewProps {
  content: ContentItem[];
  onEdit: (item: ContentItem) => void;
  onPreview: (item: ContentItem) => void;
  onStatusChange: (id: string, newStatus: string) => void;
}

const KANBAN_COLUMNS = [
  { id: 'draft', label: 'Draft', color: 'bg-gray-100 border-gray-300' },
  { id: 'review', label: 'Review', color: 'bg-orange-50 border-orange-300' },
  { id: 'approved', label: 'Approved', color: 'bg-green-50 border-green-300' },
  { id: 'scheduled', label: 'Scheduled', color: 'bg-cyan-50 border-cyan-300' },
  { id: 'published', label: 'Published', color: 'bg-emerald-50 border-emerald-300' },
];

export function KanbanView({ content, onEdit, onPreview, onStatusChange }: KanbanViewProps) {
  const [draggedItem, setDraggedItem] = useState<ContentItem | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const getColumnItems = (status: string) => {
    return content.filter((item) => item.status === status);
  };

  const handleDragStart = (e: React.DragEvent, item: ContentItem) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (draggedItem && draggedItem.status !== columnId) {
      onStatusChange(draggedItem.id, columnId);
    }
    setDraggedItem(null);
    setDragOverColumn(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[500px]">
      {KANBAN_COLUMNS.map((column) => {
        const items = getColumnItems(column.id);
        const isOver = dragOverColumn === column.id;

        return (
          <div
            key={column.id}
            className={`flex-shrink-0 w-64 rounded-lg border-2 ${column.color} ${
              isOver ? 'ring-2 ring-blue-400 ring-offset-2' : ''
            }`}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className="px-3 py-2 border-b flex items-center justify-between">
              <span className="font-medium text-sm">{column.label}</span>
              <Badge variant="secondary" className="text-xs">
                {items.length}
              </Badge>
            </div>

            {/* Column Content */}
            <div className="p-2 space-y-2 min-h-[400px]">
              {items.length === 0 ? (
                <div className="text-center text-xs text-gray-400 py-8">
                  Drop items here
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                    className={`bg-white rounded border shadow-sm p-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
                      draggedItem?.id === item.id ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Drag Handle */}
                    <div className="flex items-start gap-1">
                      <GripVertical className="h-4 w-4 text-gray-300 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight truncate">
                          {item.title || 'Untitled'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(item.created_at)}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 mt-2 pt-2 border-t">
                      {item.final_content && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onPreview(item);
                          }}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-500"
                          title="Preview"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(item);
                        }}
                        className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
                        title="Edit"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

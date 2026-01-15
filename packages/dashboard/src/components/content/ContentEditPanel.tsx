'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Save, Loader2, Eye, Code, CheckCircle, XCircle } from 'lucide-react';

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

interface ContentEditPanelProps {
  content: ContentItem;
  onClose: () => void;
  onSave: (updated: ContentItem) => void;
}

const STATUSES = [
  { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  { value: 'review', label: 'Review', color: 'bg-orange-100 text-orange-700' },
  { value: 'approved', label: 'Approved', color: 'bg-green-100 text-green-700' },
  { value: 'scheduled', label: 'Scheduled', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'published', label: 'Published', color: 'bg-emerald-100 text-emerald-700' },
];

export function ContentEditPanel({ content, onClose, onSave }: ContentEditPanelProps) {
  const [formData, setFormData] = useState({
    title: content.title || '',
    status: content.status || 'draft',
    final_content: (content.final_content || '').replace(/^```html\n?/, '').replace(/\n?```$/, ''),
    meta_description: content.meta_description || '',
    keywords: content.keywords?.join(', ') || '',
    scheduled_date: content.scheduled_date || '',
  });
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<'preview' | 'html'>('preview');

  // Escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/content/${content.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          status: formData.status,
          final_content: formData.final_content,
          meta_description: formData.meta_description,
          keywords: formData.keywords.split(',').map(k => k.trim()).filter(Boolean),
          scheduled_date: formData.scheduled_date || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to save');

      const { content: updated } = await response.json();
      onSave(updated);
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    return STATUSES.find(s => s.value === status)?.color || 'bg-gray-100 text-gray-700';
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[75%] max-w-[1200px] bg-white shadow-xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-lg truncate max-w-md">
              {formData.title || 'Untitled'}
            </h2>
            <Badge className={getStatusColor(formData.status)}>
              {STATUSES.find(s => s.value === formData.status)?.label || formData.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content - Split View */}
        <div className="flex-1 flex overflow-hidden">
          {/* Edit Side */}
          <div className="w-1/2 p-4 overflow-y-auto border-r space-y-4">
            {/* Title */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-500">Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="text-sm"
              />
            </div>

            {/* Status & Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-500">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        <div className="flex items-center gap-2">
                          {s.value === 'approved' && <CheckCircle className="h-3 w-3 text-green-500" />}
                          {s.value === 'review' && <XCircle className="h-3 w-3 text-orange-500" />}
                          {s.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-500">Scheduled Date</Label>
                <Input
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Content */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-500">Content (HTML)</Label>
              <Textarea
                value={formData.final_content}
                onChange={(e) => setFormData({ ...formData, final_content: e.target.value })}
                className="font-mono text-xs min-h-[300px]"
                placeholder="Paste or edit HTML content..."
              />
            </div>

            {/* SEO Section */}
            <div className="border-t pt-4 space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">SEO Metadata</h3>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-500">Meta Description</Label>
                <Textarea
                  value={formData.meta_description}
                  onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                  className="text-sm"
                  rows={2}
                  placeholder="SEO meta description for search results..."
                />
                <p className="text-xs text-gray-400">{formData.meta_description.length}/160 characters</p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-500">Keywords (comma-separated)</Label>
                <Input
                  value={formData.keywords}
                  onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                  className="text-sm"
                  placeholder="retirement, investing, financial planning..."
                />
              </div>
            </div>
          </div>

          {/* Preview Side */}
          <div className="w-1/2 flex flex-col bg-gray-50">
            {/* Preview Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-white">
              <span className="text-xs font-medium text-gray-500">Preview</span>
              <div className="flex gap-1">
                <Button
                  variant={previewMode === 'preview' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setPreviewMode('preview')}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Preview
                </Button>
                <Button
                  variant={previewMode === 'html' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setPreviewMode('html')}
                >
                  <Code className="h-3 w-3 mr-1" />
                  HTML
                </Button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {previewMode === 'preview' ? (
                <div className="bg-white rounded border p-4">
                  <h1 className="text-xl font-bold mb-4">{formData.title || 'Untitled'}</h1>
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: formData.final_content }}
                  />
                </div>
              ) : (
                <pre className="text-xs font-mono whitespace-pre-wrap bg-gray-900 text-gray-100 p-4 rounded overflow-x-auto">
                  {formData.final_content || '(no content)'}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

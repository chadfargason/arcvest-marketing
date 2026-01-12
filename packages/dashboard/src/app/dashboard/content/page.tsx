'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  RefreshCw,
  Loader2,
  Calendar,
  FileText,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  ExternalLink,
} from 'lucide-react';

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
  published_url: string | null;
  published_at: string | null;
  views: number;
  engagements: number;
  leads_attributed: number;
  created_at: string;
}

const CONTENT_TYPES = [
  { value: 'blog_post', label: 'Blog Post' },
  { value: 'linkedin_post', label: 'LinkedIn Post' },
  { value: 'linkedin_article', label: 'LinkedIn Article' },
  { value: 'twitter_thread', label: 'Twitter Thread' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'whitepaper', label: 'Whitepaper' },
  { value: 'video_script', label: 'Video Script' },
];

const STATUSES = [
  { value: 'idea', label: 'Idea', color: 'bg-gray-100 text-gray-700' },
  { value: 'assigned', label: 'Assigned', color: 'bg-blue-100 text-blue-700' },
  { value: 'outline', label: 'Outline', color: 'bg-purple-100 text-purple-700' },
  { value: 'draft', label: 'Draft', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'review', label: 'Review', color: 'bg-orange-100 text-orange-700' },
  { value: 'approved', label: 'Approved', color: 'bg-green-100 text-green-700' },
  { value: 'scheduled', label: 'Scheduled', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'published', label: 'Published', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'archived', label: 'Archived', color: 'bg-gray-100 text-gray-500' },
];

const getStatusBadge = (status: string) => {
  const statusConfig = STATUSES.find((s) => s.value === status);
  return statusConfig || { value: status, label: status, color: 'bg-gray-100 text-gray-700' };
};

const getContentTypeLabel = (type: string) => {
  const typeConfig = CONTENT_TYPES.find((t) => t.value === type);
  return typeConfig?.label || type;
};

export default function ContentPage() {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content_type: 'blog_post',
    status: 'idea',
    scheduled_date: '',
    topic: '',
    target_keyword: '',
    outline: '',
  });

  const fetchContent = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);

      const response = await fetch(`/api/content?${params}`);
      if (!response.ok) throw new Error('Failed to fetch content');
      const data = await response.json();
      setContent(data.content || []);
    } catch (error) {
      console.error('Error fetching content:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          scheduled_date: formData.scheduled_date || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to create content');

      setShowNewDialog(false);
      setFormData({
        title: '',
        content_type: 'blog_post',
        status: 'idea',
        scheduled_date: '',
        topic: '',
        target_keyword: '',
        outline: '',
      });
      fetchContent();
    } catch (error) {
      console.error('Error creating content:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedContent) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/content/${selectedContent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          scheduled_date: formData.scheduled_date || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to update content');

      setSelectedContent(null);
      fetchContent();
    } catch (error) {
      console.error('Error updating content:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this content?')) return;

    try {
      const response = await fetch(`/api/content/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete content');
      fetchContent();
    } catch (error) {
      console.error('Error deleting content:', error);
    }
  };

  const openEditDialog = (item: ContentItem) => {
    setSelectedContent(item);
    setFormData({
      title: item.title || '',
      content_type: item.content_type,
      status: item.status,
      scheduled_date: item.scheduled_date || '',
      topic: item.topic || '',
      target_keyword: item.target_keyword || '',
      outline: item.outline || '',
    });
  };

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const getContentForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return content.filter((item) => item.scheduled_date === dateStr);
  };

  const navigateMonth = (direction: number) => {
    setCurrentMonth((prev) => {
      const newMonth = new Date(prev);
      newMonth.setMonth(newMonth.getMonth() + direction);
      return newMonth;
    });
  };

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Content Calendar</h1>
          <p className="text-muted-foreground">
            Plan and manage your content pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {CONTENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
            >
              <Calendar className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <FileText className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" onClick={fetchContent}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setFormData({
                  title: '',
                  content_type: 'blog_post',
                  status: 'idea',
                  scheduled_date: '',
                  topic: '',
                  target_keyword: '',
                  outline: '',
                });
              }}>
                <Plus className="h-4 w-4 mr-2" />
                New Content
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Content</DialogTitle>
                <DialogDescription>
                  Add a new item to your content calendar
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Content title"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Content Type</Label>
                    <Select
                      value={formData.content_type}
                      onValueChange={(v) => setFormData({ ...formData, content_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTENT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v) => setFormData({ ...formData, status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Scheduled Date</Label>
                  <Input
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Topic</Label>
                  <Input
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    placeholder="Main topic or theme"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Keyword</Label>
                  <Input
                    value={formData.target_keyword}
                    onChange={(e) => setFormData({ ...formData, target_keyword: e.target.value })}
                    placeholder="Primary SEO keyword"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Outline / Notes</Label>
                  <Textarea
                    value={formData.outline}
                    onChange={(e) => setFormData({ ...formData, outline: e.target.value })}
                    placeholder="Content outline or notes"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowNewDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={saving || !formData.title}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => navigateMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle>{monthName}</CardTitle>
              <Button variant="ghost" onClick={() => navigateMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px bg-gray-200">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="bg-gray-50 p-2 text-center text-sm font-medium">
                  {day}
                </div>
              ))}
              {days.map((date, index) => (
                <div
                  key={index}
                  className={`bg-white min-h-[100px] p-1 ${
                    date && date.toDateString() === new Date().toDateString()
                      ? 'ring-2 ring-primary ring-inset'
                      : ''
                  }`}
                >
                  {date && (
                    <>
                      <div className="text-sm text-gray-500 mb-1">{date.getDate()}</div>
                      <div className="space-y-1">
                        {getContentForDate(date).map((item) => {
                          const status = getStatusBadge(item.status);
                          return (
                            <div
                              key={item.id}
                              className={`text-xs p-1 rounded cursor-pointer truncate ${status.color}`}
                              onClick={() => openEditDialog(item)}
                            >
                              {item.title || 'Untitled'}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3">Title</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Scheduled</th>
                  <th className="text-left p-3">Keyword</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {content.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-muted-foreground">
                      No content items found. Create your first piece of content!
                    </td>
                  </tr>
                ) : (
                  content.map((item) => {
                    const status = getStatusBadge(item.status);
                    return (
                      <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <span className="font-medium">{item.title || 'Untitled'}</span>
                          {item.topic && (
                            <p className="text-sm text-muted-foreground">{item.topic}</p>
                          )}
                        </td>
                        <td className="p-3">{getContentTypeLabel(item.content_type)}</td>
                        <td className="p-3">
                          <Badge className={status.color}>{status.label}</Badge>
                        </td>
                        <td className="p-3">
                          {item.scheduled_date
                            ? new Date(item.scheduled_date).toLocaleDateString()
                            : '-'}
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {item.target_keyword || '-'}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1">
                            {item.published_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(item.published_url!, '_blank')}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(item)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!selectedContent} onOpenChange={(open) => !open && setSelectedContent(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Content</DialogTitle>
            <DialogDescription>
              Update your content item
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Content title"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Content Type</Label>
                <Select
                  value={formData.content_type}
                  onValueChange={(v) => setFormData({ ...formData, content_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Scheduled Date</Label>
              <Input
                type="date"
                value={formData.scheduled_date}
                onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Topic</Label>
              <Input
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                placeholder="Main topic or theme"
              />
            </div>
            <div className="space-y-2">
              <Label>Target Keyword</Label>
              <Input
                value={formData.target_keyword}
                onChange={(e) => setFormData({ ...formData, target_keyword: e.target.value })}
                placeholder="Primary SEO keyword"
              />
            </div>
            <div className="space-y-2">
              <Label>Outline / Notes</Label>
              <Textarea
                value={formData.outline}
                onChange={(e) => setFormData({ ...formData, outline: e.target.value })}
                placeholder="Content outline or notes"
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSelectedContent(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  RefreshCw,
  Mail,
  Phone,
  Edit,
  Save,
  X,
  AlertCircle,
  User,
  Calendar,
  TrendingUp,
  MessageSquare,
  Plus,
  Trash2,
} from 'lucide-react';
import { use } from 'react';

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  lead_score: number;
  source: string | null;
  assigned_to: string;
  created_at: string;
  last_activity_at: string | null;
  status_changed_at: string | null;
  notes: string | null;
}

interface Interaction {
  id: string;
  type: string;
  description: string;
  created_at: string;
  created_by: string | null;
}

const statusOptions = [
  { value: 'new_lead', label: 'New Lead' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'consultation_scheduled', label: 'Consultation Scheduled' },
  { value: 'consultation_completed', label: 'Consultation Completed' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'client', label: 'Client' },
  { value: 'closed_lost', label: 'Closed Lost' },
];

const interactionTypes = [
  { value: 'note', label: 'Note' },
  { value: 'email_outbound', label: 'Email Sent' },
  { value: 'email_inbound', label: 'Email Received' },
  { value: 'call_outbound', label: 'Call Made' },
  { value: 'call_inbound', label: 'Call Received' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'consultation', label: 'Consultation' },
];

function getStatusBadge(status: string) {
  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive' }> = {
    new_lead: { label: 'New Lead', variant: 'info' },
    contacted: { label: 'Contacted', variant: 'secondary' },
    consultation_scheduled: { label: 'Consultation Scheduled', variant: 'warning' },
    consultation_completed: { label: 'Consultation Completed', variant: 'success' },
    proposal_sent: { label: 'Proposal Sent', variant: 'warning' },
    client: { label: 'Client', variant: 'success' },
    closed_lost: { label: 'Closed Lost', variant: 'destructive' },
  };
  const config = statusConfig[status] || { label: status, variant: 'secondary' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function formatDate(dateString: string | null) {
  if (!dateString) return 'Never';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(dateString: string | null) {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(dateString);
}

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [contact, setContact] = useState<Contact | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Contact>>({});

  // Add interaction state
  const [isAddingInteraction, setIsAddingInteraction] = useState(false);
  const [newInteraction, setNewInteraction] = useState({ type: 'note', description: '' });
  const [isSubmittingInteraction, setIsSubmittingInteraction] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchContact = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/contacts/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('Contact not found');
          return;
        }
        throw new Error('Failed to fetch contact');
      }
      const data = await response.json();
      setContact(data.data);
      setEditForm(data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contact');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchInteractions = useCallback(async () => {
    try {
      const response = await fetch(`/api/contacts/${id}/interactions`);
      if (response.ok) {
        const data = await response.json();
        setInteractions(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch interactions:', err);
    }
  }, [id]);

  useEffect(() => {
    fetchContact();
    fetchInteractions();
  }, [fetchContact, fetchInteractions]);

  const handleSave = async () => {
    if (!contact) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!response.ok) throw new Error('Failed to update contact');
      const data = await response.json();
      setContact(data.data);
      setIsEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update contact');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete contact');
      router.push('/dashboard/contacts');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete contact');
    }
  };

  const handleAddInteraction = async () => {
    if (!newInteraction.description.trim()) return;
    setIsSubmittingInteraction(true);
    try {
      const response = await fetch(`/api/contacts/${id}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newInteraction),
      });
      if (!response.ok) throw new Error('Failed to add interaction');
      setNewInteraction({ type: 'note', description: '' });
      setIsAddingInteraction(false);
      fetchInteractions();
      fetchContact(); // Refresh to get updated lead score
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add interaction');
    } finally {
      setIsSubmittingInteraction(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive">{error || 'Contact not found'}</p>
        <Button onClick={() => router.push('/dashboard/contacts')}>Back to Contacts</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/contacts">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">
              {contact.first_name} {contact.last_name}
            </h1>
            <p className="text-muted-foreground">{contact.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button variant="outline" className="text-destructive" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => { setIsEditing(false); setEditForm(contact); }}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      value={editForm.first_name || ''}
                      onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      value={editForm.last_name || ''}
                      onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={editForm.email || ''}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={editForm.phone || ''}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={editForm.status || ''}
                      onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assigned_to">Assigned To</Label>
                    <Select
                      value={editForm.assigned_to || ''}
                      onValueChange={(value) => setEditForm({ ...editForm, assigned_to: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="chad">Chad</SelectItem>
                        <SelectItem value="erik">Erik</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{contact.first_name} {contact.last_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <a href={`mailto:${contact.email}`} className="font-medium text-blue-600 hover:underline">
                        {contact.email}
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      {contact.phone ? (
                        <a href={`tel:${contact.phone}`} className="font-medium text-blue-600 hover:underline">
                          {contact.phone}
                        </a>
                      ) : (
                        <p className="text-muted-foreground">Not provided</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Assigned To</p>
                      <Badge variant="outline" className="capitalize">{contact.assigned_to}</Badge>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Activity</CardTitle>
                <CardDescription>Interaction history with this contact</CardDescription>
              </div>
              <Button size="sm" onClick={() => setIsAddingInteraction(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            </CardHeader>
            <CardContent>
              {interactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No interactions yet</p>
                  <p className="text-sm">Add a note or log an interaction</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {interactions.map((interaction) => (
                    <div key={interaction.id} className="flex gap-4 border-l-2 border-gray-200 pl-4 pb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="capitalize">
                            {interaction.type.replace('_', ' ')}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {formatRelativeTime(interaction.created_at)}
                          </span>
                        </div>
                        <p className="text-sm">{interaction.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Current Status</p>
                {getStatusBadge(contact.status)}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Lead Score</p>
                <div className="flex items-center gap-2">
                  <TrendingUp className={`h-5 w-5 ${contact.lead_score >= 70 ? 'text-green-600' : contact.lead_score >= 40 ? 'text-yellow-600' : 'text-gray-400'}`} />
                  <span className={`text-2xl font-bold ${contact.lead_score >= 70 ? 'text-green-600' : contact.lead_score >= 40 ? 'text-yellow-600' : 'text-gray-500'}`}>
                    {contact.lead_score}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline Card */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="text-sm font-medium">{formatDate(contact.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Last Activity</p>
                  <p className="text-sm font-medium">{formatRelativeTime(contact.last_activity_at)}</p>
                </div>
              </div>
              {contact.status_changed_at && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Status Changed</p>
                    <p className="text-sm font-medium">{formatRelativeTime(contact.status_changed_at)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" onClick={() => window.location.href = `mailto:${contact.email}`}>
                <Mail className="mr-2 h-4 w-4" />
                Send Email
              </Button>
              {contact.phone && (
                <Button variant="outline" className="w-full justify-start" onClick={() => window.location.href = `tel:${contact.phone}`}>
                  <Phone className="mr-2 h-4 w-4" />
                  Call
                </Button>
              )}
              <Button variant="outline" className="w-full justify-start" onClick={() => setIsAddingInteraction(true)}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Log Interaction
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Interaction Dialog */}
      <Dialog open={isAddingInteraction} onOpenChange={setIsAddingInteraction}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Interaction</DialogTitle>
            <DialogDescription>Log an interaction with {contact.first_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={newInteraction.type}
                onValueChange={(value) => setNewInteraction({ ...newInteraction, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {interactionTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newInteraction.description}
                onChange={(e) => setNewInteraction({ ...newInteraction, description: e.target.value })}
                placeholder="Enter details about this interaction..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingInteraction(false)}>Cancel</Button>
            <Button onClick={handleAddInteraction} disabled={isSubmittingInteraction || !newInteraction.description.trim()}>
              {isSubmittingInteraction ? 'Adding...' : 'Add Interaction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {contact.first_name} {contact.last_name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

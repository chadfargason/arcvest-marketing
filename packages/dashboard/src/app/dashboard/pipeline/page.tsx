'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  RefreshCw,
  Loader2,
  User,
  Mail,
  Phone,
  Star,
  ChevronRight,
  GripVertical,
} from 'lucide-react';

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  lead_score: number;
  assigned_to: string | null;
  created_at: string;
  last_activity_at: string | null;
}

interface PipelineColumn {
  id: string;
  title: string;
  status: string;
  contacts: Contact[];
}

const PIPELINE_STAGES = [
  { id: 'new_lead', title: 'New Leads', status: 'new_lead' },
  { id: 'contacted', title: 'Contacted', status: 'contacted' },
  { id: 'consultation_scheduled', title: 'Consultation Scheduled', status: 'consultation_scheduled' },
  { id: 'consultation_completed', title: 'Consultation Completed', status: 'consultation_completed' },
  { id: 'proposal_sent', title: 'Proposal Sent', status: 'proposal_sent' },
  { id: 'client', title: 'Clients', status: 'client' },
];

export default function PipelinePage() {
  const router = useRouter();
  const [columns, setColumns] = useState<PipelineColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<Contact | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [updating, setUpdating] = useState(false);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/contacts?limit=500');
      if (!response.ok) throw new Error('Failed to fetch contacts');
      const data = await response.json();

      // Organize contacts into columns
      const organizedColumns = PIPELINE_STAGES.map((stage) => ({
        id: stage.id,
        title: stage.title,
        status: stage.status,
        contacts: data.contacts.filter((c: Contact) => c.status === stage.status),
      }));

      setColumns(organizedColumns);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleDragStart = (e: React.DragEvent, contact: Contact) => {
    setDragging(contact);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', contact.id);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!dragging || dragging.status === targetStatus) {
      setDragging(null);
      return;
    }

    await updateContactStatus(dragging, targetStatus);
    setDragging(null);
  };

  const updateContactStatus = async (contact: Contact, status: string) => {
    setUpdating(true);
    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) throw new Error('Failed to update contact');

      // Update local state
      setColumns((prev) =>
        prev.map((col) => ({
          ...col,
          contacts:
            col.status === contact.status
              ? col.contacts.filter((c) => c.id !== contact.id)
              : col.status === status
              ? [...col.contacts, { ...contact, status }]
              : col.contacts,
        }))
      );
    } catch (error) {
      console.error('Error updating contact:', error);
    } finally {
      setUpdating(false);
      setShowMoveDialog(false);
      setSelectedContact(null);
    }
  };

  const handleMoveClick = (contact: Contact) => {
    setSelectedContact(contact);
    setNewStatus(contact.status);
    setShowMoveDialog(true);
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-gray-400';
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 pb-4">
        <div>
          <h1 className="text-2xl font-bold">Sales Pipeline</h1>
          <p className="text-muted-foreground">
            Drag and drop contacts between stages
          </p>
        </div>
        <Button variant="outline" onClick={fetchContacts} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Pipeline Board */}
      <div className="flex-1 overflow-x-auto px-6 pb-6">
        <div className="flex gap-4 h-full min-w-max">
          {columns.map((column) => (
            <div
              key={column.id}
              className={`flex flex-col w-80 bg-gray-50 rounded-lg ${
                dragOverColumn === column.id ? 'ring-2 ring-primary' : ''
              }`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.status)}
            >
              {/* Column Header */}
              <div className="p-4 border-b bg-white rounded-t-lg">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{column.title}</h3>
                  <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-sm font-medium">
                    {column.contacts.length}
                  </span>
                </div>
              </div>

              {/* Column Content */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
                {column.contacts.map((contact) => (
                  <Card
                    key={contact.id}
                    className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
                      dragging?.id === contact.id ? 'opacity-50' : ''
                    }`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, contact)}
                    onDragEnd={() => setDragging(null)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center">
                          <GripVertical className="h-4 w-4 text-gray-400 mr-1" />
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {getInitials(contact.first_name, contact.last_name)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm truncate">
                              {contact.first_name} {contact.last_name}
                            </h4>
                            <div className={`flex items-center ${getScoreColor(contact.lead_score)}`}>
                              <Star className="h-3 w-3 mr-0.5" />
                              <span className="text-xs font-medium">{contact.lead_score}</span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {contact.email}
                          </p>
                          {contact.phone && (
                            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {contact.phone}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-muted-foreground">
                              {formatDate(contact.last_activity_at || contact.created_at)}
                            </span>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => handleMoveClick(contact)}
                              >
                                Move
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => router.push(`/dashboard/contacts/${contact.id}`)}
                              >
                                <ChevronRight className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {column.contacts.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                    Drop contacts here
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Move Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Contact</DialogTitle>
            <DialogDescription>
              Change the pipeline stage for {selectedContact?.first_name} {selectedContact?.last_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {selectedContact && getInitials(selectedContact.first_name, selectedContact.last_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">
                  {selectedContact?.first_name} {selectedContact?.last_name}
                </p>
                <p className="text-sm text-muted-foreground">{selectedContact?.email}</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">New Stage</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.map((stage) => (
                    <SelectItem key={stage.id} value={stage.status}>
                      {stage.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedContact && updateContactStatus(selectedContact, newStatus)}
              disabled={updating || newStatus === selectedContact?.status}
            >
              {updating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Moving...
                </>
              ) : (
                'Move Contact'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Loading Overlay */}
      {updating && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Updating contact...</span>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

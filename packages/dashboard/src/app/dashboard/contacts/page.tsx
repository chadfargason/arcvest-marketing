'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Search,
  RefreshCw,
  Mail,
  Phone,
  Trash2,
  AlertCircle,
  Upload,
  FileSpreadsheet,
  CheckCircle,
} from 'lucide-react';

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  lead_score: number;
  source: string;
  assigned_to: string;
  created_at: string;
}

interface CSVRow {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  source?: string;
  notes?: string;
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

const sourceOptions = [
  { value: 'google_ads_search', label: 'Google Ads - Search' },
  { value: 'google_ads_display', label: 'Google Ads - Display' },
  { value: 'linkedin_ads', label: 'LinkedIn Ads' },
  { value: 'organic_search', label: 'Organic Search' },
  { value: 'referral_client', label: 'Client Referral' },
  { value: 'referral_professional', label: 'Professional Referral' },
  { value: 'direct', label: 'Direct' },
  { value: 'csv_import', label: 'CSV Import' },
  { value: 'other', label: 'Other' },
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

function getScoreColor(score: number) {
  if (score >= 70) return 'text-green-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-gray-500';
}

function formatSource(source: string) {
  const sourceLabels: Record<string, string> = {
    google_ads_search: 'Google Ads',
    google_ads_display: 'Google Display',
    linkedin_ads: 'LinkedIn Ads',
    organic_search: 'Organic Search',
    referral_client: 'Client Referral',
    referral_professional: 'Professional Referral',
    csv_import: 'CSV Import',
    direct: 'Direct',
  };

  return sourceLabels[source] || source;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);

  return { headers, rows };
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // CSV Upload state
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string; imported?: number; skipped?: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New contact form state
  const [newContact, setNewContact] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    source: 'direct',
  });

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);

      const response = await fetch(`/api/contacts?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch contacts');
      const data = await response.json();
      setContacts(data.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchContacts();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchContacts]);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create contact');
      }

      setNewContact({ first_name: '', last_name: '', email: '', phone: '', source: 'direct' });
      setIsAddDialogOpen(false);
      fetchContacts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    try {
      const response = await fetch(`/api/contacts/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete contact');
      setDeleteConfirmId(null);
      fetchContacts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete contact');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      setCsvData(parsed);

      // Auto-detect column mapping
      const mapping: Record<string, string> = {};
      const lowerHeaders = parsed.headers.map(h => h.toLowerCase());

      const mappings: Record<string, string[]> = {
        first_name: ['first_name', 'firstname', 'first name', 'fname', 'given name'],
        last_name: ['last_name', 'lastname', 'last name', 'lname', 'surname', 'family name'],
        email: ['email', 'e-mail', 'email address'],
        phone: ['phone', 'phone number', 'telephone', 'tel', 'mobile'],
        source: ['source', 'lead source', 'origin'],
        notes: ['notes', 'note', 'comments', 'comment'],
      };

      for (const [field, aliases] of Object.entries(mappings)) {
        const index = lowerHeaders.findIndex(h => aliases.includes(h));
        if (index !== -1) {
          mapping[field] = parsed.headers[index];
        }
      }

      setColumnMapping(mapping);
      setUploadResult(null);
    };
    reader.readAsText(file);
  };

  const handleUploadCSV = async () => {
    if (!csvData) return;

    setIsUploading(true);
    setUploadResult(null);

    try {
      // Convert CSV rows to contact objects using column mapping
      const contacts: CSVRow[] = csvData.rows.map(row => {
        const contact: CSVRow = {
          first_name: '',
          last_name: '',
          email: '',
        };

        for (const [field, header] of Object.entries(columnMapping)) {
          const index = csvData.headers.indexOf(header);
          if (index !== -1 && row[index]) {
            (contact as unknown as Record<string, string>)[field] = row[index];
          }
        }

        return contact;
      }).filter(c => c.first_name || c.last_name || c.email);

      const response = await fetch('/api/contacts/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts }),
      });

      const result = await response.json();

      if (!response.ok) {
        setUploadResult({
          success: false,
          message: result.error || 'Failed to import contacts',
        });
        return;
      }

      setUploadResult({
        success: true,
        message: result.message,
        imported: result.imported,
        skipped: result.skipped,
      });

      if (result.imported > 0) {
        fetchContacts();
      }
    } catch (err) {
      setUploadResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to upload contacts',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const resetUploadDialog = () => {
    setCsvData(null);
    setColumnMapping({});
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive">{error}</p>
        <Button onClick={fetchContacts}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">
            Manage your leads and client relationships
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* CSV Upload Dialog */}
          <Dialog open={isUploadDialogOpen} onOpenChange={(open) => {
            setIsUploadDialogOpen(open);
            if (!open) resetUploadDialog();
          }}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Upload CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Upload Contacts from CSV</DialogTitle>
                <DialogDescription>
                  Upload a CSV file with contacts. Required columns: first_name, last_name, email.
                  Optional: phone, source, notes.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* File Input */}
                <div className="space-y-2">
                  <Label htmlFor="csv-file">Select CSV File</Label>
                  <Input
                    ref={fileInputRef}
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                  />
                </div>

                {/* Preview & Mapping */}
                {csvData && (
                  <>
                    <div className="rounded-lg border p-4 bg-muted/50">
                      <div className="flex items-center gap-2 mb-3">
                        <FileSpreadsheet className="h-5 w-5 text-green-600" />
                        <span className="font-medium">
                          {csvData.rows.length} rows detected
                        </span>
                      </div>

                      {/* Column Mapping */}
                      <div className="grid grid-cols-2 gap-3">
                        {['first_name', 'last_name', 'email', 'phone', 'source', 'notes'].map((field) => (
                          <div key={field} className="space-y-1">
                            <Label className="text-xs capitalize">{field.replace('_', ' ')}</Label>
                            <Select
                              value={columnMapping[field] || '__none__'}
                              onValueChange={(value) => setColumnMapping({ ...columnMapping, [field]: value === '__none__' ? '' : value })}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Select column" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Not mapped</SelectItem>
                                {csvData.headers.map((header) => (
                                  <SelectItem key={header} value={header}>
                                    {header}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Preview Table */}
                    <div className="rounded-lg border overflow-hidden">
                      <div className="text-sm font-medium p-2 bg-muted">Preview (first 3 rows)</div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              {csvData.headers.map((header, i) => (
                                <th key={i} className="px-2 py-1 text-left font-medium">
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {csvData.rows.slice(0, 3).map((row, i) => (
                              <tr key={i} className="border-b">
                                {row.map((cell, j) => (
                                  <td key={j} className="px-2 py-1 truncate max-w-[150px]">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}

                {/* Upload Result */}
                {uploadResult && (
                  <div className={`rounded-lg p-4 ${uploadResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex items-center gap-2">
                      {uploadResult.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className={uploadResult.success ? 'text-green-700' : 'text-red-700'}>
                        {uploadResult.message}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsUploadDialogOpen(false);
                  resetUploadDialog();
                }}>
                  {uploadResult?.success ? 'Close' : 'Cancel'}
                </Button>
                {!uploadResult?.success && (
                  <Button
                    onClick={handleUploadCSV}
                    disabled={!csvData || !columnMapping.first_name || !columnMapping.last_name || !columnMapping.email || isUploading}
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Import Contacts
                      </>
                    )}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Add Contact Dialog */}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleAddContact}>
                <DialogHeader>
                  <DialogTitle>Add New Contact</DialogTitle>
                  <DialogDescription>
                    Add a new lead or contact to your CRM.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First Name</Label>
                      <Input
                        id="first_name"
                        value={newContact.first_name}
                        onChange={(e) => setNewContact({ ...newContact, first_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last Name</Label>
                      <Input
                        id="last_name"
                        value={newContact.last_name}
                        onChange={(e) => setNewContact({ ...newContact, last_name: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newContact.email}
                      onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={newContact.phone}
                      onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source">Source</Label>
                    <Select
                      value={newContact.source}
                      onValueChange={(value) => setNewContact({ ...newContact, source: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent>
                        {sourceOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create Contact'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                type="search"
                placeholder="Search contacts by name or email..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchContacts}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contacts Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Contacts ({contacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && contacts.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No contacts found.</p>
              <p className="text-sm mt-2">Add your first contact to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Score</th>
                    <th className="pb-3 font-medium hidden md:table-cell">Source</th>
                    <th className="pb-3 font-medium hidden lg:table-cell">Assigned To</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr key={contact.id} className="border-b hover:bg-muted/50">
                      <td className="py-4">
                        <Link
                          href={`/dashboard/contacts/${contact.id}`}
                          className="hover:underline"
                        >
                          <div className="font-medium">
                            {contact.first_name} {contact.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {contact.email}
                          </div>
                        </Link>
                      </td>
                      <td className="py-4">
                        {getStatusBadge(contact.status)}
                      </td>
                      <td className="py-4">
                        <span className={`font-semibold ${getScoreColor(contact.lead_score)}`}>
                          {contact.lead_score}
                        </span>
                      </td>
                      <td className="py-4 text-sm hidden md:table-cell">
                        {formatSource(contact.source)}
                      </td>
                      <td className="py-4 hidden lg:table-cell">
                        <Badge variant="outline" className="capitalize">
                          {contact.assigned_to}
                        </Badge>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-1">
                          {contact.email && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Send Email"
                              onClick={() => window.location.href = `mailto:${contact.email}`}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                          )}
                          {contact.phone && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Call"
                              onClick={() => window.location.href = `tel:${contact.phone}`}
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                          )}
                          <Dialog
                            open={deleteConfirmId === contact.id}
                            onOpenChange={(open) => !open && setDeleteConfirmId(null)}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Delete"
                                onClick={() => setDeleteConfirmId(contact.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Delete Contact</DialogTitle>
                                <DialogDescription>
                                  Are you sure you want to delete {contact.first_name} {contact.last_name}?
                                  This action cannot be undone.
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                                  Cancel
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => handleDeleteContact(contact.id)}
                                >
                                  Delete
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Mail,
  Phone,
} from 'lucide-react';

// Placeholder data - will be fetched from API
const contacts = [
  {
    id: '1',
    first_name: 'John',
    last_name: 'Smith',
    email: 'john.smith@example.com',
    phone: '(555) 123-4567',
    status: 'consultation_scheduled',
    lead_score: 85,
    source: 'google_ads_search',
    assigned_to: 'chad',
    created_at: '2024-01-10T10:00:00Z',
  },
  {
    id: '2',
    first_name: 'Sarah',
    last_name: 'Johnson',
    email: 'sarah.j@company.com',
    phone: '(555) 234-5678',
    status: 'contacted',
    lead_score: 78,
    source: 'organic_search',
    assigned_to: 'erik',
    created_at: '2024-01-09T14:30:00Z',
  },
  {
    id: '3',
    first_name: 'Michael',
    last_name: 'Brown',
    email: 'm.brown@email.com',
    phone: '(555) 345-6789',
    status: 'new_lead',
    lead_score: 45,
    source: 'referral_client',
    assigned_to: 'chad',
    created_at: '2024-01-11T09:15:00Z',
  },
  {
    id: '4',
    first_name: 'Emily',
    last_name: 'Davis',
    email: 'emily.davis@mail.com',
    phone: '(555) 456-7890',
    status: 'proposal_sent',
    lead_score: 92,
    source: 'linkedin_ads',
    assigned_to: 'erik',
    created_at: '2024-01-08T11:45:00Z',
  },
  {
    id: '5',
    first_name: 'Robert',
    last_name: 'Wilson',
    email: 'r.wilson@business.com',
    phone: '(555) 567-8901',
    status: 'client',
    lead_score: 100,
    source: 'referral_professional',
    assigned_to: 'chad',
    created_at: '2024-01-05T16:20:00Z',
  },
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
    direct: 'Direct',
  };

  return sourceLabels[source] || source;
}

export default function ContactsPage() {
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
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Contact
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                type="search"
                placeholder="Search contacts by name or email..."
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contacts Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Score</th>
                  <th className="pb-3 font-medium">Source</th>
                  <th className="pb-3 font-medium">Assigned To</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id} className="border-b">
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
                    <td className="py-4 text-sm">
                      {formatSource(contact.source)}
                    </td>
                    <td className="py-4">
                      <Badge variant="outline" className="capitalize">
                        {contact.assigned_to}
                      </Badge>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" title="Send Email">
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Call">
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

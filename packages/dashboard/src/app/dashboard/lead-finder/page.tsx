'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  RefreshCw,
  Mail,
  Copy,
  Check,
  Send,
  SkipForward,
  Eye,
  Sparkles,
  Target,
  Building2,
  MapPin,
  TrendingUp,
  Calendar,
  AlertCircle,
  Play,
  Download,
} from 'lucide-react';

interface Lead {
  id: string;
  full_name: string;
  title: string | null;
  company: string | null;
  geo_signal: string | null;
  trigger_type: string;
  category: string;
  score: number;
  tier: string;
  rationale_short: string;
  rationale_detail: string | null;
  contact_paths: Array<{ type: string; value: string }>;
  outreach_status: string;
  created_at: string;
  lead_finder_emails?: Array<{
    id: string;
    subject: string;
    body_html: string;
    body_plain: string;
    tone: string;
    version: number;
  }>;
  lead_finder_runs?: {
    geo_name: string;
    trigger_focus: string;
  };
}

interface Run {
  id: string;
  run_date: string;
  geo_name: string;
  trigger_focus: string;
  status: string;
  stats: {
    leadsSelected?: number;
    emailsGenerated?: number;
  };
  lead_count: number;
}

const tierColors: Record<string, string> = {
  A: 'bg-green-100 text-green-800 border-green-200',
  B: 'bg-blue-100 text-blue-800 border-blue-200',
  C: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  D: 'bg-gray-100 text-gray-800 border-gray-200',
};

const statusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  email_ready: 'bg-blue-100 text-blue-700',
  sent: 'bg-green-100 text-green-700',
  skipped: 'bg-yellow-100 text-yellow-700',
  responded: 'bg-purple-100 text-purple-700',
  converted: 'bg-emerald-100 text-emerald-700',
};

const triggerLabels: Record<string, string> = {
  career_move: 'New Role',
  funding_mna: 'Funding/M&A',
  expansion: 'Expansion',
  recognition: 'Recognition',
  other: 'Other',
};

const categoryLabels: Record<string, string> = {
  exec: 'Executive',
  owner: 'Business Owner',
  professional: 'Professional',
  real_estate: 'Real Estate',
  other: 'Other',
};

const toneLabels: Record<string, string> = {
  congratulatory: 'Congratulatory',
  value_first: 'Value-First',
  peer_credibility: 'Peer Credibility',
  direct_curious: 'Direct & Curious',
};

export default function LeadFinderPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningJob, setRunningJob] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [selectedTone, setSelectedTone] = useState('congratulatory');
  
  // Filters
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [todayOnly, setTodayOnly] = useState(true);
  const [sortBy, setSortBy] = useState<'recent' | 'score'>('recent');

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (tierFilter !== 'all') params.set('tier', tierFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (todayOnly) params.set('today', 'true');
      params.set('limit', '200'); // Increased from 50 to 200
      params.set('sort', sortBy); // Add sort parameter

      const response = await fetch(`/api/lead-finder/leads?${params.toString()}`);
      const data = await response.json();
      setLeads(data.data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  }, [tierFilter, statusFilter, todayOnly, sortBy]);

  const fetchRuns = useCallback(async () => {
    try {
      const response = await fetch('/api/lead-finder/runs?limit=7');
      const data = await response.json();
      setRuns(data.data || []);
    } catch (error) {
      console.error('Error fetching runs:', error);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchRuns();
  }, [fetchLeads, fetchRuns]);

  const handleRunNow = async () => {
    if (runningJob) return;
    
    setRunningJob(true);
    try {
      const response = await fetch('/api/test/lead-finder?action=run');
      const result = await response.json();
      
      if (result.success) {
        alert(`Lead finder completed! Found ${result.leadsFound} leads.`);
        fetchLeads();
        fetchRuns();
      } else {
        alert(`Error: ${result.error || result.errorMessage}`);
      }
    } catch (error) {
      alert('Failed to run lead finder');
    } finally {
      setRunningJob(false);
    }
  };

  const openEmailDialog = (lead: Lead) => {
    setSelectedLead(lead);
    const email = lead.lead_finder_emails?.[0];
    if (email) {
      setEditedSubject(email.subject);
      setEditedBody(email.body_plain);
      setSelectedTone(email.tone);
    }
    setIsEmailDialogOpen(true);
  };

  const handleCopyEmail = async () => {
    if (!selectedLead) return;
    
    const email = selectedLead.lead_finder_emails?.[0];
    if (!email) return;

    const textToCopy = `Subject: ${editedSubject}\n\n${editedBody}`;
    
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMarkAsSent = async () => {
    if (!selectedLead) return;

    try {
      await fetch(`/api/lead-finder/leads/${selectedLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outreach_status: 'sent' }),
      });
      
      setIsEmailDialogOpen(false);
      fetchLeads();
    } catch (error) {
      console.error('Error marking as sent:', error);
    }
  };

  const handleSkip = async () => {
    if (!selectedLead) return;

    try {
      await fetch(`/api/lead-finder/leads/${selectedLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outreach_status: 'skipped' }),
      });
      
      setIsEmailDialogOpen(false);
      fetchLeads();
    } catch (error) {
      console.error('Error skipping lead:', error);
    }
  };

  const handleRegenerateEmail = async () => {
    if (!selectedLead) return;

    setRegenerating(true);
    try {
      const response = await fetch(`/api/lead-finder/emails/${selectedLead.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone: selectedTone }),
      });

      const result = await response.json();
      if (result.data) {
        setEditedSubject(result.data.subject);
        setEditedBody(result.data.body_plain);
        // Refresh leads to get new email
        fetchLeads();
      }
    } catch (error) {
      console.error('Error regenerating email:', error);
    } finally {
      setRegenerating(false);
    }
  };

  const todayStats = {
    total: leads.length,
    tierA: leads.filter(l => l.tier === 'A').length,
    ready: leads.filter(l => l.outreach_status === 'email_ready').length,
    sent: leads.filter(l => l.outreach_status === 'sent').length,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Lead Finder
          </h1>
          <p className="text-muted-foreground">
            AI-powered Texas trigger lead discovery · Manual runs use random rotation for variety
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchLeads} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            onClick={() => window.open('/api/lead-finder/export-csv', '_blank')}
            disabled={loading || leads.length === 0}
            title="Export all leads to CSV"
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={handleRunNow} disabled={runningJob}>
            {runningJob ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Run Now
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xl font-bold">{todayStats.total}</div>
            <div className="text-xs text-muted-foreground">Today&apos;s Leads</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xl font-bold text-green-600">{todayStats.tierA}</div>
            <div className="text-xs text-muted-foreground">Tier A Leads</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xl font-bold text-blue-600">{todayStats.ready}</div>
            <div className="text-xs text-muted-foreground">Ready to Send</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xl font-bold text-purple-600">{todayStats.sent}</div>
            <div className="text-xs text-muted-foreground">Sent Today</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Runs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {runs.map(run => (
              <div
                key={run.id}
                className="flex-shrink-0 p-3 border rounded-lg bg-muted/30 min-w-[180px]"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{run.geo_name}</span>
                  <Badge variant={run.status === 'success' ? 'default' : 'secondary'}>
                    {run.status}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(run.run_date).toLocaleDateString()}
                </div>
                <div className="text-sm">
                  {run.lead_count} leads • {triggerLabels[run.trigger_focus] || run.trigger_focus}
                </div>
              </div>
            ))}
            {runs.length === 0 && (
              <div className="text-muted-foreground text-center py-4 w-full">
                No runs yet. Click &quot;Run Now&quot; to start.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>Tier:</Label>
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                  <SelectItem value="D">D</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label>Status:</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="email_ready">Ready to Send</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                  <SelectItem value="responded">Responded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="todayOnly"
                checked={todayOnly}
                onChange={(e) => setTodayOnly(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="todayOnly">Today only</Label>
            </div>
            <div className="flex items-center gap-2">
              <Label>Sort:</Label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'recent' | 'score')}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="score">Highest Score</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leads List */}
      <Card>
        <CardHeader>
          <CardTitle>Leads ({leads.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No leads found.</p>
              <p className="text-sm mt-2">Try running the lead finder or adjusting filters.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leads.map(lead => (
                <div
                  key={lead.id}
                  className="border rounded-lg p-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-base">{lead.full_name}</span>
                        <Badge className={`${tierColors[lead.tier]} text-xs py-0`}>
                          {lead.tier}
                        </Badge>
                        <Badge className={`${statusColors[lead.outreach_status]} text-xs py-0`}>
                          {lead.outreach_status.replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline" className="text-xs py-0">
                          {triggerLabels[lead.trigger_type] || lead.trigger_type}
                        </Badge>
                        {(() => {
                          // Find best email (prefer found over predicted)
                          const foundEmail = lead.contact_paths?.find(p => p.type === 'generic_email');
                          const predictedEmail = lead.contact_paths?.find(p => p.type === 'predicted_email');
                          const bestEmail = foundEmail || predictedEmail;
                          
                          if (bestEmail) {
                            return (
                              <span className="text-xs flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded border border-green-200">
                                <Mail className="h-3 w-3" />
                                {bestEmail.value}
                              </span>
                            );
                          } else {
                            return (
                              <span className="text-xs flex items-center gap-1 px-2 py-0.5 bg-gray-50 text-gray-500 rounded border border-gray-200">
                                <Mail className="h-3 w-3" />
                                No email
                              </span>
                            );
                          }
                        })()}
                        <span className="text-xs text-muted-foreground ml-auto">
                          Score: {lead.score}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {lead.title && (
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {lead.title}
                          </span>
                        )}
                        {lead.company && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {lead.company}
                          </span>
                        )}
                        {lead.geo_signal && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {lead.geo_signal}
                          </span>
                        )}
                        <span className="flex items-center gap-1 ml-auto">
                          <Calendar className="h-3 w-3" />
                          {new Date(lead.created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEmailDialog(lead)}
                        className="h-8"
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        Email
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Dialog */}
      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email for {selectedLead?.full_name}</DialogTitle>
            <DialogDescription>
              Review, edit, and copy the email to send manually
            </DialogDescription>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-4">
              {/* Lead Summary */}
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={tierColors[selectedLead.tier]}>
                    Tier {selectedLead.tier}
                  </Badge>
                  <span className="font-medium">{selectedLead.title}</span>
                  <span className="text-muted-foreground">at</span>
                  <span className="font-medium">{selectedLead.company}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedLead.rationale_short}
                </p>
              </div>

              {/* Tone Selector */}
              <div className="flex items-center gap-2">
                <Label>Tone:</Label>
                <Select value={selectedTone} onValueChange={setSelectedTone}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="congratulatory">Congratulatory</SelectItem>
                    <SelectItem value="value_first">Value-First</SelectItem>
                    <SelectItem value="peer_credibility">Peer Credibility</SelectItem>
                    <SelectItem value="direct_curious">Direct & Curious</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateEmail}
                  disabled={regenerating}
                >
                  {regenerating ? (
                    <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1 h-4 w-4" />
                  )}
                  Regenerate
                </Button>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                />
              </div>

              {/* Body */}
              <div className="space-y-2">
                <Label>Email Body</Label>
                <Textarea
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>

              {/* Email Addresses - ALWAYS SHOWN */}
              <div className="space-y-2">
                <Label className="text-base font-semibold flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  Email Addresses
                </Label>
                
                {/* Found Emails (via Search) */}
                {selectedLead.contact_paths && selectedLead.contact_paths.filter(p => p.type === 'generic_email').length > 0 && (
                  <div className="space-y-1 p-3 bg-green-50 rounded-md border border-green-200">
                    <p className="text-xs text-green-700 font-medium mb-2 flex items-center gap-1">
                      <Check className="h-3 w-3" /> Found via Search
                    </p>
                    {selectedLead.contact_paths
                      .filter(p => p.type === 'generic_email')
                      .map((path, i) => (
                        <div key={i} className="text-sm flex items-center gap-2">
                          <span className="font-medium text-green-900">{path.value}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 ml-auto"
                            onClick={() => {
                              navigator.clipboard.writeText(path.value);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                  </div>
                )}

                {/* AI-Predicted Emails */}
                {selectedLead.contact_paths && selectedLead.contact_paths.filter(p => p.type === 'predicted_email').length > 0 && (
                  <div className="space-y-1 p-3 bg-purple-50 rounded-md border border-purple-200">
                    <p className="text-xs text-purple-700 font-medium mb-2 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> AI-Predicted (verify before using)
                    </p>
                    {selectedLead.contact_paths
                      .filter(p => p.type === 'predicted_email')
                      .map((path, i) => (
                        <div key={i} className="text-sm flex items-center gap-2">
                          <span className="font-medium text-purple-900">{path.value}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 ml-auto"
                            onClick={() => {
                              navigator.clipboard.writeText(path.value);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                  </div>
                )}

                {/* No Emails Found */}
                {(!selectedLead.contact_paths || 
                  (selectedLead.contact_paths.filter(p => p.type === 'generic_email' || p.type === 'predicted_email').length === 0)) && (
                  <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                    <p className="text-sm text-gray-600 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      No email addresses found or predicted for this lead
                    </p>
                  </div>
                )}
              </div>

              {/* Other Contact Paths */}
              {selectedLead.contact_paths && selectedLead.contact_paths.filter(p => p.type !== 'generic_email' && p.type !== 'predicted_email').length > 0 && (
                <div className="space-y-2">
                  <Label>Other Contact Paths</Label>
                  <div className="space-y-1">
                    {selectedLead.contact_paths
                      .filter(p => p.type !== 'generic_email' && p.type !== 'predicted_email')
                      .map((path, i) => (
                        <div key={i} className="text-sm flex items-center gap-2">
                          <Badge variant="outline">{path.type}</Badge>
                          <span className="text-muted-foreground break-all">{path.value}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleSkip}>
              <SkipForward className="mr-1 h-4 w-4" />
              Skip Lead
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={handleCopyEmail}>
              {copied ? (
                <>
                  <Check className="mr-1 h-4 w-4 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-4 w-4" />
                  Copy Email
                </>
              )}
            </Button>
            <Button onClick={handleMarkAsSent}>
              <Send className="mr-1 h-4 w-4" />
              Mark as Sent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

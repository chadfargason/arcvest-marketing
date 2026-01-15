'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sparkles,
  Play,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Copy,
} from 'lucide-react';

// Persona and Voice definitions (matching backend)
const PERSONAS = [
  { id: 'pre-retiree', name: 'Pre-Retirees (50-65)', description: 'Retirement readiness uncertainty' },
  { id: 'hnw-investor', name: 'High-Net-Worth ($2M+)', description: 'Excessive fees, conflicts' },
  { id: 'fee-conscious', name: 'Fee-Conscious Investors', description: 'Hidden fees frustration' },
  { id: 'business-owner', name: 'Business Owners', description: 'Exit planning complexity' },
  { id: 'recently-retired', name: 'Recent Retirees', description: 'Converting savings to income' },
  { id: 'diy-investor', name: 'DIY Investors', description: 'Portfolio grown too complex' },
  { id: 'wirehouse-refugee', name: 'Wirehouse Dissatisfied', description: 'Product pushing, impersonal' },
  { id: 'professional-couple', name: 'Dual-Income Professionals', description: 'Coordinating two careers' },
];

const VOICES = [
  { id: 'educational', name: 'Educational', description: 'Informative, teaching tone' },
  { id: 'direct', name: 'Direct', description: 'Punchy, action-oriented' },
  { id: 'story-driven', name: 'Story-Driven', description: 'Relatable scenarios' },
  { id: 'data-driven', name: 'Data-Driven', description: 'Stats, evidence-focused' },
  { id: 'authority', name: 'Authority', description: 'Credibility-focused' },
];

interface GenerationResult {
  personaId: string;
  voiceId: string;
  personaName: string;
  voiceName: string;
  master: {
    headlines: Array<{ text: string; type: string; charCount: number }>;
    descriptions: Array<{ text: string; charCount: number }>;
  };
  variationCount: number;
  compliancePassed: boolean;
  complianceIssues: Array<{ text: string; reason: string; severity: string }>;
  processingTimeMs: number;
  tokensUsed: number;
}

interface GenerationResponse {
  success: boolean;
  summary: {
    totalMasterAds: number;
    totalVariations: number;
    totalAds: number;
    processingTimeMs: number;
    savedRecords: { assetGroups: number; assets: number };
  };
  results: GenerationResult[];
  error?: string;
}

function CharacterCount({ count, max }: { count: number; max: number }) {
  const status = count > max ? 'error' : count >= max - 5 ? 'warning' : 'ok';
  const colors = {
    ok: 'text-green-600',
    warning: 'text-yellow-600',
    error: 'text-red-600',
  };
  return (
    <span className={`text-xs font-mono ${colors[status]}`}>
      {count}/{max}
    </span>
  );
}

function ResultCard({ result, expanded, onToggle }: { result: GenerationResult; expanded: boolean; onToggle: () => void }) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Card className="mb-4">
      <CardHeader
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <CardTitle className="text-base">{result.personaName}</CardTitle>
              <CardDescription>{result.voiceName} voice</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {result.compliancePassed ? (
              <Badge variant="success" className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Compliant
              </Badge>
            ) : (
              <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Issues
              </Badge>
            )}
            <Badge variant="secondary">
              {result.variationCount} variations
            </Badge>
            <span className="text-xs text-muted-foreground">
              {(result.processingTimeMs / 1000).toFixed(1)}s
            </span>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="border-t">
          {/* Compliance Issues */}
          {result.complianceIssues.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 rounded-lg">
              <p className="font-medium text-red-700 dark:text-red-300 mb-2">Compliance Issues:</p>
              <ul className="space-y-1">
                {result.complianceIssues.map((issue, i) => (
                  <li key={i} className="text-sm text-red-600 dark:text-red-400">
                    &bull; {issue.text}: {issue.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Headlines */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">Headlines (15)</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(result.master.headlines.map(h => h.text).join('\n'))}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy All
              </Button>
            </div>
            <div className="grid gap-2">
              {result.master.headlines.map((headline, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                    <span>{headline.text}</span>
                    <Badge variant="outline" className="text-xs">
                      {headline.type}
                    </Badge>
                  </div>
                  <CharacterCount count={headline.charCount} max={30} />
                </div>
              ))}
            </div>
          </div>

          {/* Descriptions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">Descriptions (4)</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(result.master.descriptions.map(d => d.text).join('\n'))}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy All
              </Button>
            </div>
            <div className="space-y-2">
              {result.master.descriptions.map((desc, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between p-3 bg-muted/50 rounded text-sm"
                >
                  <div className="flex gap-2 flex-1">
                    <span className="text-xs text-muted-foreground">{i + 1}.</span>
                    <span className="flex-1">{desc.text}</span>
                  </div>
                  <CharacterCount count={desc.charCount} max={90} />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function CreativePage() {
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>(['pre-retiree']);
  const [selectedVoices, setSelectedVoices] = useState<string[]>(['direct']);
  const [variationsPerCombo, setVariationsPerCombo] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GenerationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const togglePersona = (id: string) => {
    setSelectedPersonas(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const toggleVoice = (id: string) => {
    setSelectedVoices(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  const selectAllPersonas = () => {
    setSelectedPersonas(PERSONAS.map(p => p.id));
  };

  const selectAllVoices = () => {
    setSelectedVoices(VOICES.map(v => v.id));
  };

  const toggleResult = (key: string) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const generateAds = async () => {
    if (selectedPersonas.length === 0 || selectedVoices.length === 0) {
      setError('Please select at least one persona and one voice');
      return;
    }

    setGenerating(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('/api/test/rsa-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaIds: selectedPersonas,
          voiceIds: selectedVoices,
          variationsPerCombo,
          saveToDatabase: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      setResults(data);
      // Expand first result by default
      if (data.results?.[0]) {
        setExpandedResults(new Set([`${data.results[0].personaId}-${data.results[0].voiceId}`]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setGenerating(false);
    }
  };

  const estimatedAds = selectedPersonas.length * selectedVoices.length * (1 + variationsPerCombo);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6" />
            Creative Studio
          </h1>
          <p className="text-muted-foreground">
            Generate high-volume RSA ads with AI-powered persona and voice targeting
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href="/dashboard/creative/assets">View Asset Library</a>
        </Button>
      </div>

      {/* Generation Panel */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Persona Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Target Audiences</CardTitle>
                <CardDescription>Select personas to target</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={selectAllPersonas}>
                Select All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {PERSONAS.map(persona => (
                <label
                  key={persona.id}
                  className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedPersonas.includes(persona.id)}
                    onCheckedChange={() => togglePersona(persona.id)}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{persona.name}</p>
                    <p className="text-xs text-muted-foreground">{persona.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Voice Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Voice/Tone</CardTitle>
                <CardDescription>Select communication styles</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={selectAllVoices}>
                Select All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {VOICES.map(voice => (
                <label
                  key={voice.id}
                  className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedVoices.includes(voice.id)}
                    onCheckedChange={() => toggleVoice(voice.id)}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{voice.name}</p>
                    <p className="text-xs text-muted-foreground">{voice.description}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Variations Selector */}
            <div className="mt-4 pt-4 border-t">
              <label className="block text-sm font-medium mb-2">
                Variations per combination
              </label>
              <select
                value={variationsPerCombo}
                onChange={(e) => setVariationsPerCombo(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value={5}>5 variations</option>
                <option value={10}>10 variations (recommended)</option>
                <option value={15}>15 variations</option>
                <option value={20}>20 variations</option>
              </select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generation Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">
                <span className="font-medium">{selectedPersonas.length}</span> personas &times;{' '}
                <span className="font-medium">{selectedVoices.length}</span> voices &times;{' '}
                <span className="font-medium">{1 + variationsPerCombo}</span> ads each ={' '}
                <span className="font-bold text-lg">{estimatedAds}</span> total ads
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Each combination generates 1 master + {variationsPerCombo} variations
              </p>
            </div>
            <Button
              size="lg"
              onClick={generateAds}
              disabled={generating || selectedPersonas.length === 0 || selectedVoices.length === 0}
            >
              {generating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Generate RSA Ads
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {/* Summary */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{results.summary.totalMasterAds}</p>
                  <p className="text-xs text-muted-foreground">Master Ads</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{results.summary.totalVariations}</p>
                  <p className="text-xs text-muted-foreground">Variations</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{results.summary.totalAds}</p>
                  <p className="text-xs text-muted-foreground">Total Ads</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{(results.summary.processingTimeMs / 1000).toFixed(1)}s</p>
                  <p className="text-xs text-muted-foreground">Processing Time</p>
                </div>
              </div>
              {results.summary.savedRecords && (
                <div className="text-center mt-4">
                  <p className="text-sm text-muted-foreground">
                    Saved {results.summary.savedRecords.assetGroups} groups and {results.summary.savedRecords.assets} assets to database
                  </p>
                  <Button variant="outline" size="sm" className="mt-2" asChild>
                    <a href="/dashboard/creative/assets">View in Asset Library</a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Result Cards */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Generated Ads</h3>
            {results.results.map(result => (
              <ResultCard
                key={`${result.personaId}-${result.voiceId}`}
                result={result}
                expanded={expandedResults.has(`${result.personaId}-${result.voiceId}`)}
                onToggle={() => toggleResult(`${result.personaId}-${result.voiceId}`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

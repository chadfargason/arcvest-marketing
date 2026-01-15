'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, FileText, LayoutGrid } from 'lucide-react';

export default function ApprovalsPage() {
  const router = useRouter();

  // Auto-redirect after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/dashboard/content');
    }, 5000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <LayoutGrid className="h-6 w-6 text-primary" />
            Approvals Moved to Content
          </CardTitle>
          <CardDescription className="text-base">
            The Approvals Queue has been merged into the Content page for a unified workflow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
            <p className="font-medium">New features in Content:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><strong>Kanban View</strong> - Drag cards between status columns</li>
              <li><strong>Bulk Actions</strong> - Select multiple items to approve/reject</li>
              <li><strong>Split Edit Panel</strong> - Edit content with live preview</li>
              <li><strong>Quick Status Changes</strong> - Update status with one click</li>
            </ul>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            Redirecting automatically in 5 seconds...
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={() => router.push('/dashboard/content')}
          >
            <FileText className="h-4 w-4 mr-2" />
            Go to Content Management
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

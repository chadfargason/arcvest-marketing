'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Mail,
  BarChart2,
  BarChart3,
  Megaphone,
  FileText,
  Search,
  Bot,
  Settings,
  ClipboardCheck,
  Target,
  Share2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Lead Finder', href: '/dashboard/lead-finder', icon: Target },
  { name: 'Contacts', href: '/dashboard/contacts', icon: Users },
  { name: 'Tasks', href: '/dashboard/tasks', icon: CheckSquare },
  { name: 'Pipeline', href: '/dashboard/pipeline', icon: BarChart3 },
  { name: 'Campaigns', href: '/dashboard/campaigns', icon: Megaphone },
  { name: 'Meta Ads', href: '/dashboard/meta-ads', icon: Share2 },
  { name: 'Ad Performance', href: '/dashboard/ad-performance', icon: BarChart2 },
  { name: 'Content', href: '/dashboard/content', icon: FileText },
  { name: 'SEO', href: '/dashboard/seo', icon: Search },
  { name: 'Sequences', href: '/dashboard/sequences', icon: Mail },
  { name: 'Approvals', href: '/dashboard/approvals', icon: ClipboardCheck },
  { name: 'Agents', href: '/dashboard/agents', icon: Bot },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
];

const bottomNavigation = [
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col border-r bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            A
          </div>
          <span className="text-lg font-semibold">ArcVest</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t px-3 py-4">
        {bottomNavigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

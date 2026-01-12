/**
 * ArcVest Marketing Automation System
 * Formatters Utility
 *
 * Helper functions for formatting data for display.
 */

/**
 * Format a number as currency
 */
export function formatCurrency(
  amount: number,
  options?: {
    currency?: string;
    decimals?: number;
    compact?: boolean;
  }
): string {
  const { currency = 'USD', decimals = 2, compact = false } = options ?? {};

  if (compact && Math.abs(amount) >= 1000000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Format a number with commas
 */
export function formatNumber(
  num: number,
  options?: {
    decimals?: number;
    compact?: boolean;
  }
): string {
  const { decimals, compact = false } = options ?? {};

  if (compact) {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(num);
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Format a percentage
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format a date for display
 */
export function formatDate(
  date: string | Date,
  options?: {
    format?: 'short' | 'medium' | 'long' | 'relative';
    includeTime?: boolean;
  }
): string {
  const { format = 'medium', includeTime = false } = options ?? {};
  const d = typeof date === 'string' ? new Date(date) : date;

  if (format === 'relative') {
    return formatRelativeTime(d);
  }

  const dateStyle: 'short' | 'medium' | 'long' = format;
  const timeStyle: 'short' | undefined = includeTime ? 'short' : undefined;

  return new Intl.DateTimeFormat('en-US', {
    dateStyle,
    timeStyle,
  }).format(d);
}

/**
 * Format a date as relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } else {
    return formatDate(date, { format: 'short' });
  }
}

/**
 * Format a phone number
 */
export function formatPhone(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // Format based on length
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return phone; // Return original if can't format
}

/**
 * Format a contact name
 */
export function formatContactName(
  firstName: string | null,
  lastName: string | null,
  email: string
): string {
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  } else if (firstName) {
    return firstName;
  } else if (lastName) {
    return lastName;
  }
  return email;
}

/**
 * Format initials from a name
 */
export function formatInitials(
  firstName: string | null,
  lastName: string | null,
  email: string
): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  } else if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  } else if (lastName) {
    return lastName.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * Format a duration in minutes
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format lead score with classification
 */
export function formatLeadScore(score: number): {
  score: number;
  label: string;
  color: string;
} {
  if (score >= 70) {
    return { score, label: 'Hot', color: '#EF4444' };
  } else if (score >= 40) {
    return { score, label: 'Warm', color: '#F59E0B' };
  }
  return { score, label: 'Cold', color: '#6B7280' };
}

/**
 * Slugify a string (for URLs)
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

/**
 * Capitalize first letter
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = sizes[i];

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${size ?? 'Bytes'}`;
}

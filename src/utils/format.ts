export function formatCurrency(amount: number): string {
  const formatted = Math.abs(amount).toLocaleString('ar-EG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const prefix = amount < 0 ? '-' : '';
  return `${prefix}${formatted} ج.م`;
}

export function formatNumber(num: number): string {
  return num.toLocaleString('ar-EG');
}

export function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatTime(dateString: string): string {
  try {
    return new Date(dateString).toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function formatDateTime(dateString: string): string {
  try {
    const d = new Date(dateString);
    return `${formatDate(dateString)} ${formatTime(dateString)}`;
  } catch {
    return dateString;
  }
}

export function daysUntil(dateString: string): number {
  try {
    const target = new Date(dateString).getTime();
    const now = Date.now();
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  } catch {
    return 999;
  }
}

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
}

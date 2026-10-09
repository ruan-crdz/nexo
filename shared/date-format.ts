type DateFormatOptions = { timeZone?: string };
type ParsedDate = { value: Date; civil: boolean };

function parseDate(value: string): ParsedDate | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day)
      return null;
    return { value: date, civil: true };
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? { value: date, civil: false } : null;
}

function formatOptions(options: DateFormatOptions, civil: boolean) {
  return { timeZone: civil ? 'UTC' : options.timeZone };
}

export function formatDatePtBr(value?: string | null, options: DateFormatOptions = {}) {
  if (!value) return null;
  const parsed = parseDate(value);
  if (!parsed) return null;
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      ...formatOptions(options, parsed.civil),
    }).format(parsed.value);
  } catch {
    return null;
  }
}

export function formatDateTimePtBr(value?: string | null, options: DateFormatOptions = {}) {
  if (!value) return null;
  const parsed = parseDate(value);
  if (!parsed) return null;
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...formatOptions(options, parsed.civil),
    }).format(parsed.value);
  } catch {
    return null;
  }
}

export function formatMonthPtBr(value?: string | null, options: DateFormatOptions = {}) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})$/);
  const parsed = match ? parseDate(`${match[1]}-${match[2]}-15`) : parseDate(value);
  if (!parsed) return null;
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
      ...formatOptions(options, parsed.civil),
    }).format(parsed.value);
  } catch {
    return null;
  }
}

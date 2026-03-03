type FilterablePlanEvent = {
  subjectKey?: string;
  title?: string;
  typeClass?: string;
  typeLabel?: string;
};

function normalizeText(value: string | undefined): string {
  return String(value || '').trim();
}

function readableTypeLabel(event: FilterablePlanEvent): string {
  return normalizeText(event.typeLabel) || 'Zajęcia';
}

export function planFilterTypeKey(typeClass: string | undefined): string {
  const normalized = normalizeText(typeClass).toLowerCase();
  if (!normalized) return 'class';
  return normalized;
}

export function getPlanEventFilterKey(event: FilterablePlanEvent): string {
  const subjectKey = normalizeText(event.subjectKey) || normalizeText(event.title) || 'Przedmiot';
  const typeKey = planFilterTypeKey(event.typeClass);
  return `${subjectKey}||${typeKey}`;
}

export function getPlanEventFilterLabel(event: FilterablePlanEvent): string {
  const subjectLabel = normalizeText(event.title) || normalizeText(event.subjectKey) || 'Przedmiot';
  return `${subjectLabel} (${readableTypeLabel(event)})`;
}

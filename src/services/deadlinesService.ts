import type { Deadline, DeadlineType } from '../types';

const KEY = 'mf_deadlines_v1';

export function loadDeadlines(): Deadline[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export function saveDeadlines(list: Deadline[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  try { window.dispatchEvent(new CustomEvent('mf-deadlines-changed')); } catch {}
}

export function deadlinesForCar(carModel: string): Deadline[] {
  return loadDeadlines()
    .filter(d => d.carModel === carModel)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function addDeadline(d: Omit<Deadline, 'id'>): Deadline[] {
  const list = loadDeadlines();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const next = [...list, { ...d, id }];
  saveDeadlines(next);
  return next;
}

export function updateDeadline(id: string, patch: Omit<Deadline, 'id'>): Deadline[] {
  const next = loadDeadlines().map(d => d.id === id ? { ...patch, id } : d);
  saveDeadlines(next);
  return next;
}

export function removeDeadline(id: string): Deadline[] {
  const next = loadDeadlines().filter(d => d.id !== id);
  saveDeadlines(next);
  return next;
}

export function daysUntil(date: string): number {
  const target = new Date(date + 'T00:00:00').getTime();
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00').getTime();
  return Math.round((target - today) / 86400_000);
}

export type DeadlineStatus = 'overdue' | 'urgent' | 'warn' | 'ok';

export function statusOf(d: Deadline): DeadlineStatus {
  const dd = daysUntil(d.date);
  if (dd < 0) return 'overdue';
  if (dd <= 7) return 'urgent';
  if (dd <= 30) return 'warn';
  return 'ok';
}

export function nextDateFromRecurrence(date: string, rec: Deadline['recurrence']): string | null {
  if (rec === 'none') return null;
  const d = new Date(date + 'T00:00:00');
  if (rec === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else if (rec === '2years') d.setFullYear(d.getFullYear() + 2);
  return d.toISOString().slice(0, 10);
}

export const DEADLINE_LABELS: Record<DeadlineType, string> = {
  revisione: 'Revisione',
  bollo: 'Bollo',
  assicurazione: 'Assicurazione',
  tagliando: 'Tagliando',
  altro: 'Altro',
};

export const DEFAULT_RECURRENCE: Record<DeadlineType, Deadline['recurrence']> = {
  revisione: '2years',
  bollo: 'yearly',
  assicurazione: 'yearly',
  tagliando: 'yearly',
  altro: 'none',
};

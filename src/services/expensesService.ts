import type { Expense, ExpenseType } from '../types';
import { fillupsForCar } from './fillupService';

const KEY = 'mf_expenses_v1';

export function loadExpenses(): Expense[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export function saveExpenses(list: Expense[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  try { window.dispatchEvent(new CustomEvent('mf-expenses-changed')); } catch {}
}

export function expensesForCar(carModel: string): Expense[] {
  return loadExpenses()
    .filter(e => e.carModel === carModel)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function addExpense(e: Omit<Expense, 'id'>): Expense[] {
  const list = loadExpenses();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const next = [...list, { ...e, id }];
  saveExpenses(next);
  return next;
}

export function updateExpense(id: string, patch: Omit<Expense, 'id'>): Expense[] {
  const next = loadExpenses().map(e => e.id === id ? { ...patch, id } : e);
  saveExpenses(next);
  return next;
}

export function removeExpense(id: string): Expense[] {
  const next = loadExpenses().filter(e => e.id !== id);
  saveExpenses(next);
  return next;
}

export const EXPENSE_LABELS: Record<ExpenseType, string> = {
  manutenzione: 'Manutenzione',
  bollo: 'Bollo',
  assicurazione: 'Assicurazione',
  multa: 'Multa',
  pedaggio: 'Pedaggio',
  altro: 'Altro',
};

export type CategoryKey = ExpenseType | 'fuel';

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  fuel: 'Carburante',
  ...EXPENSE_LABELS,
};

export interface CarSpend {
  fuel: number;
  fuelCount: number;
  others: number;
  total: number;
  byCategory: Record<CategoryKey, number>;
  monthly: { key: string; label: string; total: number; fuel: number; others: number }[];
  fromDate: string | null;
  toDate: string | null;
}

const MONTHS_IT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

export function computeCarSpend(carModel: string, monthsBack = 12): CarSpend {
  const fills = fillupsForCar(carModel);
  const expenses = expensesForCar(carModel);

  const now = new Date();
  const buckets = [] as { key: string; label: string; total: number; fuel: number; others: number }[];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: MONTHS_IT[d.getMonth()],
      total: 0, fuel: 0, others: 0,
    });
  }
  const byKey = new Map(buckets.map(b => [b.key, b]));

  const byCategory: Record<CategoryKey, number> = {
    fuel: 0,
    manutenzione: 0,
    bollo: 0,
    assicurazione: 0,
    multa: 0,
    pedaggio: 0,
    altro: 0,
  };

  let fuel = 0, others = 0, fuelCount = 0;
  let firstDate: string | null = null;
  let lastDate: string | null = null;

  for (const f of fills) {
    fuel += f.total;
    fuelCount += 1;
    byCategory.fuel += f.total;
    if (!firstDate || f.date < firstDate) firstDate = f.date;
    if (!lastDate || f.date > lastDate) lastDate = f.date;
    const dKey = f.date.slice(0, 7);
    const b = byKey.get(dKey);
    if (b) { b.fuel += f.total; b.total += f.total; }
  }
  for (const e of expenses) {
    others += e.amount;
    byCategory[e.type] += e.amount;
    if (!firstDate || e.date < firstDate) firstDate = e.date;
    if (!lastDate || e.date > lastDate) lastDate = e.date;
    const dKey = e.date.slice(0, 7);
    const b = byKey.get(dKey);
    if (b) { b.others += e.amount; b.total += e.amount; }
  }

  return {
    fuel, fuelCount, others,
    total: fuel + others,
    byCategory,
    monthly: buckets,
    fromDate: firstDate,
    toDate: lastDate,
  };
}

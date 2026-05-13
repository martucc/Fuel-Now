import { fillupsForCar } from './fillupService';
import { expensesForCar } from './expensesService';

const KEY = 'mf_budget_v1';

export interface BudgetPrefs {
  monthly: number;
  includeOther: boolean;
}

const DEFAULTS: BudgetPrefs = { monthly: 0, includeOther: false };

export function loadBudget(): BudgetPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw);
    return { ...DEFAULTS, ...p };
  } catch { return { ...DEFAULTS }; }
}

export function saveBudget(p: BudgetPrefs) {
  localStorage.setItem(KEY, JSON.stringify(p));
  try { window.dispatchEvent(new CustomEvent('mf-budget-changed')); } catch {}
}

export interface BudgetView {
  budget: number;
  spent: number;
  spentFuel: number;
  spentOther: number;
  pct: number;
  daysInMonth: number;
  dayOfMonth: number;
  daysLeft: number;
  projection: number;
  status: 'safe' | 'warn' | 'over';
  includeOther: boolean;
}

export function computeBudget(carModel: string | undefined): BudgetView | null {
  const prefs = loadBudget();
  if (!prefs.monthly || prefs.monthly <= 0 || !carModel) return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysLeft = Math.max(0, daysInMonth - dayOfMonth);

  let spentFuel = 0;
  for (const f of fillupsForCar(carModel)) {
    if (f.date.startsWith(monthKey)) spentFuel += f.total;
  }
  let spentOther = 0;
  if (prefs.includeOther) {
    for (const e of expensesForCar(carModel)) {
      if (e.date.startsWith(monthKey)) spentOther += e.amount;
    }
  }
  const spent = spentFuel + spentOther;
  const pct = prefs.monthly > 0 ? (spent / prefs.monthly) * 100 : 0;
  const dailyRate = dayOfMonth > 0 ? spent / dayOfMonth : 0;
  const projection = dailyRate * daysInMonth;
  const status: BudgetView['status'] = pct >= 100 ? 'over' : pct >= 75 ? 'warn' : 'safe';

  return {
    budget: prefs.monthly,
    spent, spentFuel, spentOther,
    pct, daysInMonth, dayOfMonth, daysLeft,
    projection, status, includeOther: prefs.includeOther,
  };
}

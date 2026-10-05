import { z } from 'zod';
import { MAX_MONEY, validDate } from './financial-engine.ts';

export const centsSchema = z.number().int().min(0).max(MAX_MONEY);
export const dateSchema = z.string().refine(validDate, 'Data inválida.');
export const categories = [
  'Alimentação',
  'Moradia',
  'Transporte',
  'Saúde',
  'Educação',
  'Lazer',
  'Compras',
  'Salário',
  'Serviços',
  'Investimentos',
  'Outros',
] as const;
export const transactionSchema = z.object({
  id: z.string().uuid(),
  description: z.string().trim().min(2).max(180),
  amount: centsSchema.positive(),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1).max(60),
  date: dateSchema,
  status: z.enum(['paid', 'planned']),
  source: z.enum(['manual', 'whatsapp', 'import']),
  account_id: z.string().uuid().nullable(),
});
export const accountSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  kind: z.enum(['checking', 'savings', 'investment', 'credit']),
  opening_balance: z.number().int().min(-MAX_MONEY).max(MAX_MONEY),
  closing_day: z.number().int().min(1).max(31).nullable(),
  due_day: z.number().int().min(1).max(31).nullable(),
});
export const goalSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  target: centsSchema.positive(),
  saved: centsSchema,
  monthly_contribution: centsSchema,
  deadline: dateSchema,
  priority: z.enum(['high', 'medium', 'low']),
});
export const debtSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  balance: centsSchema,
  rate_bps: z.number().int().min(0).max(100_000),
  minimum: centsSchema,
  due_date: dateSchema,
  overdue: z.boolean(),
});
export const assetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  value: centsSchema,
  kind: z.enum(['property', 'vehicle', 'investment', 'other']),
});
export const budgetSchema = z.object({
  id: z.string().uuid(),
  category: z.string().min(1).max(60),
  limit_amount: centsSchema,
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});
export const employeeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  role: z.string().min(2).max(100),
  department: z.string().min(1).max(60),
  contract: z.enum(['CLT', 'PJ', 'Outro']),
  salary: centsSchema,
  benefits: centsSchema,
  charges_bps: z.number().int().min(0).max(100_000),
  other_costs: centsSchema,
  start_date: dateSchema,
});
export const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  objective: z.string().max(100),
  monthly_income: centsSchema,
  fixed_expenses: centsSchema,
  dependents: z.number().int().min(0).max(30),
  variable_income: z.boolean(),
  insured: z.boolean(),
  timezone: z.string().refine((v) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }),
  onboarded: z.boolean(),
  business_enabled: z.boolean(),
});
export const businessProfileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  segment: z.string().max(100),
  revenue: centsSchema,
  fixed_costs: centsSchema,
  variable_cost_bps: z.number().int().min(0).max(10_000),
  cash: centsSchema,
  pro_labore: centsSchema,
  tax_bps: z.number().int().min(0).max(10_000),
});
export type Transaction = z.infer<typeof transactionSchema>;
export type Account = z.infer<typeof accountSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type Debt = z.infer<typeof debtSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Budget = z.infer<typeof budgetSchema>;
export type Employee = z.infer<typeof employeeSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type BusinessProfile = z.infer<typeof businessProfileSchema>;
export interface EntityMap {
  transactions: Transaction;
  financial_accounts: Account;
  goals: Goal;
  debts: Debt;
  assets: Asset;
  budgets: Budget;
  business_transactions: Transaction;
  employees: Employee;
  business_budgets: Budget;
}
export type Entity = keyof EntityMap;
export interface Workspace {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'finance' | 'manager' | 'viewer';
}
export interface Dataset {
  profile: Profile;
  transactions: Transaction[];
  financial_accounts: Account[];
  goals: Goal[];
  debts: Debt[];
  assets: Asset[];
  budgets: Budget[];
  business_transactions: Transaction[];
  employees: Employee[];
  business_budgets: Budget[];
  business: BusinessProfile;
  organizations: Workspace[];
}
export const emptyProfile: Profile = {
  name: 'Você',
  objective: 'Organizar meu dinheiro',
  monthly_income: 0,
  fixed_expenses: 0,
  dependents: 0,
  variable_income: false,
  insured: false,
  timezone: 'America/Sao_Paulo',
  onboarded: false,
  business_enabled: false,
};
export const emptyBusiness: BusinessProfile = {
  name: 'Minha empresa',
  segment: '',
  revenue: 0,
  fixed_costs: 0,
  variable_cost_bps: 0,
  cash: 0,
  pro_labore: 0,
  tax_bps: 0,
};
export const entitySchemas = {
  transactions: transactionSchema,
  financial_accounts: accountSchema,
  goals: goalSchema,
  debts: debtSchema,
  assets: assetSchema,
  budgets: budgetSchema,
  business_transactions: transactionSchema,
  employees: employeeSchema,
  business_budgets: budgetSchema,
};
export function emptyDataset(): Dataset {
  return {
    profile: { ...emptyProfile },
    business: { ...emptyBusiness },
    transactions: [],
    financial_accounts: [],
    goals: [],
    debts: [],
    assets: [],
    budgets: [],
    business_transactions: [],
    employees: [],
    business_budgets: [],
    organizations: [],
  };
}

import type { Dataset, Goal, HabitEvent } from './domain.ts';
import { civilDate, formatMoney, money, shiftMonths, sum, validDate } from './financial-engine.ts';
import { monthlyFlow } from './insights.ts';

export function goalMonthlyBudget(
  data: Pick<Dataset, 'transactions' | 'goal_events'> & {
    goals?: Pick<Goal, 'id' | 'saved'>[];
    profile?: Pick<Dataset['profile'], 'fixed_expenses'>;
  },
  today: string,
  timezone = 'America/Sao_Paulo',
) {
  if (!validDate(today)) throw new Error('Data inválida.');
  const month = today.slice(0, 7);
  const flow = monthlyFlow(
    data.transactions.filter((row) => row.date <= today),
    month,
  );
  const events = data.goal_events.filter(
    (event) => !data.goals || data.goals.some((goal) => goal.id === event.goal_id),
  );
  const initialAllocation = sum(
    (data.goals ?? []).map((goal) =>
      Math.max(
        0,
        goal.saved - sum(events.filter((event) => event.goal_id === goal.id).map((event) => event.delta)),
      ),
    ),
  );
  const monthEvents = events.filter((event) => {
    const day = civilDate(new Date(event.created_at), timezone);
    return day >= `${month}-01` && day <= today;
  });
  const contributed: Record<string, number> = {};
  for (const event of monthEvents)
    contributed[event.goal_id] = sum([contributed[event.goal_id] ?? 0, event.delta]);
  const allocatedThisMonth = sum(monthEvents.map((event) => event.delta));
  const allocated = Math.max(0, sum([initialAllocation, allocatedThisMonth]));
  const bills = sum(
    data.transactions
      .filter(
        (row) =>
          row.status === 'planned' && row.type === 'expense' && row.date < shiftMonths(`${month}-01`, 1),
      )
      .map((row) => row.amount),
  );
  const essentialRemaining = Math.max(0, (data.profile?.fixed_expenses ?? 0) - flow.expenses);
  const reservedExpenses = Math.max(bills, essentialRemaining);
  return {
    ...flow,
    allocated,
    initialAllocation,
    allocatedThisMonth,
    contributed,
    bills,
    reservedExpenses,
    available: Math.max(0, sum([flow.net, -allocated, -reservedExpenses])),
  };
}

export function goalMonthlyPlan(
  goal: Pick<Goal, 'target' | 'saved' | 'deadline'>,
  today: string,
  available: number,
  contributed = 0,
) {
  money(goal.target);
  money(goal.saved);
  money(available);
  money(contributed);
  if (
    goal.target <= 0 ||
    goal.saved < 0 ||
    available < 0 ||
    !validDate(today) ||
    (goal.deadline !== null && !validDate(goal.deadline))
  )
    throw new Error('Valores de planejamento inválidos.');
  const remaining = Math.max(0, goal.target - goal.saved);
  const savedThisMonth = Math.max(0, contributed);
  if (!goal.deadline)
    return {
      remaining,
      months: null,
      required: 0,
      suggested: 0,
      gap: 0,
      monthlyTarget: null,
      savedThisMonth,
      overdue: false,
      feasibleNow: true,
      projectedMonth: null,
    };
  const months = Math.max(
    1,
    (Number(goal.deadline.slice(0, 4)) - Number(today.slice(0, 4))) * 12 +
      Number(goal.deadline.slice(5, 7)) -
      Number(today.slice(5, 7)) +
      1,
  );
  const monthlyTarget = remaining > 0 ? Math.ceil(sum([remaining, savedThisMonth]) / months) : 0;
  const required = Math.max(0, monthlyTarget - savedThisMonth);
  const suggested = Math.min(remaining, required, available);
  const gap = Math.max(0, required - suggested);
  const monthsAtCurrentCapacity = available > 0 ? Math.ceil(remaining / available) : null;
  return {
    remaining,
    months,
    required,
    suggested,
    gap,
    monthlyTarget,
    savedThisMonth,
    overdue: goal.deadline < today && remaining > 0,
    feasibleNow: gap === 0 && (goal.deadline >= today || remaining === 0),
    projectedMonth:
      monthsAtCurrentCapacity !== null && monthsAtCurrentCapacity > 0 && monthsAtCurrentCapacity <= 600
        ? shiftMonths(`${today.slice(0, 7)}-01`, monthsAtCurrentCapacity - 1).slice(0, 7)
        : null,
  };
}

export const goalPresets = [500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000000].map(
  (value) => value * 100,
);
export type HabitKind = HabitEvent['kind'];
export const habitPoints: Record<HabitKind, number> = {
  checkin: 5,
  reflection: 10,
  message: 2,
  record: 2,
  saving: 10,
};
export const habitLimits: Record<HabitKind, number> = {
  checkin: 1,
  reflection: 1,
  message: 5,
  record: 5,
  saving: 1,
};
export function goalJourney(goal: Pick<Goal, 'target' | 'saved'>, weekly: number, highWater = goal.saved) {
  money(goal.target);
  money(goal.saved);
  money(weekly);
  money(highWater);
  if (goal.target <= 0 || goal.saved < 0 || weekly < 0 || highWater < 0)
    throw new Error('Valores da Caixinha inválidos.');
  const remaining = Math.max(0, goal.target - goal.saved);
  const peak = Math.max(highWater, goal.saved);
  const percent = Math.min(100, (goal.saved / goal.target) * 100);
  const ladder = [1000, 5000, 10000, ...goalPresets, goal.target];
  const milestones = [...new Set(ladder.filter((value) => value <= goal.target))].sort(
    (first, second) => first - second,
  );
  const milestone = milestones.find((value) => value > goal.saved) ?? goal.target;
  const previousMilestone = milestones.filter((value) => value < milestone).at(-1) ?? 0;
  const milestonePercent = Math.min(
    100,
    Math.max(0, ((goal.saved - previousMilestone) / (milestone - previousMilestone)) * 100),
  );
  return {
    remaining,
    peak,
    percent,
    milestone,
    previousMilestone,
    milestonePercent,
    nextStep: Math.min(remaining, weekly),
    weeks: weekly > 0 ? Math.ceil(remaining / weekly) : null,
    recovering: goal.saved < peak,
    message:
      remaining === 0
        ? 'Você chegou ao seu alvo. O próximo passo é seu.'
        : goal.saved < peak
          ? `Seu esforço não foi apagado. Você já chegou a ${formatMoney(peak)}. Vamos retomar no seu ritmo, sem tirar dinheiro do essencial.`
          : weekly > 0
            ? `Um passo de ${formatMoney(Math.min(remaining, weekly))} nesta semana, se couber no seu momento.`
            : 'Escolha um passo que caiba na sua semana. Pausar também faz parte.',
  };
}
export function habitSummary(events: HabitEvent[]) {
  const seen = new Set<string>();
  let points = 0;
  const checkins = new Set<string>();
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    if (!Number.isInteger(event.points) || event.points < 0 || event.points > 10)
      throw new Error('Pontos inválidos.');
    points += event.points;
    if (event.kind === 'checkin') checkins.add(event.day);
  }
  const thresholds = [0, 25, 75, 150, 300, 600, 1000];
  const level = Math.max(
    0,
    thresholds.findLastIndex((threshold) => points >= threshold),
  );
  const labels = [
    'Primeiro passo',
    'Criando seu caminho',
    'Ganhando clareza',
    'Ritmo próprio',
    'Constância possível',
    'Experiência que fica',
    'Seu caminho continua',
  ];
  const next = thresholds[level + 1] ?? null;
  return {
    points,
    level: level + 1,
    label: labels[level],
    next,
    remaining: next === null ? 0 : next - points,
    checkins: checkins.size,
    rewards: [
      { id: 'postcard', required: 25, title: 'Cartão da sua primeira conquista', unlocked: points >= 25 },
      { id: 'style', required: 75, title: 'Escolher a cor da sua jornada', unlocked: points >= 75 },
      { id: 'letter', required: 150, title: 'Carta do seu progresso', unlocked: points >= 150 },
      { id: 'celebration', required: 300, title: 'Quadro das suas conquistas', unlocked: points >= 300 },
    ],
  };
}
export function canAward(
  events: HabitEvent[],
  kind: HabitKind,
  day: string,
  eventId: string,
  cadence: 'daily' | 'weekly' = 'daily',
) {
  if (events.some((event) => event.id === eventId)) return false;
  if (kind === 'reflection' || (kind === 'checkin' && cadence === 'weekly')) {
    const current = new Date(`${day}T12:00:00Z`);
    const monday = new Date(current);
    monday.setUTCDate(current.getUTCDate() - ((current.getUTCDay() + 6) % 7));
    const start = monday.toISOString().slice(0, 10);
    return !events.some((event) => event.kind === kind && event.day >= start && event.day <= day);
  }
  return events.filter((event) => event.kind === kind && event.day === day).length < habitLimits[kind];
}

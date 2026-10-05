import { expect, it } from 'vitest';
import { canAward, goalJourney, goalPresets, habitSummary } from '../../shared/journey';
it('urgência reduz dinheiro atual sem apagar conquista e sem prometer rendimento', () => {
  const journey = goalJourney({ target: 50000, saved: 0 }, 500, 30000);
  expect(journey).toMatchObject({
    recovering: true,
    peak: 30000,
    remaining: 50000,
    nextStep: 500,
    weeks: 100,
  });
  expect(journey.message).toContain('não foi apagado');
  expect(journey.message).toContain('essencial');
});
it('meta oferece passos exatos, inclusive bilhões, e permite pausa', () => {
  expect(goalPresets).toContain(100000000000);
  expect(goalJourney({ target: 50000, saved: 49999 }, 1000).nextStep).toBe(1);
  expect(goalJourney({ target: 50000, saved: 0 }, 0).weeks).toBeNull();
});
it('progresso local não confunde o próximo marco com uma meta bilionária', () => {
  const journey = goalJourney({ target: 100000000000, saved: 500 }, 500);
  expect(journey.milestone).toBe(1000);
  expect(journey.milestonePercent).toBe(50);
  expect(journey.percent).toBeLessThan(1);
});
it('pontos não somem após pausa ou emergência e não representam dinheiro', () => {
  const events = [
    { id: 'a', kind: 'checkin' as const, day: '2026-10-01', points: 5 },
    { id: 'b', kind: 'saving' as const, day: '2026-10-01', points: 10 },
  ];
  expect(habitSummary([...events, events[0]]).points).toBe(15);
  expect(habitSummary(events).label).toBe('Primeiro passo');
});
it('check-in e mensagens são limitados e reflexão vale uma vez por semana', () => {
  const events = [
    { id: 'check', kind: 'checkin' as const, day: '2026-10-05', points: 5 },
    { id: 'review', kind: 'reflection' as const, day: '2026-10-05', points: 10 },
  ];
  expect(canAward(events, 'checkin', '2026-10-05', 'another')).toBe(false);
  expect(canAward(events, 'reflection', '2026-10-06', 'another')).toBe(false);
  expect(canAward(events, 'checkin', '2026-10-06', 'another')).toBe(true);
});

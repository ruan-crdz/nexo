import { expect, it } from 'vitest';
import { notificationStatus } from '../../shared/notification-status';
const now = Date.parse('2026-10-05T12:00:00Z');
const healthy = { configured: true, scheduled: true, connected: true, lastSuccess: '2026-10-05T11:50:00Z' };
it('só informa disponibilidade com configuração, agenda, vínculo e execução recente', () => {
  expect(notificationStatus(healthy, now).available).toBe(true);
  for (const patch of [
    { configured: false },
    { scheduled: false },
    { connected: false },
    { lastSuccess: null },
    { lastSuccess: 'invalid' },
    { lastSuccess: '2026-10-05T10:00:00Z' },
    { lastSuccess: '2026-10-06T10:00:00Z' },
  ])
    expect(notificationStatus({ ...healthy, ...patch }, now).available).toBe(false);
});

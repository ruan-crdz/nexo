import { expect, it } from 'vitest';
import { groupFamilyInvites } from '../../shared/family';
import { formatDatePtBr, formatMonthPtBr } from '../../shared/date-format';

const owner = 'owner-1';
const simone = 'simone-1';
const base = {
  owner_id: owner,
  viewer_id: simone,
  owner_name: 'Ruan',
  viewer_name: 'Simone',
  viewer_email: 'simone@example.test',
  scope: 'summary' as const,
  state: 'active' as const,
  expires_at: '2026-10-09T00:00:00Z',
};

it('agrupa permissões nos dois sentidos em um cartão de pessoa', () => {
  const groups = groupFamilyInvites(
    [
      { ...base, id: 'invite-owner' },
      {
        ...base,
        id: 'invite-viewer',
        owner_id: simone,
        viewer_id: owner,
        owner_name: 'Simone',
        viewer_name: 'Ruan',
      },
    ],
    owner,
  );
  expect(groups).toHaveLength(1);
  expect(groups[0]).toMatchObject({
    name: 'Simone',
    sharedByMe: [{ id: 'invite-owner' }],
    sharedWithMe: [{ id: 'invite-viewer' }],
  });
});

it('não agrupa convites sem destinatário como se fossem a mesma pessoa', () => {
  const groups = groupFamilyInvites(
    [
      { ...base, id: 'pending-a', viewer_id: null, viewer_name: null },
      { ...base, id: 'pending-b', viewer_id: null, viewer_name: null },
    ],
    owner,
  );
  expect(groups.map((group) => group.id)).toEqual(['pending:pending-a', 'pending:pending-b']);
});

it('formata datas familiares em pt-BR e trata datas inválidas sem expor o valor bruto', () => {
  expect(formatDatePtBr('2026-10-26')).toMatch(/26.*out.*2026/);
  expect(formatDatePtBr('2026-10-26', { timeZone: 'Pacific/Honolulu' })).toMatch(/26.*out.*2026/);
  expect(formatMonthPtBr('2026-10')).toMatch(/outubro.*2026/);
  expect(formatDatePtBr('2026-10-1A')).toBeNull();
  expect(formatDatePtBr('2026-02-31')).toBeNull();
});

import { authenticate, json, serve, HttpError } from '../_shared/http.ts';
serve(async (request) => {
  const { user, db } = await authenticate(request, 'export');
  const tables = [
    'profiles',
    'financial_accounts',
    'transactions',
    'goals',
    'debts',
    'assets',
    'budgets',
    'recurring_rules',
    'financial_notifications',
    'transaction_history',
    'transaction_sources',
    'category_preferences',
    'operation_metrics',
    'ai_messages',
    'whatsapp_connections',
    'whatsapp_messages_metadata',
  ];
  const result: Record<string, unknown> = {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    user: { id: user.id, email: user.email },
  };
  for (const table of tables) {
    const rows: unknown[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db
        .from(table)
        .select('*')
        .eq(table === 'profiles' ? 'id' : 'user_id', user.id)
        .range(offset, offset + 999);
      if (error) throw new HttpError(503, 'Exportação incompleta. Tente novamente.');
      rows.push(...data);
      if (data.length < 1000) break;
    }
    result[table] = rows;
  }
  const family = await db.rpc('list_family_invites');
  if (family.error) throw new HttpError(503, 'Exportação familiar incompleta.');
  result.family_permissions = family.data;
  const proposals = await db.from('family_proposals').select('*').eq('owner_id', user.id);
  if (proposals.error) throw new HttpError(503, 'Exportação de propostas incompleta.');
  result.family_proposals = proposals.data;
  const membership = await db
    .from('organization_members')
    .select('organization_id,role')
    .eq('user_id', user.id);
  if (membership.error) throw new HttpError(503, 'Exportação incompleta.');
  result.memberships = membership.data;
  // Company records are exported only by owners/admins, not every viewer.
  result.organizations = [];
  for (const m of membership.data.filter((m) => ['owner', 'admin'].includes(m.role))) {
    const exported: Record<string, unknown> = { organization_id: m.organization_id };
    for (const table of [
      'business_profiles',
      'business_transactions',
      'employees',
      'business_budgets',
      'audit_logs',
      'organization_members',
    ]) {
      const rows: unknown[] = [];
      for (let offset = 0; ; offset += 1000) {
        const r = await db
          .from(table)
          .select('*')
          .eq('organization_id', m.organization_id)
          .range(offset, offset + 999);
        if (r.error) throw new HttpError(503, 'Exportação empresarial incompleta.');
        rows.push(...r.data);
        if (r.data.length < 1000) break;
      }
      exported[table] = rows;
    }
    (result.organizations as unknown[]).push(exported);
  }
  return json(result);
});

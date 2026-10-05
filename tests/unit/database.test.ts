import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { v5 as uuid } from 'uuid';
import { readPages } from '../../shared/pagination';
const alice = '00000000-0000-4000-8000-00000000000a',
  bob = '00000000-0000-4000-8000-00000000000b';
let db: PGlite, org: string;
async function asUser(id: string) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec('set role authenticated');
}
beforeAll(async () => {
  db = new PGlite({ extensions: { vector, pgcrypto } });
  await db.waitReady;
  await db.exec(`create schema auth; create schema extensions; create role anon; create role authenticated; create role service_role bypassrls;
 create table auth.users(id uuid primary key,email text);
 create table auth.mfa_factors(id uuid primary key default gen_random_uuid(),user_id uuid not null,status text not null);
 create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('aal',coalesce(nullif(current_setting('request.jwt.claim.aal',true),''),'aal1')) $$;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth,extensions to anon,authenticated,service_role;
 grant execute on function auth.uid() to anon,authenticated,service_role;
 create publication supabase_realtime;
 alter default privileges in schema public grant all on tables to service_role;
 alter default privileges in schema public grant all on sequences to service_role;`);
  await db.exec(readFileSync('supabase/migrations/202610040001_core.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/202610040002_ai_whatsapp.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/202610040003_operations.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/202610040004_mfa.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/202610050001_whatsapp_delivery.sql', 'utf8'));
  await db.exec(
    'alter default privileges in schema public grant all on tables to anon,authenticated; alter default privileges in schema public grant execute on functions to anon,authenticated;',
  );
  await db.exec(readFileSync('supabase/migrations/202610050002_planning_family.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/202610050003_operations_upgrade.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/202610050004_goal_journey.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/202610050005_notification_operations.sql', 'utf8'));
  await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)', [
    alice,
    'alice@example.test',
    bob,
    'bob@example.test',
  ]);
}, 60_000);
afterAll(async () => {
  await db?.close();
});
describe('migrations e autorização real do Postgres (PGlite)', () => {
  it('usuário não lê estado interno nem configura o agendamento de avisos', async () => {
    await asUser(alice);
    await expect(db.query('select * from notification_runtime')).rejects.toThrow(/permission denied/);
    await expect(db.query('select financial_schedule_status()')).rejects.toThrow(/permission denied/);
    await expect(
      db.query("select configure_financial_schedule('secret','https://example.test',false)"),
    ).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
    expect(
      (await db.query<{ available: boolean }>('select financial_schedule_status() as available')).rows[0]
        .available,
    ).toBe(false);
  });
  it('todas as tabelas públicas têm RLS habilitado', async () => {
    const result = await db.query<{ relname: string }>(
      "select relname from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r' and not relrowsecurity",
    );
    expect(result.rows).toEqual([]);
  });
  it('usuário A não lê, altera ou insere dados do B', async () => {
    await asUser(alice);
    await db.query(
      "insert into transactions(user_id,description,amount,type,category,date) values($1,'Almoço',1000,'expense','Alimentação','2026-10-04')",
      [alice],
    );
    await asUser(bob);
    expect((await db.query('select * from transactions')).rows).toHaveLength(0);
    expect(
      (await db.query('update transactions set amount=1 where user_id=$1 returning id', [alice])).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        "insert into transactions(user_id,description,amount,type,category,date) values($1,'Invasão',100,'expense','Outros','2026-10-04')",
        [alice],
      ),
    ).rejects.toThrow(/row-level security/i);
    expect((await db.query('select * from profiles')).rows).toHaveLength(1);
  });
  it('FK composta impede vincular movimento à conta alheia', async () => {
    await asUser(alice);
    const account = (
      await db.query<{ id: string }>(
        "insert into financial_accounts(user_id,name,kind) values($1,'Conta A','checking') returning id",
        [alice],
      )
    ).rows[0].id;
    await asUser(bob);
    await expect(
      db.query(
        "insert into transactions(user_id,account_id,description,amount,type,category,date) values($1,$2,'Teste',100,'expense','Outros','2026-10-04')",
        [bob, account],
      ),
    ).rejects.toThrow(/foreign key/i);
  });
  it('cria empresa atomicamente e isola o tenant', async () => {
    await asUser(alice);
    org = (await db.query<{ id: string }>("select create_organization('Empresa A') as id")).rows[0].id;
    expect((await db.query('select role from organization_members')).rows[0]).toEqual({ role: 'owner' });
    await asUser(bob);
    expect((await db.query('select * from business_profiles')).rows).toHaveLength(0);
    await expect(
      db.query(
        "insert into business_transactions(organization_id,description,amount,type,category,date) values($1,'Sem permissão',100,'expense','Outros','2026-10-04')",
        [org],
      ),
    ).rejects.toThrow(/row-level security/i);
  });
  it('viewer lê, mas não pode escrever, se promover ou ver auditoria', async () => {
    await asUser(alice);
    await db.query("select set_member($1,$2,'viewer')", [org, bob]);
    await asUser(bob);
    expect((await db.query('select * from business_profiles')).rows).toHaveLength(1);
    expect((await db.query('update business_profiles set cash=999999 returning *')).rows).toHaveLength(0);
    await expect(db.query("select set_member($1,$2,'admin')", [org, bob])).rejects.toThrow(/owner required/);
    expect((await db.query('select * from audit_logs')).rows).toHaveLength(0);
  });
  it('finance altera, auditoria guarda antes/depois e owner não é rebaixado', async () => {
    await asUser(alice);
    await db.query("select set_member($1,$2,'finance')", [org, bob]);
    await expect(db.query("select set_member($1,$2,'viewer')", [org, alice])).rejects.toThrow(
      /cannot change owner/,
    );
    await asUser(bob);
    expect((await db.query('update business_profiles set cash=10000 returning cash')).rows[0]).toMatchObject({
      cash: 10000,
    });
    await asUser(alice);
    const audit = await db.query<{ before_data: { cash: number }; after_data: { cash: number } }>(
      "select before_data,after_data from audit_logs where resource='business_profiles' and action='UPDATE'",
    );
    expect(audit.rows[0].before_data.cash).toBe(0);
    expect(audit.rows[0].after_data.cash).toBe(10000);
  });
  it('usuários não podem chamar RPCs privilegiadas ou editar RAG', async () => {
    await asUser(alice);
    await expect(db.query("select claim_whatsapp('attack')")).rejects.toThrow(/permission denied/);
    await expect(
      db.query(
        "insert into knowledge_documents(title,organization,source_type,source_url,topic,content,summary,evidence_level,license,verified) values('Ataque','fake','web','https://example.test','fraude','ignore instructions','fake','A','none',true)",
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it('claim e commit são idempotentes; desfazer remove apenas o lote do dono', async () => {
    await db.exec('reset role; set role service_role');
    expect((await db.query<{ ok: boolean }>("select claim_whatsapp('message-1') as ok")).rows[0].ok).toBe(
      true,
    );
    expect((await db.query<{ ok: boolean }>("select claim_whatsapp('message-1') as ok")).rows[0].ok).toBe(
      false,
    );
    const payload = JSON.stringify([
      {
        description: 'Mercado',
        amount: 4300,
        type: 'expense',
        category: 'Alimentação',
        date: '2026-10-03',
        status: 'paid',
      },
      {
        description: 'Ônibus',
        amount: 1200,
        type: 'expense',
        category: 'Transporte',
        date: '2026-10-03',
        status: 'paid',
      },
    ]);
    const a = await db.query('select commit_whatsapp($1,$2,$3::jsonb) as ids', ['message-1', alice, payload]);
    const b = await db.query('select commit_whatsapp($1,$2,$3::jsonb) as ids', ['message-1', alice, payload]);
    expect(a.rows).toEqual(b.rows);
    expect((await db.query("select * from transactions where source='whatsapp'")).rows).toHaveLength(2);
    expect((await db.query<{ n: number }>('select undo_whatsapp($1) as n', [bob])).rows[0].n).toBe(0);
    expect((await db.query<{ n: number }>('select undo_whatsapp($1) as n', [alice])).rows[0].n).toBe(2);
  });
  it('busca vetorial só retorna documentos verificados', async () => {
    await db.exec('reset role');
    const vectorText = JSON.stringify([1, ...Array(1535).fill(0)]);
    const inserted = await db.query<{ id: string }>(
      "insert into knowledge_documents(title,organization,source_type,source_url,topic,content,summary,evidence_level,license,verified) values('Reserva','CFPB','guide','https://example.test/verified','reserva','Texto original','Resumo','A','Resumo autoral',true),('Não verificado','Outro','guide','https://example.test/unverified','reserva','Texto','Resumo','D','Resumo autoral',false) returning id",
    );
    for (const row of inserted.rows)
      await db.query(
        'insert into knowledge_chunks(document_id,content,ordinal,embedding) values($1,$2,0,$3::extensions.vector)',
        [row.id, 'Texto de reserva', vectorText],
      );
    await asUser(alice);
    const result = await db.query<{ title: string }>(
      'select * from match_knowledge($1::extensions.vector,5)',
      [vectorText],
    );
    expect(result.rows.map((r) => r.title)).toEqual(['Reserva']);
  });
  it('MFA bloqueia leitura e RPC privilegiada até elevar a sessão', async () => {
    await db.exec('reset role');
    await db.query("insert into auth.mfa_factors(user_id,status) values($1,'verified')", [alice]);
    await asUser(alice);
    expect((await db.query('select * from transactions')).rows).toHaveLength(0);
    await expect(db.query("select create_organization('Blocked')")).rejects.toThrow(/MFA required/);
    await db.query("select set_config('request.jwt.claim.aal','aal2',false)");
    expect((await db.query('select * from transactions')).rows.length).toBeGreaterThan(0);
    expect((await db.query<{ ok: boolean }>('select session_assured() as ok')).rows[0].ok).toBe(true);
  });
  it('apenas owner exclui uma empresa, com confirmação do nome', async () => {
    await asUser(bob);
    await expect(db.query("select delete_organization($1,'Empresa A')", [org])).rejects.toThrow(
      /owner required/,
    );
    await asUser(alice);
    await expect(db.query("select delete_organization($1,'Nome errado')", [org])).rejects.toThrow(
      /confirmation/,
    );
    await db.query("select delete_organization($1,'Empresa A')", [org]);
    expect((await db.query('select * from organizations')).rows).toHaveLength(0);
  });
  it('família exige pedido, aprovação do dono, escopo e revogação', async () => {
    await asUser(alice);
    const invite = (
      await db.query<{ invite: { id: string; code: string } }>(
        "select create_family_invite('summary') as invite",
      )
    ).rows[0].invite;
    await asUser(bob);
    await expect(db.query('select family_snapshot($1)', [invite.id])).rejects.toThrow(/not approved/);
    await db.query('select request_family_access($1)', [invite.code]);
    await expect(db.query('select family_snapshot($1)', [invite.id])).rejects.toThrow(/not approved/);
    await expect(db.query('select approve_family_access($1)', [invite.id])).rejects.toThrow(/owner approval/);
    await expect(
      db.query("update family_invites set state='active' where id=$1", [invite.id]),
    ).rejects.toThrow(/permission denied/);
    await asUser(alice);
    await db.query('select approve_family_access($1)', [invite.id]);
    await asUser(bob);
    const shared = (
      await db.query<{ snapshot: { scope: string; transactions: unknown[] } }>(
        'select family_snapshot($1) as snapshot',
        [invite.id],
      )
    ).rows[0].snapshot;
    expect(shared).toMatchObject({ scope: 'summary', transactions: [] });
    expect((await db.query('select * from transactions where user_id=$1', [alice])).rows).toHaveLength(0);
    await asUser(alice);
    await db.query('select revoke_family_access($1)', [invite.id]);
    await asUser(bob);
    await expect(db.query('select family_snapshot($1)', [invite.id])).rejects.toThrow(/not approved/);
  });
  it('recorrências não duplicam, não ressuscitam exclusões e não misturam usuários', async () => {
    await asUser(alice);
    const rule = (
      await db.query<{ id: string }>(
        "insert into recurring_rules(user_id,description,amount,category,start_date) values($1,'Conta mensal',1234,'Moradia',current_date) returning id",
        [alice],
      )
    ).rows[0].id;
    expect(
      (await db.query<{ count: number }>('select sync_recurring_rules() as count')).rows[0].count,
    ).toBeGreaterThan(0);
    const occurrences = await db.query<{ due_date: string; transaction_id: string }>(
      'select due_date::text,transaction_id from recurring_occurrences where rule_id=$1',
      [rule],
    );
    for (const occurrence of occurrences.rows)
      expect(occurrence.transaction_id).toBe(
        uuid(`${rule}:${occurrence.due_date}`, '9667e0ce-412e-47d9-a212-91d1d616f74b'),
      );
    expect((await db.query<{ count: number }>('select sync_recurring_rules() as count')).rows[0].count).toBe(
      0,
    );
    await db.query('delete from transactions where external_id like $1', [`recurring:${rule}:%`]);
    expect((await db.query<{ count: number }>('select sync_recurring_rules() as count')).rows[0].count).toBe(
      0,
    );
    await asUser(bob);
    await expect(db.query('select sync_recurring_rules_for($1)', [alice])).rejects.toThrow(
      /permission denied/,
    );
    expect((await db.query('select * from recurring_rules where id=$1', [rule])).rows).toHaveLength(0);
  });
  it('importação é idempotente e rollback inclui o lote inteiro', async () => {
    await asUser(alice);
    const row = {
      id: crypto.randomUUID(),
      account_id: null,
      description: 'Extrato importado',
      amount: 1234,
      type: 'expense',
      category: 'Outros',
      date: '2026-10-04',
      status: 'paid',
    };
    expect(
      (
        await db.query<{ result: { saved: number; skipped: number } }>(
          'select import_transactions($1::jsonb) as result',
          [JSON.stringify([row])],
        )
      ).rows[0].result,
    ).toEqual({ saved: 1, skipped: 0 });
    expect(
      (
        await db.query<{ result: { saved: number; skipped: number } }>(
          'select import_transactions($1::jsonb) as result',
          [JSON.stringify([row])],
        )
      ).rows[0].result,
    ).toEqual({ saved: 0, skipped: 1 });
    const valid = { ...row, id: crypto.randomUUID() };
    await expect(
      db.query('select import_transactions($1::jsonb)', [
        JSON.stringify([valid, { ...row, id: crypto.randomUUID(), amount: -1 }]),
      ]),
    ).rejects.toThrow();
    expect((await db.query('select id from transactions where id=$1', [valid.id])).rows).toHaveLength(0);
    await asUser(bob);
    await expect(db.query('select import_transactions($1::jsonb)', [JSON.stringify([row])])).rejects.toThrow(
      /invalid batch/,
    );
  });
  it('histórico só restaura a versão atual e nunca a de outra pessoa', async () => {
    await asUser(alice);
    const id = crypto.randomUUID();
    await db.query(
      "insert into transactions(id,user_id,description,amount,type,category,date) values($1,$2,'Histórico',100,'expense','Outros','2026-10-05')",
      [id, alice],
    );
    await db.query('update transactions set amount=200 where id=$1', [id]);
    const version = (
      await db.query<{ id: string }>(
        "select id from transaction_history where transaction_id=$1 and operation='UPDATE' order by created_at desc limit 1",
        [id],
      )
    ).rows[0].id;
    await asUser(bob);
    await expect(db.query('select restore_transaction_version($1)', [version])).rejects.toThrow(
      /unavailable/,
    );
    await asUser(alice);
    await db.query('select restore_transaction_version($1)', [version]);
    expect(
      (await db.query<{ amount: number }>('select amount from transactions where id=$1', [id])).rows[0]
        .amount,
    ).toBe(100);
    await expect(db.query('select restore_transaction_version($1)', [version])).rejects.toThrow(/changed/);
  });
  it('família respeita conta e período e proposta só muda dado após aprovação', async () => {
    await asUser(alice);
    const account = (
      await db.query<{ id: string }>(
        "insert into financial_accounts(user_id,name,kind) values($1,'Família filtro','checking') returning id",
        [alice],
      )
    ).rows[0].id;
    const record = (
      await db.query<{ id: string }>(
        "insert into transactions(user_id,account_id,description,amount,type,category,date) values($1,$2,'Proposta segura',100,'expense','Outros',current_date) returning id",
        [alice, account],
      )
    ).rows[0].id;
    const invite = (
      await db.query<{ invite: { id: string; code: string } }>(
        "select create_family_invite('transactions',$1,current_date,current_date,true) as invite",
        [account],
      )
    ).rows[0].invite;
    await asUser(bob);
    await db.query('select request_family_access($1)', [invite.code]);
    await asUser(alice);
    await db.query('select approve_family_access($1)', [invite.id]);
    await asUser(bob);
    const snapshot = (
      await db.query<{ data: { transactions: { id: string }[] } }>('select family_snapshot($1) as data', [
        invite.id,
      ])
    ).rows[0].data;
    expect(snapshot.transactions.map((row) => row.id)).toEqual([record]);
    const proposal = (
      await db.query<{ id: string }>(
        "select propose_family_correction($1,$2,'Proposta segura',200,'Lazer') as id",
        [invite.id, record],
      )
    ).rows[0].id;
    await expect(db.query('select decide_family_proposal($1,true)', [proposal])).rejects.toThrow(
      /owner required/,
    );
    await asUser(alice);
    expect(
      (await db.query<{ amount: number }>('select amount from transactions where id=$1', [record])).rows[0]
        .amount,
    ).toBe(100);
    await db.query('select decide_family_proposal($1,true)', [proposal]);
    expect(
      (await db.query<{ amount: number }>('select amount from transactions where id=$1', [record])).rows[0]
        .amount,
    ).toBe(200);
  });
  it('conciliação entre fontes não duplica e não aceita registro alheio', async () => {
    await asUser(alice);
    const canonical = crypto.randomUUID();
    const incoming = crypto.randomUUID();
    await db.query(
      "insert into transactions(id,user_id,description,amount,type,category,date) values($1,$2,'Mercado',1234,'expense','Outros','2026-10-05')",
      [canonical, alice],
    );
    const payload = [
      {
        id: incoming,
        account_id: null,
        description: 'PIX Mercado',
        amount: 1234,
        type: 'expense',
        category: 'Outros',
        date: '2026-10-05',
        status: 'paid',
      },
    ];
    const result = await db.query<{ result: { saved: number; skipped: number } }>(
      'select import_reviewed_transactions($1::jsonb,$2::jsonb) as result',
      [JSON.stringify(payload), JSON.stringify([{ incoming_id: incoming, canonical_id: canonical }])],
    );
    expect(result.rows[0].result).toEqual({ saved: 0, skipped: 1 });
    await asUser(bob);
    await expect(
      db.query('select import_reviewed_transactions($1::jsonb,$2::jsonb)', [
        JSON.stringify(payload),
        JSON.stringify([{ incoming_id: incoming, canonical_id: canonical }]),
      ]),
    ).rejects.toThrow(/invalid reconciliation/);
  });
  it('consentimento de avisos fica registrado e pode ser retirado', async () => {
    await asUser(alice);
    await db.query('update profiles set whatsapp_notifications=true where id=$1', [alice]);
    expect(
      (
        await db.query<{ consent: boolean }>(
          'select notification_consent_at is not null as consent from profiles where id=$1',
          [alice],
        )
      ).rows[0].consent,
    ).toBe(true);
    await db.query('update profiles set whatsapp_notifications=false where id=$1', [alice]);
    expect(
      (
        await db.query<{ consent: boolean }>(
          'select notification_consent_at is null as consent from profiles where id=$1',
          [alice],
        )
      ).rows[0].consent,
    ).toBe(true);
    await asUser(bob);
    await expect(
      db.query("insert into financial_notifications(user_id,dedupe_key,kind) values($1,'attack','bill')", [
        bob,
      ]),
    ).rejects.toThrow(/permission denied/);
  });
  it('Postgres lê seis mil movimentos com soma completa', async () => {
    await asUser(alice);
    await db.query(
      "insert into transactions(user_id,description,amount,type,category,date) select $1,'Paginação de teste',1,'expense','Outros','2026-10-05' from generate_series(1,6001)",
      [alice],
    );
    const rows = await readPages(async (from, to) => {
      const result = await db.query<{ id: string; amount: number }>(
        "select id,amount from transactions where user_id=$1 and description='Paginação de teste' order by id limit $2 offset $3",
        [alice, to - from + 1, from],
      );
      return { data: result.rows, error: null };
    });
    expect(rows).toHaveLength(6001);
    expect(rows.reduce((total, row) => total + row.amount, 0)).toBe(6001);
  }, 30000);
  it('leases interrompidos vão para reconciliação e ninguém retoma o mesmo aviso', async () => {
    await db.exec('reset role; set role service_role');
    const id = (
      await db.query<{ id: string }>(
        "insert into financial_notifications(user_id,dedupe_key,kind) values($1,'lease-test','bill') returning id",
        [alice],
      )
    ).rows[0].id;
    expect(
      (await db.query<{ count: number }>('select claim_financial_notification($1) as count', [id])).rows[0]
        .count,
    ).toBe(1);
    expect(
      (await db.query<{ count: number | null }>('select claim_financial_notification($1) as count', [id]))
        .rows[0].count,
    ).toBeNull();
    await db.query("update financial_notifications set lease_until=now()-interval '1 minute' where id=$1", [
      id,
    ]);
    await db.query('select reconcile_expired_notifications()');
    expect(
      (await db.query<{ state: string }>('select state from financial_notifications where id=$1', [id]))
        .rows[0].state,
    ).toBe('reconcile');
    await asUser(bob);
    await expect(db.query('select claim_financial_notification($1)', [id])).rejects.toThrow(
      /permission denied/,
    );
  });
  it('métricas exigem opt-in e não aceitam autoria de outra pessoa', async () => {
    await asUser(alice);
    await expect(
      db.query(
        "insert into operation_metrics(user_id,operation,latency_ms,success) values($1,'visit',1,true)",
        [alice],
      ),
    ).rejects.toThrow(/row-level security/);
    await db.query('update profiles set metrics_enabled=true where id=$1', [alice]);
    await db.query(
      "insert into operation_metrics(user_id,operation,latency_ms,success) values($1,'visit',1,true)",
      [alice],
    );
    await asUser(bob);
    expect((await db.query('select * from operation_metrics where user_id=$1', [alice])).rows).toHaveLength(
      0,
    );
  });
  it('exclusão em cascata remove histórico sem recriar dados do usuário', async () => {
    const owner = crypto.randomUUID();
    await db.exec('reset role');
    await db.query('insert into auth.users(id,email) values($1,$2)', [owner, 'delete-test@example.test']);
    await asUser(owner);
    await db.query(
      "insert into transactions(user_id,description,amount,type,category,date) values($1,'Apagar',100,'expense','Outros','2026-10-05')",
      [owner],
    );
    await db.exec('reset role');
    await db.query('delete from auth.users where id=$1', [owner]);
    expect((await db.query('select * from transaction_history where user_id=$1', [owner])).rows).toHaveLength(
      0,
    );
  });
  it('WhatsApp dá pontos limitados e retransmissão não pontua duas vezes', async () => {
    await db.exec('reset role; set role service_role');
    for (let index = 0; index < 7; index++) {
      const points = (
        await db.query<{ points: number }>('select award_habit_for($1,$2,$3) as points', [
          bob,
          'message',
          `wa:test-${index}`,
        ])
      ).rows[0].points;
      expect(points).toBe(index < 5 ? 2 : 0);
    }
    expect(
      (
        await db.query<{ points: number }>('select award_habit_for($1,$2,$3) as points', [
          bob,
          'message',
          'wa:test-0',
        ])
      ).rows[0].points,
    ).toBe(0);
    await asUser(bob);
    await expect(db.query('select award_habit_for($1,$2,$3)', [alice, 'message', 'attack'])).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.query("update profiles set journey_style='ocean' where id=$1", [bob])).rejects.toThrow(
      /not unlocked/,
    );
  });
  it('jornada mantém conquistas após urgência e protege pontos de hábitos', async () => {
    await asUser(alice);
    const goal = crypto.randomUUID();
    const payload = {
      id: goal,
      name: 'Minha reserva',
      target: 50000,
      saved: 0,
      weekly_amount: 500,
      deadline: '2027-01-01',
      priority: 'medium',
    };
    await db.query('select save_journey_goal($1::jsonb)', [JSON.stringify(payload)]);
    const request = crypto.randomUUID();
    const saved = (
      await db.query<{ result: { saved: number; points: number } }>(
        "select update_goal_progress($1,30000,'saving',$2) as result",
        [goal, request],
      )
    ).rows[0].result;
    expect(saved).toMatchObject({ saved: 30000, points: 10 });
    expect(
      (
        await db.query<{ result: { points: number } }>(
          "select update_goal_progress($1,30000,'saving',$2) as result",
          [goal, request],
        )
      ).rows[0].result.points,
    ).toBe(0);
    const pointsBefore = (
      await db.query<{ points: number }>(
        'select sum(points)::integer as points from habit_events where user_id=$1',
        [alice],
      )
    ).rows[0].points;
    await db.query("select update_goal_progress($1,-30000,'emergency',$2)", [goal, crypto.randomUUID()]);
    expect(
      (
        await db.query<{ saved: number; high_water: number }>(
          'select saved,high_water from goals where id=$1',
          [goal],
        )
      ).rows[0],
    ).toEqual({ saved: 0, high_water: 30000 });
    expect(
      (
        await db.query<{ points: number }>(
          'select sum(points)::integer as points from habit_events where user_id=$1',
          [alice],
        )
      ).rows[0].points,
    ).toBe(pointsBefore);
    expect(
      (await db.query<{ points: number }>("select journey_checkin('checkin','recovery') as points")).rows[0]
        .points,
    ).toBe(5);
    expect(
      (await db.query<{ points: number }>("select journey_checkin('checkin') as points")).rows[0].points,
    ).toBe(0);
    await expect(
      db.query(
        "insert into habit_events(user_id,kind,day,points,source_key) values($1,'checkin',current_date,10,'attack')",
        [alice],
      ),
    ).rejects.toThrow(/permission denied/);
    await asUser(bob);
    await expect(
      db.query("select update_goal_progress($1,100,'saving',$2)", [goal, crypto.randomUUID()]),
    ).rejects.toThrow(/ownership/);
    await expect(db.query('update profiles set active_goal_id=$1 where id=$2', [goal, bob])).rejects.toThrow(
      /ownership/,
    );
  });
});

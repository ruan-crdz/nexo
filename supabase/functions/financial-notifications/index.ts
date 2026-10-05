import { admin, authorizeJob, env, HttpError, json } from '../_shared/http.ts';
import { sendFinancialTemplate, WhatsAppDeliveryError } from '../_shared/whatsapp.ts';
import { budgetSchema, profileSchema, transactionSchema } from '../../../shared/domain.ts';
import { civilDate } from '../../../shared/financial-engine.ts';
import { notificationCandidates } from '../../../shared/planning.ts';

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') throw new HttpError(405, 'Método não permitido.');
    authorizeJob(request);
    if (!/^[a-z0-9_]+$/.test(env('WHATSAPP_FINANCIAL_TEMPLATE')))
      throw new HttpError(503, 'Configure um template financeiro aprovado.');
    const db = admin();
    const profiles = await db
      .from('profiles')
      .select('*')
      .eq('whatsapp_notifications', true)
      .order('id')
      .limit(201);
    if (profiles.error || profiles.data.length > 200)
      throw new HttpError(503, 'Configure paginação do job antes de ultrapassar 200 assinantes.');
    let accepted = 0,
      failed = 0,
      cancelled = 0;
    for (const raw of profiles.data) {
      const profile = profileSchema.parse(raw);
      if (!raw.notification_consent_at) continue;
      const hour = Number(
        new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit',
          hourCycle: 'h23',
          timeZone: profile.timezone,
        }).format(new Date()),
      );
      if (hour < 9 || hour >= 20) continue;
      const today = civilDate(new Date(), profile.timezone);
      const synced = await db.rpc('sync_recurring_rules_for', { owner: raw.id });
      if (synced.error) throw new HttpError(503, 'Não foi possível gerar os vencimentos.');
      const [rows, budgets, connection] = await Promise.all([
        db.from('transactions').select('*').eq('user_id', raw.id).limit(5000),
        db.from('budgets').select('*').eq('user_id', raw.id).eq('month', today.slice(0, 7)).limit(201),
        db.from('whatsapp_connections').select('phone,consent_at').eq('user_id', raw.id).maybeSingle(),
      ]);
      if (
        rows.error ||
        budgets.error ||
        connection.error ||
        rows.data.length >= 5000 ||
        budgets.data.length > 200
      )
        throw new HttpError(503, 'Leitura incompleta do job.');
      if (!connection.data?.phone || !connection.data.consent_at) continue;
      const candidates = notificationCandidates(
        {
          profile,
          transactions: transactionSchema.array().parse(rows.data),
          budgets: budgetSchema.array().parse(budgets.data),
        },
        today,
      );
      for (const candidate of candidates) {
        if (accepted + failed + cancelled >= 20) return json({ accepted, failed, cancelled, more: true });
        const queued = await db
          .from('financial_notifications')
          .upsert(
            { user_id: raw.id, dedupe_key: candidate.key, kind: candidate.kind },
            { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true },
          );
        if (queued.error) throw new HttpError(503, 'Não foi possível preparar o aviso.');
        const claim = await db
          .from('financial_notifications')
          .update({ state: 'processing', updated_at: new Date().toISOString() })
          .eq('user_id', raw.id)
          .eq('dedupe_key', candidate.key)
          .eq('state', 'pending')
          .select('id')
          .maybeSingle();
        if (claim.error) throw new HttpError(503, 'Não foi possível reservar o aviso.');
        if (!claim.data) continue;
        const latest = await db
          .from('profiles')
          .select('whatsapp_notifications,notification_consent_at,reminders_enabled,weekly_digest')
          .eq('id', raw.id)
          .single();
        const currentConnection = await db
          .from('whatsapp_connections')
          .select('phone,consent_at')
          .eq('user_id', raw.id)
          .maybeSingle();
        if (
          latest.error ||
          currentConnection.error ||
          !latest.data.whatsapp_notifications ||
          !latest.data.notification_consent_at ||
          !(candidate.kind === 'weekly' ? latest.data.weekly_digest : latest.data.reminders_enabled) ||
          !currentConnection.data?.consent_at ||
          currentConnection.data.phone !== connection.data.phone
        ) {
          await db.from('financial_notifications').update({ state: 'cancelled' }).eq('id', claim.data.id);
          cancelled++;
          continue;
        }
        try {
          const replyId = await sendFinancialTemplate(currentConnection.data.phone, candidate.text);
          const stored = await db
            .from('financial_notifications')
            .update({
              state: 'accepted',
              reply_message_id: replyId,
              error_code: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', claim.data.id);
          if (stored.error)
            throw new HttpError(
              503,
              'Envio aceito, mas resultado não registrado; confira a operação antes de repetir.',
            );
          accepted++;
        } catch (error) {
          await db
            .from('financial_notifications')
            .update({
              state: 'failed',
              error_code: error instanceof WhatsAppDeliveryError ? error.code : null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', claim.data.id);
          failed++;
        }
      }
    }
    return json({ accepted, failed, cancelled });
  } catch (error) {
    return json(
      { error: error instanceof HttpError ? error.message : 'Não foi possível executar o job.' },
      error instanceof HttpError ? error.status : 503,
    );
  }
});

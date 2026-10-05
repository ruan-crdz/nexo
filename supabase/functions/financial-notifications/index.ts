import { admin, authorizeJob, env, HttpError, json } from '../_shared/http.ts';
import { sendFinancialTemplate, WhatsAppDeliveryError } from '../_shared/whatsapp.ts';
import {
  budgetSchema,
  profileSchema,
  transactionSchema,
  goalSchema,
  habitEventSchema,
} from '../../../shared/domain.ts';
import { civilDate } from '../../../shared/financial-engine.ts';
import { notificationCandidates } from '../../../shared/planning.ts';
import { readPages } from '../../../shared/pagination.ts';
import { deliveryFailure } from '../../../shared/notification-recovery.ts';

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') throw new HttpError(405, 'Método não permitido.');
    authorizeJob(request);
    if (!/^[a-z0-9_]+$/.test(env('WHATSAPP_FINANCIAL_TEMPLATE')))
      throw new HttpError(503, 'Configure um template financeiro aprovado.');
    const db = admin();
    const expired = await db.rpc('reconcile_expired_notifications');
    if (expired.error) throw new HttpError(503, 'Não foi possível conferir tentativas interrompidas.');
    const profiles = await readPages((from, to) =>
      db.from('profiles').select('*').eq('whatsapp_notifications', true).order('id').range(from, to),
    );
    let accepted = 0,
      failed = 0,
      cancelled = 0;
    for (const raw of profiles) {
      try {
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
        const [rows, budgets, connection, goals, habits] = await Promise.all([
          readPages((from, to) =>
            db.from('transactions').select('*').eq('user_id', raw.id).order('id').range(from, to),
          ),
          readPages((from, to) =>
            db
              .from('budgets')
              .select('*')
              .eq('user_id', raw.id)
              .eq('month', today.slice(0, 7))
              .order('id')
              .range(from, to),
          ),
          db.from('whatsapp_connections').select('phone,consent_at').eq('user_id', raw.id).maybeSingle(),
          readPages((from, to) =>
            db.from('goals').select('*').eq('user_id', raw.id).order('id').range(from, to),
          ),
          readPages((from, to) =>
            db
              .from('habit_events')
              .select('id,kind,day,points')
              .eq('user_id', raw.id)
              .gte('day', `${today.slice(0, 7)}-01`)
              .order('id')
              .range(from, to),
          ),
        ]);
        if (connection.error) throw new HttpError(503, 'Leitura incompleta do job.');
        if (!connection.data?.phone || !connection.data.consent_at) continue;
        const candidates = notificationCandidates(
          {
            profile,
            transactions: transactionSchema.array().parse(rows),
            budgets: budgetSchema.array().parse(budgets),
            goals: goalSchema.array().parse(goals),
            habit_events: habitEventSchema.array().parse(habits),
          },
          today,
        );
        for (const candidate of candidates) {
          if (candidate.kind === 'journey' && hour !== profile.reminder_hour) continue;
          if (accepted + failed + cancelled >= 20) return json({ accepted, failed, cancelled, more: true });
          const queued = await db
            .from('financial_notifications')
            .upsert(
              { user_id: raw.id, dedupe_key: candidate.key, kind: candidate.kind },
              { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true },
            );
          if (queued.error) throw new HttpError(503, 'Não foi possível preparar o aviso.');
          const queuedRecord = await db
            .from('financial_notifications')
            .select('id')
            .eq('user_id', raw.id)
            .eq('dedupe_key', candidate.key)
            .single();
          if (queuedRecord.error) throw new HttpError(503, 'Aviso não encontrado.');
          const claim = await db.rpc('claim_financial_notification', {
            notification_id: queuedRecord.data.id,
          });
          if (claim.error) throw new HttpError(503, 'Não foi possível reservar o aviso.');
          if (!claim.data) continue;
          const latest = await db
            .from('profiles')
            .select(
              'whatsapp_notifications,notification_consent_at,reminders_enabled,weekly_digest,journey_reminders,journey_pause_until',
            )
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
            !(candidate.kind === 'weekly'
              ? latest.data.weekly_digest
              : candidate.kind === 'journey'
                ? latest.data.journey_reminders &&
                  (!latest.data.journey_pause_until || latest.data.journey_pause_until < today)
                : latest.data.reminders_enabled) ||
            !currentConnection.data?.consent_at ||
            currentConnection.data.phone !== connection.data.phone
          ) {
            await db
              .from('financial_notifications')
              .update({ state: 'cancelled', lease_until: null })
              .eq('id', queuedRecord.data.id);
            cancelled++;
            continue;
          }
          let replyId: string | null = null;
          try {
            replyId = await sendFinancialTemplate(currentConnection.data.phone, candidate.text);
            const stored = await db
              .from('financial_notifications')
              .update({
                state: 'accepted',
                reply_message_id: replyId,
                error_code: null,
                updated_at: new Date().toISOString(),
                lease_until: null,
              })
              .eq('id', queuedRecord.data.id);
            if (stored.error)
              throw new HttpError(
                503,
                'Envio aceito, mas resultado não registrado; confira a operação antes de repetir.',
              );
            accepted++;
          } catch (error) {
            const code = error instanceof WhatsAppDeliveryError ? error.code : null;
            const recovery = deliveryFailure(
              code,
              Number(claim.data),
              error instanceof WhatsAppDeliveryError,
            );
            await db
              .from('financial_notifications')
              .update({
                state: recovery.state,
                error_code: code,
                reply_message_id: replyId ?? undefined,
                next_attempt_at: recovery.delaySeconds
                  ? new Date(Date.now() + recovery.delaySeconds * 1000).toISOString()
                  : null,
                lease_until: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', queuedRecord.data.id);
            failed++;
          }
        }
      } catch {
        failed++;
        console.error(JSON.stringify({ event: 'notification_profile_failed', subject: raw.id }));
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

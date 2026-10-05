import { authenticate, json, serve, HttpError } from '../_shared/http.ts';
import { notificationStatus } from '../../../shared/notification-status.ts';

serve(async (request) => {
  const { user, service } = await authenticate(request, 'notification-status');
  const [connection, schedule, runtime] = await Promise.all([
    service.from('whatsapp_connections').select('phone,consent_at').eq('user_id', user.id).maybeSingle(),
    service.rpc('financial_schedule_status'),
    service.from('notification_runtime').select('last_success').eq('id', true).maybeSingle(),
  ]);
  if (connection.error || schedule.error || runtime.error)
    throw new HttpError(503, 'Não foi possível conferir os avisos agora.');
  const configured = !!(
    (Deno.env.get('FINANCIAL_JOB_SECRET') ?? '').length >= 32 &&
    /^[a-z0-9_]+$/.test(Deno.env.get('WHATSAPP_FINANCIAL_TEMPLATE') ?? '')
  );
  return json(
    notificationStatus({
      configured,
      scheduled: schedule.data === true,
      connected: !!(connection.data?.phone && connection.data?.consent_at),
      lastSuccess: runtime.data?.last_success ?? null,
    }),
  );
});

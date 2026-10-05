import { authenticate, json, serve, HttpError } from '../_shared/http.ts';
import { sendText } from '../_shared/whatsapp.ts';
// Deliberately no arbitrary recipient/content endpoint: only a test reply to the
// caller's verified number within a recent inbound conversation window.
serve(async (request) => {
  const { user, service } = await authenticate(request, 'whatsapp-send');
  const connection = await service
    .from('whatsapp_connections')
    .select('phone,consent_at')
    .eq('user_id', user.id)
    .single();
  if (!connection.data?.phone || !connection.data.consent_at)
    throw new HttpError(400, 'Vincule seu número primeiro.');
  const recent = await service
    .from('whatsapp_messages_metadata')
    .select('message_id')
    .eq('user_id', user.id)
    .gte('created_at', new Date(Date.now() - 23 * 3600_000).toISOString())
    .limit(1);
  if (!recent.data?.length)
    throw new HttpError(400, 'Envie uma mensagem ao Nexo pelo WhatsApp antes de testar.');
  await sendText(
    connection.data.phone,
    'Seu Nexo está conectado. Envie um gasto ou uma pergunta para começar.',
  );
  return json({ sent: true });
});

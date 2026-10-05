export function notificationStatus(
  input: { configured: boolean; scheduled: boolean; connected: boolean; lastSuccess: string | null },
  now = Date.now(),
) {
  if (!input.configured || !input.scheduled)
    return {
      available: false,
      message:
        'Os avisos automáticos ainda estão em preparação. Sua preferência fica salva; por enquanto, confira os avisos no app.',
    };
  if (!input.connected)
    return { available: false, message: 'Conecte seu WhatsApp para receber os avisos que você autorizar.' };
  const last = input.lastSuccess ? Date.parse(input.lastSuccess) : NaN;
  if (!Number.isFinite(last) || now - last > 45 * 60_000 || last > now + 60_000)
    return {
      available: false,
      message:
        'Ainda não conseguimos confirmar o funcionamento dos avisos automáticos. Confira os avisos no app.',
    };
  return {
    available: true,
    message:
      'O serviço de avisos está funcionando. Você receberá apenas os avisos autorizados, quando houver algo para informar. A entrega depende do WhatsApp.',
  };
}

import { env, HttpError } from './http.ts';
import { graphUrl } from './whatsapp.ts';

export const financialTemplateName = 'nexo_aviso_financeiro';
export async function prepareFinancialTemplate(account: string, create: boolean) {
  if (!/^\d{8,30}$/.test(account)) throw new HttpError(400, 'Informe o ID da conta WhatsApp Business.');
  const headers = {
    Authorization: `Bearer ${env('WHATSAPP_ACCESS_TOKEN')}`,
    'Content-Type': 'application/json',
  };
  const path = `${account}/message_templates`;
  const response = await fetch(
    graphUrl(`${path}?name=${financialTemplateName}&fields=name,status,language,components`),
    { headers, signal: AbortSignal.timeout(15_000) },
  );
  const result = await response.json();
  if (!response.ok)
    throw new HttpError(
      503,
      `A Meta não permitiu consultar o template (código ${Number(result.error?.code) || 'indisponível'}). Confira a permissão whatsapp_business_management e a conta informada.`,
    );
  const template = result.data?.find(
    (item: { name: string; language: string }) =>
      item.name === financialTemplateName && item.language === 'pt_BR',
  );
  if (template) {
    const parameters =
      template.components
        ?.find((component: { type: string }) => component.type === 'BODY')
        ?.text?.match(/\{\{\d+\}\}/g) ?? [];
    const compatible =
      parameters.length === 1 &&
      parameters[0] === '{{1}}' &&
      !template.components?.some(
        (component: { type: string }) => component.type === 'HEADER' || component.type === 'BUTTONS',
      );
    return {
      name: financialTemplateName,
      status: template.status,
      compatible,
      approved: template.status === 'APPROVED' && compatible,
    };
  }
  if (!create)
    return { name: financialTemplateName, status: 'NOT_FOUND', compatible: false, approved: false };
  const created = await fetch(graphUrl(path), {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      name: financialTemplateName,
      language: 'pt_BR',
      category: 'UTILITY',
      components: [
        {
          type: 'BODY',
          text: 'Olá! Este é o aviso financeiro que você solicitou ao Nexo: {{1}} Confira os detalhes no app. Para deixar de receber, desative os avisos em Ajustes.',
          example: {
            body_text: [['Sua conta de luz de R$ 100,00 vence em 10/10/2026. Confira se já foi paga.']],
          },
        },
      ],
    }),
  });
  const saved = await created.json();
  if (!created.ok)
    throw new HttpError(
      503,
      `A Meta não permitiu cadastrar o template (código ${Number(saved.error?.code) || 'indisponível'}). Confira o WhatsApp Manager.`,
    );
  return {
    name: financialTemplateName,
    status: String(saved.status ?? 'PENDING'),
    compatible: true,
    approved: saved.status === 'APPROVED',
  };
}

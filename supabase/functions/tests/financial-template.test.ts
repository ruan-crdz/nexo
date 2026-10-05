import { strict as assert } from 'node:assert';
import { financialTemplateName, prepareFinancialTemplate } from '../_shared/financial-template.ts';

Deno.test(
  'template financeiro só fica pronto quando aprovado e compatível; preparação não envia mensagens',
  async () => {
    const original = globalThis.fetch;
    const names = ['WHATSAPP_GRAPH_VERSION', 'WHATSAPP_ACCESS_TOKEN'];
    const previous = names.map((name) => Deno.env.get(name));
    try {
      Deno.env.set(names[0], 'v25.0');
      Deno.env.set(names[1], 'test-only');
      for (const status of ['PENDING', 'APPROVED', 'REJECTED']) {
        globalThis.fetch = async (input) => {
          assert.match(String(input), /message_templates\?name=nexo_aviso_financeiro/);
          return Response.json({
            data: [
              {
                name: financialTemplateName,
                language: 'pt_BR',
                status,
                components: [{ type: 'BODY', text: 'Aviso: {{1}}.' }],
              },
            ],
          });
        };
        assert.equal(
          (await prepareFinancialTemplate('4566478770233811', false)).approved,
          status === 'APPROVED',
        );
      }
      globalThis.fetch = async () =>
        Response.json({
          data: [
            {
              name: financialTemplateName,
              language: 'pt_BR',
              status: 'APPROVED',
              components: [{ type: 'BODY', text: '{{1}} {{2}}' }],
            },
          ],
        });
      assert.equal((await prepareFinancialTemplate('4566478770233811', false)).approved, false);
      let calls = 0;
      globalThis.fetch = async (input, init) => {
        assert.ok(!String(input).includes('/messages'));
        calls++;
        if (init?.method === 'POST') {
          const payload = JSON.parse(String(init.body));
          assert.equal(payload.language, 'pt_BR');
          assert.equal(payload.components[0].example.body_text[0].length, 1);
          return Response.json({ status: 'PENDING' });
        }
        return Response.json({ data: [] });
      };
      assert.equal((await prepareFinancialTemplate('4566478770233811', true)).status, 'PENDING');
      assert.equal(calls, 2);
    } finally {
      globalThis.fetch = original;
      names.forEach((name, index) =>
        previous[index] === undefined ? Deno.env.delete(name) : Deno.env.set(name, previous[index]!),
      );
    }
  },
);

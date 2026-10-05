import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Experimentar sem cadastro', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Seu mês até agora' })).toBeVisible();
});

test('anota, persiste, corrige e exclui um gasto com confirmação', async ({ page }) => {
  await page.getByRole('button', { name: 'Anotar gasto' }).click();
  await page.getByLabel('Quanto foi? (R$)', { exact: true }).fill('42,35');
  await page.getByLabel('Com o quê?', { exact: true }).fill('Farmácia teste');
  await expect(page.getByLabel('Categoria', { exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Salvar anotação', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Anotação salva.' })).toBeVisible();
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Anotações' }).click();
  await page.getByLabel('Buscar uma anotação').fill('Farmácia teste');
  await expect(page.getByRole('heading', { name: 'Farmácia teste' })).toBeVisible();
  await page.reload();
  await page.getByLabel('Buscar uma anotação').fill('Farmácia teste');
  await page.getByRole('button', { name: 'Corrigir Farmácia teste' }).click();
  await page.getByLabel('Quanto foi? (R$)').fill('50,00');
  await page.getByRole('button', { name: 'Salvar anotação' }).click();
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await expect(page.locator('.money-row-top > strong')).toContainText('50,00');
  await page.getByRole('button', { name: 'Excluir Farmácia teste' }).click();
  await page.getByRole('button', { name: 'Não, voltar' }).click();
  await expect(page.getByRole('heading', { name: 'Farmácia teste' })).toBeVisible();
  await page.getByRole('button', { name: 'Excluir Farmácia teste' }).click();
  await page.getByRole('button', { name: 'Sim, excluir anotação' }).click();
  await expect(page.getByRole('heading', { name: 'Farmácia teste' })).not.toBeVisible();
});

test('entrada atualiza o resumo e filtros separam gastos de entradas', async ({ page }) => {
  const initial = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('nexo.demo.v1')!).transactions.filter(
        (t: { type: string; status: string; date: string }) =>
          t.type === 'income' &&
          t.status === 'paid' &&
          t.date === new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()),
      ).length,
  );
  await page.getByRole('button', { name: 'Anotar entrada' }).click();
  await page.getByLabel('Quanto foi? (R$)').fill('150,00');
  await page.getByLabel('De onde veio?').fill('Entrada de teste');
  await page.getByRole('button', { name: 'Salvar anotação' }).click();
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  const matching = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('nexo.demo.v1')!).transactions.filter(
        (t: { type: string; status: string; date: string }) =>
          t.type === 'income' &&
          t.status === 'paid' &&
          t.date === new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()),
      ).length,
  );
  expect(matching).toBe(initial + 1);
  await page.goto('/#/movimentos');
  await page.getByLabel('Buscar uma anotação').fill('Entrada de teste');
  await page.getByRole('button', { name: 'Gastos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Entrada de teste' })).not.toBeVisible();
  await page.getByRole('button', { name: 'Entradas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Entrada de teste' })).toBeVisible();
});

test('rejeita valor inválido e não salva ao cancelar', async ({ page }) => {
  const before = await page.evaluate(() => localStorage.getItem('nexo.demo.v1'));
  await page.getByRole('button', { name: 'Anotar gasto' }).click();
  await page.getByLabel('Quanto foi? (R$)').fill('0');
  await page.getByLabel('Com o quê?').fill('Não salvar');
  await page.getByRole('button', { name: 'Salvar anotação' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('nexo.demo.v1'))).toEqual(before);
});

test('mantém campos antigos ao corrigir e não soma previsões no resumo', async ({ page }) => {
  const original = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('nexo.demo.v1')!);
    const t = data.transactions[0];
    t.description = 'Conta prevista de teste';
    t.status = 'planned';
    t.source = 'whatsapp';
    t.category = 'Categoria antiga';
    t.date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    localStorage.setItem('nexo.demo.v1', JSON.stringify(data));
    return t;
  });
  await page.reload();
  const totals = await page.locator('.simple-totals').innerText();
  await page.goto('/#/movimentos');
  await page.getByRole('button', { name: 'Corrigir Conta prevista de teste' }).click();
  await page.getByLabel('Quanto foi? (R$)').fill('987,65');
  await page.getByRole('button', { name: 'Salvar anotação' }).click();
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  const changed = await page.evaluate(
    (id) =>
      JSON.parse(localStorage.getItem('nexo.demo.v1')!).transactions.find((t: { id: string }) => t.id === id),
    original.id,
  );
  expect(changed).toMatchObject({ ...original, amount: 98765 });
  await page.goto('/#/inicio');
  await expect(page.locator('.simple-totals')).toHaveText(totals, { useInnerText: true });
});

test('navegação contém apenas quatro destinos e caminhos antigos voltam ao início', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Principal' });
  await expect(nav.getByRole('link')).toHaveCount(4);
  await expect(nav).toContainText('Início');
  await expect(nav).toContainText('Anotações');
  await expect(nav).toContainText('WhatsApp');
  await expect(nav).toContainText('Ajustes');
  await expect(page.getByText('Nexo Score')).not.toBeVisible();
  for (const path of ['empresa', 'futuro', 'patrimonio']) {
    await page.goto(`/#/${path}`);
    await expect(page).toHaveURL(/#\/inicio$/);
    await expect(page.getByRole('heading', { name: 'Seu mês até agora' })).toBeVisible();
  }
});

test('demonstração explica WhatsApp sem fingir conexão ou envio', async ({ page }) => {
  await page.getByRole('link', { name: 'Conhecer o WhatsApp' }).click();
  await page.getByRole('button', { name: 'Conectar meu WhatsApp' }).click();
  await expect(page.getByRole('alert')).toContainText('Nenhuma mensagem foi enviada');
});

test('modo noturno persiste e acompanha a preferência do aparelho', async ({ page }) => {
  await page.goto('/#/perfil');
  await page.getByLabel('Escolha o fundo').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.getByLabel('Escolha o fundo')).toHaveValue('dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.getByLabel('Escolha o fundo').selectOption('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('nome persiste e exclusão de conta exige confirmação explícita', async ({ page }) => {
  await page.goto('/#/perfil');
  await page.getByLabel('Como podemos chamar você?').fill('Maria');
  await page.getByRole('button', { name: 'Salvar nome' }).click();
  await expect(page.getByRole('status')).toContainText('Seu nome foi atualizado');
  await page.goto('/#/inicio');
  await expect(page.getByRole('heading', { name: 'Olá, Maria.' })).toBeVisible();
  await page.goto('/#/privacidade');
  await page.getByRole('button', { name: 'Quero excluir minha conta' }).click();
  await expect(page.getByRole('button', { name: 'Confirmar exclusão permanente' })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancelar e voltar' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Seus dados', exact: true })).toBeVisible();
});

test('telas em claro e escuro passam verificações de acessibilidade', async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    await page.goto('/#/perfil');
    await page.getByLabel('Escolha o fundo').selectOption(theme);
    for (const route of [
      'inicio',
      'movimentos',
      'integracoes',
      'perfil',
      'ajuda',
      'privacidade',
      'planejar',
      'perguntas',
      'importar',
      'familia',
      'controle',
      'recibo',
    ]) {
      await page.goto(`/#/${route}`);
      await expect(page.locator('main h1').first()).toBeVisible();
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(result.violations, `${theme} / ${route}`).toEqual([]);
    }
  }
});

test('telas cabem em celular estreito e texto ampliado', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [320, 360, 390, 430, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of [
      'inicio',
      'movimentos',
      'integracoes',
      'perfil',
      'ajuda',
      'privacidade',
      'planejar',
      'perguntas',
      'importar',
      'familia',
      'controle',
      'recibo',
    ]) {
      await page.goto(`/#/${route}`);
      await expect(page.locator('main h1').first()).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth), {
          message: `${route} em ${width}px`,
        })
        .toBeLessThanOrEqual(width);
    }
  }
  await page.setViewportSize({ width: 768, height: 844 });
  await page.goto('/#/inicio');
  await page.addStyleTag({ content: 'body { font-size: 200% !important; font-family: Arial, sans-serif; }' });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth), {
      message: 'O texto ampliado não deve criar rolagem horizontal',
    })
    .toBeLessThanOrEqual(768);
  expect(errors).toEqual([]);
});

test('formulário tem foco, Escape cancela e campos são acessíveis', async ({ page }) => {
  await page.getByRole('button', { name: 'Anotar gasto' }).click();
  await expect(page.getByLabel('Quanto foi? (R$)')).toBeFocused();
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(result.violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('resumo seleciona o mês e categorias conservam os gastos pagos', async ({ page }) => {
  const selected = page.locator('.flow-month').first();
  const month = await selected.getAttribute('data-month');
  await selected.click();
  await expect(page.getByLabel('Mês do resumo', { exact: true })).toHaveValue(month!);
  await expect(page.locator('.simple-totals')).toHaveAttribute('data-month', month!);
  const expected = await page.evaluate((selectedMonth) => {
    const data = JSON.parse(localStorage.getItem('nexo.demo.v1')!);
    return data.transactions
      .filter(
        (transaction: { date: string; status: string; type: string }) =>
          transaction.date.startsWith(selectedMonth!) &&
          transaction.status === 'paid' &&
          transaction.type === 'expense',
      )
      .reduce((total: number, transaction: { amount: number }) => total + transaction.amount, 0);
  }, month);
  const rendered = await page.locator('.category-list strong').allTextContents();
  const total = rendered.reduce(
    (amount, text) => amount + Math.round(Number(text.replace(/[^\d,]/g, '').replace(',', '.')) * 100),
    0,
  );
  expect(total).toBe(expected);
});

test('PC distribui os blocos e celular mantém ações visíveis', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const evolution = await page.locator('.money-evolution').boundingBox();
  const breakdown = await page.locator('.money-breakdown').boundingBox();
  expect(evolution).not.toBeNull();
  expect(breakdown!.x).toBeGreaterThan(evolution!.x + evolution!.width);
  expect(Math.abs(breakdown!.y - evolution!.y)).toBeLessThan(2);
  await page.setViewportSize({ width: 320, height: 740 });
  await expect(page.getByRole('button', { name: 'Anotar gasto' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Anotar entrada' })).toBeVisible();
});

test('modal não rola horizontalmente e trava o fundo em celular e PC', async ({ page }) => {
  for (const width of [320, 390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole('button', { name: 'Anotar gasto' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByText('Mais detalhes (opcional)', { exact: true }).click();
    await expect(dialog.getByRole('combobox', { name: 'Categoria', exact: true })).toBeVisible();
    expect(
      await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth),
      `Modal em ${width}px`,
    ).toBe(true);
    expect(
      await dialog.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= window.innerWidth;
      }),
    ).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden');
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    expect(await page.evaluate(() => document.documentElement.style.overflow)).not.toBe('hidden');
  }
});

test('capturas da nova experiência', async ({ page }) => {
  await page.screenshot({ path: `docs/screenshots/home-${test.info().project.name}.png`, fullPage: true });
  await page.goto('/#/perfil');
  await page.getByLabel('Escolha o fundo').selectOption('dark');
  await page.goto('/#/inicio');
  await page.screenshot({
    path: `docs/screenshots/home-dark-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('entrada e cadastro têm instruções simples e permitem conferir a senha', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Já tenho conta' }).click();
  await expect(page.getByRole('heading', { name: 'Entrar na minha conta' })).toBeVisible();
  await page.getByLabel('Senha', { exact: true }).fill('senha-de-exemplo');
  await page.getByRole('button', { name: 'Mostrar senha' }).click();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Esconder senha' }).click();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'password');
  await page.getByRole('link', { name: 'Ainda não tenho conta' }).click();
  await expect(page.getByRole('heading', { name: 'Criar minha conta' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(result.violations).toEqual([]);
});

test('recorrência persiste como pendente sem duplicar ao recarregar', async ({ page }) => {
  await page.goto('/#/planejar');
  await page.getByRole('button', { name: 'Nova conta recorrente' }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Conta recorrente e2e');
  await page.getByLabel('Valor (R$)', { exact: true }).fill('99,50');
  await page.getByRole('button', { name: 'Salvar planejamento' }).click();
  await expect(page.getByRole('heading', { name: 'Conta recorrente e2e' })).toBeVisible();
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('nexo.demo.v1')!).transactions.filter(
      (row: { description: string }) => row.description === 'Conta recorrente e2e',
    ),
  );
  expect(before.length).toBeGreaterThan(0);
  expect(before.every((row: { status: string }) => row.status === 'planned')).toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Seu planejamento' })).toBeVisible();
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('nexo.demo.v1')!).transactions.filter(
      (row: { description: string }) => row.description === 'Conta recorrente e2e',
    ),
  );
  expect(after).toEqual(before);
});

test('limite e meta têm cálculo verificável e avisos exigem consentimento', async ({ page }) => {
  await expect(page.locator('.attention-band')).toHaveCount(0);
  await page.goto('/#/planejar');
  await page.getByRole('button', { name: 'Limites', exact: true }).click();
  await page.getByRole('button', { name: 'Novo limite' }).click();
  await page.getByLabel('Valor (R$)', { exact: true }).fill('1,00');
  await page.getByRole('combobox', { name: 'Categoria', exact: true }).selectOption('Alimentação');
  await page.getByRole('button', { name: 'Salvar planejamento' }).click();
  await expect(page.locator('.plan-list')).toContainText('Acima do limite');
  await page.getByRole('button', { name: 'Metas', exact: true }).click();
  await page.getByRole('button', { name: 'Nova meta' }).click();
  await page.getByLabel('Nome da meta', { exact: true }).fill('Viagem e2e');
  await page.getByLabel('Valor que quer alcançar (R$)').fill('1000,00');
  await page.getByLabel('Quanto está guardado agora? (R$)').fill('200,00');
  await page.getByRole('button', { name: 'Colocar meta em foco' }).click();
  await expect(page.getByRole('heading', { name: 'Viagem e2e' })).toBeVisible();
  await page.goto('/#/perguntas');
  await page.getByRole('button', { name: 'Quanto falta para minha meta?' }).click();
  await expect(page.locator('.verified-answer')).toContainText('Viagem e2e');
  await expect(page.locator('.verified-answer')).toContainText('800,00');
  await page.goto('/#/perfil');
  await page.getByRole('checkbox', { name: 'Quero avisos de vencimentos e limites no app.' }).check();
  await expect(
    page.getByRole('checkbox', { name: 'Quero avisos de vencimentos e limites no app.' }),
  ).toBeEnabled();
  await page.goto('/#/inicio');
  await expect(page.getByRole('heading', { name: 'Vale conferir' })).toBeVisible();
  await expect(page.locator('.attention-band')).toContainText('Alimentação');
});

test('extrato só é salvo após revisão e o mesmo lote não entra duas vezes', async ({ page }) => {
  const file = {
    name: 'extrato.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Data;Descrição;Valor\n04/10/2026;Importação e2e;-12,34'),
  };
  await page.goto('/#/importar');
  await page.getByLabel('Extrato CSV ou OFX').setInputFiles(file);
  await page.getByRole('button', { name: 'Revisar registros' }).click();
  await expect(page.locator('.import-preview')).toContainText('Importação e2e');
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('nexo.demo.v1')!).transactions.filter(
          (row: { description: string }) => row.description === 'Importação e2e',
        ).length,
    ),
  ).toBe(0);
  await page.getByRole('button', { name: 'Salvar 1 registros selecionados' }).click();
  await expect(page.getByRole('status')).toContainText('1 registros salvos');
  await page.getByLabel('Extrato CSV ou OFX').setInputFiles(file);
  await page.getByRole('button', { name: 'Revisar registros' }).click();
  await expect(page.locator('.import-preview')).toContainText('Já importado');
  await expect(page.getByRole('button', { name: 'Salvar 0 registros selecionados' })).toBeDisabled();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('nexo.demo.v1')!).transactions.filter(
          (row: { description: string }) => row.description === 'Importação e2e',
        ).length,
    ),
  ).toBe(1);
});
test('decisão recusa premissas vazias e mostra dinheiro calculado sem antecipar renda', async ({ page }) => {
  await page.goto('/#/controle');
  await expect(page.getByRole('button', { name: 'Calcular com minhas premissas' })).toBeDisabled();
  await page.getByLabel('Dinheiro disponível confirmado (R$)').fill('1000,00');
  await page.getByLabel('Reserva que não quer gastar (R$)').fill('100,00');
  await page.getByLabel('Separado para metas (R$)').fill('100,00');
  await page.getByLabel('Renda esperada (não recebida) (R$)').fill('5000,00');
  await page.getByRole('checkbox', { name: /Confirmei o dinheiro disponível/ }).check();
  await page.getByRole('button', { name: 'Calcular com minhas premissas' }).click();
  await expect(page.locator('.verified-answer')).toContainText('não foi tratada como dinheiro recebido');
});
test('renda semanal é prevista e fatura não transforma limite em saldo', async ({ page }) => {
  await page.goto('/#/planejar');
  await page.getByRole('button', { name: 'Nova conta recorrente' }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Renda semanal teste');
  await page.getByLabel('Valor (R$)', { exact: true }).fill('100,00');
  await page.getByRole('combobox', { name: 'Frequência' }).selectOption('weekly');
  await page.getByRole('combobox', { name: 'Gasto ou renda' }).selectOption('income');
  await page.getByRole('button', { name: 'Salvar planejamento' }).click();
  await expect(page.getByRole('heading', { name: 'Renda semanal teste' })).toBeVisible();
  const rows = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('nexo.demo.v1')!).transactions.filter(
      (row: { description: string }) => row.description === 'Renda semanal teste',
    ),
  );
  expect(
    rows.every((row: { type: string; status: string }) => row.type === 'income' && row.status === 'planned'),
  ).toBe(true);
  await page.goto('/#/controle');
  await page.getByRole('button', { name: 'Faturas', exact: true }).click();
  await page.getByRole('button', { name: 'Cadastrar cartão' }).click();
  await page.getByLabel('Nome do cartão').fill('Cartão teste');
  await page.getByLabel('Limite informado (R$)').fill('1000,00');
  await page.getByRole('button', { name: 'Salvar cartão' }).click();
  await expect(page.locator('.verified-answer')).toContainText('Não é dinheiro disponível');
});
test('CSV lista linha inválida sem impedir revisão das válidas', async ({ page }) => {
  await page.goto('/#/importar');
  await page.getByLabel('Extrato CSV ou OFX').setInputFiles({
    name: 'com-erros.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Data;Descrição;Valor\n04/10/2026;Válida;-12,34\n31/02/2026;Inválida;-1,00'),
  });
  await page.getByRole('button', { name: 'Revisar registros' }).click();
  await expect(page.getByRole('heading', { name: '1 linhas não serão salvas' })).toBeVisible();
  await expect(page.locator('.import-preview')).toContainText('Válida');
  await expect(page.getByRole('button', { name: 'Salvar 1 registros selecionados' })).toBeEnabled();
});
test('meta na home mostra próximo passo e urgência não apaga conquistas', async ({ page }) => {
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('nexo.demo.v1')!);
    data.goals = [];
    data.profile.active_goal_id = null;
    data.goal_events = [];
    data.habit_events = [];
    localStorage.setItem('nexo.demo.v1', JSON.stringify(data));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Criar minha meta' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome da meta').fill('Minha reserva de 500');
  await dialog.getByLabel('Passo semanal confortável (R$)').fill('5,00');
  await dialog.getByRole('button', { name: 'Colocar meta em foco' }).click();
  await expect(page.getByRole('heading', { name: 'Minha reserva de 500', exact: true })).toBeVisible();
  await expect(page.locator('.journey-coaching')).toContainText('5,00');
  await page.getByRole('button', { name: 'Guardei dinheiro', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Valor (R$)', { exact: true }).fill('30,00');
  await page.getByRole('dialog').getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Confirmar progresso' }).click();
  await expect(page.locator('.journey-amount strong')).toContainText('30,00');
  await expect(page.locator('.journey-level')).toContainText('10 pontos');
  await page.getByRole('button', { name: 'Precisei usar numa urgência' }).click();
  await page.getByRole('dialog').getByLabel('Valor (R$)', { exact: true }).fill('30,00');
  await page.getByRole('dialog').getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Confirmar progresso' }).click();
  await expect(page.locator('.journey-amount strong')).toContainText('0,00');
  await expect(page.locator('.journey-coaching')).toContainText('não foi apagado');
  await expect(page.locator('.journey-foot')).toContainText('30,00');
  await expect(page.locator('.journey-level')).toContainText('10 pontos');
  await page.reload();
  await expect(page.locator('.journey-coaching')).toContainText('não foi apagado');
});
test('check-in único mantém pontos e pausa lembretes sem perder nível', async ({ page }) => {
  await page.getByRole('button', { name: 'Fazer meu check-in' }).click();
  await page.getByRole('button', { name: 'Estou retomando aos poucos' }).click();
  await expect(page.locator('.journey-level')).toContainText('5 pontos');
  await expect(page.getByRole('button', { name: 'Check-in desta semana feito' })).toBeDisabled();
  await page.getByRole('button', { name: 'Personalizar acompanhamento' }).click();
  await page.getByRole('checkbox', { name: 'Mostrar pontos e níveis de hábitos' }).uncheck();
  await expect(page.getByRole('checkbox', { name: 'Mostrar pontos e níveis de hábitos' })).toBeEnabled();
  await page.getByRole('dialog').getByRole('button', { name: 'Concluir', exact: true }).click();
  await expect(page.locator('.journey-level')).toHaveCount(0);
});
test('recompensas desbloqueiam personalização real e cartão local sem dados bancários', async ({ page }) => {
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('nexo.demo.v1')!);
    data.habit_events = Array.from({ length: 15 }, (_, index) => ({
      id: crypto.randomUUID(),
      kind: 'checkin',
      day: `2026-09-${String(index + 1).padStart(2, '0')}`,
      points: 5,
    }));
    localStorage.setItem('nexo.demo.v1', JSON.stringify(data));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Minhas conquistas' }).click();
  await expect(page.getByRole('dialog')).toContainText('Conquistado');
  await page.getByLabel('Cor da minha jornada').selectOption('ocean');
  await expect(page.getByLabel('Cor da minha jornada')).toBeEnabled();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar meu cartão de conquista' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('nexo-minha-conquista.png');
  await page.getByRole('dialog').getByRole('button', { name: 'Concluir', exact: true }).click();
  await expect(page.locator('.goal-journey')).toHaveAttribute('data-style', 'ocean');
});

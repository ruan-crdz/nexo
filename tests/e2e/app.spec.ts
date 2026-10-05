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
    for (const route of ['inicio', 'movimentos', 'integracoes', 'perfil', 'ajuda', 'privacidade']) {
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
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ['inicio', 'movimentos', 'integracoes', 'perfil', 'ajuda', 'privacidade']) {
      await page.goto(`/#/${route}`);
      await expect(page.locator('main h1').first()).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth), {
          message: `${route} em ${width}px`,
        })
        .toBeLessThanOrEqual(width);
    }
  }
  await page.goto('/#/inicio');
  await page.addStyleTag({ content: 'body { font-size: 200% !important; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations).toEqual([]);
});

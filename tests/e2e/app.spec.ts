import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { formatMoney } from '../../shared/financial-engine';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Experimentar sem cadastro', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Seu mês' })).toBeVisible();
});

test('anota, persiste, corrige e exclui um gasto com confirmação', async ({ page }) => {
  await page.getByRole('button', { name: 'Anotar', exact: true }).click();
  await page.getByRole('button', { name: 'Digitar' }).click();
  await page.getByRole('button', { name: 'Um gasto' }).click();
  await page.getByLabel('Quanto foi? (R$)', { exact: true }).fill('42,35');
  await page.getByLabel('Com o quê?', { exact: true }).fill('Farmácia teste');
  await expect(page.getByLabel('Categoria', { exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Salvar movimento', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Movimento salvo.');
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Histórico' }).click();
  await page.getByRole('button', { name: 'Buscar no histórico' }).click();
  await page.getByRole('searchbox').fill('Farmácia teste');
  await expect(page.getByRole('button', { name: 'Farmácia teste' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Buscar no histórico' }).click();
  await page.getByRole('searchbox').fill('Farmácia teste');
  await page.getByRole('button', { name: 'Farmácia teste' }).click();
  await page.getByRole('button', { name: 'Corrigir movimento' }).click();
  await page.getByLabel('Quanto foi? (R$)').fill('50,00');
  await page.getByRole('button', { name: 'Salvar movimento' }).click();
  await expect(page.locator('.money-row-top > strong')).toContainText('50,00');
  await page.getByRole('button', { name: 'Farmácia teste' }).click();
  await page.getByRole('button', { name: 'Mais opções' }).click();
  await page.getByRole('button', { name: 'Excluir registro' }).click();
  await page.getByRole('button', { name: 'Não, voltar' }).click();
  await page.getByRole('button', { name: 'Farmácia teste' }).click();
  await page.getByRole('button', { name: 'Mais opções' }).click();
  await page.getByRole('button', { name: 'Excluir registro' }).click();
  await page.getByRole('button', { name: 'Sim, excluir movimento' }).click();
  await expect(page.getByRole('button', { name: 'Farmácia teste' })).not.toBeVisible();
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
  await page.getByRole('button', { name: 'Anotar', exact: true }).click();
  await page.getByRole('button', { name: 'Digitar' }).click();
  await page.getByRole('button', { name: 'Uma entrada' }).click();
  await page.getByLabel('Quanto foi? (R$)').fill('150,00');
  await page.getByLabel('De onde veio?').fill('Entrada de teste');
  await page.getByRole('button', { name: 'Salvar movimento' }).click();
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
  await page.getByRole('button', { name: 'Buscar no histórico' }).click();
  await page.getByRole('searchbox').fill('Entrada de teste');
  await page.getByRole('button', { name: 'Filtrar histórico' }).click();
  await page.getByLabel('Gastos', { exact: true }).check();
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByRole('button', { name: 'Entrada de teste' })).not.toBeVisible();
  await page.getByRole('button', { name: 'Filtrar histórico' }).click();
  await page.getByLabel('Entradas', { exact: true }).check();
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByRole('button', { name: 'Entrada de teste' })).toBeVisible();
  await page.getByRole('button', { name: 'Entrada de teste' }).click();
  const details = page.getByRole('dialog');
  await expect(details).toContainText('Anotado no app');
  await details.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Filtrar histórico' }).click();
  await page.getByLabel('Todos', { exact: true }).check();
  await page.getByLabel('WhatsApp', { exact: true }).check();
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByRole('button', { name: 'Entrada de teste' })).not.toBeVisible();
  await page.getByRole('button', { name: 'Filtrar histórico' }).click();
  await page.getByLabel('WhatsApp', { exact: true }).uncheck();
  await page.getByLabel('Aplicativo', { exact: true }).check();
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByRole('button', { name: 'Entrada de teste' })).toBeVisible();
});

test('desfaz imediatamente um movimento recém-registrado', async ({ page }) => {
  const initial = await page.evaluate(
    () => JSON.parse(localStorage.getItem('nexo.demo.v1')!).transactions.length,
  );
  await page.getByRole('button', { name: 'Anotar', exact: true }).click();
  await page.getByRole('button', { name: 'Digitar' }).click();
  await page.getByRole('button', { name: 'Um gasto' }).click();
  await page.getByLabel('Quanto foi? (R$)', { exact: true }).fill('19,90');
  await page.getByLabel('Com o quê?', { exact: true }).fill('Desfazer teste');
  await page.getByRole('button', { name: 'Salvar movimento' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('status')).toContainText('Movimento salvo.');
  const createdId = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('nexo.demo.v1')!).transactions.find(
        (row: { description: string }) => row.description === 'Desfazer teste',
      ).id,
  );
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Movimento desfeito.');
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('nexo.demo.v1')!));
  expect(data.transactions).toHaveLength(initial);
  expect(data.transactions.some((row: { description: string }) => row.description === 'Desfazer teste')).toBe(
    false,
  );
  expect(data.habit_events.some((event: { id: string }) => event.id === createdId)).toBe(false);
});

test('detalhes do movimento mostram origem e estado atuais', async ({ page }) => {
  await page.goto('/#/movimentos');
  await page.getByRole('button', { name: 'Mercado da semana' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Mercado da semana' })).toBeVisible();
  await expect(dialog).toContainText('Mercado da semana');
  await expect(dialog).toContainText('Alimentação');
  await expect(dialog).toContainText('WhatsApp');
  await expect(dialog).toContainText('Pago');
  await dialog.getByText('Como este registro chegou aqui?').click();
  await expect(dialog).toContainText('Registrado a partir de uma mensagem enviada pelo WhatsApp.');
});

test('rejeita valor inválido e não salva ao cancelar', async ({ page }) => {
  const before = await page.evaluate(() => localStorage.getItem('nexo.demo.v1'));
  await page.getByRole('button', { name: 'Anotar', exact: true }).click();
  await page.getByRole('button', { name: 'Digitar' }).click();
  await page.getByRole('button', { name: 'Um gasto' }).click();
  await page.getByLabel('Quanto foi? (R$)').fill('0');
  await page.getByLabel('Com o quê?').fill('Não salvar');
  await page.getByRole('button', { name: 'Salvar movimento' }).click();
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
  const result = await page.locator('.home-month-result').innerText();
  await page.goto('/#/movimentos');
  await page.getByRole('button', { name: 'Conta prevista de teste' }).click();
  await page.getByRole('button', { name: 'Corrigir movimento' }).click();
  await page.getByLabel('Quanto foi? (R$)').fill('987,65');
  await page.getByRole('button', { name: 'Salvar movimento' }).click();
  const changed = await page.evaluate(
    (id) =>
      JSON.parse(localStorage.getItem('nexo.demo.v1')!).transactions.find((t: { id: string }) => t.id === id),
    original.id,
  );
  expect(changed).toMatchObject({ ...original, amount: 98765 });
  await page.goto('/#/movimentos');
  await page.getByRole('button', { name: 'Filtrar histórico' }).click();
  await page.getByLabel('Pendentes', { exact: true }).check();
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByRole('button', { name: 'Conta prevista de teste' })).toBeVisible();
  await page.goto('/#/inicio');
  await expect(page.locator('.home-month-result')).toHaveText(result, { useInnerText: true });
});

test('navegação oferece os cinco destinos principais em celular e desktop', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Principal' });
  const nexoLink = nav.getByRole('link', { name: 'Perguntar ao Nexo' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(nexoLink.locator('.simple-nav-nexo-mark img')).toBeVisible();
  await expect(nexoLink.locator('.simple-nav-nexo-label')).not.toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(nav.getByRole('link')).toHaveCount(5);
  await expect(nav).toContainText('Início');
  await expect(nav).toContainText('Histórico');
  await expect(nav.getByRole('link', { name: 'Família', exact: true })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Objetivos', exact: true })).toHaveAttribute('href', '#/metas');
  await expect(nav.getByRole('link', { name: 'Planejar', exact: true })).toHaveAttribute(
    'href',
    '#/planejar',
  );
  await expect(nav.getByRole('link').nth(2)).toHaveAttribute('href', '#/nexo');
  await expect(nexoLink).toHaveAccessibleName('Perguntar ao Nexo');
  await expect(nexoLink.locator('.simple-nav-nexo-label')).not.toBeVisible();
  const nexoMark = nexoLink.locator('.simple-nav-nexo-mark img');
  await expect(nexoMark).toHaveAttribute('src', /logo_letra_n\.png/);
  await expect(nexoMark).toHaveCSS('filter', 'brightness(0) invert(1)');
  await expect(nexoMark).toHaveCSS('width', '32px');
  await expect(page.getByRole('link', { name: 'Abrir seu perfil' })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 740 });
  const navFits = await nav.evaluate((element) => {
    const links = [...element.querySelectorAll('a')];
    return (
      element.scrollWidth <= element.clientWidth &&
      links.every((link) => {
        const bounds = link.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= window.innerWidth;
      })
    );
  });
  expect(navFits).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [name, path] of [
    ['Início', 'inicio'],
    ['Histórico', 'movimentos'],
    ['Perguntar ao Nexo', 'nexo'],
    ['Objetivos', 'metas'],
    ['Planejar', 'planejar'],
  ]) {
    await nav.getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#/${path}$`));
  }
  await nav.getByRole('link', { name: 'Início', exact: true }).click();
  await expect(
    page.locator('.home-goal').getByRole('link', { name: 'Ver todos os objetivos' }),
  ).toBeVisible();
  const linkWidths = await nav
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => link.getBoundingClientRect().width));
  expect(Math.max(...linkWidths) - Math.min(...linkWidths)).toBeLessThan(1);
  expect(await nav.evaluate((element) => getComputedStyle(element).display)).toBe('flex');
  await expect(page.getByText('Nexo Score')).not.toBeVisible();
  for (const path of ['empresa', 'futuro', 'patrimonio', 'investimentos']) {
    await page.goto(`/#/${path}`);
    await expect(page).toHaveURL(/#\/inicio$/);
    await expect(page.getByRole('heading', { name: 'Seu mês' })).toBeVisible();
  }
});

test('Perfil na demonstração mantém só destinos disponíveis e Família explica a limitação', async ({
  page,
}) => {
  await page.goto('/#/perfil');
  await expect(page.getByRole('heading', { name: 'Perfil', exact: true })).toBeVisible();
  await expect(page.locator('.simple-topbar')).toHaveCount(0);
  await expect(
    page.locator('.profile-demo-intro').getByRole('link', { name: 'Criar minha conta', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Aparência', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Como usar o Nexo' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Família', exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.locator('.profile-page input')).toHaveCount(0);
  await page.goto('/#/familia');
  await expect(page.getByRole('heading', { name: 'Família', exact: true })).toBeVisible();
  await expect(page.getByText(/Compartilhamento requer duas contas reais/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Criar minha conta' })).toBeVisible();
});

test('rotas exclusivas não exibem controles desabilitados na demonstração', async ({ page }) => {
  const routes = [
    ['/perfil/offline', 'Uso sem internet'],
    ['/integracoes', 'WhatsApp'],
    ['/familia', 'Família'],
    ['/privacidade', 'Privacidade e dados'],
    ['/seguranca', 'Proteção'],
    ['/perfil/avisos', 'Avisos'],
    ['/perfil/avisos/historico', 'Histórico de avisos'],
  ] as const;
  for (const [route, heading] of routes) {
    await page.goto(`/#${route}`);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    if (route === '/perfil/avisos') {
      await expect(page.getByRole('switch', { name: 'Enviar avisos' })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Conectar WhatsApp' })).toBeVisible();
    } else if (route === '/privacidade') {
      await expect(page.getByRole('switch', { name: 'Métricas de uso' })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Métricas de uso' })).toHaveAttribute('href', '#/cadastro');
    } else if (route !== '/integracoes') {
      await expect(page.getByRole('link', { name: 'Criar minha conta' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Voltar ao Perfil' })).toBeVisible();
    }
  }
});

test('subpáginas do Perfil usam cabeçalho local e escondem navegação global no mobile', async ({ page }) => {
  const routes = [
    '/perfil/editar',
    '/perfil/aparencia',
    '/perfil/offline',
    '/perfil/avisos',
    '/perfil/avisos/historico',
    '/integracoes',
    '/familia',
    '/importar',
    '/privacidade',
    '/privacidade/exportar',
    '/seguranca',
    '/ajuda',
  ];
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(`/#${route}`);
      await expect(page.locator('h1').first()).toBeVisible();
      await expect(page.locator('.simple-topbar')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Voltar' })).toBeVisible();
      if (viewport.width <= 700) {
        await expect(page.getByRole('navigation', { name: 'Principal' })).toBeHidden();
      }
    }
  }
  await page.goto('/#/perfil');
  await page.getByRole('link', { name: 'Como usar o Nexo' }).click();
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(page).toHaveURL(/#\/perfil$/);
});

test('datas e mês do histórico continuam utilizáveis em tela estreita e desktop', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('button', { name: 'Anotar', exact: true }).click();
  await page.getByRole('button', { name: 'Digitar' }).click();
  await page.getByRole('button', { name: 'Um gasto' }).click();
  const date = page.locator('input[type="date"]');
  await expect(date).toBeVisible();
  await date.fill('2026-10-05');
  await expect(date).toHaveValue('2026-10-05');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.goto('/#/movimentos');
  await expect(page.locator('.simple-topbar')).toBeVisible();
  await page.getByRole('button', { name: 'outubro de 2026', exact: true }).click();
  const monthSheet = page.getByRole('dialog', { name: 'Escolher período' });
  await expect(monthSheet.getByRole('button', { name: 'outubro de 2026', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await monthSheet.getByRole('button', { name: 'agosto de 2026', exact: true }).click();
  await expect(page.getByRole('button', { name: 'agosto de 2026', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole('button', { name: 'agosto de 2026', exact: true })).toBeVisible();
  await expect(page.locator('.simple-topbar')).toBeVisible();
});

test('navegação desktop e ocultação de valores persistem entre páginas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const nav = page.getByRole('navigation', { name: 'Principal' });
  await expect(nav.locator('a:not(.simple-nav-brand)')).toHaveCount(6);
  await expect(nav.locator('.simple-nav-brand img')).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Início', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Histórico' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Abrir seu perfil' })).toBeVisible();
  expect(await nav.evaluate((element) => getComputedStyle(element).position)).toBe('sticky');
  const mainBounds = await page.locator('main').boundingBox();
  const navBounds = await nav.boundingBox();
  expect(mainBounds!.x).toBeGreaterThan(navBounds!.x + navBounds!.width - 1);
  expect(mainBounds!.width).toBeLessThanOrEqual(1240);

  await page.getByRole('button', { name: 'Ocultar valores' }).click();
  await expect(page.locator('.home-month-result strong')).toHaveText('R$ •••••');
  await page.goto('/#/movimentos');
  await expect(page.locator('.money-row-top > strong').first()).toContainText('R$ •••••');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Mostrar valores' })).toBeVisible();
  await expect(page.locator('.money-row-top > strong').first()).toContainText('R$ •••••');
  await page.goto('/#/inicio');
  await expect(page.getByRole('button', { name: 'Mostrar valores' })).toBeVisible();
  await expect(page.locator('.home-month-result strong')).toHaveText('R$ •••••');
  await page.getByRole('button', { name: 'Mostrar valores' }).click();
  await page.goto('/#/movimentos');
  await expect(page.locator('.money-row-top > strong').first()).not.toContainText('•••••');

  await page.goto('/#/inicio');
  await page.getByRole('button', { name: 'Ocultar valores' }).click();
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('nexo.demo.v1')!);
    const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })
      .format(new Date())
      .slice(0, 7);
    data.budgets.push({
      id: crypto.randomUUID(),
      category: 'Teste da máscara',
      limit_amount: 90_000,
      month,
    });
    localStorage.setItem('nexo.demo.v1', JSON.stringify(data));
  });
  await page.goto('/#/planejar');
  await expect(page.getByText('R$ •••••').first()).toBeVisible();
  await page.goto('/#/metas');
  await expect(page.getByText('R$ •••••').first()).toBeVisible();
  await page.goto('/#/nexo');
  await page.getByRole('button', { name: 'Como está meu mês?' }).click();
  await expect(page.locator('.chat-message.assistant').first()).toContainText('•••••');
  await page.goto('/#/perguntas');
  await page.getByRole('button', { name: 'Quanto falta para minha Caixinha?' }).click();
  await expect(page.locator('.verified-answer')).toContainText('•••••');
  await expect(page.locator('.verified-answer')).not.toContainText(/R\$\s*\d/);
});

test('títulos principais seguem o padrão visual da Home e têm respiro do cabeçalho', async ({ page }) => {
  const homeTitleSizes = await page
    .locator('.home-month-title h1, .home-goal-heading h2, .home-recent h2')
    .evaluateAll((elements) => elements.map((element) => getComputedStyle(element).fontSize));
  expect(homeTitleSizes).toEqual(['22px', '22px', '22px']);
  await expect(page.locator('main')).toHaveCSS('padding-top', '16px');

  for (const [path, label] of [
    ['/#/movimentos', 'Histórico'],
    ['/#/metas', 'Objetivos'],
    ['/#/nexo', 'Nexo'],
  ]) {
    await page.goto(path);
    const heading = page.getByRole('heading', { name: label, exact: true });
    await expect(heading).toBeVisible();
    await expect(heading).toHaveCSS('font-size', '22px');
  }
});

test('onboarding pergunta nome, oferece WhatsApp e salva objetivo opcional', async ({ page }) => {
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('nexo.demo.v1')!);
    data.profile.name = 'Nome anterior';
    data.profile.objective = '';
    data.profile.onboarded = false;
    localStorage.setItem('nexo.demo.v1', JSON.stringify(data));
  });
  await page.reload();
  await page.goto('/#/onboarding');
  await expect(page.getByRole('heading', { name: 'Como podemos chamar você?' })).toBeVisible();
  await page.getByLabel('Seu nome', { exact: true }).fill('Ruan');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Use pelo WhatsApp' })).toBeVisible();
  await page.getByRole('link', { name: 'Conectar WhatsApp' }).click();
  await expect(page).toHaveURL(/#\/integracoes\?onboarding=1$/);
  await page.goto('/#/inicio');
  await expect(page).toHaveURL(/#\/onboarding\?step=whatsapp$/);
  await expect(page.getByRole('heading', { name: 'Use pelo WhatsApp' })).toBeVisible();
  await page.getByRole('link', { name: 'Conectar WhatsApp' }).click();
  await expect(page.getByRole('link', { name: 'Continuar sem conectar' })).toBeVisible();
  await page.getByRole('link', { name: 'Continuar sem conectar' }).click();
  await expect(page.getByRole('heading', { name: 'O que você mais quer melhorar?' })).toBeVisible();
  await page.getByRole('button', { name: 'Guardar dinheiro' }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page).toHaveURL(/#\/tour$/);
  await expect(page.getByRole('heading', { name: 'Acompanhe seu mês' })).toBeVisible();
  await page.evaluate(() => localStorage.removeItem('nexo.feature-tour.demo'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Acompanhe seu mês' })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Converse com o Nexo' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Converse com o Nexo' })).toBeVisible();
  await page.goto('/#/inicio');
  await expect(page).toHaveURL(/#\/tour$/);
  await expect(page.getByRole('heading', { name: 'Converse com o Nexo' })).toBeVisible();
  await page.getByRole('button', { name: 'Pular tudo' }).click();
  await expect(page).toHaveURL(/#\/inicio$/);
  await expect(page.getByRole('heading', { name: 'Seu mês' })).toBeVisible();
  const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('nexo.demo.v1')!).profile);
  expect(profile).toMatchObject({
    name: 'Ruan',
    objective: 'Guardar dinheiro',
    onboarded: true,
    feature_tour_completed: true,
  });
  expect(await page.evaluate(() => localStorage.getItem('nexo.feature-tour.demo'))).toBe('complete');
});

test('tour apresenta as funcionalidades principais em sequência até Começar a usar', async ({ page }) => {
  const titles = [
    'Acompanhe seu mês',
    'Converse com o Nexo',
    'Anote e revise movimentos',
    'Organize suas Caixinhas',
    'Organize o planejamento',
    'Use o WhatsApp do seu jeito',
    'Tenha controle da sua privacidade',
  ];
  await page.evaluate(() => {
    localStorage.setItem('nexo.feature-tour.demo', 'pending:0');
    const data = JSON.parse(localStorage.getItem('nexo.demo.v1')!);
    data.profile.feature_tour_completed = false;
    localStorage.setItem('nexo.demo.v1', JSON.stringify(data));
  });
  await page.reload();
  await page.goto('/#/tour');
  for (const [index, title] of titles.entries()) {
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Progresso do tour' })).toHaveAttribute(
      'aria-valuenow',
      String(index + 1),
    );
    await page
      .getByRole('button', { name: index === titles.length - 1 ? 'Começar a usar' : 'Continuar' })
      .click();
  }
  await expect(page).toHaveURL(/#\/inicio$/);
  expect(await page.evaluate(() => localStorage.getItem('nexo.feature-tour.demo'))).toBe('complete');
});

test('Anotar abre opções em uma folha e permite iniciar uma entrada manual', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Anotar', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toHaveClass(/capture-sheet/);
  await expect(sheet.getByRole('heading', { name: 'Como quer adicionar?' })).toBeVisible();
  await expect(sheet.getByRole('link', { name: 'Falar com o Nexo' })).toHaveAttribute('href', '#/nexo');
  await expect(sheet.getByRole('link', { name: 'Fotografar recibo' })).toHaveAttribute('href', '#/recibo');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Anotar', exact: true }).click();
  await page.getByRole('button', { name: 'Digitar' }).click();
  await page.getByRole('button', { name: 'Uma entrada' }).click();
  await expect(page.locator('dialog.capture-sheet')).not.toBeVisible();
  await expect(page.getByLabel('Quanto foi? (R$)', { exact: true })).toBeVisible();
  await expect(page.getByLabel('De onde veio?', { exact: true })).toBeVisible();
});

test('Home identifica a demonstração e abre o índice de Perfil', async ({ page }) => {
  await expect(page.locator('.simple-demo')).toContainText('dados de exemplo');
  await page.getByRole('banner').getByRole('link', { name: 'Abrir seu perfil', exact: true }).click();
  await expect(page).toHaveURL(/#\/perfil$/);
  await expect(page.getByRole('heading', { name: 'Perfil', exact: true })).toBeVisible();
  await expect(
    page.locator('.profile-demo-intro').getByRole('link', { name: 'Criar minha conta', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Posso gastar?', exact: true })).toHaveCount(0);
});

test('Proteção descreve somente MFA realmente disponível', async ({ page }) => {
  await page.goto('/#/seguranca');
  await expect(page.getByRole('heading', { name: 'Proteção', exact: true })).toBeVisible();
  await expect(page.getByText('A proteção em duas etapas está disponível em uma conta real.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Criar minha conta' })).toBeVisible();
  await expect(page.getByText(/sessões ativas|último acesso|proteções ativas/i)).toHaveCount(0);
});

test('insight compara meses completos e prepara a pergunta do Nexo', async ({ page }) => {
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('nexo.demo.v1')!);
    const currentMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })
      .format(new Date())
      .slice(0, 7);
    const [year, month] = currentMonth.split('-').map(Number);
    const latestMonth = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
    const previousMonth = new Date(Date.UTC(year, month - 3, 1)).toISOString().slice(0, 7);
    data.transactions = [
      {
        id: crypto.randomUUID(),
        description: 'Mercado mês anterior',
        amount: 100_000,
        type: 'expense',
        category: 'Alimentação',
        date: `${previousMonth}-10`,
        status: 'paid',
        source: 'manual',
        account_id: null,
      },
      {
        id: crypto.randomUUID(),
        description: 'Mercado mês recente',
        amount: 130_000,
        type: 'expense',
        category: 'Alimentação',
        date: `${latestMonth}-10`,
        status: 'paid',
        source: 'manual',
        account_id: null,
      },
    ];
    localStorage.setItem('nexo.demo.v1', JSON.stringify(data));
  });
  await page.reload();
  await expect(page.locator('.home-insight-copy')).toContainText(
    'Seus gastos mudaram em relação ao mês passado.',
  );
  await expect(page.locator('.home-insight-amount')).toContainText('R$ 300,00 a mais');
  await expect(page.locator('.home-insight')).not.toContainText('Mercado mês anterior');
  await page.getByRole('link', { name: 'Entender a diferença' }).click();
  await expect(page.getByLabel('Sua pergunta para o Nexo')).toHaveValue(
    /Calcule a diferença pelos registros disponíveis/,
  );
  await expect(page.getByLabel('Sua pergunta para o Nexo')).not.toHaveValue(/300,00/);
});

test('Anotar reúne registro manual, Nexo, nota, extrato e WhatsApp', async ({ page }) => {
  await page.goto('/#/anotar');
  await expect(page.getByRole('heading', { name: 'Anotar', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Falar ou escrever para o Nexo' })).toHaveAttribute(
    'href',
    '#/nexo',
  );
  await expect(page.getByRole('link', { name: 'Fotografar ou enviar uma nota' })).toHaveAttribute(
    'href',
    '#/recibo',
  );
  await expect(page.getByRole('link', { name: 'Importar extrato' })).toHaveAttribute('href', '#/importar');
  await expect(page.getByRole('link', { name: 'Usar WhatsApp' })).toHaveAttribute('href', '#/integracoes');
  await page.getByRole('button', { name: 'Anotar gasto' }).click();
  await expect(page.getByLabel('Quanto foi? (R$)')).toBeVisible();
});

test('demonstração explica WhatsApp sem fingir conexão ou envio', async ({ page }) => {
  await page.getByRole('link', { name: 'WhatsApp', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'WhatsApp', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Criar conta para conectar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Conectar WhatsApp' })).toHaveCount(0);
});

test('modo noturno persiste e acompanha a preferência do aparelho', async ({ page }) => {
  await page.goto('/#/perfil/aparencia');
  await page.getByLabel('Escuro', { exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.getByLabel('Escuro', { exact: true })).toBeChecked();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.getByLabel('Usar configuração do celular').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('nome persiste e exclusão de conta exige confirmação explícita', async ({ page }) => {
  await page.goto('/#/perfil/editar');
  await page.getByLabel('Nome', { exact: true }).fill('Maria');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByRole('status')).toContainText('Nome atualizado.');
  await page.goto('/#/inicio');
  await expect(page.locator('.simple-nav-avatar')).toHaveText('M');
  await page.goto('/#/privacidade');
  await expect(page.getByRole('link', { name: /Métricas de uso/ })).toHaveAttribute('href', '#/cadastro');
  await expect(page.getByRole('switch', { name: /Métricas de uso/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Excluir minha conta' }).click();
  await expect(page.getByRole('button', { name: 'Confirmar exclusão permanente' })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancelar e voltar' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Privacidade e dados', exact: true })).toBeVisible();
});

test('exportação de dados tem confirmação e download em página própria', async ({ page }) => {
  await page.goto('/#/privacidade');
  await page.getByRole('link', { name: 'Baixar meus dados' }).click();
  await expect(page.getByRole('heading', { name: 'Baixar meus dados', exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Preparar download' }).click();
  expect((await download).suggestedFilename()).toBe('nexo-meus-dados.json');
  await expect(page.getByRole('status')).toContainText('Cópia dos seus dados preparada');
});

test('telas em claro e escuro passam verificações de acessibilidade', async ({ page }) => {
  test.setTimeout(60_000);
  for (const theme of ['light', 'dark']) {
    await page.goto('/#/perfil/aparencia');
    await page.getByLabel(theme === 'light' ? 'Claro' : 'Escuro', { exact: true }).check();
    for (const route of [
      'inicio',
      'anotar',
      'movimentos',
      'nexo',
      'integracoes',
      'perfil',
      'ajuda',
      'privacidade',
      'privacidade/exportar',
      'planejar',
      'metas',
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
      'anotar',
      'movimentos',
      'nexo',
      'integracoes',
      'perfil',
      'ajuda',
      'privacidade',
      'privacidade/exportar',
      'planejar',
      'metas',
      'perguntas',
      'importar',
      'familia',
      'controle',
      'recibo',
    ]) {
      await page.goto(`/#/${route}`);
      await expect(page.locator('main h1').first()).toBeVisible();
      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const overflow = await page.evaluate(() =>
        Array.from(document.querySelectorAll('body *'))
          .map((element) => {
            const bounds = element.getBoundingClientRect();
            return {
              tag: element.tagName,
              className: typeof element.className === 'string' ? element.className : '',
              right: Math.round(bounds.right),
            };
          })
          .filter((element) => element.right > window.innerWidth + 1)
          .slice(-5),
      );
      expect(
        documentWidth,
        `${route} em ${width}px; overflow: ${JSON.stringify(overflow)}`,
      ).toBeLessThanOrEqual(width);
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

test('Mais controle mantém campos alinhados e Movimentos cabe no menu mobile', async ({ page }) => {
  for (const width of [320, 360, 390, 1024, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/#/controle');
    await expect(page.locator('h1')).toHaveText('Posso gastar?');
    const metrics = await page.evaluate(() => {
      const form = document.querySelector('form.simple-form')!;
      const inputs = Array.from(form.querySelectorAll<HTMLInputElement>('input:not([type="checkbox"])'));
      const label = Array.from(document.querySelectorAll('.simple-nav a span')).find(
        (element) => element.textContent?.trim() === 'Histórico',
      )!;
      const labelStyle = getComputedStyle(label);
      return {
        formWidth: form.getBoundingClientRect().width,
        inputWidths: inputs.map((input) => input.getBoundingClientRect().width),
        dateWidths: inputs
          .filter((input) => input.type === 'date')
          .map((input) => input.getBoundingClientRect().width),
        documentWidth: document.documentElement.scrollWidth,
        labelWidth: label.getBoundingClientRect().width,
        labelScrollWidth: label.scrollWidth,
        labelHeight: label.getBoundingClientRect().height,
        labelLineHeight: Number.parseFloat(labelStyle.lineHeight),
        labelWhiteSpace: labelStyle.whiteSpace,
      };
    });
    expect(metrics.inputWidths).toHaveLength(6);
    expect(Math.max(...metrics.inputWidths) - Math.min(...metrics.inputWidths)).toBeLessThanOrEqual(1);
    expect(metrics.dateWidths).toEqual([metrics.inputWidths[1], metrics.inputWidths[2]]);
    expect(metrics.documentWidth).toBeLessThanOrEqual(width);
    if (width >= 1024) expect(metrics.formWidth).toBeLessThanOrEqual(760);
    if (width <= 390) {
      expect(metrics.labelWhiteSpace).toBe('nowrap');
      expect(metrics.labelScrollWidth).toBeLessThanOrEqual(metrics.labelWidth);
      expect(metrics.labelHeight).toBeLessThanOrEqual(metrics.labelLineHeight + 1);
    }
  }
});

test('formulário tem foco, Escape cancela e campos são acessíveis', async ({ page }) => {
  await page.getByRole('button', { name: 'Anotar', exact: true }).click();
  await page.getByRole('button', { name: 'Digitar' }).click();
  await page.getByRole('button', { name: 'Um gasto' }).click();
  await expect(page.getByLabel('Quanto foi? (R$)')).toBeFocused();
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(result.violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('Home mostra o resumo, ações rápidas, objetivos e até três movimentos', async ({ page }) => {
  const totals = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('nexo.demo.v1')!);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const month = today.slice(0, 7);
    return data.transactions
      .filter(
        (transaction: { date: string; status: string; type: string }) =>
          transaction.date <= today &&
          transaction.date.startsWith(month) &&
          transaction.status === 'paid' &&
          (transaction.type === 'income' || transaction.type === 'expense'),
      )
      .reduce(
        (result: { income: number; expenses: number }, transaction: { amount: number; type: string }) => {
          result[transaction.type === 'income' ? 'income' : 'expenses'] += transaction.amount;
          return result;
        },
        { income: 0, expenses: 0 },
      );
  });
  const net = totals.income - totals.expenses;
  await expect(page.getByRole('heading', { name: 'Seu mês', exact: true })).toBeVisible();
  await expect(page.locator('.home-month-result')).toContainText(net < 0 ? 'faltou' : 'livre para planejar');
  await expect(page.locator('.home-flow-line')).toHaveText(
    `Entrou ${formatMoney(totals.income)} · Saiu ${formatMoney(totals.expenses)}`,
  );
  await expect(page.locator('.home-month-details')).toHaveCount(0);
  await page.locator('.home-month-title').click();
  await expect(page.locator('.home-month-details')).toContainText(
    `Resultado dos movimentos${formatMoney(net)}`,
  );
  await expect(page.locator('.home-month-details')).toContainText('Objetivos');
  await expect(page.locator('.home-month-method')).toContainText('não é saldo bancário');
  await expect(page.getByRole('link', { name: 'WhatsApp', exact: true })).toBeVisible();
  await expect(page.locator('.home-action-rail > *')).toHaveCount(4);
  await expect(page.locator('.home-insight').count()).resolves.toBeLessThanOrEqual(1);
  await expect(page.locator('.home-goal')).toHaveCount(1);
  await expect(page.locator('.home-recent').getByRole('link', { name: 'Histórico' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Objetivos', exact: true })).toBeVisible();
  const sectionHeadingStyles = await Promise.all(
    [
      page.getByRole('heading', { name: 'Seu mês', exact: true }),
      page.getByRole('heading', { name: 'Objetivos', exact: true }),
      page.getByRole('heading', { name: 'Últimos movimentos', exact: true }),
    ].map((heading) =>
      heading.evaluate((element) => {
        const style = getComputedStyle(element);
        return { fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight };
      }),
    ),
  );
  expect(sectionHeadingStyles[1]).toEqual(sectionHeadingStyles[0]);
  expect(sectionHeadingStyles[2]).toEqual(sectionHeadingStyles[0]);
  await expect(page.locator('.home-recent .money-list > li').count()).resolves.toBeLessThanOrEqual(3);
  await expect(page.locator('.money-evolution, .money-breakdown, .home-upcoming')).toHaveCount(0);
});

test('Home mantém o resultado legível e sem rolagem horizontal em mobile e desktop', async ({ page }) => {
  for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { name: 'Seu mês', exact: true })).toBeVisible();
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const overflowingElements = await page.evaluate(() =>
      Array.from(document.querySelectorAll('body *'))
        .map((element) => {
          const bounds = element.getBoundingClientRect();
          return {
            tag: element.tagName,
            className: typeof element.className === 'string' ? element.className : '',
            right: Math.round(bounds.right),
          };
        })
        .filter((element) => element.right > window.innerWidth + 1)
        .slice(0, 8),
    );
    const actionRailLayout = await page.locator('.home-action-rail').evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const parentRect = element.parentElement!.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        viewport: window.innerWidth,
        rail: {
          x: Math.round(rect.x),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
        },
        parent: {
          x: Math.round(parentRect.x),
          right: Math.round(parentRect.right),
          width: Math.round(parentRect.width),
        },
      };
    });
    expect(
      documentWidth,
      `${width}px; overflow: ${JSON.stringify(overflowingElements)}; rail: ${JSON.stringify(actionRailLayout)}`,
    ).toBeLessThanOrEqual(width);
    const amount = page.locator('.home-month-result strong');
    const dimensions = await amount.evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
    }));
    expect(dimensions.height, `Valor principal em ${width}px`).toBeLessThanOrEqual(dimensions.lineHeight + 1);
    await expect(page.locator('.home-action-rail > *')).toHaveCount(4);
    await expect(page.locator('.home-recent .money-list > li').count()).resolves.toBeLessThanOrEqual(3);
  }
});

test('Nexo responde com conclusão, métrica principal e dados recolhidos', async ({ page }) => {
  const free = await page.locator('.home-month-result strong').innerText();
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Perguntar ao Nexo', exact: true })
    .click();
  await page.getByRole('button', { name: 'Como está meu mês?', exact: true }).click();
  const answer = page.locator('.chat-message.assistant').first();
  await expect(answer.locator('.nexo-answer-direct')).toBeVisible();
  await expect(answer.locator('.nexo-answer-metric strong')).toHaveText(free);
  await expect(answer.getByRole('link', { name: 'Ver meu mês' })).toHaveAttribute('href', '#/inicio');
  await expect(answer.locator('h2')).toHaveCount(0);
  await expect(answer).not.toContainText('A base recuperada não sustenta');
  await expect(answer).not.toContainText('Futuro se');
  await expect(answer.locator('.nexo-answer-disclosure')).toHaveCount(3);
  await answer.getByText('Dados usados', { exact: true }).click();
  await expect(answer.locator('.nexo-metrics')).toContainText(free);
  await page.getByRole('button', { name: 'Mais opções do Nexo' }).click();
  await page.getByRole('menuitem', { name: 'Nova conversa' }).click();
  await expect(page.getByRole('heading', { name: 'O que você quer saber?' })).toBeVisible();
  await expect(page.locator('.chat-message')).toHaveCount(0);
});

test('Nexo resume o mês com monthlyFlow e direciona para a Home', async ({ page }) => {
  await page.goto('/#/nexo');
  await page.getByRole('button', { name: 'Como está meu mês?', exact: true }).click();
  const answer = page.locator('.chat-message.assistant').first();
  await expect(answer.locator('.nexo-answer-direct')).toContainText('Seu mês está');
  await expect(answer.locator('.nexo-metrics')).toContainText('Entradas');
  await expect(answer.locator('.nexo-metrics')).toContainText('Saídas');
  await expect(answer.getByRole('link', { name: 'Ver meu mês' })).toHaveAttribute('href', '#/inicio');
  await expect(answer.locator('.nexo-answer-disclosure[open]')).toHaveCount(0);
});

test('Nexo inicia a tela Voz na demo e mantém a alternativa de teclado', async ({ page }) => {
  await page.goto('/#/nexo');
  await expect(page.getByRole('heading', { name: 'O que você quer saber?' })).toBeVisible();
  await expect(page.locator('.nexo-suggestions > *')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Posso gastar R$ 500?', exact: true })).toBeVisible();
  await expect(page.locator('.nexo-suggestions > *').nth(2)).toContainText(
    /Qual dívida devo priorizar\?|Quando chego nos .*\?|Como está minha reserva\?/,
  );
  await expect(page.getByLabel('Sua pergunta para o Nexo')).toBeVisible();
  await page.getByRole('button', { name: 'Falar com o Nexo' }).click();
  const voice = page.getByRole('dialog', { name: 'Nexo Voz' });
  await expect(voice.getByRole('alert')).toContainText('exige uma conta real');
  await voice.getByRole('button', { name: 'Usar teclado' }).click();
  await expect(voice).not.toBeVisible();
  await expect(page.getByLabel('Sua pergunta para o Nexo')).toBeVisible();
});

test('Home mantém WhatsApp entre os atalhos e só mostra insight quando há sinal', async ({ page }) => {
  await expect(page.getByRole('link', { name: 'WhatsApp', exact: true })).toBeVisible();
  await expect(page.locator('.home-insight').count()).resolves.toBeLessThanOrEqual(1);
  await expect(page.locator('.home-goal')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Objetivos', exact: true })).toBeVisible();
});

test('meta SMART limita aporte à sobra e separar 10 deixa 54,08 sem criar gasto', async ({ page }) => {
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('nexo.demo.v1')!);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: data.profile.timezone }).format(new Date());
    const identifier = crypto.randomUUID();
    const deadline = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) + 2, 0))
      .toISOString()
      .slice(0, 10);
    data.profile.fixed_expenses = 0;
    data.profile.active_goal_id = identifier;
    data.transactions = [
      {
        id: crypto.randomUUID(),
        description: 'Sobra de teste',
        amount: 6408,
        date: today,
        type: 'income',
        category: 'Outros',
        status: 'paid',
        source: 'manual',
        account_id: null,
      },
    ];
    data.goals = [
      {
        id: identifier,
        name: 'Juntar 500 reais',
        target: 50000,
        saved: 0,
        monthly_contribution: 0,
        weekly_amount: 0,
        high_water: 0,
        priority: 'high',
        deadline,
        purpose: 'Minha reserva',
      },
    ];
    data.goal_events = [];
    data.recurring_rules = [];
    localStorage.setItem('nexo.demo.v1', JSON.stringify(data));
  });
  await page.reload();
  await expect(page.locator('.home-month-result strong')).toHaveText(formatMoney(6408));
  const goalId = await page.evaluate(() => JSON.parse(localStorage.getItem('nexo.demo.v1')!).goals[0].id);
  await page.goto(`/#/metas/${goalId}`);
  await page.getByRole('button', { name: 'Registrar valor guardado' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Quanto você guardou? (R$)').fill('10');
  await expect(dialog.locator('.goal-plan-preview')).toContainText(formatMoney(5408));
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nexo.demo.v1')!).goals[0].saved)).toBe(0);
  await dialog.getByRole('button', { name: 'Confirmar' }).click();
  await expect(dialog).not.toBeVisible();
  await page.goto('/#/inicio');
  await expect(page.locator('.home-month-result strong')).toHaveText(formatMoney(5408));
  await page.locator('.home-month-title').click();
  await expect(page.locator('.home-month-details')).toContainText(formatMoney(6408));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nexo.demo.v1')!));
  expect(saved.transactions).toHaveLength(1);
  expect(saved.goals[0].saved).toBe(1000);
  expect(saved.goal_events).toHaveLength(1);
  await page.goto(`/#/metas/${goalId}`);
  await page.getByRole('button', { name: 'Retirar' }).click();
  const withdrawal = page.getByRole('dialog');
  await withdrawal.getByLabel('Quanto deixou de estar guardado? (R$)').fill('10');
  await withdrawal.getByRole('button', { name: 'Confirmar retirada' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.goto('/#/inicio');
  await expect(page.locator('.home-month-result strong')).toHaveText(formatMoney(6408));
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('nexo.demo.v1')!).transactions.length),
  ).toBe(1);
});

test('recibo permite corrigir antes de confirmar e não aceita valor inválido', async ({ page }) => {
  await page.goto('/#/recibo');
  await page.getByRole('button', { name: 'Experimentar com recibo fictício' }).click();
  await page.getByLabel('Descrição do recibo', { exact: true }).fill('Farmácia revisada');
  await page.getByLabel('Valor do recibo (R$)', { exact: true }).fill('-5,00');
  const consent = page.getByRole('checkbox', { name: 'Conferi e corrigi' });
  await consent.check();
  await page.getByRole('button', { name: 'Salvar dados conferidos' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('Valor do recibo (R$)', { exact: true }).fill('27,90');
  await expect(consent).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Salvar dados conferidos' })).toBeDisabled();
  await page.getByRole('combobox', { name: 'Categoria do recibo', exact: true }).selectOption('Saúde');
  await page.getByRole('combobox', { name: 'Situação do recibo', exact: true }).selectOption('paid');
  await consent.check();
  await page.getByRole('button', { name: 'Salvar dados conferidos' }).click();
  await expect(page.getByRole('button', { name: 'Salvar dados conferidos' })).not.toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('nexo.demo.v1')!).transactions.find(
      (row: { description: string }) => row.description === 'Farmácia revisada',
    ),
  );
  expect(saved).toMatchObject({ amount: 2790, category: 'Saúde', status: 'paid' });
});

test('leitura de nota aceita PDF e formatos comuns de foto', async ({ page }) => {
  await page.goto('/#/recibo');
  const input = page.getByLabel('Nota fiscal ou recibo');
  const accept = await input.getAttribute('accept');
  expect(accept).toContain('application/pdf');
  expect(accept).toContain('image/*');
  expect(accept).toContain('.heic');
  await expect(page.getByRole('heading', { name: 'Ler nota fiscal ou recibo' })).toBeVisible();
});

test('notas de versão do PWA descrevem mudanças recentes', async ({ request }) => {
  const response = await request.get('/release-notes.json');
  expect(response.ok()).toBe(true);
  const notes = await response.json();
  expect(notes.version).toBe('2026.10.08.1');
  expect(notes.changes).toEqual(['Topo mais compacto e aviso de atualização resumido para esta publicação.']);
});

test('modal não rola horizontalmente e trava o fundo em celular e PC', async ({ page }) => {
  for (const width of [320, 390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole('button', { name: 'Anotar', exact: true }).click();
    await page.getByRole('button', { name: 'Digitar' }).click();
    await page.getByRole('button', { name: 'Um gasto' }).click();
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
  await page.goto('/#/perfil/aparencia');
  await page.getByLabel('Escuro', { exact: true }).check();
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

test('Planejamento resume as áreas e centraliza a adição', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/#/planejar');
  await expect(page.getByRole('heading', { name: 'Planejamento', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Próximos 30 dias' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Limites do mês' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Caixinhas' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Contas recorrentes' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Editar|Excluir/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Adicionar planejamento' }).click();
  await expect(page.getByRole('heading', { name: 'O que quer planejar?' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Conta', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Limite de gastos' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Caixinha' })).toHaveCount(0);
  await page.goto('/#/planejar/adicionar');
  const headingSpacing = await page.evaluate(() => {
    const header = document.querySelector('.planning-page-heading')?.getBoundingClientRect();
    const content = document.querySelector('.planning-flow-step h2')?.getBoundingClientRect();
    return header && content ? content.top - header.bottom : Number.POSITIVE_INFINITY;
  });
  expect(headingSpacing).toBeLessThanOrEqual(20);
});

test('botões de ação têm altura uniforme nas telas principais', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  for (const path of ['/#/inicio', '/#/planejar', '/#/planejar/adicionar?tipo=limite', '/#/metas/nova']) {
    await page.goto(path);
    await expect(page.locator('#root .button:visible').first()).toBeVisible();
    const heights = await page
      .locator('#root .button:visible')
      .evaluateAll((buttons) =>
        [...new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().height)))].sort(),
      );
    expect(heights).toEqual([48]);
  }
});

test('recorrência persiste como pendente sem duplicar ao recarregar', async ({ page }) => {
  await page.goto('/#/planejar/adicionar');
  await page.getByRole('link', { name: 'Conta', exact: true }).click();
  await page.getByLabel('Nome da conta').fill('Conta recorrente e2e');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Valor (R$)').fill('99,50');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Data de vencimento').fill('2026-10-15');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Todo mês' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Confirmar conta' }).click();
  await expect(page.getByRole('heading', { name: 'Conta recorrente e2e' })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 740 });
  await page.locator('.planning-detail-overflow > summary[aria-label="Mais opções da conta"]').click();
  await expect(page.getByRole('link', { name: 'Editar', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pausar conta' })).toBeVisible();
  const accountMenuBounds = await page
    .locator('.planning-detail-overflow .planning-overflow-menu')
    .boundingBox();
  expect(accountMenuBounds).not.toBeNull();
  expect(accountMenuBounds!.x).toBeGreaterThanOrEqual(0);
  expect(accountMenuBounds!.x + accountMenuBounds!.width).toBeLessThanOrEqual(320);
  expect(accountMenuBounds!.y).toBeGreaterThanOrEqual(0);
  expect(accountMenuBounds!.y + accountMenuBounds!.height).toBeLessThanOrEqual(740);
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('nexo.demo.v1')!).transactions.filter(
      (row: { description: string }) => row.description === 'Conta recorrente e2e',
    ),
  );
  expect(before.length).toBeGreaterThan(0);
  expect(before.every((row: { status: string }) => row.status === 'planned')).toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Conta recorrente e2e' })).toBeVisible();
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('nexo.demo.v1')!).transactions.filter(
      (row: { description: string }) => row.description === 'Conta recorrente e2e',
    ),
  );
  expect(after).toEqual(before);
});

test('limite e meta têm cálculo verificável e avisos exigem consentimento', async ({ page }) => {
  await expect(page.locator('.attention-band')).toHaveCount(0);
  await page.goto('/#/planejar/adicionar');
  await page.getByRole('link', { name: 'Limite de gastos' }).click();
  await page.getByRole('button', { name: 'Alimentação', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Valor máximo (R$)').fill('1,00');
  await page.getByRole('button', { name: 'Criar limite' }).click();
  await expect(page.locator('.planning-limit-list-full')).toContainText('acima');
  await page.setViewportSize({ width: 320, height: 740 });
  await page.locator('.planning-limit-row').filter({ hasText: 'Alimentação' }).click();
  await expect(page.getByRole('heading', { name: 'Alimentação', exact: true })).toBeVisible();
  await page.locator('.planning-detail-overflow > summary[aria-label="Mais opções do limite"]').click();
  await expect(page.getByRole('link', { name: 'Editar limite' })).toBeVisible();
  const menuBounds = await page.locator('.planning-detail-overflow .planning-overflow-menu').boundingBox();
  expect(menuBounds).not.toBeNull();
  expect(menuBounds!.x).toBeGreaterThanOrEqual(0);
  expect(menuBounds!.x + menuBounds!.width).toBeLessThanOrEqual(320);
  expect(menuBounds!.y).toBeGreaterThanOrEqual(0);
  expect(menuBounds!.y + menuBounds!.height).toBeLessThanOrEqual(740);
  await page.goto('/#/metas/nova');
  await page.getByRole('button', { name: 'Viagem', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Nome da Caixinha').fill('Viagem e2e');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Meta (R$)').fill('1000,00');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Valor guardado (R$)').fill('200,00');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Não, vou no meu ritmo' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Criar Caixinha' }).click();
  await expect(page.getByRole('heading', { name: 'Viagem e2e' })).toBeVisible();
  await page.goto('/#/perguntas');
  await page.getByRole('button', { name: 'Quanto falta para minha Caixinha?' }).click();
  await expect(page.locator('.verified-answer')).toContainText('Viagem e2e');
  await expect(page.locator('.verified-answer')).toContainText('800,00');
  await page.goto('/#/perfil/avisos');
  await page.getByRole('switch', { name: 'Vencimentos e limites' }).check();
  await expect(page.getByRole('switch', { name: 'Vencimentos e limites' })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Métricas de uso' })).toHaveCount(0);
  await expect(page.getByText(/Conferindo disponibilidade/)).toHaveCount(0);
  await page.goto('/#/inicio');
  await expect(page.locator('.attention-band')).toHaveCount(0);
  expect(await page.locator('.home-insight').count()).toBeLessThanOrEqual(1);
});

test('extrato só é salvo após revisão e o mesmo lote não entra duas vezes', async ({ page }) => {
  const file = {
    name: 'extrato.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Data;Descrição;Valor\n04/10/2026;Importação e2e;-12,34'),
  };
  await page.goto('/#/importar');
  await page.getByLabel('Escolher arquivo CSV, OFX ou QFX').setInputFiles(file);
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
  await page.getByLabel('Escolher arquivo CSV, OFX ou QFX').setInputFiles(file);
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
  await page.getByLabel('Separado em Caixinhas (R$)').fill('100,00');
  await page.getByLabel('Renda esperada (não recebida) (R$)').fill('5000,00');
  await page.getByRole('checkbox', { name: /Confirmei o dinheiro disponível/ }).check();
  await page.getByRole('button', { name: 'Calcular com minhas premissas' }).click();
  await expect(page.locator('.verified-answer')).toContainText('não foi tratada como dinheiro recebido');
});
test('renda semanal é prevista e fatura não transforma limite em saldo', async ({ page }) => {
  await page.goto('/#/planejar/adicionar');
  await page.getByRole('link', { name: 'Conta', exact: true }).click();
  await page.getByLabel('Nome da conta').fill('Renda semanal teste');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Valor (R$)', { exact: true }).fill('100,00');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Data de vencimento').fill('2026-10-12');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Toda semana' }).click();
  await page.getByText('Mais opções').click();
  await page.getByLabel('Tipo').selectOption('income');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Confirmar conta' }).click();
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
  await page.getByLabel('Escolher arquivo CSV, OFX ou QFX').setInputFiles({
    name: 'com-erros.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Data;Descrição;Valor\n04/10/2026;Válida;-12,34\n31/02/2026;Inválida;-1,00'),
  });
  await page.getByRole('button', { name: 'Revisar registros' }).click();
  await expect(page.getByRole('heading', { name: '1 linhas não serão salvas' })).toBeVisible();
  await expect(page.locator('.import-preview')).toContainText('Válida');
  await expect(page.getByRole('button', { name: 'Salvar 1 registros selecionados' })).toBeEnabled();
});
test('lista várias Caixinhas e abre o detalhe individual', async ({ page }) => {
  const goals = [
    { id: '12345678-1234-4234-8234-123456789abc', name: 'Reserva', target: 100000, saved: 25000 },
    { id: '22345678-1234-4234-8234-123456789abc', name: 'Viagem', target: 50000, saved: 10000 },
  ];
  await page.evaluate((items) => {
    const data = JSON.parse(localStorage.getItem('nexo.demo.v1')!);
    data.goals = items.map((goal) => ({
      ...goal,
      monthly_contribution: 0,
      deadline: null,
      priority: 'medium',
      weekly_amount: 0,
      high_water: goal.saved,
      purpose: goal.name,
    }));
    data.goal_events = [];
    data.profile.active_goal_id = null;
    localStorage.setItem('nexo.demo.v1', JSON.stringify(data));
  }, goals);
  await page.reload();
  await page.goto('/#/metas');
  await expect(page.locator('.objective-card')).toHaveCount(2);
  await expect(page.locator('.objectives-total strong')).toContainText('350,00');
  await expect(page.locator('.objective-card').nth(0)).toContainText('Reserva');
  await expect(page.locator('.objective-card').nth(0)).toContainText('250,00');
  await expect(page.locator('.objective-card').nth(0)).toContainText('1.000,00');
  await page.locator('.objective-card').filter({ hasText: 'Reserva' }).click();
  await expect(page).toHaveURL(/#\/metas\/12345678-1234-4234-8234-123456789abc$/);
  await expect(page.getByRole('heading', { name: 'Reserva', exact: true })).toBeVisible();
  await expect(page.locator('.journey-level')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /check-in|conquista|acompanhamento/i })).toHaveCount(0);
});
test('wizard cria uma Caixinha sem prazo e abre seu detalhe', async ({ page }) => {
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('nexo.demo.v1')!);
    data.goals = [];
    data.profile.active_goal_id = null;
    data.goal_events = [];
    localStorage.setItem('nexo.demo.v1', JSON.stringify(data));
  });
  await page.reload();
  await page.goto('/#/metas/nova');
  await page.getByRole('button', { name: 'Reserva', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Nome da Caixinha').fill('Reserva tranquila');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Meta (R$)').fill('500,00');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Valor guardado (R$)').fill('25,00');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Não, vou no meu ritmo' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.locator('.goal-review-list')).toContainText('Sem data');
  await page.getByRole('button', { name: 'Criar Caixinha' }).click();
  await expect(page.getByRole('heading', { name: 'Reserva tranquila', exact: true })).toBeVisible();
  await expect(page.locator('.objective-detail-saved')).toContainText('25,00');
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('nexo.demo.v1')!));
  expect(data.goals).toContainEqual(
    expect.objectContaining({ name: 'Reserva tranquila', saved: 2500, deadline: null }),
  );
});
test('modal de prazo mantém opções e data alinhadas em celular', async ({ page }) => {
  const id = '12345678-1234-4234-8234-123456789abc';
  await page.evaluate((goalId) => {
    const data = JSON.parse(localStorage.getItem('nexo.demo.v1')!);
    data.goals = [
      {
        id: goalId,
        name: 'Reserva do prazo',
        target: 50000,
        saved: 2000,
        monthly_contribution: 0,
        deadline: null,
        priority: 'medium',
        weekly_amount: 0,
        high_water: 2000,
        purpose: 'Reserva',
      },
    ];
    data.goal_events = [];
    data.profile.active_goal_id = goalId;
    localStorage.setItem('nexo.demo.v1', JSON.stringify(data));
  }, id);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.reload();
  await page.goto(`/#/metas/${id}`);
  await page.locator('.objective-detail-row').nth(1).click();
  const dialog = page.getByRole('dialog');
  const choices = dialog.getByRole('group', { name: 'Prazo da Caixinha' });
  await expect(dialog).toHaveClass(/objective-settings-sheet/);
  await choices.getByRole('radio', { name: 'Escolher uma data' }).check();
  const dateValue = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().slice(0, 10);
  });
  await dialog.getByLabel('Data desejada').fill(dateValue);
  await expect(choices.locator('.objective-deadline-option').nth(1)).toHaveCSS('border-radius', '8px');
  const controlsFit = await dialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return (
      element.scrollWidth <= element.clientWidth &&
      [...element.querySelectorAll('input, button')].every((control) => {
        const controlBounds = control.getBoundingClientRect();
        return controlBounds.left >= bounds.left && controlBounds.right <= bounds.right;
      })
    );
  });
  expect(controlsFit).toBe(true);
  await dialog.getByRole('button', { name: 'Salvar' }).click();
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('nexo.demo.v1')!));
  expect(data.goals[0].deadline).toBe(dateValue);
});
test('excluir Caixinha exige confirmação e remove seu histórico', async ({ page }) => {
  const goalId = '12345678-1234-4234-8234-123456789abc';
  const eventId = '32345678-1234-4234-8234-123456789abc';
  await page.evaluate(
    ({ goalId: id, eventId: movementId }) => {
      const data = JSON.parse(localStorage.getItem('nexo.demo.v1')!);
      data.goals = [
        {
          id,
          name: 'Reserva para excluir',
          target: 50000,
          saved: 2000,
          monthly_contribution: 0,
          deadline: null,
          priority: 'medium',
          weekly_amount: 0,
          high_water: 3000,
          purpose: 'Reserva',
        },
      ];
      data.goal_events = [
        {
          id: movementId,
          goal_id: id,
          delta: 2000,
          reason: 'saving',
          balance_after: 2000,
          created_at: new Date().toISOString(),
        },
      ];
      data.profile.active_goal_id = id;
      localStorage.setItem('nexo.demo.v1', JSON.stringify(data));
    },
    { goalId, eventId },
  );
  await page.reload();
  await page.goto(`/#/metas/${goalId}`);
  await page.getByRole('button', { name: 'Excluir Caixinha' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Excluir Caixinha?' })).toBeVisible();
  await expect(dialog).toContainText('o histórico de movimentações serão removidos');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('heading', { name: 'Reserva para excluir' })).toBeVisible();
  await page.getByRole('button', { name: 'Excluir Caixinha' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir Caixinha' }).click();
  await expect(page).toHaveURL(/#\/metas$/);
  await expect(page.getByRole('heading', { name: 'Objetivos', exact: true })).toBeVisible();
  const remaining = await page.evaluate(() => JSON.parse(localStorage.getItem('nexo.demo.v1')!));
  expect(remaining.goals).toHaveLength(0);
  expect(remaining.goal_events).toHaveLength(0);
  expect(remaining.profile.active_goal_id).toBeNull();
});
test('guardar e retirar atualiza o detalhe sem apagar o pico histórico', async ({ page }) => {
  const id = '12345678-1234-4234-8234-123456789abc';
  await page.evaluate((goalId) => {
    const data = JSON.parse(localStorage.getItem('nexo.demo.v1')!);
    data.goals = [
      {
        id: goalId,
        name: 'Reserva editável',
        target: 50000,
        saved: 12000,
        monthly_contribution: 0,
        deadline: null,
        priority: 'medium',
        weekly_amount: 0,
        high_water: 12000,
        purpose: '',
      },
    ];
    data.goal_events = [];
    data.profile.active_goal_id = goalId;
    localStorage.setItem('nexo.demo.v1', JSON.stringify(data));
  }, id);
  await page.reload();
  await page.goto(`/#/metas/${id}`);
  await page.getByRole('button', { name: 'Registrar valor guardado' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Quanto você guardou? (R$)').fill('30,00');
  await dialog.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.locator('.objective-detail-saved')).toContainText('150,00');
  await page.getByRole('button', { name: 'Retirar' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Quanto deixou de estar guardado? (R$)').fill('20,00');
  await expect(dialog.getByLabel('Motivo (opcional)')).toHaveValue('');
  await dialog.getByLabel('Motivo (opcional)').selectOption('emergency');
  await dialog.getByRole('button', { name: 'Confirmar retirada' }).click();
  await expect(page.locator('.objective-detail-saved')).toContainText('130,00');
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('nexo.demo.v1')!));
  expect(data.goals[0]).toMatchObject({ saved: 13000, high_water: 15000 });
  expect(data.goal_events).toContainEqual(
    expect.objectContaining({ goal_id: id, delta: -2000, reason: 'emergency', balance_after: 13000 }),
  );
  await page.getByRole('button', { name: /2 registros/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Emergência');
});
test('conta única vira um gasto previsto sem criar recorrência', async ({ page }) => {
  await page.goto('/#/planejar/adicionar');
  await page.getByRole('link', { name: 'Conta', exact: true }).click();
  await page.getByLabel('Nome da conta').fill('Consulta médica única');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Valor (R$)').fill('85,00');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Data de vencimento').fill('2026-10-20');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Só desta vez' }).click();
  await expect(
    page.getByText('Será anotada como pendente uma única vez. Nenhum pagamento é feito pelo app.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Anotar conta' }).click();
  await expect(page.getByRole('heading', { name: 'Contas', exact: true })).toBeVisible();
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('nexo.demo.v1')!));
  expect(data.transactions).toContainEqual(
    expect.objectContaining({
      description: 'Consulta médica única',
      amount: 8500,
      type: 'expense',
      status: 'planned',
    }),
  );
  expect(data.recurring_rules).not.toContainEqual(
    expect.objectContaining({ description: 'Consulta médica única' }),
  );
});

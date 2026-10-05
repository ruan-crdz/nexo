import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explorar demonstração', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Seu dinheiro hoje' })).toBeVisible();
});
test('cria, persiste, edita e exclui um movimento', async ({ page }) => {
  await page.getByRole('button', { name: 'Adicionar movimento', exact: true }).click();
  await page.getByLabel('Descrição', { exact: true }).fill('Teste de persistência');
  await page.getByLabel('Valor (R$)', { exact: true }).fill('42,35');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.goto('/#/movimentos');
  await page.getByPlaceholder('Buscar nos seus registros').fill('Teste de persistência');
  await expect(page.getByRole('cell', { name: 'Teste de persistência', exact: true })).toBeVisible();
  await page.reload();
  await page.getByPlaceholder('Buscar nos seus registros').fill('Teste de persistência');
  await expect(page.getByRole('cell', { name: 'Teste de persistência', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Editar Teste de persistência' }).click();
  await page.getByLabel('Valor (R$)', { exact: true }).fill('50,00');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('− R$ 50,00', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Excluir Teste de persistência' }).click();
  await page.getByRole('button', { name: 'Excluir registro', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Teste de persistência', exact: true })).not.toBeVisible();
});
test('simula compra e contratação, sem misturar os domínios', async ({ page }) => {
  await page.goto('/#/futuro');
  await page.getByLabel('Valor da compra (R$)').fill('999.999,00');
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  await expect(page.getByText('Melhor rever o momento')).toBeVisible();
  await page.goto('/#/empresa');
  await expect(page.getByRole('heading', { name: 'Estúdio Horizonte, com perspectiva.' })).toBeVisible();
  await page.goto('/#/empresa/cenarios');
  await expect(page.getByRole('heading', { name: 'Essa contratação cabe no plano?' })).toBeVisible();
  await page.getByLabel('Quantidade de pessoas').fill('3');
  await expect(page.getByText('R$ 34.800,00', { exact: true })).toBeVisible();
  await page.goto('/#/inicio');
  await expect(page.getByRole('heading', { name: 'Seu dinheiro hoje' })).toBeVisible();
});
test('navega pelas telas e não gera erro JavaScript', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const route of [
    'metas',
    'jornada',
    'orcamento',
    'dividas',
    'patrimonio',
    'contas',
    'relatorios',
    'assistente',
    'perfil',
    'privacidade',
    'integracoes',
    'empresa/equipe',
    'empresa/orcamento',
    'empresa/relatorios',
    'empresa/configuracoes',
    'empresa/acessos',
  ]) {
    await page.goto(`/#/${route}`);
    await expect(page.locator('main h1').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});
test('home atende verificações automáticas de acessibilidade', async ({ page }) => {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(result.violations).toEqual([]);
  await page.screenshot({ path: `docs/screenshots/home-${test.info().project.name}.png`, fullPage: true });
});
test('a demonstração não finge conexão com IA ou WhatsApp', async ({ page }) => {
  await page.goto('/#/assistente');
  await page.getByRole('button', { name: 'Como está meu mês?' }).click();
  await expect(page.getByText(/Esta é uma explicação local da demonstração/)).toBeVisible();
  await page.goto('/#/integracoes');
  await page.getByRole('button', { name: 'Gerar código de vinculação' }).click();
  await expect(page.getByRole('alert')).toContainText('Nenhuma mensagem foi enviada');
});

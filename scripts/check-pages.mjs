import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  await page.goto('http://127.0.0.1:4173/nexo/');
  await page.getByRole('button', { name: 'Explorar demonstração', exact: true }).click();
  await page.getByRole('heading', { name: 'Seu dinheiro hoje' }).waitFor();
  await page.goto('http://127.0.0.1:4173/nexo/#/metas');
  await page.getByRole('heading', { name: 'Seu dinheiro, com destino.' }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Seu dinheiro, com destino.' }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/nexo/');
  assert.deepEqual(errors, []);
  console.log(
    'Build Pages validado: base /nexo/, assets, navegação, lazy chunks e refresh de rota sem erros.',
  );
} finally {
  await browser.close();
}

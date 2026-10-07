import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TypingIndicator } from '../../src/features/Assistant';

it('indicador de digitação tem três pontos decorativos e status acessível', () => {
  const markup = renderToStaticMarkup(<TypingIndicator />);
  expect(markup).toContain('role="status"');
  expect(markup).toContain('aria-label="Nexo está digitando"');
  expect(markup.match(/aria-hidden="true"/g)).toHaveLength(3);
  expect(markup).not.toContain('Preparando uma resposta');
});

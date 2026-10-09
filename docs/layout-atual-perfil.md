# Perfil: layout atual

Ficha factual das rotas de Perfil, sob `/#/perfil`. Perfil é um índice de destinos; edição, aparência, uso sem internet e avisos ficam em páginas próprias. Os destinos disponíveis variam entre conta real e demonstração.

## Mapa das telas

```text
PERFIL · CONTA REAL
Perfil
Avatar · nome · e-mail · Editar perfil
Conta          Aparência · Uso sem internet
Conexões       WhatsApp · Família · Importar dados
Preferências   Avisos · Privacidade e dados
Segurança      Proteção
Ajuda          Como usar o Nexo
Sair

PERFIL · DEMONSTRAÇÃO
Perfil
Avatar · modo demonstração · Criar minha conta
Preferências   Aparência
Ajuda          Como usar o Nexo · Sobre o Nexo

PÁGINAS DE DESTINO
Editar perfil · Aparência · Uso sem internet · Avisos · Histórico de avisos
```

## Perfil como índice

- A rota `/perfil/*` carrega `ProfileExperience`; `/perfil` não contém formulários nem controles de preferência.
- O cabeçalho local tem título e retorno para Início. O header global do Shell é ocultado nas rotas de Perfil.
- Em conta real, o índice mostra avatar com iniciais, nome e e-mail (quando disponível), além dos grupos Conta, Conexões, Preferências, Segurança e Ajuda. **Editar perfil** e **Sair** são ações próprias.
- Na demonstração, o índice mostra o avatar, o modo de demonstração, o convite **Criar minha conta**, Aparência, Como usar o Nexo e Sobre o Nexo. Não oferece links indisponíveis, formulários ou checkboxes.
- As linhas de destino navegam para telas separadas; não expandem configurações dentro do índice.

## Editar perfil

- Rota `/#/perfil/editar`.
- O nome é obrigatório, aceita até 80 caracteres e é salvo pelo repositório. Sucesso e falha são comunicados na própria tela.
- O e-mail é somente leitura. Alteração de foto não está disponível e não é simulada como ação.
- Salvar atualiza os dados do app e as iniciais/nome mostrados no índice.

## Aparência

- Rota `/#/perfil/aparencia`; opções **Claro**, **Escuro** e **Usar configuração do celular**.
- A escolha é persistida pela preferência local de tema e o modo de sistema acompanha a configuração do dispositivo.

## Uso sem internet

- Rota `/#/perfil/offline`; disponível apenas em conta real autenticada.
- A preferência habilita o armazenamento local cifrado e o uso com conexão temporariamente indisponível. A página informa que não é recomendado em aparelho compartilhado.
- Com o modo habilitado, mostra o total de alterações pendentes e oferece **Sincronizar agora**. Erros de leitura e configuração são informados sem apresentar uma operação como concluída.

## Avisos e histórico

- Rota `/#/perfil/avisos` contém as preferências **Vencimentos e limites**, **Resumo semanal** e **Enviar avisos**. Os estados são salvos pelo repositório; enquanto a gravação ocorre, os controles ficam desabilitados.
- **Enviar avisos** fica desabilitado na demonstração. Em conta real, quando ativado, a tela oferece o destino **Histórico de avisos**.
- Rota `/#/perfil/avisos/historico` consulta até cinco registros recentes do WhatsApp, apenas quando há conta real e consentimento ativo. A consulta e o estado vazio/erro aparecem nesta página, não no índice nem na tela de preferências.
- Métricas de uso não fazem parte de Avisos; a preferência fica em **Privacidade e dados** (`/#/privacidade`) e está desabilitada na demonstração.

## Sair e privacidade

- **Sair** abre confirmação antes de encerrar a sessão. Sem alterações locais pendentes, o diálogo oferece sair ou cancelar.
- Se houver alterações pendentes, o diálogo informa a quantidade e oferece **Sincronizar primeiro** ou **Sair mesmo assim**. A sincronização verifica novamente a fila antes de encerrar a sessão; falhas preservam as pendências e mostram erro.
- Se não for possível conferir a fila local, o diálogo informa que sair pode remover alterações locais e oferece as mesmas opções explícitas de sincronização ou saída forçada.
- Exportação de dados e exclusão permanente ficam em `/#/privacidade`. A exclusão exige confirmação textual explícita.

## Responsividade e acessibilidade

- A página usa uma coluna central com largura máxima de 680 px. As linhas têm altura mínima de 56 px e a tipografia do título reduz em telas de até 700 px.
- Títulos, grupos, links, labels e estados de formulário usam estrutura semântica; opções binárias usam checkboxes e a aparência usa radios.
- Os E2Es cobrem as rotas de Perfil, a demonstração, persistência do nome/tema, avisos e telas estreitas.

## Referências de implementação

- `src/features/ProfileExperience.tsx`: índice e páginas de destino.
- `src/features/Shell.tsx`: moldura de navegação compartilhada.
- `src/features/SimplePrivacy.tsx`: métricas, exportação e exclusão de dados.
- `src/design-system/theme.tsx`: preferência de aparência.
- `src/data/offline.ts`: armazenamento e fila local.
- `src/design-system/simple.css`: layout responsivo do Perfil.
- `tests/e2e/app.spec.ts`: cobertura de Perfil, preferências e avisos.

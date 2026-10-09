# Telas da aba Perfil

Ficha das telas e ações acessíveis pelo índice `/#/perfil`. Cada destino abaixo é uma página própria, não um formulário embutido no índice. Os itens variam entre conta real e demonstração.

## Índice do Perfil

- **Conta real:** avatar com iniciais, nome e e-mail; destinos Editar perfil, Aparência, Uso sem internet, WhatsApp, Família, Importar dados, Avisos, Privacidade e dados, Proteção e Como usar o Nexo; ação Sair.
- **Demonstração:** avatar, aviso do modo demonstração e Criar minha conta; destinos Aparência, Como usar o Nexo e Sobre o Nexo. Não oferece configurações indisponíveis ou controles desabilitados.
- O header global é ocultado nas rotas `/perfil/*` e nos destinos WhatsApp, Família, Importação, Avisos, Privacidade e Ajuda; no mobile, a navegação inferior também some nessas subpáginas. Cada uma usa cabeçalho local. Sobre o Nexo abre `/`.

## 1. Editar perfil

- **Rota:** `/#/perfil/editar` — destino **Editar perfil** na identidade da conta real.
- Mostra avatar por iniciais, campo obrigatório **Nome** (até 80 caracteres) e e-mail somente leitura.
- **Salvar alterações** persiste o nome e atualiza os dados do app; apresenta confirmação ou erro.
- A alteração de foto não está disponível. Não há edição de e-mail ou credenciais nesta tela.

## 2. Aparência

- **Rota:** `/#/perfil/aparencia` — disponível também na demonstração.
- Oferece os temas **Claro**, **Escuro** e **Usar configuração do celular** por opções de seleção.
- A escolha fica guardada como preferência local; o tema de sistema acompanha a configuração de cores do dispositivo.

## 3. Uso sem internet

- **Rota:** `/#/perfil/offline` — disponível apenas para conta real autenticada.
- O controle **Disponível neste aparelho** habilita ou desabilita o uso offline, com armazenamento local cifrado. A tela recomenda não ativar em aparelho compartilhado.
- Ao ativar pela primeira vez, confirma que uma cópia cifrada ficará no aparelho. Se houver fila pendente ou não for possível consultá-la, desativar pede confirmação e oferece sincronizar antes.
- Mostra estados de consulta, sincronização, fila pendente, sem conexão ou erro com tentativa novamente; **Sincronizar agora** só aparece quando há pendências e conexão.
- Na demonstração ou sem usuário real, oferece criar conta e voltar ao Perfil, sem switch desabilitado.

## 4. WhatsApp

- **Rota:** `/#/integracoes` — destino **WhatsApp** em Conexões.
- Mostra o estado da conexão. Em conta real, **Conectar WhatsApp** gera um código temporário e abre a conversa com a mensagem de vínculo; o status é atualizado enquanto aguarda o envio. Também permite abrir a conversa ou copiar a mensagem como alternativa, com verificação novamente e timeout.
- Após conectar, exibe os últimos quatro dígitos do número, o estado de entrega quando disponível, **Abrir conversa**, **Receber dicas no WhatsApp** e **Desconectar WhatsApp**. Desconectar exige confirmação; movimentos já salvos permanecem no Nexo.
- A demonstração oferece cadastro; não conecta um número nem envia mensagens.
- **O que você pode mandar** resume exemplos de gasto, entrada, áudio e resumo. Dicas avançadas ficam em Gerenciar quando conectado. O vínculo não significa que o envio proativo esteja homologado.

## 5. Família

- **Rota:** `/#/familia` — destino **Família** em Conexões.
- **Demonstração:** explica que o compartilhamento requer duas contas reais; nenhum dado da demonstração é enviado.
- **Conta real:** acessos ativos são consultados automaticamente ao abrir a página, cada um em seu próprio estado de carregamento/erro e retry. O snapshot respeita o escopo autorizado e atualiza periodicamente para refletir revogações.
- O botão **+** abre um wizard de convite em três passos: escopo, limites opcionais de conta/período e revisão. No escopo de movimentações é possível permitir propostas de correção. A pessoa só consulta depois que o dono aprovar; o código expira em 24 horas.
- **Tenho um código** envia pedido de acesso, também sujeito à aprovação de quem convidou. A lista organiza convites, acessos e estados; o dono pode aprovar ou revogar e a outra pessoa pode sair do acesso.
- Os grupos separados são **Quem compartilha comigo**, **Meus compartilhamentos** e **Convites e pedidos**; não há botão **Consultar** nem seletor de pessoa. O resumo é somente leitura; propostas de correção não alteram registros até o dono aprovar. Revogar bloqueia novas consultas, mas não apaga o que a outra pessoa já viu ou copiou.
- Datas são formatadas em pt-BR; datas inválidas viram **Data indisponível**, sem exibir texto ISO.

## 6. Importar dados

- **Rota:** `/#/importar` — destino **Importar dados** em Conexões; o título da página é **Importar extrato**.
- Antes de arquivo, a tela oferece escolher CSV/OFX/QFX ou baixar modelo. Conta e ajustes CSV aparecem após seleção; colunas reconhecidas automaticamente não abrem o mapeamento. Quando necessário, **Ajustar colunas** expande data, descrição, valor, tipo e formatos.
- **Revisar registros** mostra uma prévia paginada de 50 itens por vez. Registros inválidos são listados e não salvos; possíveis duplicatas começam desmarcadas e duplicatas confirmadas não podem ser selecionadas. Uma possível duplicata pode ser conciliada com um movimento existente.
- Só os itens selecionados são salvos após revisão. A tela informa quantos foram salvos e quantas duplicatas foram ignoradas; erros não apresentam a importação como concluída.
- Conexão bancária automática ainda não está disponível. CSV/OFX não pedem senha do banco. **Ler recibo por foto** abre a rota `/#/recibo`, que é outro recurso.

## 7. Avisos

- **Rota:** `/#/perfil/avisos` — destino **Avisos** em Preferências.
- Permite controlar **Vencimentos e limites**, **Resumo semanal** e **Enviar avisos**. As preferências são salvas ao alterar; controles ficam temporariamente desabilitados durante a gravação e erros são apresentados na tela.
- Na demonstração, **Vencimentos e limites** e **Resumo semanal** continuam locais; WhatsApp vira destino **Conectar WhatsApp**, sem switch desabilitado. Em conta real, ativar essa preferência revela **Histórico de avisos**.
- **Rota do histórico:** `/#/perfil/avisos/historico`. Só consulta registros quando há conta real e autorização ativa; mostra até cinco avisos, estados traduzidos, horário, retry/erro e estado vazio. Na demo oferece cadastro e retorno ao Perfil.
- Métricas não ficam em Avisos; são configuradas em Privacidade e dados.

## 8. Privacidade e dados

- **Rota:** `/#/privacidade` — destino **Privacidade e dados** em Preferências.
- Apresenta um resumo curto; **Como usamos seus dados** expande os detalhes sobre armazenamento, banco, IA e acesso técnico. Na demonstração, informa que os dados ficam neste navegador.
- **Métricas de uso** é uma preferência separada; na demo leva ao cadastro, sem switch desabilitado. Em conta real, salva a preferência do perfil.
- **Baixar meus dados** abre `/#/privacidade/exportar`, uma tela própria com **Preparar download**, estado de carregamento e arquivo JSON. Na demonstração, exporta o conjunto local; em conta real, solicita a exportação da conta.
- **Quero excluir minha conta** abre confirmação irreversível. É necessário digitar exatamente `EXCLUIR MINHA CONTA`; cancelar fecha o fluxo sem excluir.
- **Gerenciar meu WhatsApp** leva a `/#/integracoes`.

## 9. Proteção

- **Rota:** `/#/seguranca` — destino **Proteção** em Segurança.
- Usa autenticação em duas etapas TOTP por aplicativo autenticador. Em conta real, mostra se há fator ativo, permite iniciar configuração com QR code ou chave manual e verificar o código de seis dígitos.
- Fatores TOTP ativos podem ser removidos; a remoção pode exigir verificar um código. Erros ao consultar, configurar ou verificar são informados.
- É standalone, com o mesmo header local e gutter mobile. Na demonstração, oferece criar conta e voltar ao Perfil; sem sessão real de produção, a rota direciona ao login.

## 10. Como usar o Nexo

- **Rota:** `/#/ajuda` — destino **Como usar o Nexo** em Ajuda.
- Apresenta disclosures curtos para gasto, entrada, WhatsApp e correção; os números do mês e a ausência de saldo bancário têm explicações recolhidas. Oferece atalhos para Início, WhatsApp e Movimentos.

## 11. Sair

- A ação **Sair** fica no fim do índice de conta real e abre o diálogo **Sair do Nexo?**.
- Sem pendências locais, oferece **Sair** ou **Cancelar**. Havendo pendências, informa a quantidade e oferece **Sincronizar primeiro** ou **Sair mesmo assim**; a fila é consultada novamente após sincronizar.
- Se não for possível ler a fila, informa a incerteza e o risco de remover alterações locais, mantendo as mesmas opções explícitas. Erros de sincronização preservam a fila e exibem uma mensagem.

## Referências

- `src/features/ProfileExperience.tsx`: índice, editar perfil, aparência, offline e avisos.
- `src/features/ProfileSubpageLayout.tsx`: header local e linhas de navegação/switch/radio.
- `src/features/Integrations.tsx`: WhatsApp.
- `src/features/Family.tsx`: compartilhamento familiar.
- `src/features/StatementImport.tsx`: importação CSV/OFX.
- `src/features/SimplePrivacy.tsx`: privacidade, métricas, exportação e exclusão.
- `src/features/Mfa.tsx`: proteção TOTP.
- `shared/date-format.ts`: datas civis, timestamps e meses em pt-BR com validação.
- `src/features/SimpleSettings.tsx`: conteúdo de Ajuda.
- `src/features/Shell.tsx` e `src/design-system/simple.css`: moldura, navegação e layout.
- `tests/e2e/app.spec.ts`: cobertura E2E das rotas de Perfil e fluxos relacionados.
- `PROFILE_UX_REFACTOR.md`: tabela de problema, mudança, motivo, componentes, testes e status por tela.
- `docs/screenshots/profile-before-*` e `docs/screenshots/profile-after-*`: comparação visual em 390×844 e 1440×900.

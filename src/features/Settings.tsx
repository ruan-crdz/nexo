import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Download,
  MessageCircle,
  LogOut,
  Building2,
  ArrowUpRight,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../data/context';
import { invoke, supabase } from '../data/client';
import { DEMO_KEY } from '../data/repository';
import { parseMoney } from '../../shared/financial-engine';
import { profileSchema } from '../../shared/domain';
import { Badge, Button, Card, Dialog, PageHeader, SectionTitle } from '../design-system/components';
import { download } from './Resources';

export function ProfilePage() {
  const app = useApp(),
    navigate = useNavigate(),
    [name, setName] = useState(app.data.profile.name),
    [income, setIncome] = useState((app.data.profile.monthly_income / 100).toFixed(2).replace('.', ',')),
    [expenses, setExpenses] = useState((app.data.profile.fixed_expenses / 100).toFixed(2).replace('.', ',')),
    [dependents, setDependents] = useState(app.data.profile.dependents),
    [variable, setVariable] = useState(app.data.profile.variable_income),
    [insured, setInsured] = useState(app.data.profile.insured),
    [timezone, setTimezone] = useState(app.data.profile.timezone),
    [error, setError] = useState(''),
    [reset, setReset] = useState(false);
  async function save() {
    try {
      await app.repository.profile(
        profileSchema.parse({
          ...app.data.profile,
          name,
          monthly_income: parseMoney(income),
          fixed_expenses: parseMoney(expenses),
          dependents,
          variable_income: variable,
          insured,
          timezone,
        }),
      );
      await app.refresh();
      app.toast('Perfil atualizado. As projeções já consideram seu novo momento.');
      setError('');
    } catch {
      setError('Confira os valores e tente novamente.');
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Seu perfil"
        title="Seu momento muda. O Nexo acompanha."
        description="Atualize suas premissas quando precisar."
      />
      <div className="grid grid-2">
        <Card>
          <SectionTitle>Sobre seu momento</SectionTitle>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="form-grid">
              <label>
                Como podemos chamar você?
                <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                Dependentes
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={dependents}
                  onChange={(e) => setDependents(Number(e.target.value))}
                />
              </label>
              <label>
                Renda mensal aproximada (R$)
                <input inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value)} />
              </label>
              <label>
                Despesas fixas (R$)
                <input inputMode="decimal" value={expenses} onChange={(e) => setExpenses(e.target.value)} />
              </label>
              <label className="full">
                Fuso horário
                <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  {[
                    'America/Sao_Paulo',
                    'America/Manaus',
                    'America/Rio_Branco',
                    'America/Noronha',
                    'Europe/Lisbon',
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="check-label">
                <input type="checkbox" checked={variable} onChange={(e) => setVariable(e.target.checked)} />
                Minha renda varia
              </label>
              <label className="check-label">
                <input type="checkbox" checked={insured} onChange={(e) => setInsured(e.target.checked)} />
                Tenho proteção / seguro adequado
              </label>
            </div>
            {error && <p className="error-message">{error}</p>}
            <div className="form-actions">
              <Button type="submit">Salvar perfil</Button>
            </div>
          </form>
        </Card>
        <div className="stack">
          <Card>
            <SectionTitle>Seu espaço</SectionTitle>
            {[
              {
                to: '/empresa',
                icon: Building2,
                title: 'Nexo Empresas',
                text: 'Separe as contas do negócio e planeje com perspectiva.',
              },
              {
                to: '/privacidade',
                icon: ShieldCheck,
                title: 'Privacidade e segurança',
                text: 'Exporte seus dados e controle seu acesso.',
              },
              {
                to: '/integracoes',
                icon: MessageCircle,
                title: 'WhatsApp e integrações',
                text: 'Conecte a forma como você prefere registrar.',
              },
              {
                to: '/relatorios',
                icon: Download,
                title: 'Relatórios',
                text: 'Veja o caminho percorrido e exporte.',
              },
            ].map(({ to, icon: Icon, title, text }) => (
              <div className="settings-row" key={to}>
                <div>
                  <h3>
                    <Icon size={15} /> {title}
                  </h3>
                  <p>{text}</p>
                </div>
                <Link to={to} className="button button-ghost" aria-label={`Abrir ${title}`}>
                  <ArrowUpRight size={18} />
                </Link>
              </div>
            ))}
          </Card>
          <Card>
            <p className="muted" style={{ fontSize: 12, overflowWrap: 'anywhere' }}>
              ID da conta: {app.demo ? 'Demonstração local' : app.user?.id}
            </p>
            {app.demo && (
              <Button variant="secondary" onClick={() => setReset(true)} style={{ marginTop: 20 }}>
                <RotateCcw size={15} />
                Redefinir demonstração
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() =>
                void app
                  .signOut()
                  .then(() => navigate('/'))
                  .catch(() => setError('Não foi possível sair.'))
              }
              style={{ marginTop: 16 }}
            >
              <LogOut size={15} />
              {app.demo ? 'Sair da demonstração' : 'Sair da conta'}
            </Button>
          </Card>
        </div>
      </div>
      {reset && (
        <Dialog title="Recomeçar a demonstração?" onClose={() => setReset(false)}>
          <p>Suas alterações nos dados fictícios serão substituídas pelos exemplos iniciais.</p>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setReset(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                localStorage.removeItem(DEMO_KEY);
                void app.refresh();
                setReset(false);
                app.toast('Demonstração redefinida.');
              }}
            >
              Redefinir
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
export function PrivacyPage() {
  const app = useApp(),
    navigate = useNavigate(),
    [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [deleting, setDeleting] = useState(false),
    [confirmation, setConfirmation] = useState('');
  async function exportData() {
    setPending(true);
    try {
      const data = app.demo
        ? { mode: 'demo', exported_at: new Date().toISOString(), ...app.data }
        : await invoke('account-export', {});
      download('nexo-meus-dados.json', JSON.stringify(data, null, 2));
      app.toast('Exportação concluída.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível exportar.');
    } finally {
      setPending(false);
    }
  }
  async function clearHistory() {
    if (app.demo) {
      app.toast('Na demonstração, a conversa só fica aberta nesta sessão da tela.');
      return;
    }
    const result = await supabase!.from('ai_messages').delete().eq('user_id', app.user!.id);
    if (result.error) setError('Não foi possível apagar o histórico.');
    else app.toast('Histórico de IA excluído.');
  }
  async function deleteAccount() {
    setPending(true);
    try {
      if (app.demo) {
        localStorage.removeItem(DEMO_KEY);
      } else await invoke('account-delete', { confirmation });
      await app.signOut();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir.');
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Centro de privacidade"
        title="Seus dados. Suas escolhas."
        description="Controle o que compartilha e leve seus dados quando quiser."
      />
      <Card className="bottom-space">
        <ShieldCheck size={26} />
        <h2 style={{ margin: '12px 0' }}>Proteção com transparência</h2>
        <p className="muted">
          Contas reais usam isolamento por usuário e controles de acesso no Supabase. Credenciais de IA e
          WhatsApp permanecem no servidor. Administradores da infraestrutura podem ter acesso técnico aos
          dados; não prometemos inacessibilidade absoluta.
        </p>
        {app.demo && (
          <p className="notice" style={{ marginTop: 16 }}>
            Demonstração: dados fictícios salvos apenas neste navegador. Não use este modo para informações
            sensíveis reais.
          </p>
        )}
      </Card>
      <Card>
        <div className="settings-row">
          <div>
            <h3>Exportar meus dados</h3>
            <p>Arquivo JSON com registros pessoais e dados empresariais que você administra.</p>
          </div>
          <Button variant="secondary" disabled={pending} onClick={() => void exportData()}>
            <Download size={16} />
            Exportar
          </Button>
        </div>
        <div className="settings-row">
          <div>
            <h3>Histórico do assistente</h3>
            <p>Salvar conversas é opcional. Você pode excluir o histórico armazenado.</p>
          </div>
          <Button variant="secondary" onClick={() => void clearHistory()}>
            <Trash2 size={15} />
            Apagar histórico
          </Button>
        </div>
        <div className="settings-row">
          <div>
            <h3>Áudios e mídias</h3>
            <p>
              Áudios são processados em memória para transcrição e não são armazenados pelo Nexo. A retenção
              dos fornecedores segue seus próprios contratos.
            </p>
          </div>
          <Badge tone="green">Sem biblioteca de mídias</Badge>
        </div>
        <div className="settings-row">
          <div>
            <h3>Sessões da conta</h3>
            <p>
              {app.user ? `Sessão atual: ${app.user.email}. ` : ''}Encerre as sessões para exigir novo login.
              Tokens já emitidos podem permanecer válidos até expirar.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              if (app.demo) {
                app.toast('A demonstração não possui sessões remotas.');
                return;
              }
              void supabase!.auth.signOut({ scope: 'global' }).then(async ({ error }) => {
                if (error) setError('Não foi possível encerrar as sessões.');
                else {
                  await app.signOut();
                  navigate('/login');
                }
              });
            }}
          >
            Encerrar todas
          </Button>
        </div>
        <div className="settings-row">
          <div>
            <h3>Autenticação em duas etapas</h3>
            <p>
              Adicione um autenticador TOTP. Quando ativado, o banco exige a verificação adicional para
              liberar os dados.
            </p>
          </div>
          <Link to="/seguranca" className="button button-secondary">
            Gerenciar autenticador
          </Link>
        </div>
        <div className="settings-row">
          <div>
            <h3>Excluir minha conta</h3>
            <p>
              Exclusão permanente dos dados pessoais. Proprietários precisam resolver os dados compartilhados
              das empresas antes.
            </p>
          </div>
          <Button variant="danger" onClick={() => setDeleting(true)}>
            Excluir conta
          </Button>
        </div>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
      </Card>
      {deleting && (
        <Dialog
          title={app.demo ? 'Apagar dados da demonstração?' : 'Excluir permanentemente sua conta?'}
          onClose={() => setDeleting(false)}
        >
          <p>Exporte o que quiser guardar. Esta ação não pode ser desfeita.</p>
          <label style={{ marginTop: 20 }}>
            Digite EXCLUIR MINHA CONTA
            <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
          </label>
          {error && <p className="error-message">{error}</p>}
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setDeleting(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={pending || confirmation !== 'EXCLUIR MINHA CONTA'}
              onClick={() => void deleteAccount()}
            >
              Confirmar exclusão
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

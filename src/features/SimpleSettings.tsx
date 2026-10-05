import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, ShieldCheck, ChevronRight, LogOut } from 'lucide-react';
import { useApp } from '../data/context';
import { useTheme } from '../design-system/theme';
import { Button, Card, Dialog } from '../design-system/components';

export function SimpleSettings() {
  const app = useApp();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(app.data.profile.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [saved, setSaved] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    setSaved(false);
    try {
      await app.repository.profile({ ...app.data.profile, name: name.trim() });
      await app.refresh();
      setSaved(true);
    } catch {
      setError('Não foi possível salvar. Tente novamente.');
    } finally {
      setPending(false);
    }
  }
  async function signOut() {
    setPending(true);
    setError('');
    try {
      await app.signOut();
      navigate('/login');
    } catch {
      setError('Não foi possível sair. Confira sua conexão e tente de novo.');
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <header className="simple-heading">
        <h1>Ajustes</h1>
        <p>Deixe o Nexo confortável para você.</p>
      </header>
      <Card>
        <form className="simple-form" onSubmit={(e) => void save(e)}>
          <label>
            Como podemos chamar você?
            <input
              autoComplete="given-name"
              required
              maxLength={80}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
            />
          </label>
          <Button disabled={pending}>Salvar nome</Button>
          {saved && (
            <p className="notice" role="status">
              Seu nome foi atualizado.
            </p>
          )}
        </form>
      </Card>
      <Card>
        <div className="simple-form">
          <h2>Aparência da tela</h2>
          <label>
            Escolha o fundo
            <select value={theme} onChange={(e) => setTheme(e.target.value as 'system' | 'light' | 'dark')}>
              <option value="light">Claro</option>
              <option value="dark">Escuro (modo noturno)</option>
              <option value="system">Igual ao meu celular</option>
            </select>
          </label>
          <p className="muted">Sua escolha fica guardada neste aparelho.</p>
        </div>
      </Card>
      <Card className="simple-settings-links">
        <Link to="/integracoes">
          <MessageCircle />
          <span>Meu WhatsApp</span>
          <ChevronRight />
        </Link>
        <Link to="/ajuda">
          <span>Como usar o Nexo</span>
          <ChevronRight />
        </Link>
        <Link to="/privacidade">
          <ShieldCheck />
          <span>Privacidade e meus dados</span>
          <ChevronRight />
        </Link>
        <Button variant="secondary" onClick={() => setLeaving(true)}>
          <LogOut size={20} /> Sair da minha conta
        </Button>
      </Card>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {leaving && (
        <Dialog
          title="Sair da sua conta?"
          onClose={() => {
            if (!pending) setLeaving(false);
          }}
        >
          <div className="simple-form">
            <p>Suas anotações continuam salvas. Para voltar, use seu e-mail e sua senha.</p>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            <Button disabled={pending} onClick={() => void signOut()}>
              Sim, sair
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setLeaving(false)}>
              Continuar no Nexo
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

export function SimpleHelp() {
  return (
    <>
      <header className="simple-heading">
        <h1>Vamos por partes.</h1>
        <p>Você só precisa anotar o que recebeu ou gastou.</p>
      </header>
      <div className="help-steps">
        <Card>
          <span className="help-number">1</span>
          <h2>Para anotar um gasto</h2>
          <p>
            No início, toque em “Anotar gasto”. Digite o valor e com o que gastou, como “mercado”. Depois
            toque em “Salvar anotação”.
          </p>
          <Link className="button button-secondary" to="/inicio">
            Ir para o início
          </Link>
        </Card>
        <Card>
          <span className="help-number">2</span>
          <h2>Para anotar dinheiro recebido</h2>
          <p>Toque em “Anotar entrada”. Pode ser aposentadoria, salário ou qualquer dinheiro que entrou.</p>
        </Card>
        <Card>
          <span className="help-number">3</span>
          <h2>Para usar sua voz</h2>
          <p>
            Abra a área “WhatsApp” e conecte seu número. Na conversa com o Nexo, envie um áudio dizendo, por
            exemplo: “Gastei 30 reais na farmácia hoje”.
          </p>
          <Link className="button button-secondary" to="/integracoes">
            Abrir área do WhatsApp
          </Link>
        </Card>
        <Card>
          <h2>Anotou algo errado?</h2>
          <p>
            Abra “Anotações” e toque em “Corrigir”. Para tirar uma anotação, toque em “Excluir”. O Nexo vai
            pedir sua confirmação.
          </p>
          <Link className="button button-secondary" to="/movimentos">
            Ver minhas anotações
          </Link>
        </Card>
        <Card>
          <h2>De onde vem o resumo?</h2>
          <p>
            “Entrou” soma o que você recebeu no mês. “Saiu” soma o que pagou. A diferença mostra quanto sobrou
            ou faltou, com base nas suas anotações. O Nexo não consulta seu banco.
          </p>
        </Card>
      </div>
    </>
  );
}

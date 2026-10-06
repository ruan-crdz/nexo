import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../data/context';
import { invoke } from '../data/client';
import { DEMO_KEY } from '../data/repository';
import { Button, Dialog } from '../design-system/components';

export function SimplePrivacy() {
  const app = useApp();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  async function exportData() {
    setPending(true);
    setError('');
    try {
      const data = app.demo ? { mode: 'demo', ...app.data } : await invoke('account-export', {});
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'nexo-meus-dados.json';
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      app.toast('Cópia dos seus dados preparada. Confira os downloads do aparelho.');
    } catch {
      setError('Não foi possível baixar os dados. Confira sua conexão e tente de novo.');
    } finally {
      setPending(false);
    }
  }
  async function removeAccount() {
    setPending(true);
    setError('');
    try {
      if (app.demo) localStorage.removeItem(DEMO_KEY);
      else await invoke('account-delete', { confirmation });
      await app.signOut();
      navigate('/');
    } catch {
      setError('Não foi possível concluir a exclusão. Tente novamente.');
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <header className="simple-heading">
        <h1>Seus dados</h1>
        <p>Você controla suas anotações.</p>
      </header>
      <section className="privacy-section simple-form">
        <h2>O que fica guardado?</h2>
        <p>
          Seu nome, suas anotações e o número de WhatsApp que você conectar. O Nexo não acessa sua conta
          bancária.
        </p>
        <p>
          As mensagens e os áudios enviados podem ser processados por serviços de inteligência artificial para
          entender suas anotações. O Nexo não mantém uma biblioteca dos seus áudios.
        </p>
        <p>
          Suas anotações são separadas das de outras contas. A equipe responsável pelo funcionamento do
          serviço pode ter acesso técnico aos dados.
        </p>
        {app.demo && <p className="notice">Nesta demonstração, os dados ficam apenas neste navegador.</p>}
        <Link className="button button-secondary" to="/integracoes">
          Gerenciar meu WhatsApp
        </Link>
      </section>
      <section className="privacy-section simple-form">
        <h2>Guardar uma cópia</h2>
        <p>Baixe um arquivo com seus dados e suas anotações.</p>
        <Button variant="secondary" disabled={pending} onClick={() => void exportData()}>
          Baixar meus dados
        </Button>
      </section>
      <section className="privacy-section simple-form">
        <h2>Excluir minha conta</h2>
        <p>
          Isso apaga sua conta e suas anotações permanentemente. Baixe uma cópia antes, se quiser guardar seus
          dados.
        </p>
        <Button
          variant="danger"
          onClick={() => {
            setError('');
            setDeleting(true);
          }}
        >
          Quero excluir minha conta
        </Button>
      </section>
      {error && !deleting && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {deleting && (
        <Dialog
          title="Excluir tudo permanentemente?"
          onClose={() => {
            if (!pending) setDeleting(false);
          }}
        >
          <div className="simple-form">
            <p>Esta ação não pode ser desfeita. Para confirmar, escreva a frase abaixo.</p>
            <label>
              Digite EXCLUIR MINHA CONTA
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
              />
            </label>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            <Button
              variant="danger"
              disabled={pending || confirmation !== 'EXCLUIR MINHA CONTA'}
              onClick={() => void removeAccount()}
            >
              {pending ? 'Excluindo…' : 'Confirmar exclusão permanente'}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setDeleting(false)}>
              Cancelar e voltar
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

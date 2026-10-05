import { Link } from 'react-router-dom';
import { GoalJourney } from './GoalJourney';

export function GoalsPage() {
  return (
    <>
      <header className="simple-heading">
        <h1>Minhas metas</h1>
        <p>Guarde no seu ritmo. Esta parte é opcional.</p>
        <Link className="text-link" to="/inicio">
          Voltar ao meu dinheiro
        </Link>
      </header>
      <GoalJourney />
      <Link className="button button-secondary" to="/planejar">
        Ver todas as metas e planejamento
      </Link>
    </>
  );
}

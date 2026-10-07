import { Link } from 'react-router-dom';
import { GoalJourney } from './GoalJourney';

export function GoalsPage() {
  return (
    <>
      <header className="simple-heading">
        <h1>Minhas metas</h1>
        <p>Um objetivo com prazo e aportes que caibam no seu momento.</p>
      </header>
      <GoalJourney />
      <Link className="button button-secondary" to="/planejar">
        Ver todas as metas e planejamento
      </Link>
    </>
  );
}

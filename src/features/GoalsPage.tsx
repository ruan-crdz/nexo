import { Link } from 'react-router-dom';
import { GoalJourney } from './GoalJourney';

export function GoalsPage() {
  return (
    <>
      <header className="simple-heading">
        <h1>Caixinhas</h1>
        <p>Separe dinheiro para o que importa. Com ou sem prazo.</p>
      </header>
      <GoalJourney />
      <Link className="button button-secondary" to="/planejar">
        Ver planejamento completo
      </Link>
    </>
  );
}

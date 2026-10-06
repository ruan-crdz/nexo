import { useState } from 'react';
import { Search, Calculator } from 'lucide-react';
import { useApp } from '../data/context';
import { Button } from '../design-system/components';
import {
  redactFinancialText,
  useFinancialVisibility,
  useMoneyDisplay,
} from '../design-system/financial-visibility';
import { civilDate } from '../../shared/financial-engine';
import { answerFinancialQuestion } from '../../shared/financial-questions';
import { Link } from 'react-router-dom';
export function FinancialQuestions() {
  const app = useApp();
  const displayMoney = useMoneyDisplay();
  const { visible } = useFinancialVisibility();
  const [question, setQuestion] = useState('');
  const [submitted, setSubmitted] = useState('');
  const reply = answerFinancialQuestion(
    app.data,
    submitted,
    civilDate(new Date(), app.data.profile.timezone),
  );
  return (
    <>
      <header className="simple-heading">
        <h1>Pergunte ao seu dinheiro</h1>
        <p>Respostas calculadas com seus movimentos, não estimativas inventadas.</p>
      </header>
      <Link className="button button-secondary" to="/controle">
        Quanto posso gastar? · Faturas e sugestões
      </Link>
      <div className="simple-inline-actions">
        {['Por que gastei mais?', 'Quanto falta para minha meta?', 'Quais contas ainda vencem?'].map(
          (text) => (
            <Button
              key={text}
              variant="secondary"
              onClick={() => {
                setQuestion(text);
                setSubmitted(text);
              }}
            >
              {text}
            </Button>
          ),
        )}
      </div>
      <form
        className="simple-form"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(question);
        }}
      >
        <label>
          Sua pergunta
          <input maxLength={2000} value={question} onChange={(event) => setQuestion(event.target.value)} />
        </label>
        <div>
          <Button disabled={!question.trim()}>
            <Search size={18} />
            Conferir meus dados
          </Button>
        </div>
      </form>
      {submitted && (
        <section className="verified-answer" aria-live="polite">
          <h2>
            {reply
              ? visible
                ? reply.answer
                : redactFinancialText(reply.answer)
              : 'Ainda não interpreto esta pergunta. Escolha uma das perguntas acima.'}
          </h2>
          {reply && (
            <>
              <h3>
                <Calculator size={18} /> Cálculo usado
              </h3>
              <ul>
                {reply.calculation.map((line) => (
                  <li key={line}>{visible ? line : redactFinancialText(line)}</li>
                ))}
              </ul>
              <h3>Registros usados</h3>
              {reply.records.length ? (
                <ul className="evidence-list">
                  {reply.records.map((record) => (
                    <li key={record.id}>
                      <span>
                        {record.description} · {record.date.split('-').reverse().join('/')}
                      </span>
                      <strong>{displayMoney(record.amount)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Nenhum movimento foi usado nesta resposta.</p>
              )}
              {reply.goals.map((goal) => (
                <p key={goal.id}>
                  {goal.name}: objetivo {displayMoney(goal.target)}, guardado {displayMoney(goal.saved)}.
                </p>
              ))}
            </>
          )}
        </section>
      )}
    </>
  );
}

import { useEffect, useId, useRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ArrowUpRight, X, Info, Plus } from 'lucide-react';
import { formatMoney } from '../../shared/financial-engine';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand${compact ? ' brand-compact' : ''}`}>
      <img
        src={`${import.meta.env.BASE_URL}${compact ? 'logo_letra_n.png' : 'logo_nome_horizontal.png'}`}
        alt="Nexo"
        width={compact ? 56 : 180}
        height={compact ? 56 : 61}
      />
    </span>
  );
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action}
    </header>
  );
}
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      {action}
    </div>
  );
}
export function Stat({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className={`stat ${accent ? 'stat-accent' : ''}`}>
      <span>{label}</span>
      <strong>{typeof value === 'number' ? formatMoney(value) : value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={Math.round(Math.min(100, Math.max(0, value)))}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'green' | 'orange';
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: () => void;
}) {
  return (
    <div className="empty">
      <span className="empty-symbol">
        <Plus size={28} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <Button onClick={action}>
          <Plus size={16} />
          Adicionar primeiro registro
        </Button>
      )}
    </div>
  );
}
export function Why({
  children,
  title = 'Por que este resultado?',
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <details className="why">
      <summary>
        <Info size={15} />
        {title}
      </summary>
      <div>{children}</div>
    </details>
  );
}
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId();
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      className="dialog"
      ref={ref}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog-header">
        <h2 id={titleId}>{title}</h2>
        <Button variant="ghost" onClick={onClose} aria-label="Fechar">
          <X size={20} />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-link">
      {children}
      <ArrowUpRight size={15} />
    </a>
  );
}

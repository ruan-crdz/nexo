import type { ReactNode } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export function ProfileSubpageLayout({
  title,
  children,
  action,
  backTo = '/perfil',
  showBack = true,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  backTo?: string;
  showBack?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  function goBack() {
    const historyIndex = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof historyIndex === 'number' && historyIndex > 0) navigate(-1);
    else navigate(backTo, { state: { from: location.pathname } });
  }

  return (
    <div className="profile-page profile-subpage">
      <header className="profile-page-header">
        {showBack ? (
          <button className="profile-back-link" type="button" aria-label="Voltar" onClick={goBack}>
            <ArrowLeft size={20} />
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
        <h1>{title}</h1>
        <div className="profile-header-action">{action}</div>
      </header>
      <div className="profile-subpage-content">{children}</div>
    </div>
  );
}

export function SettingsRow({
  title,
  description,
  to,
  onClick,
  action,
  danger = false,
  disabled = false,
}: {
  title: string;
  description?: string;
  to?: string;
  onClick?: () => void;
  action?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  const className = `profile-setting-row${danger ? ' is-danger' : ''}${disabled ? ' is-disabled' : ''}`;
  const content = (
    <>
      <span className="profile-setting-copy">
        <span className="profile-setting-title">{title}</span>
        {description && <span className="profile-setting-description">{description}</span>}
      </span>
      <span className="profile-setting-action">
        {action ?? ((to || onClick) && <ChevronRight size={20} aria-hidden="true" />)}
      </span>
    </>
  );

  if (to)
    return (
      <Link className={className} to={to}>
        {content}
      </Link>
    );
  if (onClick)
    return (
      <button className={className} type="button" disabled={disabled} onClick={onClick}>
        {content}
      </button>
    );
  return <div className={className}>{content}</div>;
}

export function SettingsToggleRow({
  title,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="profile-setting-row profile-toggle-row">
      <span className="profile-setting-copy">
        <span className="profile-setting-title">{title}</span>
        {description && <span className="profile-setting-description">{description}</span>}
      </span>
      <span className="profile-toggle-control">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="profile-toggle-track" aria-hidden="true" />
      </span>
    </label>
  );
}

export function SettingsRadioRow({
  title,
  description,
  name,
  value,
  checked,
  onChange,
}: {
  title: string;
  description?: string;
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="profile-setting-row profile-radio-row">
      <span className="profile-setting-copy">
        <span className="profile-setting-title">{title}</span>
        {description && <span className="profile-setting-description">{description}</span>}
      </span>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} />
    </label>
  );
}

import React from 'react';
export function PageHeading({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: React.ReactNode }) {
  return <header className="workspace-heading"><div>{eyebrow && <p className="workspace-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="workspace-description">{description}</p>}</div>{actions && <div className="workspace-actions">{actions}</div>}</header>;
}
export function Surface({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <section className={`workspace-surface ${className}`}>{children}</section>; }
export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) { return <div className="workspace-empty"><span aria-hidden="true" className="workspace-empty-icon">↗</span><h2>{title}</h2><p>{description}</p>{action}</div>; }
export function Feedback({ message, retry }: { message: string; retry?: () => void }) { return <div role="alert" className="workspace-error"><p>{message}</p>{retry && <button onClick={retry}>Réessayer</button>}</div>; }

import { forwardRef, type ReactNode } from 'react';

/** Numbered step buttons; the current one carries aria-current. Children follow the buttons. */
export function Stepper({ id, label, titles, cur, onPick, children }: {
  id: string; label: string; titles: string[]; cur: number; onPick: (n: number) => void; children?: ReactNode;
}) {
  return (
    <div className="stepper" id={id} role="group" aria-label={label}>
      {titles.map((t, i) => (
        <button key={t} type="button" aria-current={i + 1 === cur ? 'step' : undefined} onClick={() => onPick(i + 1)}>
          <span className="num">{i + 1}</span>{t}
        </button>
      ))}
      {children}
    </div>
  );
}

type Next = { label: string; onClick: () => void } | { label: string; href: string };

/** The key points for the current step, then a button to the next one. */
export const Keys = forwardRef<HTMLDivElement, { id: string; title: string; keys: string[]; next?: Next }>(
  function Keys({ id, title, keys, next }, ref) {
    return (
      <div className="skeys" id={id} aria-live="polite" ref={ref}>
        <h3>{title}</h3>
        <ul>{keys.map((k) => <li key={k}>{k}</li>)}</ul>
        {next && ('href' in next
          ? <a className="vbtn go ddnext" href={next.href}>{next.label}</a>
          : <button type="button" className="vbtn go ddnext" onClick={next.onClick}>{next.label}</button>)}
      </div>
    );
  },
);

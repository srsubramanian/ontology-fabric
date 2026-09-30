import { useEffect, useRef } from 'react';
import { CH } from './path-data';

const LINKS = [{ href: '#map', label: 'Map', dot: false }, ...CH.map((c) => ({ href: '#ch' + c.n, label: c.n + ' ' + c.short, dot: true }))];

/** The chapter nav: where you are, which chapters are done. */
export function Toc({ here, done, onHere }: { here: string; done: number[]; onHere: (href: string) => void }) {
  const toc = useRef<HTMLElement>(null);
  // The section in the middle band of the screen marks its link, and scrolls it into the nav on phones.
  useEffect(() => {
    const links = Array.from(toc.current!.querySelectorAll('a'));
    const targets = links.map((a) => { const t = document.querySelector(a.getAttribute('href')!); return t ? (t.tagName === 'SECTION' ? t : t.closest('section')) : null; });
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const i = targets.indexOf(en.target), cur = links[i], t = toc.current!;
      onHere(cur ? cur.getAttribute('href')! : '');
      if (cur && t.scrollWidth > t.clientWidth) t.scrollTo({ left: cur.offsetLeft - t.clientWidth / 2 + cur.clientWidth / 2, behavior: 'smooth' });
    }), { rootMargin: '-22% 0px -70% 0px' });
    targets.forEach((t) => { if (t) io.observe(t); });
    return () => io.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <nav className="toc" aria-label="Chapters" id="toc" ref={toc}>
      {LINKS.map((l) => (
        <a key={l.href} href={l.href} className={[l.href === here ? 'here' : '', l.dot && done.includes(Number(l.href.slice(3))) ? 'done' : ''].filter(Boolean).join(' ') || undefined}>
          {l.dot && <i className="pdot"></i>}{l.label}
        </a>
      ))}
    </nav>
  );
}

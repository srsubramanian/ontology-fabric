import { useEffect, useState } from 'react';

/** The location hash without its '#', kept current as the reader navigates. */
export function useHash(): string {
  const [hash, setHash] = useState(() => location.hash.slice(1));
  useEffect(() => {
    const onChange = () => setHash(location.hash.slice(1));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

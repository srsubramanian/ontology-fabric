import { motion, type HTMLMotionProps } from 'motion/react';
import { useMemo } from 'react';
import { highlight } from './prism';

type Props = { code: string; lang: string } & Omit<HTMLMotionProps<'pre'>, 'children' | 'dangerouslySetInnerHTML'>;

/** A dark code panel highlighted with Prism. Extra props go to the <pre>, so it can animate. */
export function CodeBlock({ code, lang, ...pre }: Props) {
  const html = useMemo(() => highlight(code, lang), [code, lang]);
  return (
    <div className="code">
      <motion.pre {...pre} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

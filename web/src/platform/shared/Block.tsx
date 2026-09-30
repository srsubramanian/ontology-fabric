import { createContext, forwardRef, useContext, type HTMLAttributes } from 'react';

/** Whether the sub-page a block belongs to is the one showing. */
export const PageShown = createContext(true);

/** A chapter's sub-page: a `section.block`, hidden while another sub-page shows. */
export const Block = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(function Block(props, ref) {
  const shown = useContext(PageShown);
  return <section {...props} hidden={!shown} ref={ref} />;
});

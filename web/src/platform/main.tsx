// The platform overview, all in React: the map and your path (shell/), then the seven chapters
// (ch1/ to ch7/), one view at a time. The styles are the page's original platform.css.
import './platform.css';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { App } from './shell/App';

// Render at once, so the first paint already shows the routed view.
const root = createRoot(document.querySelector('main.wrap')!);
flushSync(() => root.render(<App />));

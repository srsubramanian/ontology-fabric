import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Chapter1 } from './Chapter1';

// Chapter 1 renders into its section before the page's remaining scripts run, since they
// find its sub-pages, mini map and watch button in the DOM.
const section = document.getElementById('ch1')!;
const root = createRoot(section);
flushSync(() => root.render(<Chapter1 />));

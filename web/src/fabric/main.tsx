// The page: a bar to switch apps, then the overview, the retrieval walkthrough and the class
// explorer. Each app's own stylesheet comes in with it (Fabric.tsx); this one styles the bar.
import './fabric.css';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Fabric } from './Fabric';

// Render at once, so the first paint already shows the routed view.
const root = createRoot(document.getElementById('root')!);
flushSync(() => root.render(<Fabric />));

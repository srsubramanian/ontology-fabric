import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../kit/tokens.css';
import '../kit/reset.css';
import './retrieval.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

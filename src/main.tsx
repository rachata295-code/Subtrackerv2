import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/anuphan/400.css';
import '@fontsource/anuphan/500.css';
import '@fontsource/anuphan/600.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/motion.css';
import App from './App';
import { ThemeProvider } from './components/ThemeProvider';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);

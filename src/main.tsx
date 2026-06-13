import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { HangarProvider } from './lib/store';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <HangarProvider>
        <App />
      </HangarProvider>
    </HashRouter>
  </React.StrictMode>,
);

import React from 'react';
import ReactDOM from 'react-dom/client';
import '../../src/styles/theme.css';
import App from './App';

document.documentElement.classList.add('pv-popup');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

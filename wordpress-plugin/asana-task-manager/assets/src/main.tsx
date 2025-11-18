import React from 'react';
import ReactDOM from 'react-dom/client';
import { TaskManagerApp } from './App';
import './styles/main.css';

const rootElement = document.getElementById('atm-root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <TaskManagerApp />
    </React.StrictMode>
  );
}

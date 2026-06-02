import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './state/store';
import { SocialProvider } from './social/SocialProvider';
import './theme/theme.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoreProvider>
      <SocialProvider>
        <App />
      </SocialProvider>
    </StoreProvider>
  </React.StrictMode>,
);

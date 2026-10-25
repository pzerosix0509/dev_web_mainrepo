import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { LoadingProvider } from './app/loading';
import './styles.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><LoadingProvider><RouterProvider router={router} /></LoadingProvider></React.StrictMode>);

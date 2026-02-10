
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import CheckoutPage from './pages/CheckoutPage';
import SuccessPage from './pages/SuccessPage';
import FailedPage from './pages/FailedPage';
import CancelledPage from './pages/CancelledPage';

const App: React.FC = () => {
  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Routes>
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/success" element={<SuccessPage />} />
          <Route path="/failed" element={<FailedPage />} />
          <Route path="/cancelled" element={<CancelledPage />} />
          <Route path="*" element={<Navigate to="/checkout?ref=TEST_REF_123&amount=5000&email=tester@example.com" replace />} />
        </Routes>
      </div>
    </HashRouter>
  );
};

export default App;
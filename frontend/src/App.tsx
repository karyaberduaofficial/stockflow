import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ROLE_METADATA } from './config/rbac';

import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { GoogleCallbackPage } from './pages/GoogleCallbackPage';
import { PendingApprovalPage } from './pages/PendingApprovalPage';
import { DashboardPage } from './pages/DashboardPage';
import { MasterDataPage } from './pages/MasterDataPage';
import { InventoryPage } from './pages/InventoryPage';
import { ProcurementPage } from './pages/ProcurementPage';
import { SalesPosPage } from './pages/SalesPosPage';
import { FinancePage } from './pages/FinancePage';
import { AccountingPage } from './pages/AccountingPage';
import { TaxPage } from './pages/TaxPage';
import { AttendancePage } from './pages/AttendancePage';
import { HrPayrollPage } from './pages/HrPayrollPage';
import { ReportsExportsPage } from './pages/ReportsExportsPage';
import { SettingsPage } from './pages/SettingsPage';

const RootRedirect: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_METADATA[user.role]?.defaultRoute || '/dashboard'} replace />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <StoreProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
            <Route
              path="/pending-approval"
              element={
                <ProtectedRoute>
                  <PendingApprovalPage />
                </ProtectedRoute>
              }
            />

            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'manager', 'warehouse', 'purchasing', 'sales', 'finance', 'hr_payroll']}>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/master-data"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'manager', 'warehouse', 'purchasing', 'sales', 'hr_payroll']}>
                    <MasterDataPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'manager', 'warehouse', 'purchasing', 'sales']}>
                    <InventoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/procurement"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'manager', 'purchasing', 'finance']}>
                    <ProcurementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sales"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'manager', 'sales', 'finance']}>
                    <SalesPosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finance"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'manager', 'finance']}>
                    <FinancePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/accounting"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'manager', 'finance']}>
                    <AccountingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tax"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'manager', 'finance', 'hr_payroll']}>
                    <TaxPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/attendance"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'manager', 'warehouse', 'purchasing', 'sales', 'finance', 'hr_payroll']}>
                    <AttendancePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr-payroll"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'manager', 'finance', 'hr_payroll']}>
                    <HrPayrollPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'manager', 'warehouse', 'purchasing', 'sales', 'finance', 'hr_payroll']}>
                    <ReportsExportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/*"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </BrowserRouter>
      </StoreProvider>
    </AuthProvider>
  );
};

export default App;

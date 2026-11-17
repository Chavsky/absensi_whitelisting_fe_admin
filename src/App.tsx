import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AdminLayout } from './components/layout/AdminLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { EmployeeListPage } from './features/employees/EmployeeListPage';
import { AdminListPage } from './features/admins/AdminListPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { StatisticsPage } from './features/statistics/StatisticsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { RouteErrorBoundary } from './components/ui/RouteErrorBoundary';
import { AttendanceSessionsPage } from './features/attendance-sessions/AttendanceSessionsPage';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <RouteErrorBoundary><Routes>
              {/* Public route */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected admin routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AdminLayout />}>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/employees" element={<EmployeeListPage />} />
                  <Route path="/admins" element={<AdminListPage />} />
                  <Route path="/attendance-sessions" element={<AttendanceSessionsPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/statistics" element={<StatisticsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Route>
              </Route>
            </Routes></RouteErrorBoundary>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

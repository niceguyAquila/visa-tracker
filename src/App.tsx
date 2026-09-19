import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { GuestRoute, ProtectedRoute } from "./components/ProtectedRoute";
import { CustomerDetail } from "./pages/CustomerDetail";
import { CustomerDuplicatesPage } from "./pages/CustomerDuplicatesPage";
import { CustomerForm } from "./pages/CustomerForm";
import { CustomersPage } from "./pages/CustomersPage";
import { Dashboard } from "./pages/Dashboard";
import { EntryForm } from "./pages/EntryForm";
import { ForgotPassword } from "./pages/ForgotPassword";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ResetPassword } from "./pages/ResetPassword";
import { SettingsPage } from "./pages/SettingsPage";
import { VisaDetail } from "./pages/VisaDetail";
import { VisaForm } from "./pages/VisaForm";
import {
  VisaListActivePage,
  VisaListArchivePage,
} from "./pages/VisaListPages";

export default function App() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/companies" element={<Navigate to="/settings" replace />} />
          <Route path="/visas/active" element={<VisaListActivePage />} />
          <Route path="/visas/archive" element={<VisaListArchivePage />} />
          <Route
            path="/visas/new"
            element={<EntryForm defaultMode="visaOnly" />}
          />
          <Route path="/visas/:id/edit" element={<VisaForm />} />
          <Route path="/visas/:id" element={<VisaDetail />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route
            path="/customers/new"
            element={<EntryForm defaultMode="personAndVisa" />}
          />
          <Route
            path="/customers/duplicates"
            element={<CustomerDuplicatesPage />}
          />
          <Route path="/customers/:id/edit" element={<CustomerForm />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

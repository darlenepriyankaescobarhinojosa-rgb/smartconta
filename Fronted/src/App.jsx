import { Navigate, Route, Routes } from "react-router-dom"
import AppShell from "./components/AppShell"
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import Expenses from "./pages/Expenses"
import Sales from "./pages/Sales"
import Workers from "./pages/Workers"
import Reports from "./pages/Reports"
import Vouchers from "./pages/Vouchers"
import Settings from "./pages/Settings"
import Inventory from "./pages/Inventory"
import Prices from "./pages/Prices"
import Debts from "./pages/Debts"
import { getStoredSession } from "./lib/auth"

function ProtectedRoute({ children }) {
  const session = getStoredSession()
  if (!session?.access_token) {
    return <Navigate to="/login" replace />
  }
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="sales" element={<Sales />} />
        <Route path="workers" element={<Workers />} />
        <Route path="reports" element={<Reports />} />
        <Route path="vouchers" element={<Vouchers />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="prices" element={<Prices />} />
        <Route path="debts" element={<Debts />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import AppShell from "./components/AppShell"
import LoadingSkeleton from "./components/LoadingSkeleton"
import Login from "./pages/Login"
import { getStoredSession } from "./lib/auth"

const Dashboard = lazy(() => import("./pages/Dashboard"))
const Expenses = lazy(() => import("./pages/Expenses"))
const Sales = lazy(() => import("./pages/Sales"))
const Workers = lazy(() => import("./pages/Workers"))
const Reports = lazy(() => import("./pages/Reports"))
const Vouchers = lazy(() => import("./pages/Vouchers"))
const Settings = lazy(() => import("./pages/Settings"))
const Inventory = lazy(() => import("./pages/Inventory"))
const Prices = lazy(() => import("./pages/Prices"))
const Debts = lazy(() => import("./pages/Debts"))
const TelegramReview = lazy(() => import("./pages/TelegramReview"))
const Finance = lazy(() => import("./pages/Finance"))
const TelegramHub = lazy(() => import("./pages/TelegramHub"))
const ConfigurationHub = lazy(() => import("./pages/ConfigurationHub"))

function ProtectedRoute({ children }) {
  const session = getStoredSession()
  if (!session?.access_token) {
    return <Navigate to="/login" replace />
  }
  return children
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
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
          <Route path="finanzas" element={<Finance />} />
          <Route path="productos" element={<Inventory />} />
          <Route path="telegram" element={<TelegramHub />} />
          <Route path="configuracion" element={<ConfigurationHub />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="sales" element={<Sales />} />
          <Route path="workers" element={<Workers />} />
          <Route path="reports" element={<Reports />} />
          <Route path="vouchers" element={<Vouchers />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="prices" element={<Prices />} />
          <Route path="debts" element={<Debts />} />
          <Route path="revisar-telegram" element={<TelegramReview />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

function RouteFallback() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <LoadingSkeleton rows={5} />
      </div>
    </div>
  )
}

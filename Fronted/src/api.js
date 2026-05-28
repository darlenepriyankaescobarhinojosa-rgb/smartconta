import axios from "axios"
import { getStoredSession } from "./lib/auth"

export const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
})

api.interceptors.request.use((config) => {
  const token = getStoredSession()?.access_token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export function formatMoney(value) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

export function downloadCsv(filename, rows) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`
  const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export const demoSummary = {
  revenue: 0,
  expenses: 0,
  profit: 0,
  active_workers: 0,
  vouchers_pending: 0,
  stock_units: 0,
  monthly_series: [],
  daily_series: [],
  categories: [],
  material_costs: [],
  recent_movements: [],
}

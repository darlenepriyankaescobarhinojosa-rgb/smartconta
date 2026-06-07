import axios from "axios"
import { getStoredSession } from "./lib/auth"

const rawAPIURL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://127.0.0.1:8000" : "")

if (!rawAPIURL) {
  throw new Error("Missing VITE_API_URL. Configure it with your backend URL before building for production.")
}

export const API_URL = rawAPIURL.replace(/\/+$/, "")

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

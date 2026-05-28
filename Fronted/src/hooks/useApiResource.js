import { useEffect, useState } from "react"
import { api } from "../api"

export function useApiResource(path, fallback) {
  const [data, setData] = useState(fallback)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let alive = true
    setLoading(true)
    api
      .get(path)
      .then((response) => alive && setData(response.data))
      .catch((err) => alive && setError(err.response?.data?.detail || "No se pudo cargar la data real"))
      .finally(() => alive && setLoading(false))

    return () => {
      alive = false
    }
  }, [path])

  async function reload() {
    setLoading(true)
    setError("")
    try {
      const response = await api.get(path)
      setData(response.data)
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo cargar la data real")
    } finally {
      setLoading(false)
    }
  }

  return { data, loading, error, reload }
}

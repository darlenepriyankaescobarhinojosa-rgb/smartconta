import { useEffect, useState } from "react"

function Dashboard() {
  const [movimientos, setMovimientos] = useState([])

  const obtenerMovimientos = () => {
    fetch("http://127.0.0.1:8000/movimientos/1")
      .then(res => res.json())
      .then(data => setMovimientos(data))
  }

  useEffect(() => {
    obtenerMovimientos()
  }, [])

  const ingresos = movimientos
    .filter(m => m.tipo === "ingreso")
    .reduce((acc, m) => acc + m.monto, 0)

  const gastos = movimientos
    .filter(m => m.tipo === "gasto")
    .reduce((acc, m) => acc + m.monto, 0)

  const ganancia = ingresos - gastos

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1> SmartConta</h1>

      {/* TARJETAS */}
      <div style={{ display: "flex", gap: "20px", marginTop: "20px" }}>
        
        <div style={{ flex: 1, background: "#22c55e", color: "white", padding: "20px", borderRadius: "10px" }}>
          <h3>Ventas</h3>
          <p>S/ {ingresos}</p>
        </div>

        <div style={{ flex: 1, background: "#ef4444", color: "white", padding: "20px", borderRadius: "10px" }}>
          <h3>Gastos</h3>
          <p>S/ {gastos}</p>
        </div>

        <div style={{ flex: 1, background: "#3b82f6", color: "white", padding: "20px", borderRadius: "10px" }}>
          <h3>Ganancia</h3>
          <p>S/ {ganancia}</p>
        </div>

      </div>

      {/* LISTA */}
      <h2 style={{ marginTop: "30px" }}>Movimientos</h2>

      {movimientos.length === 0 ? (
        <p>No hay movimientos aún</p>
      ) : (
        movimientos.map((m) => (
          <div key={m.id} style={{
            borderBottom: "1px solid #ccc",
            padding: "10px",
            color: m.tipo === "ingreso" ? "green" : "red"
          }}>
            <strong>{m.tipo}</strong> - S/ {m.monto} <br />
            <small>{m.descripcion}</small>
          </div>
        ))
      )}
    </div>
  )
}

export default Dashboard
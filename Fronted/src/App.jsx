import { useEffect, useState } from "react"

function App() {
  const [movimientos, setMovimientos] = useState([])
  const [tipo, setTipo] = useState("")
  const [monto, setMonto] = useState("")
  const [descripcion, setDescripcion] = useState("")

  const obtenerMovimientos = () => {
    fetch("http://127.0.0.1:8000/movimientos")
      .then(res => res.json())
      .then(data => setMovimientos(data))
  }

  useEffect(() => {
    obtenerMovimientos()
  }, [])

  const crearMovimiento = () => {
    fetch("http://127.0.0.1:8000/movimientos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tipo,
        monto: parseFloat(monto),
        descripcion
      })
    }).then(() => {
      obtenerMovimientos() 
      setTipo("")
      setMonto("")
      setDescripcion("")
    })
  }

  return (
    <div>
      <h1>SmartConta </h1>

      <h2>Agregar movimiento</h2>

      <input
        placeholder="tipo (ingreso/gasto)"
        value={tipo}
        onChange={(e) => setTipo(e.target.value)}
      />

      <input
        placeholder="monto"
        value={monto}
        onChange={(e) => setMonto(e.target.value)}
      />

      <input
        placeholder="descripcion"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
      />

      <button onClick={crearMovimiento}>Agregar</button>

      <h2>Movimientos</h2>

      <p>Total: {movimientos.length}</p>

      {movimientos.map((m) => (
        <div key={m.id}>
          <p>{m.tipo} - S/ {m.monto}</p>
          <p>{m.descripcion}</p>
          <hr />
        </div>
      ))}
    </div>
  )
}

export default App
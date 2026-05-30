export function productHistory(product, priceHistory = []) {
  return priceHistory
    .filter((item) => sameId(item.product_id, product.id))
    .sort((a, b) => dateValue(a) - dateValue(b))
}

export function costTrend(product, priceHistory = []) {
  const history = productHistory(product, priceHistory)
  const latest = history.at(-1)
  const previous = history.at(-2)
  const currentCost = numberValue(product.cost ?? latest?.cost)
  const previousCost = numberValue(previous?.cost ?? latest?.cost ?? product.cost)
  const changePct = previousCost > 0 ? ((currentCost - previousCost) / previousCost) * 100 : 0

  return {
    currentCost,
    previousCost,
    changePct,
    isIncreasing: changePct > 1,
    hasHistory: history.length > 0,
    hasComparison: history.length > 1,
  }
}

export function priceTrend(product, priceHistory = []) {
  const history = productHistory(product, priceHistory)
  const latest = history.at(-1)
  const previous = history.at(-2)
  const currentPrice = numberValue(product.price ?? latest?.price)
  const previousPrice = numberValue(previous?.price ?? latest?.price ?? product.price)
  const changePct = previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0

  return {
    currentPrice,
    previousPrice,
    changePct,
    hasComparison: history.length > 1,
  }
}

export function marginInfo(product) {
  const cost = numberValue(product.cost)
  const price = numberValue(product.price)
  const margin = price - cost
  const marginPct = price > 0 ? (margin / price) * 100 : 0
  const level = marginPct < 15 ? "low" : marginPct < 30 ? "medium" : "high"

  return { cost, price, margin, marginPct, level }
}

export function hasMovement(product, movements = []) {
  return movements.some((movement) => sameId(movement.product_id, product.id))
}

export function productStatus(product, priceHistory = [], movements = []) {
  const stock = numberValue(product.stock)
  const minStock = numberValue(product.min_stock)
  const margin = marginInfo(product)
  const trend = costTrend(product, priceHistory)
  const withoutMovement = !hasMovement(product, movements)

  if (stock <= minStock) {
    return { label: "CRITICO", tone: "danger", reason: "Stock bajo" }
  }

  if (trend.isIncreasing || margin.level === "low" || withoutMovement) {
    return { label: "ATENCION", tone: "warning", reason: trend.isIncreasing ? "Costo subiendo" : margin.level === "low" ? "Margen bajo" : "Sin movimiento" }
  }

  return { label: "SALUDABLE", tone: "success", reason: "Sin riesgos visibles" }
}

export function formatPercent(value) {
  const number = Number(value || 0)
  const sign = number > 0 ? "+" : ""
  return `${sign}${number.toFixed(1)}%`
}

function sameId(left, right) {
  return String(left) === String(right)
}

function numberValue(value) {
  return Number(value || 0)
}

function dateValue(item) {
  return new Date(item.occurred_on || item.created_at || 0).getTime()
}

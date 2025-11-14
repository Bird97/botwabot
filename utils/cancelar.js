// utils/cancelar.js
function verificarCancelacion(texto, endFlow) {
    const cancelarWords = ["0", "salirse", "cancelar pedido", "cancelar"];
    if (cancelarWords.includes(texto.toLowerCase())) {
        return endFlow({ body: "❌ Pedido *cancelado*. Bot apagado. Reactiva con *Hola* 🔛" });
    }
    return null; // No se canceló
}

module.exports = { verificarCancelacion };

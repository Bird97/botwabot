module.exports = {
    calcularTotal(pedido) {
        return pedido.items_encontrados.reduce((total, item) => {
            return total + (item.precio_unitario * item.cantidad);
        }, 0);
    }
};

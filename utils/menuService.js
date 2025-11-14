// Ejemplo de integración del endpoint de menú en el bot de WhatsApp
// Este archivo muestra cómo consumir el endpoint GET /productos/menu/:id_restaurante

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3050";
const ID_RESTAURANTE = process.env.ID_RESTAURANTE || ""; // Configurar en .env

/**
 * Obtiene el menú actualizado desde el backend
 * @returns {Promise<Object>} Menú en formato JSON
 */
async function obtenerMenuActualizado() {
  try {
    console.log("🔄 Obteniendo menú desde el backend...");

    const response = await fetch(
      `${BACKEND_URL}/productos/menu/${ID_RESTAURANTE}`
    );
    const data = await response.json();

    if (data.isSuccess && data.data) {
      console.log("✅ Menú obtenido exitosamente del backend");
      console.log(
        `📋 Categorías encontradas: ${Object.keys(data.data).length}`
      );

      // Contar productos totales
      const totalProductos = Object.values(data.data).reduce(
        (acc, productos) => {
          return acc + productos.length;
        },
        0
      );
      console.log(`🍽️  Productos totales: ${totalProductos}`);

      return data.data;
    } else {
      console.warn("⚠️  El backend no devolvió datos válidos");
      return usarMenuLocal();
    }
  } catch (error) {
    console.error("❌ Error al obtener menú del backend:", error.message);
    return usarMenuLocal();
  }
}

/**
 * Fallback: usa el menu.json local si falla el backend
 * @returns {Object} Menú desde archivo local
 */
function usarMenuLocal() {
  try {
    console.log("📁 Usando menu.json local como fallback");
    const menuLocal = require("./data/menu.json");
    return menuLocal;
  } catch (error) {
    console.error("❌ Error al cargar menu.json local:", error.message);
    return {};
  }
}

/**
 * Busca un producto en el menú por nombre o término similar
 * @param {Object} menu - Menú completo
 * @param {string} termino - Término de búsqueda
 * @returns {Array} Productos encontrados
 */
function buscarProducto(menu, termino) {
  const resultados = [];
  const terminoLower = termino.toLowerCase();

  for (const [categoria, productos] of Object.entries(menu)) {
    for (const producto of productos) {
      if (producto.nombre.toLowerCase().includes(terminoLower)) {
        resultados.push({
          ...producto,
          categoria: categoria,
        });
      }
    }
  }

  return resultados;
}

/**
 * Obtiene productos de una categoría específica
 * @param {Object} menu - Menú completo
 * @param {string} categoria - Nombre de la categoría (slug)
 * @returns {Array} Productos de la categoría
 */
function obtenerProductosPorCategoria(menu, categoria) {
  const categoriaSlug = categoria
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");

  return menu[categoriaSlug] || [];
}

/**
 * Genera un mensaje de WhatsApp con el menú completo
 * @param {Object} menu - Menú completo
 * @returns {string} Mensaje formateado
 */
function generarMensajeMenu(menu) {
  let mensaje = "📋 *MENÚ DISPONIBLE* 📋\n\n";

  for (const [categoria, productos] of Object.entries(menu)) {
    // Convertir slug a título legible
    const tituloCategoria = categoria
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    mensaje += `🔸 *${tituloCategoria}*\n`;

    productos.forEach((producto, index) => {
      mensaje += `${index + 1}. ${
        producto.nombre
      } - $${producto.precio.toLocaleString()}\n`;
      if (producto.descripcion) {
        mensaje += `   _${producto.descripcion}_\n`;
      }
    });

    mensaje += "\n";
  }

  return mensaje;
}

/**
 * Genera mensaje de una categoría específica
 * @param {Object} menu - Menú completo
 * @param {string} categoria - Nombre de la categoría
 * @returns {string} Mensaje formateado
 */
function generarMensajeCategoria(menu, categoria) {
  const productos = obtenerProductosPorCategoria(menu, categoria);

  if (productos.length === 0) {
    return "❌ No se encontraron productos en esa categoría.";
  }

  const tituloCategoria = categoria
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  let mensaje = `🔸 *${tituloCategoria}*\n\n`;

  productos.forEach((producto, index) => {
    mensaje += `${index + 1}. *${
      producto.nombre
    }* - $${producto.precio.toLocaleString()}\n`;
    if (producto.descripcion) {
      mensaje += `   _${producto.descripcion}_\n`;
    }
  });

  return mensaje;
}

/**
 * Ejemplo de uso en el flujo del bot
 */
async function ejemploUsoEnBot() {
  // 1. Obtener menú al iniciar el bot
  const menu = await obtenerMenuActualizado();

  // 2. Buscar un producto específico
  const cappuccinos = buscarProducto(menu, "cappuccino");
  console.log("Cappuccinos encontrados:", cappuccinos);

  // 3. Obtener productos de una categoría
  const bebidas = obtenerProductosPorCategoria(
    menu,
    "Bebidas Calientes con Café"
  );
  console.log("Bebidas calientes:", bebidas);

  // 4. Generar mensaje del menú completo
  const mensajeCompleto = generarMensajeMenu(menu);
  console.log(mensajeCompleto);

  // 5. Generar mensaje de una categoría
  const mensajeCategoria = generarMensajeCategoria(menu, "sandwiches");
  console.log(mensajeCategoria);
}

// Exportar funciones para usar en los flows
module.exports = {
  obtenerMenuActualizado,
  buscarProducto,
  obtenerProductosPorCategoria,
  generarMensajeMenu,
  generarMensajeCategoria,
  usarMenuLocal,
};

// Ejemplo de integración en flowDomicilio.js:
/*
const { obtenerMenuActualizado, buscarProducto } = require('./utils/menuService');

// Al inicio del flow
let menuActualizado = {};

const flowDomicilio = addKeyword(["domicilio", "pedido", "delivery"])
  .addAnswer("¡Hola! Bienvenido a nuestro servicio de domicilio", null, async (ctx, { flowDynamic }) => {
    // Obtener menú actualizado
    menuActualizado = await obtenerMenuActualizado();
  })
  .addAnswer("¿Qué te gustaría ordenar?", { capture: true }, async (ctx, { flowDynamic }) => {
    const pedidoTexto = ctx.body;
    
    // Buscar productos en el menú actualizado
    const productosEncontrados = buscarProducto(menuActualizado, pedidoTexto);
    
    if (productosEncontrados.length > 0) {
      await flowDynamic(`Encontré estos productos:\n${productosEncontrados.map(p => `- ${p.nombre}: $${p.precio}`).join('\n')}`);
    } else {
      await flowDynamic("No encontré ese producto en nuestro menú.");
    }
  });
*/

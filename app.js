require("dotenv").config();

const path = require("path");
const fs = require("fs");
const {
  createBot,
  createProvider,
  createFlow,
  addKeyword,
  EVENTS,
} = require("@bot-whatsapp/bot");
const QRPortalWeb = require("@bot-whatsapp/portal");
const BaileysProvider = require("@bot-whatsapp/provider/baileys");
const MockAdapter = require("@bot-whatsapp/database/mock");

// Flujos
const FlowMenu = require("./flows/flowmenu.js");
const FlowDomicilio = require("./flows/flowDomicilio.js");
const FlowAsesor = require("./flows/flowAsesor.js");
const FlowMapa = require("./flows/flowMapa.js");

// ===============================
//  Lectura segura de archivo de opciones
// ===============================
const opcionesPath = path.join(__dirname, "mensajes", "opciones.txt");
let opciones = "";
try {
  opciones = fs.readFileSync(opcionesPath, "utf8");
} catch (err) {
  console.error(`Error al leer ${opcionesPath}:`, err);
  opciones = "⚠️ No hay opciones disponibles por el momento.";
}

// ===============================
//  Funciones auxiliares
// ===============================
function normalizaOpcion(texto) {
  if (!texto) return "";
  const mapa = {
    1: "1",
    uno: "1",
    2: "2",
    dos: "2",
    3: "3",
    tres: "3",
    4: "4",
    cuatro: "4",
  };
  return mapa[texto.trim().toLowerCase()] || "";
}

async function manejarOpcionInvalida(ctx, fallBack, flowDynamic) {
  return fallBack(
    `❌ Opción no válida. Elige un número del menú (1-3) para continuar. ¡Estamos para ayudarte! 😊`
  );
}

// ===============================
//  Flujo principal de opciones
// ===============================
const opcionesFlow = addKeyword([EVENTS.WELCOME])
  .addAnswer(
    `¡Hola! Soy WaBot 🤖, solo un chat de prueba (*Menu ficticio*).\n*Elige* tu pregunta:`
  )
  .addAnswer(
    opciones,
    { capture: true },
    async (ctx, { gotoFlow, fallBack, flowDynamic }) => {
      const opcion = normalizaOpcion(ctx.body);

      if (!["1", "2", "3", "4"].includes(opcion)) {
        return manejarOpcionInvalida(ctx, fallBack, flowDynamic);
      }

      const flujos = {
        1: FlowMenu,
        2: FlowDomicilio,
        3: FlowAsesor,
        4: FlowMapa,
      };
      return gotoFlow(flujos[opcion]);
    }
  );

// ===============================
//  Agrupación de flujos
// ===============================
const mainFlow = createFlow([
  opcionesFlow,
  FlowMenu,
  FlowDomicilio,
  FlowAsesor,
  FlowMapa,
]);

// ===============================
//  Función principal
// ===============================
const main = async () => {
  try {
    const adapterDB = new MockAdapter();
    const adapterFlow = mainFlow;
    const adapterProvider = createProvider(BaileysProvider);

    await createBot({
      flow: adapterFlow,
      provider: adapterProvider,
      database: adapterDB,
    });

    QRPortalWeb();
    console.log("✅ WaBot iniciado correctamente.");
  } catch (err) {
    console.error("❌ Error al iniciar WaBot:", err);
  }
};

// ===============================
//  Manejo global de errores
// ===============================
process.on("unhandledRejection", (reason) => {
  console.error("🚨 Promesa rechazada sin manejar:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("🚨 Excepción no controlada:", err);
});

// ===============================
//  Inicio de la aplicación
// ===============================
main();

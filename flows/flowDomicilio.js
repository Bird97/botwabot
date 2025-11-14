// ============= SOLUCIÓN ALTERNATIVA: USAR AXIOS EN LUGAR DE MISTRAL CLIENT =============

const { addKeyword, EVENTS } = require("@bot-whatsapp/bot");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { verificarCancelacion } = require("../utils/cancelar");

// 🔹 SOLUCIÓN SIN MISTRAL CLIENT - Usar API directamente
async function llamarMistralAPI(prompt) {
  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const data = await response.json();
    console.log(data);
    return data.choices[0].message.content;
  } catch (error) {
    console.error("❌ Error llamando a Mistral API:", error);
    throw error;
  }
}

const FlowDomicilio = addKeyword(EVENTS.ACTION)
  .addAnswer(
    "🤖 ¡Hola! Has activado el *servicio automático de pedidos* 📝\n" +
      "Escribe tu pedido (plato, tamaño y detalles).\n\n" +
      "❌ Para cancelar: *0* o *salirse*."
  )

  // 🔹 PASO 1/7 MEJORADO CON IA SÚPER INTELIGENTE 🟡
  .addAnswer(
    "📌 1/7 | Escribe tu pedido completo (platos, tamaños, cantidades y detalles).",
    { capture: true },
    async (ctx, { state, endFlow, fallBack, flowDynamic }) => {
      const cancelado = verificarCancelacion(ctx.body, endFlow);
      if (cancelado) return cancelado;

      try {
        const menu = require("../data/menu.json");

        const prompt = `
Eres un asistente de restaurante que interpreta pedidos.

Devuelve SOLO un JSON válido con este formato:

{
  "items": [
    {
      "plato": "string",
      "tamaño": "pequeño | mediano | grande | null",
      "cantidad": number,
      "precio_unitario": number,
      "precio_total": number,
      "detalles_extra": "string | null",
      "encontrado_en_menu": true/false,
      "notas_revision": "string | null"
    }
  ],
  "total_pedido": number,
  "resumen_legible": "string"
}

REGLAS:
1. MENÚ: ${JSON.stringify(menu)}
2. Si plato en menú → usar precio
3. Si no está en menú → precio=0, nota="Revisar manualmente"
4. Faltantes = null (no cadenas vacías)
5. Separa cada plato en items
6. Total_pedido = suma de precio_total
7. Resumen_legible = frase corta

Pedido del cliente: "${ctx.body}"

RESPONDE SOLO EL JSON.
`;

        // 🔹 Llamar API IA
        const rawResponse = await llamarMistralAPI(prompt);
        const data = JSON.parse(rawResponse);

        if (
          !data.items ||
          !Array.isArray(data.items) ||
          data.items.length === 0
        ) {
          return fallBack("⚠️ No entendí tu pedido. Ej: '2 pizzas grandes'");
        }

        // 🔹 Armar mensaje corto
        let totalConfirmado = 0;
        let hayItemsSinMenu = false;

        const itemsTexto = data.items
          .map((item) => {
            const plato = item.plato || "Plato desconocido";
            const cantidad = item.cantidad || 1;
            const tam = item.tamaño ? ` (${item.tamaño})` : "";
            const detalles = item.detalles_extra
              ? ` [${item.detalles_extra}]`
              : "";

            if (item.encontrado_en_menu) {
              totalConfirmado += item.precio_total || 0;
              const precioUnit = new Intl.NumberFormat("es-CO").format(
                item.precio_unitario || 0
              );
              const precioTotal = new Intl.NumberFormat("es-CO").format(
                item.precio_total || 0
              );

              // Si cantidad > 1, mostrar precio unitario y total
              if (cantidad > 1) {
                return `🍽️ ${cantidad}x ${plato}${tam}${detalles}\n   💵 $${precioUnit} c/u = $${precioTotal}`;
              } else {
                return `🍽️ ${cantidad}x ${plato}${tam}${detalles} - $${precioTotal}`;
              }
            } else {
              hayItemsSinMenu = true;
              return `🍽️ ${cantidad}x ${plato}${tam}${detalles} ⚠️`;
            }
          })
          .join("\n");

        let mensaje = `✅ Pedido:\n${itemsTexto}`;
        if (totalConfirmado > 0) {
          mensaje += `\n💰 Total: $${new Intl.NumberFormat("es-CO").format(
            totalConfirmado
          )}`;
        }
        if (hayItemsSinMenu) {
          mensaje += `\n🔍 Algunos platos deben revisarse.`;
        }

        // 🔹 Guardar en estado limpio
        await state.update({
          pedido: {
            items: data.items.map((i) => ({
              plato: i.plato || null,
              tamaño: i.tamaño || null,
              cantidad: i.cantidad ?? null,
              precio_unitario: i.precio_unitario ?? null,
              precio_total: i.precio_total ?? null,
              detalles_extra: i.detalles_extra || null,
              encontrado_en_menu: i.encontrado_en_menu ?? false,
              notas_revision: i.notas_revision || null,
            })),
            total_menu: totalConfirmado,
            total_estimado: data.total_pedido ?? null,
            tiene_items_sin_menu: hayItemsSinMenu,
            resumen: data.resumen_legible || null,
            procesado_con_ai: true,
            timestamp: new Date().toISOString(),
          },
        });

        // 🔹 Enviar mensaje corto al cliente
        await flowDynamic(mensaje);
      } catch (error) {
        console.error("❌ Error procesando pedido con IA:", error);

        await state.update({
          pedido: {
            texto_original: ctx.body,
            procesado_con_ai: false,
            requiere_revision_manual: true,
            timestamp: new Date().toISOString(),
            error_ai: "Error en procesamiento de IA",
          },
        });

        await flowDynamic(
          `⚠️ No pude procesar el pedido automático.\n📝 "${ctx.body}"\nSerá revisado manualmente.`
        );
      }
    }
  )
  // 2/7 - Nombre y apellido
  .addAnswer(
    "📝 2/7 Nombre y apellido:",
    { capture: true },
    async (ctx, { state, endFlow }) => {
      const cancelado = verificarCancelacion(ctx.body, endFlow);
      if (cancelado) return cancelado;
      await state.update({ nombre: ctx.body });
    }
  )

  // 3/7 - Número de teléfono MEJORADO
  .addAnswer(
    "📞 3/7 Escribe tu *número de contacto* (10 dígitos, inicia en 3):",
    { capture: true },
    async (ctx, { state, fallBack, endFlow }) => {
      const entradaTelefono = ctx.body.trim();

      const cancelado = verificarCancelacion(entradaTelefono, endFlow);
      if (cancelado) return cancelado;

      // Limpiar número: remover espacios, guiones, puntos y código +57
      let numeroLimpio = entradaTelefono.replace(/[^\d]/g, "");

      if (numeroLimpio.startsWith("57") && numeroLimpio.length === 12) {
        numeroLimpio = numeroLimpio.substring(2);
      }

      // Validar formato colombiano
      if (numeroLimpio.length !== 10) {
        return fallBack(
          `⚠️ Debe tener 10 dígitos. Tienes ${numeroLimpio.length}. Ej: 3001234567`
        );
      }

      if (!numeroLimpio.startsWith("3")) {
        return fallBack("⚠️ Debe empezar en 3. Ej: 3001234567");
      }

      await state.update({ telefono: numeroLimpio });
    }
  )

  // 4/7 - Método de pago
  .addAnswer(
    `💳 4/7 Elige tu *método de pago*:  
1️⃣ Nequi: 324 665 5962  
2️⃣ Bancolombia: 320 649 1370  
3️⃣ Efectivo 💵  
4️⃣ Pagar en restaurante 🍽️  

👉 Al final del proceso envia el comprobante de pago (si aplica) para procesar tu pedido.`,
    { capture: true },
    async (ctx, { state, flowDynamic, fallBack, endFlow }) => {
      const pagoEntrada = ctx.body.trim().toLowerCase();

      // Cancelar
      const cancelado = await verificarCancelacion(pagoEntrada, endFlow);
      if (cancelado) return cancelado;

      // Diccionario de opciones
      const opciones = {
        1: "nequi",
        nequi: "nequi",
        2: "bancolombia",
        bancolombia: "bancolombia",
        3: "efectivo",
        4: "pagar en restaurante",
        "pagar en restaurante": "pagar en restaurante",
      };

      // Medios de pago
      const mediosPago = {
        nequi: { nombre: "Nequi", cuenta: "324 665 5962" },
        bancolombia: { nombre: "Bancolombia", cuenta: "320 649 1370" },
        efectivo: { nombre: "Efectivo" },
        "pagar en restaurante": { nombre: "Pagar en restaurante" },
      };

      const pagoKey = opciones[pagoEntrada];
      if (!pagoKey) {
        return fallBack(
          "⚠️ Opción inválida. Elige el número o el nombre de la opción."
        );
      }

      await state.update({ pago: mediosPago[pagoKey] });
      await flowDynamic("✅ Método de pago registrado.");
    }
  )

  // 5/7 - Pregunta por el billete
  // 5/7 - Pregunta por el billete más flexible
  .addAnswer(
    "💵 5/7 ¿Vas a pagar en efectivo?\n👉 Escribe los billetes que usarás (ej: 20000, 50000 o 2x100000).\n👉 Si no, escribe *no*.",
    { capture: true },
    async (ctx, { state, flowDynamic, fallBack, endFlow }) => {
      let entrada = ctx.body.trim().toLowerCase();

      // Cancelación
      const cancelado = verificarCancelacion(entrada, endFlow);
      if (cancelado) return cancelado;

      // Caso: no va a pagar en efectivo
      if (entrada === "no") {
        await state.update({ billete: null });
        await flowDynamic("✅ Registrado: no pagarás en efectivo.");
        return;
      }

      // Limpiar entrada: quitar puntos, espacios y caracteres extra
      entrada = entrada.replace(/[^\dx,]/g, "");

      let billetes = [];
      try {
        entrada.split(",").forEach((part) => {
          part = part.trim();
          // Formato multiplicación: 2x100000
          const match = part.match(/^(\d+)x(\d+)$/);
          if (match) {
            billetes.push(parseInt(match[1]) * parseInt(match[2]));
          } else if (/^\d+$/.test(part)) {
            billetes.push(parseInt(part));
          } else {
            // Entrada desconocida
            throw new Error("Formato no reconocido");
          }
        });
      } catch {
        return fallBack(
          "⚠️ No entendí los billetes. Ej: 20000, 50000 o 2x100000. Por favor intenta de nuevo."
        );
      }

      if (billetes.length === 0) {
        return fallBack(
          "⚠️ No ingresaste ningún billete válido. Intenta de nuevo."
        );
      }

      const totalBillete = billetes.reduce((acc, val) => acc + val, 0);
      await state.update({ billete: totalBillete });

      // Obtener total del pedido si existe
      const pedidoTotal = state.getMyState()?.pedido?.total_menu || 0;

      let mensaje = `✅ Registrado: pagarás con $${new Intl.NumberFormat(
        "es-CO"
      ).format(totalBillete)}`;

      if (pedidoTotal > 0) {
        if (totalBillete >= pedidoTotal) {
          const cambio = totalBillete - pedidoTotal;
          mensaje += `\n💸 Cambio estimado: $${new Intl.NumberFormat(
            "es-CO"
          ).format(cambio)}`;
        } else {
          const faltante = pedidoTotal - totalBillete;
          mensaje += `\n⚠️ Billete insuficiente (faltan $${new Intl.NumberFormat(
            "es-CO"
          ).format(faltante)})`;
        }
      }

      await flowDynamic(mensaje);
    }
  )

  // 6/7 - Dirección
  .addAnswer(
    [
      "📍 6/7 Dirección de entrega: Escríbela o envía tu ubicación por WhatsApp.",
      '👉 Si vas a recoger tu pedido en el restaurante, simplemente escribe "Local".',
    ],
    { capture: true },
    async (ctx, { state, endFlow }) => {
      const cancelado = verificarCancelacion(ctx.body, endFlow);
      if (cancelado) return cancelado;

      let direccion = ctx.body;
      if (ctx.message?.location) {
        const { latitude, longitude } = ctx.message.location;
        direccion = `Ubicación: https://www.google.com/maps?q=${latitude},${longitude}`;
      }

      await state.update({ direccion });
    }
  )

  // 7/7 - Nota adicional
  .addAnswer(
    "📝 7/7 Si deseas dejar una nota adicional para tu pedido, escríbela aquí. Si no, simplemente escribe *no*.",
    { capture: true },
    async (ctx, { flowDynamic, state }) => {
      const entradaNota = ctx.body.trim();

      // Verificar si el usuario no quiere dejar nota
      const sinNota =
        entradaNota.toLowerCase() === "no" ||
        entradaNota.toLowerCase() === "sin nota" ||
        entradaNota.toLowerCase() === "ninguna";

      let notaFinal = null;
      let mensaje = "";

      if (sinNota) {
        notaFinal = null; // ✅ Usar null en lugar de cadena vacía
        mensaje = "ℹ️ No se ha agregado ninguna nota.";
      } else {
        notaFinal = entradaNota; // ✅ Guardar la nota tal como la escribió
        mensaje = `✅ Nota registrada: "${entradaNota}"`;
      }

      // ✅ Actualizar estado y confirmar
      await state.update({ nota: notaFinal });

      // ✅ Debug temporal (puedes quitarlo después)
      console.log("🔍 Debug nota:", {
        entrada: entradaNota,
        guardada: notaFinal,
        estado: state.getMyState().nota,
      });

      await flowDynamic(mensaje);
    }
  )

  // Mostrar resumen del pedido
  .addAnswer("🎉 *Último paso*", null, async (ctx, { flowDynamic, state }) => {
    const myState = state.getMyState();

    // 🔹 FORMATEAR MÉTODO DE PAGO
    let pagoInfo = "No especificado";
    if (myState.pago) {
      if (typeof myState.pago === "object") {
        pagoInfo = myState.pago.nombre;
        // Agregar cuenta si existe
        if (myState.pago.cuenta) {
          pagoInfo += ` (${myState.pago.cuenta})`;
        }
      } else {
        pagoInfo = myState.pago;
      }
    }

    // 🔹 FORMATEAR BILLETE EN FORMATO LEGIBLE
    let billeteInfo = "";
    if (myState.billete) {
      const billeteFormateado = new Intl.NumberFormat("es-CO").format(
        myState.billete
      );
      billeteInfo = `\n💵 *Billete:* $${billeteFormateado}`;
    }

    // 🔹 FORMATEAR PEDIDO INTELIGENTEMENTE
    let pedidoDetallado = "";
    let totalInfo = "";
    let advertenciasInfo = "";

    if (myState.pedido) {
      // Si fue procesado con IA (estructura nueva)
      if (myState.pedido.procesado_con_ai && myState.pedido.items) {
        pedidoDetallado = "🍽️ *Pedido detallado:*\n";

        myState.pedido.items.forEach((item, index) => {
          const numero =
            myState.pedido.items.length > 1 ? `${index + 1}. ` : "";
          const cantidad = item.cantidad || 1;

          pedidoDetallado += `${numero}▫️ ${cantidad}x ${item.plato}`;

          if (item.tamaño) {
            pedidoDetallado += ` (${item.tamaño})`;
          }

          if (item.detalles_extra) {
            pedidoDetallado += `\n   📝 ${item.detalles_extra}`;
          }

          if (item.encontrado_en_menu && item.precio_total > 0) {
            const precioUnit = new Intl.NumberFormat("es-CO").format(
              item.precio_unitario || 0
            );
            const precioTotal = new Intl.NumberFormat("es-CO").format(
              item.precio_total
            );

            // Si cantidad > 1, mostrar desglose completo
            if (cantidad > 1) {
              pedidoDetallado += `\n   💵 $${precioUnit} c/u = $${precioTotal}`;
            } else {
              pedidoDetallado += ` - $${precioTotal}`;
            }
          } else {
            pedidoDetallado += ` - *Precio pendiente*`;
          }

          pedidoDetallado += "\n";
        });

        // 🔹 TOTALES Y ADVERTENCIAS
        if (myState.pedido.total_menu > 0) {
          totalInfo = `\n💰 *Total confirmado:* $${new Intl.NumberFormat(
            "es-CO"
          ).format(myState.pedido.total_menu)}`;
        }

        if (myState.pedido.tiene_items_sin_menu) {
          advertenciasInfo =
            "\n⚠️ *Algunos platos serán revisados manualmente*";
        }

        if (myState.pedido.total_estimado > myState.pedido.total_menu) {
          const diferencia =
            myState.pedido.total_estimado - myState.pedido.total_menu;
          totalInfo += `\n📊 *Total estimado:* $${new Intl.NumberFormat(
            "es-CO"
          ).format(myState.pedido.total_estimado)} (+$${new Intl.NumberFormat(
            "es-CO"
          ).format(diferencia)} pendiente)`;
        }
      }
      // Si fue procesado con estructura anterior (compatibilidad)
      else if (typeof myState.pedido === "object" && myState.pedido.plato) {
        pedidoDetallado = `🍽️ *Pedido:* ${myState.pedido.cantidad}x ${myState.pedido.plato}`;
        if (myState.pedido.tamaño) {
          pedidoDetallado += ` (${myState.pedido.tamaño})`;
        }
        if (myState.pedido.precio_total) {
          totalInfo = `\n💰 *Total:* $${new Intl.NumberFormat("es-CO").format(
            myState.pedido.precio_total
          )}`;
        }
      }
      // Si es solo texto (modo fallback)
      else if (myState.pedido.texto_original) {
        pedidoDetallado = `🍽️ *Pedido:* ${myState.pedido.texto_original}`;
        advertenciasInfo = "\n🔍 *Pedido será procesado manualmente*";
      }
      // Fallback para formato anterior
      else {
        pedidoDetallado = `🍽️ *Pedido:* ${myState.pedido}`;
      }
    } else {
      pedidoDetallado = "🍽️ *Pedido:* No especificado";
    }

    // 🔹 CALCULAR CAMBIO SI HAY BILLETE Y TOTAL
    let cambioInfo = "";
    if (myState.billete && myState.pedido && myState.pedido.total_menu > 0) {
      const billete = parseInt(myState.billete);
      const total = myState.pedido.total_menu;

      if (billete >= total) {
        const cambio = billete - total;
        cambioInfo = `\n💸 *Cambio:* $${new Intl.NumberFormat("es-CO").format(
          cambio
        )}`;
      } else {
        cambioInfo = `\n⚠️ *Billete insuficiente* (faltan $${new Intl.NumberFormat(
          "es-CO"
        ).format(total - billete)})`;
      }
    }

    // 🔹 ENSAMBLAR RESUMEN FINAL
    const resumen = `🛎️ *Resumen completo de tu pedido*
══════════════════════
${pedidoDetallado}${totalInfo}${cambioInfo}

👤 *Cliente:* ${myState.nombre || "No especificado"}
📞 *Teléfono:* ${myState.telefono || "No especificado"}
💳 *Método de pago:* ${pagoInfo}${billeteInfo}
📍 *Dirección:* ${myState.direccion || "No especificada"}
📝 *Notas:* ${myState.nota || "Sin notas adicionales"}${advertenciasInfo}

📅 *Fecha:* ${new Date().toLocaleDateString(
      "es-CO"
    )} - ${new Date().toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;

    await flowDynamic(resumen);
  })

  .addAnswer(
    `
*¿Qué deseas hacer?*

1️⃣ *Confirmar pedido* 
2️⃣ *Reiniciar pedido* 
3️⃣ *Cancelar pedido* 

👉 *Escribe el número de tu opción:*`,
    { capture: true },
    async (ctx, { flowDynamic, state, gotoFlow, endFlow, fallBack }) => {
      const opcion = ctx.body.trim();

      if (["0", "salirse", "cancelar"].includes(opcion.toLowerCase())) {
        await flowDynamic("❌ Pedido cancelado. Reactiva con *Hola*");
        return endFlow();
      }

      if (opcion === "1") {
        const myState = state.getMyState();
        const fecha = new Date().toLocaleDateString("es-CO");
        const hora = new Date().toLocaleTimeString("es-CO");

        // 👉 CORRECCIÓN: Acceder correctamente a los datos
        const items = myState.pedido?.items || [];

        // 👉 Generar pedido con fallback
        const pedidoTexto =
          items.length > 0
            ? items
                .map(
                  (item) =>
                    `${item.cantidad}x ${item.plato}${
                      item.tamaño ? ` (${item.tamaño})` : ""
                    }`
                )
                .join(", ")
            : myState.pedido?.texto_original ||
              myState.pedido?.resumen ||
              "Pedido manual";

        // 👉 Generar desglose con fallback
        const desglose =
          items.length > 0
            ? items
                .map(
                  (item) =>
                    `${item.cantidad}x ${item.plato}${
                      item.tamaño ? ` (${item.tamaño})` : ""
                    } - $${new Intl.NumberFormat("es-CO").format(
                      item.precio_total || 0
                    )}`
                )
                .join("\n")
            : `${pedidoTexto} - Precio a confirmar`;

        // 👉 Calcular total con fallback
        const total =
          items.length > 0
            ? items.reduce((acc, item) => acc + (item.precio_total || 0), 0)
            : myState.pedido?.total_menu || 0;

        // 👉 Billete (si aplica)
        let billeteFormateado = null;
        if (myState.billete) {
          billeteFormateado = new Intl.NumberFormat("es-CO").format(
            myState.billete
          );
        }

        // 👉 Objeto final para enviar limpio
        const datosPedido = {
          nombre: myState.nombre || null,
          telefono: myState.telefono || null,
          pedido: pedidoTexto, // ✅ Ahora con contenido real
          desglose: desglose, // ✅ Ahora con precios
          total: total, // ✅ Ahora con total real
          pago: myState.pago?.nombre || myState.pago || null,
          billete: billeteFormateado,
          direccion: myState.direccion || null,
          nota: myState.nota || null,
          fecha: fecha,
          hora: hora,
          estado: "Por confirmar Pago",
        }; // 👉 Log para verificar datos
        console.log("📤 Datos a enviar:", {
          pedido: pedidoTexto,
          total: total,
          items_length: items.length,
        });

        // ✅ ENVIAR A BACKEND NESTJS
        const pedidoBackend = {
          nombre: myState.nombre || null,
          telefono: myState.telefono || null,
          direccion: myState.direccion || null,
          metodo_pago: myState.pago?.nombre || myState.pago || null,
          billete: myState.billete ? parseFloat(myState.billete) : null,
          total_menu: myState.pedido?.total_menu || total || 0,
          total_estimado: myState.pedido?.total_estimado || null,
          tiene_items_sin_menu: myState.pedido?.tiene_items_sin_menu || false,
          resumen: myState.pedido?.resumen || null,
          nota: myState.nota || null,
          procesado_con_ai: myState.pedido?.procesado_con_ai || false,
          estado: "Por confirmar Pago",
          items: items.length > 0 ? items : [],
        };

        // Enviar a backend NestJS
        const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";
        fetch(`${backendUrl}/pedidos/whatsapp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pedidoBackend),
        })
          .then(async (res) => {
            if (!res.ok) {
              const errorText = await res.text();
              console.error("❌ Error backend:", errorText);
              throw new Error(`HTTP ${res.status}`);
            }
            return res.json();
          })
          .then((data) => {
            console.log("✅ Pedido guardado en DB:", data.data?.id);
          })
          .catch((err) => {
            console.error("❌ Error guardando pedido en backend:", err.message);
          });

        // Enviar a Google Sheets (mantener compatibilidad)
        fetch(
          "https://script.google.com/macros/s/AKfycbxag7MBTAyQIhN3PkqY3VQ0iWaxWH-EA3VmRfAKYr5OAakt0TctgY3v7e-Kkwk3Ia1N/exec",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datosPedido),
          }
        )
          .then(() => {
            console.log("✅ Enviado a Google Sheets");
          })
          .catch((err) => {
            console.log("❌ Error enviando a Sheets:", err);
          });

        await flowDynamic(
          `✅ *Pedido confirmado*\n📅 ${fecha} - ${hora}\n💰 Total: $${new Intl.NumberFormat(
            "es-CO"
          ).format(total)}\n🙏 ¡Gracias por tu pedido! Reactiva con *Hola*`
        );
        return endFlow();
      }

      if (opcion === "2") {
        await flowDynamic("🔄 Reiniciando pedido...");
        await state.clear();
        return gotoFlow(FlowDomicilio);
      }

      if (opcion === "3") {
        await flowDynamic("❌ Pedido cancelado. Reactiva con *Hola*");
        return endFlow();
      }

      return fallBack("⚠️ Escribe 1, 2 o 3");
    }
  );

module.exports = FlowDomicilio;

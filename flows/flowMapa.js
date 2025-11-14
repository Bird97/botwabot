const { addKeyword, EVENTS } = require("@bot-whatsapp/bot");

const FlowMapahorario = addKeyword(EVENTS.ACTION).addAnswer(
  `⏰ *Horario*: Todos los días, 5:00 PM - 12:00 AM.
📍 *Ubicación*: Wabot, centro de Sahagún, frente a Plaza Bolívar.
🔗 Google Maps: https://www.google.com/maps/place/Parque+Simon+Bolivar+(Central)/`
);

module.exports = FlowMapahorario;

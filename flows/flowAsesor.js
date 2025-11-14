const { addKeyword, EVENTS } = require('@bot-whatsapp/bot');

const FlowAsesor = addKeyword(EVENTS.ACTION)
.addAnswer(
`📞 *Asesor* disponible
¿Necesitas ayuda? Un asesor te atenderá pronto.
Si es urgente, cuéntanos tu consulta.`);

    module.exports = FlowAsesor;

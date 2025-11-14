const { addKeyword, EVENTS } = require('@bot-whatsapp/bot');

const FlowMenu = addKeyword(EVENTS.ACTION)
    .addAnswer('📜 *Menú digital cargando...*')
    .addAnswer('⏳ Un momento por favor...', null, async (ctx, { flowDynamic }) => {
        try {
        // Pausa breve
        await new Promise(resolve => setTimeout(resolve, 1800));

        // Enviar el menú en PDF
        await flowDynamic([
            {
            body: '⬇️ Aquí tienes el menú:',
            //Menu de Dembow -> Prueba GRATIS wabot
            media: 'https://i.imgur.com/ImFcHwr.jpeg', 
            //media: 'https://dl.dropboxusercontent.com/scl/fi/vcxymid70mdeqowup2vju/Bot-de-WhatsApp-de-Atencion-Cliente.pdf?rlkey=ug7f0g7lb6i3nro53iybmye1n&st=5opstmnh&dl=1'
            },
            {
            body: '✅ Listo. Escribe *Hola* para continuar'
            }
        ]);
        } catch (err) {
        console.error('❌ Error cargando el menú:', err);
        await flowDynamic('😊 Parece que hubo un problema con la conexión. Intenta nuevamente más tarde.');
        }
    });

module.exports = FlowMenu;

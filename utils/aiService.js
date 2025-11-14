const mistral = require('../config/mistral');
const menu = require('../data/menu.json');

class AIService {
    async interpretarPedido(pedidoTexto) {
        try {
            const menuString = JSON.stringify(menu, null, 2);

            const prompt = `
Eres un asistente de restaurante. Analiza este pedido y encuentra los items correspondientes en el menú.

MENÚ DISPONIBLE:
${menuString}

PEDIDO DEL CLIENTE: "${pedidoTexto}"

INSTRUCCIONES:
1. Identifica SOLO los items que existen en el menú
2. Determina cantidades (si no se especifica, asume 1)
3. Determina tamaños (si no se especifica, usa el más común/barato)
4. Si no encuentras algo, NO lo incluyas

FORMATO DE RESPUESTA (JSON válido):
{
  "items_encontrados": [
    {
      "id": "pizza_pepperoni",
      "nombre": "Pizza Pepperoni",
      "cantidad": 1,
      "tamaño": "mediana",
      "precio_unitario": 25000
    }
  ],
  "items_no_encontrados": ["item que no existe"],
  "mensaje_confirmacion": "He encontrado: 1 Pizza Pepperoni mediana. ¿Es correcto?"
}
`;

            const response = await mistral.chat.complete({
                model: "mistral-small", // puedes cambiar a medium o large
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1,
            });

            const respuesta = response.choices[0].message.content;
            const jsonMatch = respuesta.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);

            throw new Error("No se pudo parsear la respuesta de Mistral");
        } catch (error) {
            console.error("Error en interpretarPedido:", error);
            return {
                items_encontrados: [],
                items_no_encontrados: [pedidoTexto],
                mensaje_confirmacion: "❌ No pude procesar tu pedido. ¿Puedes ser más específico?",
            };
        }
    }
}

module.exports = new AIService();

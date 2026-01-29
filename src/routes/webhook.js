const express = require('express');
const router = express.Router();
const { getAIResponse } = require('../services/openaiService');
const { sendMessage, addNoteToLead } = require('../services/kommoService');

// Variável global temporária para capturar payloads (Fase 2)
let lastPayloads = [];

/**
 * Webhook principal para receber mensagens do Kommo
 * POST /webhook/kommo
 */
router.post('/kommo', async (req, res) => {
    try {
        const payload = req.body;
        
        console.log('\n' + '='.repeat(80));
        console.log('📥 [WEBHOOK] Requisição recebida do Kommo');
        console.log('='.repeat(80));
        console.log('Timestamp:', new Date().toISOString());
        console.log('Headers:', JSON.stringify(req.headers, null, 2));
        console.log('Body:', JSON.stringify(payload, null, 2));
        console.log('='.repeat(80) + '\n');

        // Responder imediatamente ao Kommo (evitar timeout)
        res.status(200).json({ status: 'received' });

        // Processar mensagem de forma assíncrona
        processWebhook(payload).catch(error => {
            console.error('❌ [WEBHOOK] Erro no processamento assíncrono:', error);
        });

    } catch (error) {
        console.error('❌ [WEBHOOK] Erro ao receber webhook:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * Endpoint para capturar e visualizar o payload real do Kommo (Fase 2)
 * POST /webhook/capture
 */
router.post('/capture', (req, res) => {
    const payload = req.body;
    console.log('📸 [CAPTURE] Payload capturado:', JSON.stringify(payload, null, 2));
    
    lastPayloads.unshift({
        timestamp: new Date().toISOString(),
        payload: payload
    });
    
    // Manter apenas os últimos 10
    if (lastPayloads.length > 10) lastPayloads.pop();
    
    res.status(200).json({ status: 'captured' });
});

/**
 * Endpoint para visualizar os payloads capturados
 * GET /webhook/capture
 */
router.get('/capture', (req, res) => {
    res.json(lastPayloads);
});

/**
 * Processa o webhook de forma assíncrona
 */
async function processWebhook(payload) {
    try {
        // Extrair informações do payload
        const messageData = extractMessageData(payload);

        if (!messageData) {
            console.log('⚠️ [WEBHOOK] Payload não contém mensagem processável');
            return;
        }

        const { leadId, chatId, messageText, senderType } = messageData;

        console.log(`📋 [WEBHOOK] Dados extraídos:`, {
            leadId,
            chatId,
            messageText: messageText?.substring(0, 50),
            senderType
        });

        // Ignorar mensagens enviadas pelo bot (evitar loop)
        if (senderType === 'bot' || senderType === 'manager') {
            console.log('⏭️ [WEBHOOK] Mensagem ignorada (enviada pelo bot ou gerente)');
            return;
        }

        // Validar dados necessários
        if (!chatId || !messageText) {
            console.log('⚠️ [WEBHOOK] chatId ou messageText ausente');
            return;
        }

        // 1. Obter resposta da IA
        console.log(`🤖 [WEBHOOK] Solicitando resposta da IA...`);
        const aiResponse = await getAIResponse(messageText, leadId);

        // 2. Enviar resposta de volta ao cliente via Kommo
        console.log(`📤 [WEBHOOK] Enviando resposta ao cliente...`);
        await sendMessage(chatId, aiResponse);

        // 3. Adicionar nota ao lead (opcional - para auditoria)
        if (leadId) {
            const noteText = `🤖 IA respondeu:\nCliente: ${messageText}\nResposta: ${aiResponse}`;
            await addNoteToLead(leadId, noteText).catch(err => {
                console.log('⚠️ [WEBHOOK] Não foi possível adicionar nota ao lead:', err.message);
            });
        }

        console.log('✅ [WEBHOOK] Processamento concluído com sucesso\n');

    } catch (error) {
        console.error('❌ [WEBHOOK] Erro no processamento:', error);
        throw error;
    }
}

/**
 * Extrai dados relevantes do payload do Kommo
 * O formato do payload pode variar dependendo do tipo de evento
 */
function extractMessageData(payload) {
    try {
        // Formato 1: Evento de mensagem direta
        if (payload.message) {
            return {
                leadId: payload.lead_id || payload.message.lead_id,
                chatId: payload.message.talk_id || payload.talk_id,
                messageText: payload.message.text,
                senderType: payload.message.sender?.type || 'client'
            };
        }

        // Formato 2: Evento de talk (conversa)
        if (payload.talk && payload.talk.message) {
            return {
                leadId: payload.talk.lead_id,
                chatId: payload.talk.id,
                messageText: payload.talk.message.text,
                senderType: payload.talk.message.sender?.type || 'client'
            };
        }

        // Formato 3: Evento de leads (menos comum para mensagens)
        if (payload.leads && payload.leads.add) {
            const lead = payload.leads.add[0];
            return {
                leadId: lead.id,
                chatId: null,
                messageText: lead.name || 'Novo lead criado',
                senderType: 'system'
            };
        }

        return null;

    } catch (error) {
        console.error('❌ [WEBHOOK] Erro ao extrair dados do payload:', error);
        return null;
    }
}

/**
 * Endpoint de teste para validar se o servidor está funcionando
 * GET /webhook/test
 */
router.get('/test', (req, res) => {
    res.json({
        status: 'online',
        message: 'Servidor Léxia Bot funcionando corretamente',
        timestamp: new Date().toISOString(),
        endpoints: {
            webhook: 'POST /webhook/kommo',
            capture: 'POST/GET /webhook/capture',
            test: 'GET /webhook/test'
        }
    });
});

/**
 * Endpoint para simular recebimento de mensagem (apenas para testes)
 * POST /webhook/test
 */
router.post('/test', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Campo "message" é obrigatório' });
        }

        console.log(`🧪 [TEST] Simulando mensagem: "${message}"`);

        const aiResponse = await getAIResponse(message, 'TEST_LEAD');

        res.json({
            status: 'success',
            input: message,
            output: aiResponse,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ [TEST] Erro:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

import Fastify from 'fastify';
import dotenv from 'dotenv';

dotenv.config();

const fastify = Fastify({ logger: true });
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

if (!VERIFY_TOKEN) {
  throw new Error('WHATSAPP_VERIFY_TOKEN must be configured');
}

fastify.get('/', async () => ({ status: 'ok' }));

// --- 1. WEBHOOK VERIFICATION (The Meta Handshake) ---
// Meta sends a GET request to verify your endpoint exists and is secure.
fastify.get('/webhook', async (request, reply) => {
  const query = request.query as {
    'hub.mode'?: string;
    'hub.verify_token'?: string;
    'hub.challenge'?: string;
  };

  if (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === VERIFY_TOKEN) {
    fastify.log.info('Webhook verified successfully by Meta.');
    return reply.type('text/plain').send(query['hub.challenge']);
  }
  
  return reply.status(403).send('Verification token mismatch');
});

// --- 2. INCOMING MESSAGES INGESTION GATEWAY ---
// Meta sends a POST request whenever a user messages your WhatsApp bot.
fastify.post('/webhook', async (request, reply) => {
  const payload = request.body as any;
  console.log('WhatsApp webhook POST body:', JSON.stringify(payload));
  fastify.log.info({ webhookPayload: payload }, 'Received WhatsApp webhook POST');

  try {
    const entry = payload?.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];

    if (message) {
      const sender = message.from;
      const messageId = message.id;
      fastify.log.info({ message }, 'Received WhatsApp message');

      // Deep parsing of heterogeneous inputs
      if (message.type === 'image') {
        const mediaId = message.image.id;
        
        // ASYNC DECOUPLING: Fire and forget the background worker, do not wait for it.
        processImageWorker(mediaId, sender, messageId).catch((err) => 
          fastify.log.error({ err, messageId }, 'Image worker failed')
        );
      } else if (message.type === 'text') {
        const textBody = message.text.body;
        
        processTextWorker(textBody, sender, messageId).catch((err) =>
          fastify.log.error({ err, messageId }, 'Text worker failed')
        );
      }
    }
  } catch (error) {
    fastify.log.error({ err: error }, 'Failed to parse webhook payload structural components');
  }

  // Always return 200 OK instantly back to Meta within 3 seconds 
  // to avoid webhook retry congestion and message duplications.
  return reply.status(200).send({ status: 'received' });
});

// --- 3. BACKGROUND WORKER STUBS ---
async function processImageWorker(mediaId: string, sender: string, messageId: string) {
  fastify.log.info(`[Worker] Starting media extraction downstream for ${mediaId}...`);
  // Next steps will build out this media stream extraction layer
}

async function processTextWorker(text: string, sender: string, messageId: string) {
  fastify.log.info(`[Worker] Starting natural language parsing for: "${text}"...`);
}

// --- START SERVER ---
const start = async () => {
  try {
    // Render dynamically injects a PORT environment variable. We must capture it.
    await fastify.listen({ 
      port: Number(process.env.PORT) || 8000, 
      host: '0.0.0.0' // Crucial for cloud routing providers to expose the instance
    });
    console.log(`🚀 Production Ingestion Engine Online`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};


start();
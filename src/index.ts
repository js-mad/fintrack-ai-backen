import Fastify from 'fastify';
import dotenv from 'dotenv';

dotenv.config();

const fastify = Fastify({ logger: true });
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'my_fintrack_secret_token';

// --- 1. WEBHOOK VERIFICATION (The Meta Handshake) ---
// Meta sends a GET request to verify your endpoint exists and is secure.
fastify.get('/webhook', async (request, reply) => {
  const query = request.query as {
    'hub.mode'?: string;
    'hub.token'?: string;
    'hub.challenge'?: string;
  };

  if (query['hub.mode'] === 'subscribe' && query['hub.token'] === VERIFY_TOKEN) {
    fastify.log.info('Webhook verified successfully by Meta.');
    return reply.type('text/plain').send(query['hub.challenge']);
  }
  
  return reply.status(403).send('Verification token mismatch');
});

// --- 2. INCOMING MESSAGES INGESTION GATEWAY ---
// Meta sends a POST request whenever a user messages your WhatsApp bot.
fastify.post('/webhook', async (request, reply) => {
  const payload = request.body as any;

  try {
    const entry = payload?.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];

    if (message) {
      const sender = message.from;
      const messageId = message.id;

      // Deep parsing of heterogeneous inputs
      if (message.type === 'image') {
        const mediaId = message.image.id;
        fastify.log.info(`Received image payload (ID: ${mediaId}) from ${sender}`);
        
        // ASYNC DECOUPLING: Fire and forget the background worker, do not wait for it.
        processImageWorker(mediaId, sender, messageId).catch((err) => 
          fastify.log.error(`Worker error for message ${messageId}:`, err)
        );
      } else if (message.type === 'text') {
        const textBody = message.text.body;
        fastify.log.info(`Received text payload: "${textBody}" from ${sender}`);
        
        processTextWorker(textBody, sender, messageId).catch((err) =>
          fastify.log.error(`Text worker error for message ${messageId}:`, err)
        );
      }
    }
  } catch (error) {
    fastify.log.error('Failed to parse webhook payload structural components:', error);
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

git config --global user.name "js-mad"
git config --global user.email "k.p.tech024@gmail.com"

const http = require('http');
const crypto = require('crypto');
const { Telegraf } = require('telegraf')
const { TBTKN, PORT, WEBHOOK_DOMAIN } = require('./config/vars');
const mongoose = require('./config/mongoose');
const botroute = require('./api/routes/botroute');
const BotHelper = require('./config/bot');

const init = require('./cron');
const { ws } = require('./ws');

console.log('Starting application...');
console.log(`PORT: ${PORT}`);
console.log(`TBTKN: ${TBTKN ? 'Set' : 'Not set'}`);

try {
  const conn = mongoose.connect();
  if (conn) {
    conn.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
    conn.on('connected', () => {
      console.log('MongoDB connected');
    });
  } else {
    console.warn('MongoDB connection not configured (MONGO_URI not set)');
  }

  let botInstance;
  if (TBTKN) {
    try {
      botInstance = new Telegraf(TBTKN);
      if (botInstance) {
        const botHelper = new BotHelper(botInstance);
        botroute(botHelper, conn);
        let server;
        if (WEBHOOK_DOMAIN) {
          botInstance.catch((e) => console.error('Bot handler error:', e));
          // Вебхук вместо long polling: Telegram сам присылает POST, и Cloud Run
          // может не держать CPU включённым между запросами.
          const hookPath = '/tg-webhook';
          const secretToken = crypto.createHash('sha256').update(TBTKN).digest('hex').slice(0, 32);
          const webhookCb = botInstance.webhookCallback(hookPath, { secretToken });
          server = http.createServer((req, res) => webhookCb(req, res, () => {
            res.statusCode = 404;
            res.end();
          }));
          server.listen(PORT);
          botInstance.telegram.setWebhook(`https://${WEBHOOK_DOMAIN}${hookPath}`, { secret_token: secretToken })
            .then(() => console.log(`Webhook set: ${WEBHOOK_DOMAIN}${hookPath}`))
            .catch((e) => console.error('setWebhook failed:', e));
        }
        ws(botHelper, server);
        init(botHelper);
        console.log('Application started successfully');
      }
    } catch (botError) {
      console.error('Error initializing bot:', botError);
      process.exit(1);
    }
  } else {
    console.error('TBTKN (Telegram Bot Token) is not set in .env file');
    console.error('Application cannot start without bot token');
    process.exit(1);
  }
} catch (error) {
  console.error('Fatal error during startup:', error);
  process.exit(1);
}

const { Telegraf } = require('telegraf')
const { TBTKN, PORT } = require('./config/vars');
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
        ws(botHelper);
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

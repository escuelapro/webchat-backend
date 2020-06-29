const Telegraf = require('telegraf');

const { TBTKN } = require('./config/vars');
const mongoose = require('./config/mongoose');
const botroute = require('./api/routes/botroute');
const BotHelper = require('./config/bot');

const init = require('./cron');
const { ws } = require('./ws');

const conn = mongoose.connect();
let botInstance;
if (TBTKN) {
  botInstance = new Telegraf(TBTKN);
  if (botInstance) {
    const botHelper = new BotHelper(botInstance);
    botroute(botHelper, conn);
    ws(botHelper);
    init(botHelper);
  }
}

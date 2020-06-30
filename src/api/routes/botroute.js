const format = require('./chat');
const db = require('../utils/db');

module.exports = (botHelper, conn) => {
  if (conn) conn.on('error', () => {
    botHelper.disDb();
  });

  botHelper.bot.command('stat', ({ message, reply }) => {
    if (botHelper.isAdmin(message.chat.id)) {
      db.stat().then(reply).catch(console.log);
    }
  });

  botHelper.bot.command('statuids', ({ message, reply }) => {
    if (botHelper.isAdmin(message.chat.id)) {
      db.stat('uids').then(reply).catch(console.log);
    }
  });

  format(botHelper);
  botHelper.bot.launch();
};

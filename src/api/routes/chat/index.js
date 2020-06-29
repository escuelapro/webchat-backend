const Extra = require('telegraf/extra');
const Markup = require('telegraf/markup');

const messages = require('../../../messages/format');
const buttons = require('../../../config/buttons');

let username = process.env.TBTUSERNAME;

function start() {
  const replyMarkup = Markup.keyboard([
    [buttons.help.label],
  ]);
  return Extra.markup(replyMarkup);
}

module.exports = botHelper => {
  botHelper.bot.command(['/start', buttons.help.command],
    ctx => botHelper.startOrHelp(ctx));
  botHelper.bot.hears(buttons.help.label, botHelper.startOrHelp);
  botHelper.bot.hears(buttons.back.label,
    ({ reply }) => reply(messages.menu(), start()).catch(() => {}));

  const onMessage = async ({ message: msg, reply }) => {
    let { reply_to_message } = msg;
    let document = msg.document;
    let rpl = reply_to_message;
    if (!document && rpl) document = rpl.document;
    const { chat: { id: chatId } } = msg;
    let { text } = msg;
    if (rpl) {
      if (!document) {
        await botHelper.sockSend(chatId, text, rpl.text);
        return;
      }
    }
    if (msg.new_chat_participant || msg.left_chat_participant ||
      msg.group_chat_created) {
      let s = msg.left_chat_participant ? 'left' : 'add';
      if ((msg.new_chat_participant && msg.new_chat_participant.username ===
        username) || msg.group_chat_created) {
        await reply(messages.start(username, chatId)).catch(
          () => {});
      }
    }
  };
  botHelper.bot.hears(/.*/, (ctx) => onMessage(ctx));
  botHelper.bot.on('message',
    ({ update, reply }) => onMessage({ ...update, reply }));
};

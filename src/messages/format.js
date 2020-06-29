const OPTS = 'Type /help to show options';
const username = process.env.TBTUSERNAME;

module.exports = {
  start: (n, id) => `1. First promote me to admin
2. Set the domain name by https://t.me/${n}?start=${id}`,
  startCode: (codes) => `Put this code into bottom body of your website
  \`\`\`${codes.join(`\`\`\`\n\nor\n\n\`\`\``)} \`\`\``,
  startTg: (id = '') => `\nor Direct chat in telegram \n https://t.me/${username}?start=tg-${id}`,
  startEmpty: () => 'Please add me to group',
  startChat: () => 'Wait for response...\nThis chat will be disconnected in an hour from the last answer',
  notFound: (id) => `Sorry but the conversation not found or deactivated${id
    ? `, try to start again https://t.me/${username}?start=tg${id}`
    : ''}`,
  menu: () => OPTS,
};

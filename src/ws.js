const WebSocket = require('ws');
const fs = require('fs');
const uid = require('uid-safe').sync;

const { putChat, getLast } = require('./api/utils/db');
const { PORT } = require('./config/vars');

const sockets = { g: {}, u: {} };
const ws = (botHelper) => {
  botHelper.setSockets(sockets);
  const wss = new WebSocket.Server({ port: PORT });
  wss.on('connection', ws => {
    ws.on('message', async message => {
      let messageObj = {};
      try {
        messageObj = JSON.parse(message);
        let isUndef = false;
        if (!messageObj.uid) isUndef = true;
        let uid1 = messageObj.uid || uid(5);
        if (isUndef) uid1 = uid1.replace(/-/g, '');
        messageObj.uid = uid1;

        if (messageObj.g) {
          const key = `${messageObj.g}_chat_${messageObj.uid}`;
          if (messageObj.service === 'lastmes') {
            let result = [];
            try {
              const lastMess = await getLast(key, messageObj.uid);
              if (lastMess) result = lastMess;
            } catch (e) {
              console.log(e);
            }
            const service = { service: 'lastmes', message: messageObj.uid };
            service.lastMess = result;

            ws.send(JSON.stringify(service));
            return;
          }
          if (!sockets.g[key]) {
            let lastMess = [];
            if (!messageObj.isRec) lastMess = await getLast(key,
              messageObj.uid);
            sockets.g[key] = { ws, userId: messageObj.uid };
            if (isUndef || lastMess.length) {
              const service = { service: 'setUid', message: messageObj.uid };
              ws.send(JSON.stringify(service));
            }
            ws.on('close', () => {
              delete sockets.g[key];
            });
          }
          const CHAT_ID = +messageObj.g * -1;

          if (messageObj.img) {
            const filePath = `./${new Date().getTime()}`;
            const base64Data = messageObj.img.replace(/^data:([A-Za-z-+/]+);base64,/, '');

            fs.writeFile(filePath, base64Data, 'base64', () => {
              botHelper.sendPhot(CHAT_ID, { source: fs.readFileSync(filePath) }, 'test').then(()=>{
                fs.unlinkSync(filePath);
              });
            });
            return;
          }
          if (!messageObj.login) {
            await putChat(messageObj, key).catch(() => {});
            botHelper.botMes(CHAT_ID, `
          #u${messageObj.uid}:\n${messageObj.message}`, messageObj.g, false);
          }
        }
      } catch (e) {
        botHelper.sendAdmin({ text: `${e}` });
      }
    });
  });
};

module.exports.ws = ws;

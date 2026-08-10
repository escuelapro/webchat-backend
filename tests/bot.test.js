const mockPutChat = jest.fn();
const mockPutUidUser = jest.fn();
const mockGetUidUser = jest.fn();
const mockUpdateLastAdminMessage = jest.fn();
const mockUidSync = jest.fn(() => 'ab-cd');

jest.mock('uid-safe', () => ({
  sync: (...args) => mockUidSync(...args),
}));

jest.mock('../src/api/utils/db', () => ({
  putChat: (...args) => mockPutChat(...args),
  putUidUser: (...args) => mockPutUidUser(...args),
  getUidUser: (...args) => mockGetUidUser(...args),
  updateLastAdminMessage: (...args) => mockUpdateLastAdminMessage(...args),
}));

describe('src/config/bot', () => {
  const OLD_ENV = process.env;

  function createHelper() {
    process.env = {
      ...OLD_ENV,
      TGADMIN: '77',
      APP_FRONTNAME: 'widget.example',
      TBTUSERNAME: 'support_bot',
    };

    jest.resetModules();

    const BotHelper = require('../src/config/bot');
    const sendMessage = jest.fn().mockResolvedValue(true);
    const sendPhoto = jest.fn().mockResolvedValue(true);
    const bot = {
      telegram: { sendMessage, sendPhoto },
    };

    const helper = new BotHelper(bot);
    helper.sockets = { g: {}, u: {} };

    return { helper, sendMessage, sendPhoto };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('builds markdown widget instructions for direct start payload', async () => {
    const { helper } = createHelper();

    const result = await helper.processUpdateMessage({
      chat: { id: 10 },
      text: '/start 123',
    });

    expect(result.mode).toBe('Markdown');
    expect(result.text).toContain('//widget.example/start.js');
    expect(result.text).toContain('tg-123');
    expect(result.text).toContain('instantChatBotUidName');
  });

  it('joins telegram direct chat payload through local socket flow', async () => {
    const { helper } = createHelper();
    helper.localSockSend = jest.fn().mockResolvedValue(true);

    const result = await helper.processUpdateMessage({
      chat: { id: 55 },
      text: '/start tg-123',
    });

    expect(result).toEqual({
      text: 'Wait for response...\nThis chat will be disconnected in an hour from the last answer',
    });
    expect(helper.localSockSend).toHaveBeenCalledWith(-123, 'joined to chat', null, 55);
  });

  it('generates uid, stores mapping, and notifies telegram in localSockSend', async () => {
    const { helper } = createHelper();
    helper.botMes = jest.fn().mockResolvedValue(true);

    await helper.localSockSend(-100, 'hello', null, 15);

    expect(mockPutUidUser).toHaveBeenCalledWith({ g: -100, u: 15, txt: 'hello' }, 'abcd');
    expect(helper.socketsLocal['-100_abcd']).toMatchObject({
      key: 'abcd',
      userId: 15,
      chatId: -100,
    });
    expect(helper.botMes).toHaveBeenCalledWith(-100, '#tguabcd:\nhello', -100);
  });

  it('reuses known local mapping in localSockReply', async () => {
    const { helper } = createHelper();
    helper.socketsLocalUid['-100_15'] = 'cached-uid';
    helper.localSockSend = jest.fn().mockResolvedValue(true);

    await helper.localSockReply(-100, 'answer', 'ignored', 15);

    expect(helper.localSockSend).toHaveBeenCalledWith(-100, 'answer', 'cached-uid', 15);
    expect(mockGetUidUser).not.toHaveBeenCalled();
  });

  it('routes group replies to websocket client and persists admin message', async () => {
    const { helper } = createHelper();
    const send = jest.fn();
    helper.sockets.g['123_chat_user-1'] = { ws: { send } };

    await helper.sockSend(-123, 'reply text', '#uuser-1:');

    expect(send).toHaveBeenCalledWith('reply text');
    expect(mockPutChat).toHaveBeenCalledWith(
      { message: 'reply text', sender: 'admin', uid: 'user-1' },
      '123_chat_user-1',
    );
  });

  it('routes #tgu replies through local socket branch first', async () => {
    const { helper } = createHelper();
    helper.localSockReply = jest.fn().mockResolvedValue(true);

    await helper.sockSend(-123, 'reply text', '#tguabc12:');

    expect(helper.localSockReply).toHaveBeenCalledWith(-123, 'reply text', 'abc12');
    expect(mockPutChat).not.toHaveBeenCalled();
  });

  it('pushes edited admin messages to the active websocket client', async () => {
    const { helper } = createHelper();
    const send = jest.fn();
    helper.sockets.g['123_chat_user-1'] = { ws: { send } };

    await helper.sockSendEdited(-123, 'edited text', '#uuser-1:');

    expect(send).toHaveBeenCalledWith(JSON.stringify({
      service: 'edited',
      message: 'edited text',
    }));
    expect(mockUpdateLastAdminMessage).toHaveBeenCalledWith('123_chat_user-1', 'user-1', 'edited text');
  });

  it('removes stale local chat mappings in clearUnusedChats', () => {
    const { helper } = createHelper();
    const oldDate = new Date(Date.now() - (10 * 60 * 1000));

    helper.socketsLocal['-100_uid-1'] = {
      createdAt: oldDate,
      userId: 15,
      chatId: -100,
    };
    helper.socketsLocalUid['-100_15'] = 'uid-1';

    helper.clearUnusedChats();

    expect(helper.socketsLocal['-100_uid-1']).toBeUndefined();
    expect(helper.socketsLocalUid['-100_15']).toBeUndefined();
  });

  it('uses processUpdateMessage result in startOrHelp replies', async () => {
    const { helper } = createHelper();
    helper.processUpdateMessage = jest.fn().mockResolvedValue({
      text: 'custom text',
      mode: 'Markdown',
    });
    const reply = jest.fn().mockResolvedValue(true);

    await helper.startOrHelp({
      reply,
      update: {
        message: {
          chat: { id: 1 },
          text: '/start 1',
        },
      },
    });

    expect(reply).toHaveBeenCalledWith('custom text', {
      disable_web_page_preview: true,
      parse_mode: 'Markdown',
    });
  });

  it('falls back to group start instructions in startOrHelp', async () => {
    const { helper } = createHelper();
    helper.processUpdateMessage = jest.fn().mockResolvedValue({});
    const reply = jest.fn().mockResolvedValue(true);

    await helper.startOrHelp({
      reply,
      update: {
        message: {
          chat: { id: -123 },
          text: '/start',
        },
      },
    });

    expect(reply).toHaveBeenCalledWith(
      '1. First promote me to admin\n2. Set the domain name by https://t.me/support_bot?start=-123',
      { disable_web_page_preview: true },
    );
  });
});

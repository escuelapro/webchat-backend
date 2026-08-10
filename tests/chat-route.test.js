jest.mock('telegraf/markup', () => ({
  keyboard: jest.fn(() => 'keyboard'),
}));

describe('src/api/routes/chat', () => {
  const OLD_ENV = process.env;

  function loadChatRoute() {
    process.env = {
      ...OLD_ENV,
      TBTUSERNAME: 'support_bot',
    };

    jest.resetModules();
    return require('../src/api/routes/chat');
  }

  function createBotHelper() {
    return {
      bot: {
        command: jest.fn(),
        hears: jest.fn(),
        on: jest.fn(),
      },
      startOrHelp: jest.fn(),
      sockSend: jest.fn().mockResolvedValue(true),
      sockSendEdited: jest.fn().mockResolvedValue(true),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('registers start/help handlers and back keyboard reply', async () => {
    const registerChatRoutes = loadChatRoute();
    const botHelper = createBotHelper();

    registerChatRoutes(botHelper);

    expect(botHelper.bot.command).toHaveBeenCalledTimes(1);
    expect(botHelper.bot.hears).toHaveBeenCalledTimes(3);

    const backHandler = botHelper.bot.hears.mock.calls.find(
      ([pattern]) => pattern === '🔙 Back',
    )[1];
    const reply = jest.fn().mockResolvedValue(true);

    await backHandler({ reply });

    expect(reply).toHaveBeenCalledWith('Type /help to show options', 'keyboard');
  });

  it('forwards reply messages without documents through sockSend', async () => {
    const registerChatRoutes = loadChatRoute();
    const botHelper = createBotHelper();
    registerChatRoutes(botHelper);

    const wildcardHandler = botHelper.bot.hears.mock.calls.find(
      ([pattern]) => pattern instanceof RegExp,
    )[1];

    await wildcardHandler({
      message: {
        chat: { id: -200 },
        text: 'admin reply',
        reply_to_message: { text: '#uabc:' },
      },
      reply: jest.fn(),
    });

    expect(botHelper.sockSend).toHaveBeenCalledWith(-200, 'admin reply', '#uabc:');
  });

  it('forwards edited replies through sockSendEdited', async () => {
    const registerChatRoutes = loadChatRoute();
    const botHelper = createBotHelper();
    registerChatRoutes(botHelper);

    const editedHandler = botHelper.bot.on.mock.calls.find(
      ([event]) => event === 'edited_message',
    )[1];

    await editedHandler({
      update: {
        edited_message: {
          chat: { id: -300 },
          text: 'edited reply',
          reply_to_message: { text: '#uabc:' },
        },
      },
    });

    expect(botHelper.sockSendEdited).toHaveBeenCalledWith(-300, 'edited reply', '#uabc:');
  });

  it('greets group when the bot is added to chat', async () => {
    const registerChatRoutes = loadChatRoute();
    const botHelper = createBotHelper();
    registerChatRoutes(botHelper);

    const messageHandler = botHelper.bot.on.mock.calls.find(
      ([event]) => event === 'message',
    )[1];
    const reply = jest.fn().mockResolvedValue(true);

    await messageHandler({
      update: {
        message: {
          chat: { id: -123 },
          new_chat_participant: { username: 'support_bot' },
        },
      },
      reply,
    });

    expect(reply).toHaveBeenCalledWith(
      '1. First promote me to admin\n2. Set the domain name by https://t.me/support_bot?start=-123',
    );
  });
});

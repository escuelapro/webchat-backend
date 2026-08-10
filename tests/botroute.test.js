const mockFormat = jest.fn();
const mockStat = jest.fn();

jest.mock('../src/api/routes/chat', () => (...args) => mockFormat(...args));
jest.mock('../src/api/utils/db', () => ({
  stat: (...args) => mockStat(...args),
}));

describe('src/api/routes/botroute', () => {
  function createBotHelper() {
    return {
      bot: {
        command: jest.fn(),
        launch: jest.fn(),
      },
      disDb: jest.fn(),
      isAdmin: jest.fn(),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('subscribes to db errors, wires chat routes, and launches bot', () => {
    const registerBotRoutes = require('../src/api/routes/botroute');
    const botHelper = createBotHelper();
    const conn = { on: jest.fn() };

    registerBotRoutes(botHelper, conn);

    expect(conn.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockFormat).toHaveBeenCalledWith(botHelper);
    expect(botHelper.bot.launch).toHaveBeenCalledTimes(1);

    const errorHandler = conn.on.mock.calls[0][1];
    errorHandler(new Error('db down'));
    expect(botHelper.disDb).toHaveBeenCalledTimes(1);
  });

  it('runs stat command only for admin users', async () => {
    const registerBotRoutes = require('../src/api/routes/botroute');
    const botHelper = createBotHelper();
    botHelper.isAdmin.mockReturnValue(true);
    mockStat.mockResolvedValue(12);

    registerBotRoutes(botHelper);

    const statHandler = botHelper.bot.command.mock.calls.find(
      ([name]) => name === 'stat',
    )[1];
    const reply = jest.fn();

    await statHandler({
      message: { chat: { id: 77 } },
      reply,
    });

    expect(botHelper.isAdmin).toHaveBeenCalledWith(77);
    expect(mockStat).toHaveBeenCalledWith();
    await Promise.resolve();
    expect(reply).toHaveBeenCalledWith(12);
  });

  it('skips stat query for non-admin users', async () => {
    const registerBotRoutes = require('../src/api/routes/botroute');
    const botHelper = createBotHelper();
    botHelper.isAdmin.mockReturnValue(false);

    registerBotRoutes(botHelper);

    const statHandler = botHelper.bot.command.mock.calls.find(
      ([name]) => name === 'stat',
    )[1];

    await statHandler({
      message: { chat: { id: 10 } },
      reply: jest.fn(),
    });

    expect(mockStat).not.toHaveBeenCalled();
  });

  it('requests uid statistics for statuids command', async () => {
    const registerBotRoutes = require('../src/api/routes/botroute');
    const botHelper = createBotHelper();
    botHelper.isAdmin.mockReturnValue(true);
    mockStat.mockResolvedValue(4);

    registerBotRoutes(botHelper);

    const statUidsHandler = botHelper.bot.command.mock.calls.find(
      ([name]) => name === 'statuids',
    )[1];
    const reply = jest.fn();

    await statUidsHandler({
      message: { chat: { id: 77 } },
      reply,
    });

    expect(mockStat).toHaveBeenCalledWith('uids');
    await Promise.resolve();
    expect(reply).toHaveBeenCalledWith(4);
  });
});

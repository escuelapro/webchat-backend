describe('src/ws', () => {
  function loadWsModule() {
    jest.resetModules();

    const mockServerOn = jest.fn();
    const mockServer = { on: mockServerOn };
    const mockServerCtor = jest.fn(() => mockServer);
    const mockWriteFile = jest.fn((filePath, data, encoding, callback) => callback());
    const mockReadFileSync = jest.fn(() => Buffer.from('image-binary'));
    const mockUnlinkSync = jest.fn();
    const mockPutChat = jest.fn().mockResolvedValue(true);
    const mockGetLast = jest.fn().mockResolvedValue([]);
    const mockUid = jest.fn(() => 'ab-cd');

    jest.doMock('ws', () => ({
      Server: mockServerCtor,
    }));
    jest.doMock('fs', () => ({
      writeFile: mockWriteFile,
      readFileSync: mockReadFileSync,
      unlinkSync: mockUnlinkSync,
    }));
    jest.doMock('uid-safe', () => ({
      sync: (...args) => mockUid(...args),
    }));
    jest.doMock('../src/api/utils/db', () => ({
      putChat: (...args) => mockPutChat(...args),
      getLast: (...args) => mockGetLast(...args),
    }));
    jest.doMock('../src/config/vars', () => ({
      PORT: 4000,
    }));

    return {
      wsModule: require('../src/ws'),
      mockServerOn,
      mockServerCtor,
      mockWriteFile,
      mockReadFileSync,
      mockUnlinkSync,
      mockPutChat,
      mockGetLast,
    };
  }

  function createSocket() {
    return {
      on: jest.fn(),
      send: jest.fn(),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates websocket server and serves last messages', async () => {
    const {
      wsModule,
      mockServerCtor,
      mockServerOn,
      mockGetLast,
    } = loadWsModule();
    const botHelper = {
      setSockets: jest.fn(),
      botMes: jest.fn(),
      sendPhot: jest.fn().mockResolvedValue(true),
      sendAdmin: jest.fn(),
    };

    wsModule.ws(botHelper);

    expect(botHelper.setSockets).toHaveBeenCalledTimes(1);
    expect(mockServerCtor).toHaveBeenCalledWith({ port: 4000 });

    const connectionHandler = mockServerOn.mock.calls.find(
      ([event]) => event === 'connection',
    )[1];
    const socket = createSocket();
    connectionHandler(socket);

    const messageHandler = socket.on.mock.calls.find(
      ([event]) => event === 'message',
    )[1];
    mockGetLast.mockResolvedValue([{ message: 'saved' }]);

    await messageHandler(JSON.stringify({
      g: 123,
      uid: 'known-user',
      service: 'lastmes',
    }));

    expect(mockGetLast).toHaveBeenCalledWith('123_chat_known-user', 'known-user');
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({
      service: 'lastmes',
      message: 'known-user',
      lastMess: [{ message: 'saved' }],
    }));
  });

  it('assigns uid to new websocket client and forwards chat message to telegram', async () => {
    const {
      wsModule,
      mockServerOn,
      mockPutChat,
      mockGetLast,
    } = loadWsModule();
    const botHelper = {
      setSockets: jest.fn(),
      botMes: jest.fn(),
      sendPhot: jest.fn().mockResolvedValue(true),
      sendAdmin: jest.fn(),
    };

    wsModule.ws(botHelper);

    const connectionHandler = mockServerOn.mock.calls.find(
      ([event]) => event === 'connection',
    )[1];
    const socket = createSocket();
    connectionHandler(socket);

    const messageHandler = socket.on.mock.calls.find(
      ([event]) => event === 'message',
    )[1];
    mockGetLast.mockResolvedValue([]);

    await messageHandler(JSON.stringify({
      g: 123,
      message: 'hello from widget',
    }));

    expect(mockGetLast).toHaveBeenCalledWith('123_chat_abcd', 'abcd');
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({
      service: 'setUid',
      message: 'abcd',
    }));
    expect(mockPutChat).toHaveBeenCalledWith(
      expect.objectContaining({
        g: 123,
        uid: 'abcd',
        message: 'hello from widget',
      }),
      '123_chat_abcd',
    );
    expect(botHelper.botMes).toHaveBeenCalledWith(
      -123,
      expect.stringContaining('#uabcd:\nhello from widget'),
      123,
      false,
    );
  });

  it('sends screenshots through telegram photo flow and cleans up temp file', async () => {
    const {
      wsModule,
      mockServerOn,
      mockWriteFile,
      mockReadFileSync,
      mockUnlinkSync,
    } = loadWsModule();
    const botHelper = {
      setSockets: jest.fn(),
      botMes: jest.fn(),
      sendPhot: jest.fn().mockResolvedValue(true),
      sendAdmin: jest.fn(),
    };

    wsModule.ws(botHelper);

    const connectionHandler = mockServerOn.mock.calls.find(
      ([event]) => event === 'connection',
    )[1];
    const socket = createSocket();
    connectionHandler(socket);

    const messageHandler = socket.on.mock.calls.find(
      ([event]) => event === 'message',
    )[1];

    await messageHandler(JSON.stringify({
      g: 123,
      uid: 'known-user',
      img: 'data:image/png;base64,Zm9v',
    }));
    await Promise.resolve();

    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.any(String),
      'Zm9v',
      'base64',
      expect.any(Function),
    );
    expect(mockReadFileSync).toHaveBeenCalledWith(expect.any(String));
    expect(botHelper.sendPhot).toHaveBeenCalledWith(
      -123,
      { source: Buffer.from('image-binary') },
      '#uknown-user:\nScreen shot',
    );
    expect(mockUnlinkSync).toHaveBeenCalledWith(expect.any(String));
  });

  it('reports malformed websocket payloads to admin', async () => {
    const {
      wsModule,
      mockServerOn,
    } = loadWsModule();
    const botHelper = {
      setSockets: jest.fn(),
      botMes: jest.fn(),
      sendPhot: jest.fn().mockResolvedValue(true),
      sendAdmin: jest.fn(),
    };

    wsModule.ws(botHelper);

    const connectionHandler = mockServerOn.mock.calls.find(
      ([event]) => event === 'connection',
    )[1];
    const socket = createSocket();
    connectionHandler(socket);

    const messageHandler = socket.on.mock.calls.find(
      ([event]) => event === 'message',
    )[1];

    await messageHandler('not-json');

    expect(botHelper.sendAdmin).toHaveBeenCalledWith({
      text: expect.stringContaining('SyntaxError'),
    });
  });
});

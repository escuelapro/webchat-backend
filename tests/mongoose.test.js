describe('src/config/mongoose', () => {
  function loadMongooseModule(mongoUri) {
    jest.resetModules();

    const mockConnect = jest.fn();
    const mockConnection = { readyState: 1 };

    jest.doMock('mongoose', () => ({
      connect: (...args) => mockConnect(...args),
      connection: mockConnection,
    }));
    jest.doMock('../src/config/vars', () => ({
      mongo: { uri: mongoUri },
    }));

    return {
      mongooseModule: require('../src/config/mongoose'),
      mockConnect,
      mockConnection,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns false when mongo uri is missing', () => {
    const { mongooseModule, mockConnect } = loadMongooseModule(undefined);

    expect(mongooseModule.connect()).toBe(false);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('connects to mongoose and returns the shared connection', () => {
    const { mongooseModule, mockConnect, mockConnection } = loadMongooseModule('mongodb://localhost/test');

    const result = mongooseModule.connect();

    expect(mockConnect).toHaveBeenCalledWith('mongodb://localhost/test', {
      connectTimeoutMS: 30000,
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    expect(result).toBe(mockConnection);
  });
});

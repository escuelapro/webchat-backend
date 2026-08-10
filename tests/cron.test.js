jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

jest.mock('cron', () => ({
  CronJob: jest.fn((expression, handler) => ({
    expression,
    handler,
    start: jest.fn(),
  })),
}));

describe('src/cron', () => {
  const OLD_ENV = process.env;

  function loadCronModule() {
    jest.resetModules();
    return {
      fs: require('fs'),
      CronJob: require('cron').CronJob,
      init: require('../src/cron'),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('creates cron jobs only for existing task files', () => {
    process.env.NODE_CRON = '5:10';
    process.env.CRON_TASKS = 'test,missing:test';
    const { fs, CronJob, init } = loadCronModule();
    fs.existsSync.mockImplementation((filePath) => filePath.endsWith('test.js'));

    init({ bot: true });

    expect(CronJob).toHaveBeenCalledTimes(2);
    expect(CronJob.mock.calls[0][0]).toBe('0 */5 * * * *');
    expect(CronJob.mock.calls[1][0]).toBe('0 */10 * * * *');
    expect(CronJob.mock.results[0].value.start).toHaveBeenCalledTimes(1);
    expect(CronJob.mock.results[1].value.start).toHaveBeenCalledTimes(1);
  });

  it('skips cron creation when no task files exist', () => {
    process.env.NODE_CRON = '5';
    process.env.CRON_TASKS = 'missing';
    const { fs, CronJob, init } = loadCronModule();
    fs.existsSync.mockReturnValue(false);

    init({ bot: true });

    expect(CronJob).not.toHaveBeenCalled();
  });

  it('runs scheduled task handlers and swallows task failures', async () => {
    process.env.NODE_CRON = '5';
    process.env.CRON_TASKS = 'test';
    const { fs, CronJob, init } = loadCronModule();
    fs.existsSync.mockReturnValue(true);

    const runMock = jest.fn().mockRejectedValue(new Error('boom'));
    jest.doMock('../src/service/commands/test', () => ({ run: runMock }));

    init({ marker: 'botHelper' });

    const [{ handler }] = CronJob.mock.results.map((result) => result.value);

    await expect(handler()).resolves.toBeUndefined();
    expect(runMock).toHaveBeenCalledWith(
      { cronJob: '0 */5 * * * *' },
      { marker: 'botHelper' },
    );
  });
});

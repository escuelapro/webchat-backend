describe('src/api/utils/db', () => {
  const OLD_ENV = process.env;

  function loadDbModule() {
    const links = {
      countDocuments: jest.fn().mockResolvedValue(11),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 2 }),
      findOne: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
      bulkWrite: jest.fn().mockResolvedValue({ ok: 1 }),
      find: jest.fn(() => ({
        sort: jest.fn(() => ({
          limit: jest.fn().mockResolvedValue([]),
        })),
      })),
    };

    const uids = {
      countDocuments: jest.fn().mockResolvedValue(7),
      findOne: jest.fn(),
      bulkWrite: jest.fn().mockResolvedValue({ ok: 1 }),
    };

    const modelMock = jest.fn((name) => {
      if (name === (process.env.MONGO_COL_MESS || 'messages')) return links;
      if (name === (process.env.MONGO_COL_UIDS || 'uids')) return uids;
      return { collection: { conn: { model: modelMock } }, schema: {} };
    });

    jest.resetModules();
    jest.doMock('mongoose', () => ({
      Schema: jest.fn(() => ({})),
      model: jest.fn(() => ({
        collection: {
          conn: {
            model: modelMock,
          },
        },
        schema: {},
      })),
    }));

    const db = require('../src/api/utils/db');
    return { db, links, uids };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('returns collection statistics for messages and uids', async () => {
    const { db, links, uids } = loadDbModule();

    await expect(db.stat()).resolves.toBe(11);
    await expect(db.stat('uids')).resolves.toBe(7);

    expect(links.countDocuments).toHaveBeenCalledTimes(1);
    expect(uids.countDocuments).toHaveBeenCalledTimes(1);
  });

  it('returns early from clear when search value is empty', async () => {
    const { db, links } = loadDbModule();

    await expect(db.clear({ text: '/cleardb   ' })).resolves.toBe('empty');
    expect(links.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes records by url prefix in clear', async () => {
    const { db, links } = loadDbModule();

    await expect(db.clear({ text: '/cleardb example.com' })).resolves.toBe(JSON.stringify({ deletedCount: 2 }));

    const [{ url }] = links.deleteMany.mock.calls[0];
    expect(url.test('https://example.com/page')).toBe(true);
    expect(url.test('http://example.com')).toBe(true);
    expect(url.test('https://other.com')).toBe(false);
  });

  it('updates the latest admin message when one exists', async () => {
    const { db, links } = loadDbModule();
    const sort = jest.fn().mockResolvedValue({ _id: 'last-admin-id' });
    links.findOne.mockReturnValue({ sort });

    await db.updateLastAdminMessage('room-key', 'uid-1', 'edited message');

    expect(links.findOne).toHaveBeenCalledWith({ key: 'room-key', uid: 'uid-1', sender: 'admin' });
    expect(links.updateOne).toHaveBeenCalledWith(
      { _id: 'last-admin-id' },
      { $set: { message: 'edited message' } },
    );
  });

  it('returns null from updateLastAdminMessage when admin message is missing', async () => {
    const { db, links } = loadDbModule();
    const sort = jest.fn().mockResolvedValue(null);
    links.findOne.mockReturnValue({ sort });

    await expect(db.updateLastAdminMessage('room-key', 'uid-1', 'edited message')).resolves.toBeNull();
    expect(links.updateOne).not.toHaveBeenCalled();
  });
});

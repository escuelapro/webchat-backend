const mongoose = require('mongoose');
const { mongo } = require('../../config/vars');

// Без MONGO_URI запросы висят 10 с в буфере mongoose и падают — не обращаемся к БД.
const noDb = () => !mongo.uri;

const Any = mongoose.model('Any', new mongoose.Schema({}, {
  timestamps: true,
  strict: false,
}));

const links = Any.collection.conn.model(
  process.env.MONGO_COL_MESS || 'messages', Any.schema);
const uids = Any.collection.conn.model(
  process.env.MONGO_COL_UIDS || 'uids', Any.schema);

const statUids = () => uids.countDocuments();

const stat = (coll = '') => {
  if (coll === 'uids') {
    return statUids();
  }
  return links.countDocuments();
};

const clear = async (msg) => {
  let search = msg.text.replace('/cleardb', '').trim();
  search = `${search}`.trim();
  if (!search) {
    return Promise.resolve('empty');
  }
  // eslint-disable-next-line no-useless-escape
  const s = new RegExp(`^https?:\/\/${search}`);
  const d = await links.deleteMany({ url: s });
  return JSON.stringify(d);
};

const getLast = async (key, uid) => {
  if (noDb()) return [];
  return links.find({ key, uid }).sort({ createdAt: -1 }).limit(20);
};

const updateLastAdminMessage = async (key, uid, message) => {
  if (noDb()) return null;
  const last = await links.findOne({ key, uid, sender: 'admin' }).sort({ createdAt: -1 });
  if (!last) return null;
  return links.updateOne({ _id: last._id }, { $set: { message } });
};

const updateOne = async (item) => {
  const { url } = item;
  item.$inc = { affects: 1 };
  return links.updateOne({ url }, item, { upsert: true });
};

const putChat = async ({ g, u, pathname, host, ...item }, key) => {
  if (noDb()) return null;
  return links.bulkWrite([
    {
      insertOne: {
        document: { key, ...item },
      },
    },
  ]);
};

const getUidUser = async (g, key) => {
  if (noDb()) return null;
  g = `${g}`;
  const last = await uids.findOne({ key, g });
  return last ? last.toObject() : null;
};

const putUidUser = async ({ g, u, ...item }, key) => {
  if (noDb()) return null;
  return uids.bulkWrite([
    {
      updateOne: {
        filter: { g, key },
        update: { g, key, u, ...item },
        upsert: true,
      },
    }]);
};
module.exports.stat = stat;
module.exports.clear = clear;
module.exports.updateOne = updateOne;
module.exports.getLast = getLast;
module.exports.updateLastAdminMessage = updateLastAdminMessage;
module.exports.putChat = putChat;
module.exports.putUidUser = putUidUser;
module.exports.getUidUser = getUidUser;

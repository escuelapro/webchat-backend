const mongoose = require('mongoose');

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
  const s = new RegExp(`^https?:\/\/${search}`);
  const d = await links.deleteMany({ url: s });
  return JSON.stringify(d);
};

const getLast = (key, uid) => links.find({ key, uid }).sort(
  { createdAt: -1 }).limit(20);

const updateOne = async (item) => {
  const { url } = item;
  item.$inc = { affects: 1 };
  return links.updateOne({ url }, item, { upsert: true });
};

const putChat = async ({ g, u, pathname, host, ...item }, key) => {
  return links.bulkWrite([
    {
      insertOne: {
        document: { key, ...item },
      },
    },
  ]);
};

const getUidUser = async (g, key) => {
  g = `${g}`;
  const last = await uids.findOne({ key, g });
  return last ? last.toObject() : null;
};

const putUidUser = async ({ g, u, ...item }, key) => {
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
module.exports.putChat = putChat;
module.exports.putUidUser = putUidUser;
module.exports.getUidUser = getUidUser;

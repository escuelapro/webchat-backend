const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv-safe');

const envPath = path.join(__dirname, '../../.env');

if (fs.existsSync(envPath)) {
  dotenv.config({
    allowEmptyValues: true,
    path: envPath,
    sample: path.join(__dirname, '../../.env.example'),
  });
}

module.exports = {
  env: process.env.NODE_ENV,
  PORT: process.env.PORT || 4000,
  TBTKN: process.env.TBTKN || '',
  mongo: {
    uri: process.env.MONGO_URI,
  },
};

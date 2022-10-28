#! /usr/bin/env node

const importLocal = require('import-local');

if (importLocal(__filename)) {
  require('npmlog').info('cli', '正在使用 wisper-cli 本地版本');
} else {
  require('npmlog').info('cli', '正在使用 wisper-cli 调试版本');
  require('../lib')(process.argv.slice(2));
}

'use strict';

module.exports = core;

const semver = require('semver');
const colors = require('colors');

const pkg = require('../package.json');
const log = require('@wisper-cli/log');
const constant = require('./const');

function core() {
  try {
    checkPkgVersion();
    checkNodeVersion();
    checkRoot();
  } catch (err) {
    log.error(err.message);
  }
}

function checkRoot() {
  const rootCheck = require('root-check');
  rootCheck();
  console.log(process.geteuid());
}

function checkNodeVersion() {
  const currentVersion = process.version;
  const lowestVersion = constant.LOWEST_NODE_VERSION;
  if (!semver.gte(currentVersion, lowestVersion)) {
    throw new Error(
      colors.red(`wisper-cli 需要安装 v${lowestVersion} 以上版本的 Node.js`)
    );
  }
}

function checkPkgVersion() {
  log.info('cli', pkg.version);
}

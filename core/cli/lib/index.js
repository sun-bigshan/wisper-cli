'use strict';

const path = require('path');
const semver = require('semver');
const colors = require('colors');
const userHome = require('user-home');
const pathExists = require('path-exists').sync;

const pkg = require('../package.json');
const log = require('@wisper-cli/log');
const constant = require('./const');

let args, config;

async function core() {
  try {
    checkPkgVersion();
    checkNodeVersion();
    checkRoot();
    checkUserHome();
    checkInputArgs();
    log.verbose('debug', 'test debug log');
    checkEnv();
    checkGlobalUpdate();
  } catch (err) {
    log.error(err.message);
  }
}

async function checkGlobalUpdate() {
  // 1. 获取当前的版本号和模块名
  const currentVersion = pkg.version;
  const npmName = pkg.name;
  // 2. 调用 npm API 获取所有版本号
  const { getNpmSemverVersion } = require('@wisper-cli/get-npm-info');
  // 3. 提取所有版本号，比对哪些版本号时大于当前版本号
  const lastVersion = await getNpmSemverVersion(npmName, currentVersion);
  // 4. 获取最新的版本号，提示用户更新到该版本
  if (lastVersion && semver.gt(lastVersion, currentVersion)) {
    log.warn(
      colors.yellow(
        `请手动更新 ${npmName}, 当前版本为：${currentVersion}, 最新版本为：${lastVersion}
              更新命令为：npm install -g ${npmName}`
      )
    );
  }
}

function checkEnv() {
  const dotenv = require('dotenv');
  const dotenvPath = path.resolve(userHome, '.env');
  if (pathExists(dotenvPath)) {
    config = dotenv.config({
      path: path.resolve(userHome, '.env'),
    });
  }
  createDefaultConfig();
  log.verbose('环境变量', process.env.CLI_HOME_PATH);
}

function createDefaultConfig() {
  let cliHome;
  if (process.env.CLI_HOME) {
    cliHome = path.join(userHome, process.env.CLI_HOME);
  } else {
    cliHome = path.join(userHome, constant.DEFAULT_CLI_HOME);
  }
  process.env.CLI_HOME_PATH = cliHome;
}

function checkInputArgs() {
  const minimist = require('minimist');
  args = minimist(process.argv.slice(2));
  // console.log(args);
  checkArgs();
}

function checkArgs() {
  const level = args.debug ? 'verbose' : 'info';
  process.env.LOG_LEVEL = level;
  log.level = level;
}

function checkUserHome() {
  if (!userHome || !pathExists(userHome)) {
    throw new Error(colors.red('当前用户主目录不存在'));
  }
}

function checkRoot() {
  const rootCheck = require('root-check');
  rootCheck();
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

module.exports = core;

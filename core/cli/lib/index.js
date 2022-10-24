'use strict';

const path = require('path');
const semver = require('semver');
const colors = require('colors');
const userHome = require('user-home');
const pathExists = require('path-exists').sync;
const commander = require('commander');

const pkg = require('../package.json');
const log = require('@wisper-cli/log');
const constant = require('./const');
// const init = require('@wisper-cli/init');
const exec = require('@wisper-cli/exec');

let config;

const program = new commander.Command();

async function core() {
  try {
    await prepare();
    registerCommand();
  } catch (e) {
    log.error(e.message);
    if (program.opts().debug) {
      console.log(e);
    }
  }
}

function registerCommand() {
  program
    .name(Object.keys(pkg.bin)[0])
    .usage('<command> [options]')
    .version(pkg.version)
    .option('-d, --debug', '是否开启调试模式', false)
    .option('-tp, --targetPath <targetPath>', '是否制定本地调试文件路径', '');

  program
    .command('init [projectName]')
    .option('-f, --force', '是否强制初始化项目')
    .action(exec);

  // 开启 debug 模式
  program.on('option:debug', function () {
    const level = program.opts().debug ? 'verbose' : 'info';
    process.env.LOG_LEVEL = level;
    log.level = level;
  });

  // 制定targetPath
  program.on('option:targetPath', function () {
    process.env.CLI_TARGET_PATH = program.opts().targetPath;
  });

  // 对未知命令监听
  program.on('command:*', function (obj) {
    const availableCommands = program.commands.map((cmd) => cmd.name());
    console.log(colors.red(`未知的命令：${obj[0]}`));
    if (availableCommands.length > 0) {
      console.log(colors.green(`可用命令：${availableCommands.join(',')}`));
    }
  });
  program.parse(process.argv);
}

async function prepare() {
  checkPkgVersion();
  checkRoot();
  checkUserHome();
  checkEnv();
  await checkGlobalUpdate();
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

function checkUserHome() {
  if (!userHome || !pathExists(userHome)) {
    throw new Error(colors.red('当前用户主目录不存在'));
  }
}

function checkRoot() {
  const rootCheck = require('root-check');
  rootCheck();
}

function checkPkgVersion() {
  log.info('cli', pkg.version);
}

module.exports = core;

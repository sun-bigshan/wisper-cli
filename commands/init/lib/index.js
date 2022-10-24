'use strict';

const fs = require('fs');
const path = require('path');
const userHome = require('user-home');
const Command = require('@wisper-cli/command');
const log = require('@wisper-cli/log');
const Package = require('@wisper-cli/package');
const { spinnerStart, sleep } = require('@wisper-cli/utils');
const inquirer = require('inquirer');
const fse = require('fs-extra');
const semver = require('semver');

const getProjectTemplate = require('./getProjectTemplate');

const TYPE_PROJECT = 'project';
const TYPE_COMPONENT = 'component';

class InitCommand extends Command {
  init() {
    this.projectName = this._argv[0];
    this.force = !!this._argv[1].force;
    log.verbose('projectName', this.projectName);
    log.verbose('force', this.force);
  }
  async exec() {
    try {
      // 1. 准备阶段
      const projectInfo = await this.prepare();
      // 2. 下载模板
      if (projectInfo) {
        log.verbose('projectInfo', projectInfo);
        this.projectInfo = projectInfo;
        await this.downloadTemplate();
      }
      // 3. 安装模板
    } catch (e) {
      log.error(e.message);
    }
  }
  async downloadTemplate() {
    // 1. 通过项目模板API获取项目模板信息
    const { projectTemplate } = this.projectInfo;
    const templateInfo = this.template.filter(
      (item) => item.npmName === projectTemplate
    );
    if (templateInfo.length > 0) {
      const targetPath = path.resolve(
        userHome,
        process.env.CLI_HOME_PATH,
        'template'
      );
      const storeDir = path.resolve(
        userHome,
        process.env.CLI_HOME_PATH,
        'template',
        'node_modules'
      );
      const { npmName, version } = templateInfo[0];
      const templateNpm = new Package({
        targetPath,
        storeDir,
        packageName: npmName,
        packageVersion: version,
      });

      if (!(await templateNpm.exists())) {
        const spinner = spinnerStart('正在下载模板...');
        await sleep();
        try {
          await templateNpm.install();
          log.success('下载模板成功');
        } catch (e) {
        } finally {
          spinner.stop(true);
        }
      } else {
        const spinner = spinnerStart('正在更新模板...');
        await sleep();
        try {
          await templateNpm.update();
          log.success('更新模板成功');
        } catch (e) {
        } finally {
          spinner.stop(true);
        }
      }
    }
  }
  async prepare() {
    // 判断项目模板是否存在
    const template = await getProjectTemplate();
    if (!template || template.length === 0) {
      throw new Error('项目模板不存在');
    }
    this.template = template;
    const localPath = process.cwd();
    // 1. 判断当前目录是否为空
    if (!this.isDirEmpty(localPath)) {
      let ifContinue = false;
      if (!this.force) {
        // 询问是否继续创建
        ifContinue = await inquirer.prompt({
          type: 'confirm',
          name: 'ifContinue',
          default: false,
          message: '当前文件夹不为空，是否继续创建项目？',
        }).ifContinue;
        if (!ifContinue) {
          return;
        }
      }
      // 2. 是否启动强制更新
      if (ifContinue || this.force) {
        const { confirmDelete } = await inquirer.prompt({
          type: 'confirm',
          name: 'confirmDelete',
          default: false,
          message: '是否确认清空当前目录下的文件？',
        });
        if (confirmDelete) {
          // 清空当前目录
          fse.emptyDirSync(localPath);
        }
      }
    }

    return this.getProjectInfo();
  }

  async getProjectInfo() {
    let projectInfo = {};
    // 1. 选择创建项目或组件
    const { type } = await inquirer.prompt({
      type: 'list',
      name: 'type',
      message: '请选择初始化类型',
      default: TYPE_PROJECT,
      choices: [
        {
          name: '项目',
          value: TYPE_PROJECT,
        },
        {
          name: '组件',
          value: TYPE_COMPONENT,
        },
      ],
    });
    log.verbose('type', type);

    if (type === TYPE_PROJECT) {
      // 2. 获取项目的基本信息
      const project = await inquirer.prompt([
        {
          type: 'input',
          name: 'projectName',
          message: '请输入项目名称',
          default: '',
          validate: function (v) {
            const done = this.async();

            setTimeout(function () {
              if (!/^[a-zA-Z]+([-_][a-zA-Z]+[a-zA-Z0-9]*)*$/.test(v)) {
                done('请输入合法的项目名称');
                return;
              }
              done(null, true);
            }, 0);
          },
          filter: function (v) {
            return v;
          },
        },
        {
          type: 'input',
          name: 'projectVersion',
          message: '请输入项目版本号',
          default: '1.0.0',
          validate: function (v) {
            const done = this.async();

            setTimeout(function () {
              if (!semver.valid(v)) {
                done('请输入合法的版本号');
                return;
              }
              done(null, true);
            }, 0);
          },
          filter: function (v) {
            if (!!semver.valid(v)) {
              return semver.valid(v);
            }
            return v;
          },
        },
        {
          type: 'list',
          name: 'projectTemplate',
          message: '请选择项目模板',
          choices: this.createTemplateChoices(),
        },
      ]);
      projectInfo = {
        type,
        ...project,
      };
    } else if (type === TYPE_COMPONENT) {
      //
    }
    return projectInfo;
  }

  isDirEmpty(localPath) {
    const fileList = fs.readdirSync(localPath);
    return !fileList || fileList.length === 0;
  }

  createTemplateChoices() {
    return this.template.map((item) => ({
      value: item.npmName,
      name: item.name,
    }));
  }
}

function init(argv) {
  new InitCommand(argv);
}

module.exports = init;

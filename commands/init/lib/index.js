'use strict';

const fs = require('fs');
const path = require('path');
const userHome = require('user-home');
const Command = require('@wisper-cli/command');
const log = require('@wisper-cli/log');
const Package = require('@wisper-cli/package');
const { spinnerStart, sleep, execAsync } = require('@wisper-cli/utils');
const inquirer = require('inquirer');
const fse = require('fs-extra');
const semver = require('semver');
const ejs = require('ejs');
const glob = require('glob');

const getProjectTemplate = require('./getProjectTemplate');

const TYPE_PROJECT = 'project';
const TYPE_COMPONENT = 'component';

const TEMPLATE_TYPE_NORMAL = 'normal';
const TEMPLATE_TYPE_CUSTOM = 'custom';

const WHITE_COMMANDS = ['npm', 'cnpm', 'yarn'];

class InitCommand extends Command {
  init() {
    this.projectName = this._argv[0] || '';
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
        // 3. 安装模板
        await this.installTemplate();
      }
    } catch (e) {
      log.error(e.message);
    }
  }
  async installTemplate() {
    if (this.templateInfo) {
      if (!this.templateInfo.type) {
        this.templateInfo.type = TEMPLATE_TYPE_NORMAL;
      }
      if (this.templateInfo.type === TEMPLATE_TYPE_NORMAL) {
        // 标准安装
        await this.installNormalTemplate();
      } else if (this.templateInfo.type === TEMPLATE_TYPE_CUSTOM) {
        // 自定义安装
        await this.installCustomTemplate();
      } else {
        throw new Error('项目模板类型无法识别');
      }
    } else {
      throw new Error('项目模板信息不存在');
    }
  }
  checkCommand(cmd) {
    if (!WHITE_COMMANDS.includes(cmd)) {
      throw new Error(`只允许执行 ${WHITE_COMMANDS.join('|')} 命令`);
    }
    return cmd;
  }
  async execCommand(command, message) {
    let ret;
    const installCmd = command.split(' ');
    const cmd = this.checkCommand(installCmd[0]);
    const args = installCmd.slice(1);
    // cmd = yarn   args = ['install']
    ret = await execAsync(cmd, args, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    if (ret !== 0) {
      throw new Error(message);
    }
    return ret;
  }
  ejsRender(ignore) {
    return new Promise((resolve, reject) => {
      const dir = process.cwd();
      glob(
        '**',
        {
          cwd: dir,
          ignore: ignore || '',
          nodir: true,
        },
        (err, files) => {
          if (err) {
            reject(err);
          }
          Promise.all(
            files.map((file) => {
              const filePath = path.join(dir, file);
              return new Promise((res, rej) => {
                ejs.renderFile(filePath, this.projectInfo, (err, result) => {
                  if (err) {
                    rej(err);
                  } else {
                    fse.writeFileSync(filePath, result);
                    res(result);
                  }
                });
              });
            })
          )
            .then(() => {
              resolve();
            })
            .catch((err) => {
              reject(err);
            });
        }
      );
    });
  }
  async installNormalTemplate() {
    log.verbose('templateNpm', this.templateNpm);
    log.verbose('templateInfo', this.templateInfo);
    // 拷贝模板代码至当前目录
    let spinner = spinnerStart('正在安装模板...');
    await sleep();
    try {
      const templatePath = path.resolve(
        this.templateNpm.cacheFilePath,
        'template'
      );
      const targetPath = process.cwd();
      fse.ensureDirSync(templatePath);
      fse.ensureDirSync(targetPath);
      fse.copySync(templatePath, targetPath);
    } catch (e) {
      throw new Error(e.message);
    } finally {
      spinner.stop(true);
      log.success('模板安装成功');
    }

    const templateIgnore = this.templateInfo.ignore || [];
    const ignore = ['**/node_modules/**', ...templateIgnore];
    await this.ejsRender(ignore);
    const { installCommand, startCommand } = this.templateInfo;

    // 依赖安装
    if (installCommand) {
      await this.execCommand(installCommand, '依赖安装失败');
    }
    // 执行启动命令
    if (startCommand) {
      await this.execCommand(startCommand, '项目启动失败！');
    }
  }
  async installCustomTemplate() {
    const rootFile = this.templateNpm.getRootFilePath();
    if (fs.existsSync(rootFile)) {
      log.notice('开始执行自定义模板');
      const templatePath = path.resolve(
        this.templateNpm.cacheFilePath,
        'template'
      );
      const options = {
        templateInfo: this.templateInfo,
        projectInfo: this.projectInfo,
        sourcePath: templatePath,
        targetPath: process.cwd(),
      };
      const code = `require('${rootFile}')(${JSON.stringify(options)})`;
      log.verbose('code', code);
      await execAsync('node', ['-e', code], {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      log.success('自定义模板安装成功');
    } else {
      throw new Error('自定义模板入口文件不存在');
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
      this.templateInfo = templateInfo[0];
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
        } catch (e) {
        } finally {
          spinner.stop(true);
          if (await templateNpm.exists()) {
            log.success('下载模板成功');
            this.templateNpm = templateNpm;
          }
        }
      } else {
        const spinner = spinnerStart('正在更新模板...');
        await sleep();
        try {
          await templateNpm.update();
        } catch (e) {
        } finally {
          spinner.stop(true);
          if (await templateNpm.exists()) {
            log.success('更新模板成功');
            this.templateNpm = templateNpm;
          }
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
        const answer = await inquirer.prompt({
          type: 'confirm',
          name: 'ifContinue',
          default: false,
          message: '当前文件夹不为空，是否继续创建项目？',
        });

        ifContinue = answer.ifContinue;
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
    function isValidName(v) {
      return /^[a-zA-Z]+([-_][a-zA-Z]+[a-zA-Z0-9]*)*$/.test(v);
    }
    let projectInfo = {};
    let isProjectNameValid = false;
    if (isValidName(this.projectName)) {
      isProjectNameValid = true;
      projectInfo.projectName = this.projectName;
    }
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
    const title = type === TYPE_PROJECT ? '项目' : '组件';
    this.template = this.template.filter((template) =>
      template.tag.includes(type)
    );

    const projectNamePrompt = {
      type: 'input',
      name: 'projectName',
      message: `请输入${title}名称`,
      default: '',
      validate: function (v) {
        const done = this.async();
        setTimeout(function () {
          if (!isValidName(v)) {
            done(`请输入合法的${title}名称`);
            return;
          }
          done(null, true);
        }, 0);
      },
      filter: function (v) {
        return v;
      },
    };
    const projectPrompt = [
      {
        type: 'input',
        name: 'projectVersion',
        message: `请输入${title}版本号`,
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
        message: `请选择${title}模板`,
        choices: this.createTemplateChoices(),
      },
    ];
    if (!isProjectNameValid) {
      projectPrompt.unshift(projectNamePrompt);
    }

    if (type === TYPE_PROJECT) {
      // 2. 获取项目的基本信息
      const project = await inquirer.prompt(projectPrompt);
      projectInfo = {
        type,
        ...project,
      };
    } else if (type === TYPE_COMPONENT) {
      // 2. 获取组件的基本信息
      const descriptionPrompt = {
        type: 'input',
        name: 'componentDescription',
        message: '请输入组件描述信息',
        default: '',
        validate: function (v) {
          const done = this.async();

          setTimeout(function () {
            if (!v) {
              done('请输入组件描述信息');
              return;
            }
            done(null, true);
          }, 0);
        },
      };
      projectPrompt.push(descriptionPrompt);
      const project = await inquirer.prompt(projectPrompt);
      projectInfo = {
        type,
        ...project,
      };
    }
    // 生成classname
    if (projectInfo.projectName) {
      projectInfo.name = projectInfo.projectName;
      projectInfo.className = require('kebab-case')(
        projectInfo.projectName
      ).replace(/^-/, '');
    }
    if (projectInfo.projectVersion) {
      projectInfo.version = projectInfo.projectVersion;
    }

    if (projectInfo.componentDescription) {
      projectInfo.description = projectInfo.componentDescription;
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

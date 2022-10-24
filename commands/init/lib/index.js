'use strict';

const Command = require('@wisper-cli/command');
const log = require('@wisper-cli/log');

class InitCommand extends Command {
  init() {
    this.projectName = this._argv[0];
    this.force = !!this._argv[1].force;
    log.verbose('projectName', this.projectName);
    log.verbose('force', this.force);
  }
  exec() {}
}

function init(argv) {
  // console.log('init', projectName, cmdObj.force, process.env.CLI_TARGET_PATH);
  new InitCommand(argv);
}

module.exports = init;

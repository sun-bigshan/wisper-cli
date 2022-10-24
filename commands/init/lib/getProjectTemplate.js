const request = require('@wisper-cli/request');

module.exports = function () {
  return request({
    url: '/project/template',
  });
};

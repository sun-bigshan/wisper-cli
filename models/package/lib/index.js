'use strict';

const path = require('path');
const pkgDir = require('pkg-dir').sync;
const { isObject } = require('@wisper-cli/utils');
const formatPath = require('@wisper-cli/format-path');
const {
  getDefaultRegistry,
  getNpmLatestVersion,
} = require('@wisper-cli/get-npm-info');
const npminstall = require('npminstall');
const pathExists = require('path-exists').sync;
const fse = require('fs-extra');

class Package {
  constructor(options) {
    if (!options) {
      throw new Error('Package类的options参数不能为空！');
    }
    if (!isObject(options)) {
      throw new Error('Package类的options参数需为对象！');
    }
    // package 的路径
    this.targetPath = options.targetPath;
    // package 的缓存路径
    this.storeDir = options.storeDir;
    // package 的 name
    this.packageName = options.packageName;
    // package 的 version
    this.packageVersion = options.packageVersion;
    // package 的缓存目录前缀
    this.cacheFilePathPrefix = this.packageName.replace('/', '_');
  }
  async prepare() {
    if (this.storeDir && !pathExists(this.storeDir)) {
      fse.mkdirpSync(this.storeDir);
    }
    if (this.packageVersion === 'latest') {
      this.packageVersion = await getNpmLatestVersion(this.packageName);
    }
  }
  get cacheFilePath() {
    return path.resolve(
      this.storeDir,
      `_${this.cacheFilePathPrefix}@${this.packageVersion}@${this.packageName}`
    );
  }
  getSpecificCacheFilePath(packageVersion) {
    return path.resolve(
      this.storeDir,
      `_${this.cacheFilePathPrefix}@${packageVersion}@${this.packageName}`
    );
  }
  // 判断当前 package 是否存在
  async exists() {
    if (this.storeDir) {
      await this.prepare();
      return pathExists(this.cacheFilePath);
    } else {
      return pathExists(this.targetPath);
    }
  }
  // 安装 package
  install() {
    const params = {
      root: this.targetPath,
      storeDir: this.storeDir,
      registry: getDefaultRegistry(),
      pkgs: [
        {
          name: this.packageName,
          version: this.packageVersion,
        },
      ],
    };
    return npminstall(params);
  }
  // 更新 package
  async update() {
    await this.prepare();
    // 1. 获取最新的 npm 模块版本号
    const latestPackageVersion = await getNpmLatestVersion(this.packageName);
    // 2. 查询最新版本号对应的路径是否存在
    const latestFilePath = this.getSpecificCacheFilePath(latestPackageVersion);
    // 3. 如果不存在，则直接安装最新版本
    if (!pathExists(latestFilePath)) {
      const params = {
        root: this.targetPath,
        storeDir: this.storeDir,
        registry: getDefaultRegistry(),
        pkgs: [
          {
            name: this.packageName,
            version: latestPackageVersion,
          },
        ],
      };
      return npminstall(params);
    }
  }
  // 获取入口文件的路径
  getRootFilePath() {
    function _getRootFile(targetPath) {
      // 1. 获取 package.json 所在的目录
      const dir = pkgDir(targetPath);
      if (dir) {
        // 2. 读取 package.json - require()
        const pkgFile = require(path.resolve(dir, 'package.json'));
        // 3. main/lib - path
        if (pkgFile && pkgFile.main) {
          // 4. 路径的兼容（macos/windows）
          return formatPath(path.resolve(dir, pkgFile.main));
          return null;
        }
        return null;
      }
    }
    if (this.storeDir) {
      return _getRootFile(this.cacheFilePath);
    } else {
      return _getRootFile(this.targetPath);
    }
  }
}

module.exports = Package;

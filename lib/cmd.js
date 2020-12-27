"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const program = require("commander");
const path = require("path");
const inquirer = require("inquirer");
const fs = require("fs-extra");
const debugLog = require("./debugLog");
const utils_1 = require("./utils");
const packageFilePath = path.join(__dirname, "..", "package.json");
const packageInfo = JSON.parse(fs.readFileSync(packageFilePath, "utf8"));
const currentVersion = packageInfo.version;
program.version(currentVersion).usage("[命令] [配置项]");
program.description("powerful api code generator");
function assert(expression, message) {
    if (!expression) {
        debugLog.error(message);
        process.exit(1);
    }
}
(function () {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const manager = yield utils_1.createManager();
            program
                .command("check")
                .description("检测 api-lock.yml 文件")
                .action(() => __awaiter(this, void 0, void 0, function* () {
                debugLog.info("api-lock.yml 文件检测中...");
                try {
                    const localDatas = (yield manager.readLockFile());
                    if (localDatas.length > 1) {
                        assert(localDatas.every(data => !!data.name), '多数据源每个数据源应该有 "name"');
                    }
                    localDatas.forEach(data => {
                        data.baseClasses.forEach(base => {
                            assert(!!base.name, `描述为 ${base.description} 的类没有"name"属性`);
                            base.properties.forEach(prop => {
                                assert(!!prop.name, `${base.name} 类的某个属性没有 "name" 属性`);
                            });
                        });
                        data.mods.forEach(mod => {
                            assert(!!mod.name, `描述为 ${mod.description} 的模块没有 "name" 属性`);
                            mod.interfaces.forEach(inter => {
                                assert(!!inter.name, `${mod.name} 模块的某个接口没有 "name" 属性`);
                                inter.parameters.forEach(param => {
                                    assert(!!param.name, `${mod.name} 模块的 ${inter.name} 接口的某个参数没有 "name" 属性`);
                                });
                            });
                        });
                    });
                }
                catch (e) {
                    debugLog.error(e);
                    process.exit(1);
                }
                process.exit(0);
            }));
            program
                .command("ls")
                .description("查看数据源")
                .action(() => {
                debugLog.info(manager.allConfigs.map(conf => conf.name).join("  "));
            });
            program
                .command("diff")
                .description("对比数据源")
                .action(() => {
                inquirer
                    .prompt([
                    {
                        type: "list",
                        name: "dataSource",
                        message: "请选择需要更新的数据源",
                        pageSize: 30,
                        choices: manager.allConfigs.map(conf => ({
                            name: conf.name,
                            value: conf.name
                        }))
                    }
                ])
                    .then((answer) => __awaiter(this, void 0, void 0, function* () {
                    yield manager.selectDataSource(answer.dataSource);
                    manager.calDiffs();
                    const { modDiffs, boDiffs } = manager.diffs;
                    debugLog.tip("接口变更：");
                    debugLog.tip(modDiffs.map(mod => mod.details.join("\n")).join("\n") + "\n");
                    debugLog.tip("基类变更：");
                    debugLog.tip(boDiffs.map(bo => bo.details.join("\n")).join("\n"));
                }));
            });
            program
                .command("select <dsName>")
                .description("选择数据源")
                .action(dsName => {
                manager.selectDataSource(dsName);
            });
            program
                .command("updateBo")
                .description("更新基类")
                .action(() => {
                inquirer
                    .prompt([
                    {
                        type: "list",
                        name: "dataSource",
                        message: "请选择需要更新的数据源",
                        pageSize: 30,
                        choices: manager.allConfigs.map(conf => ({
                            name: conf.name,
                            value: conf.name
                        }))
                    }
                ])
                    .then((answer) => __awaiter(this, void 0, void 0, function* () {
                    yield manager.selectDataSource(answer.dataSource);
                    manager.calDiffs();
                    const { boDiffs } = manager.diffs;
                    const choices = [];
                    debugLog.tip("基类变更：");
                    debugLog.tip(boDiffs
                        .map(bo => {
                        choices.push({
                            name: bo.name,
                            value: bo.name
                        });
                        return bo.details.join("\n");
                    })
                        .join("\n"));
                    if (choices && !choices.length)
                        return debugLog.tip("没有什么需要更新的");
                    inquirer
                        .prompt([
                        {
                            type: "checkbox",
                            name: "boList",
                            message: "请选择需要更新的基类",
                            pageSize: 30,
                            choices: choices
                        }
                    ])
                        .then(answers => {
                        if (answers.boList && !answers.boList.length) {
                            debugLog.error("=============什么都没选=============");
                            return;
                        }
                        answers.boList.forEach(boName => {
                            manager.makeSameBase(boName);
                        });
                        manager.regenerateFiles();
                    });
                }));
            });
            program
                .command("updateInterface")
                .description("作用：更新接口\n本命令只会更新接口纬度的代码，不会更新模块、基类纬度的代码，举例：如果远端删除或者新增了一个模块，请使用updateMod，如果远端基类发生了变化，请使用updateBo")
                .action(() => {
                inquirer
                    .prompt([
                    {
                        type: "list",
                        name: "dataSource",
                        message: "请选择需要更新的数据源",
                        pageSize: 30,
                        choices: manager.allConfigs.map(conf => ({
                            name: conf.name,
                            value: conf.name
                        }))
                    }
                ])
                    .then((answer) => __awaiter(this, void 0, void 0, function* () {
                    yield manager.selectDataSource(answer.dataSource);
                    manager.calDiffs();
                    const { modDiffs } = manager.diffs;
                    debugLog.tip("\n接口变更：");
                    debugLog.tip(modDiffs.map(mod => mod.details.join("\n")).join("\n") + "\n");
                    const choices = [];
                    modDiffs.forEach(mod => {
                        mod.modifiedInterfaceList &&
                            mod.modifiedInterfaceList.forEach(interName => {
                                choices.push({
                                    name: `${mod.name}模块的${interName}接口`,
                                    value: mod.name + "." + interName
                                });
                            });
                    });
                    if (choices && !choices.length)
                        return debugLog.tip("没有什么需要更新的");
                    inquirer
                        .prompt([
                        {
                            type: "checkbox",
                            name: "interfaceList",
                            pageSize: 30,
                            message: "请选择需要更新的接口",
                            choices: choices
                        }
                    ])
                        .then(answers => {
                        if (answers.interfaceList && !answers.interfaceList.length) {
                            debugLog.error("=============什么都没选=============");
                            return;
                        }
                        manager.mutipleUpdateInterface(answers.interfaceList);
                        manager.regenerateFiles();
                    });
                }));
            });
            program
                .command("updateMod")
                .description("更新模块")
                .action(() => {
                inquirer
                    .prompt([
                    {
                        type: "list",
                        name: "dataSource",
                        message: "请选择需要更新的数据源",
                        pageSize: 30,
                        choices: manager.allConfigs.map(conf => ({
                            name: conf.name,
                            value: conf.name
                        }))
                    }
                ])
                    .then((answer) => __awaiter(this, void 0, void 0, function* () {
                    yield manager.selectDataSource(answer.dataSource);
                    manager.calDiffs();
                    const { modDiffs } = manager.diffs;
                    const choices = [];
                    debugLog.tip("模块变更：");
                    debugLog.tip(modDiffs
                        .map(mod => {
                        if (mod.details && mod.details.length === 1) {
                            choices.push({
                                name: mod.name + "模块",
                                value: mod.name
                            });
                            return mod.details[0].split(/，/)[0];
                        }
                        else {
                            choices.push({
                                name: mod.name +
                                    "模块(内部存在接口变更，请使用updateInterface命令选择性更新)",
                                value: mod.name,
                                disabled: true
                            });
                            return;
                        }
                    })
                        .join("\n"));
                    if (choices && !choices.length)
                        return debugLog.tip("没有什么需要更新的");
                    inquirer
                        .prompt([
                        {
                            type: "checkbox",
                            name: "modList",
                            pageSize: 30,
                            message: "请选择需要更新的模块",
                            choices: choices
                        }
                    ])
                        .then(answers => {
                        if (answers.modList && !answers.modList.length) {
                            debugLog.error("=============什么都没选=============");
                            return;
                        }
                        answers.modList.forEach(modName => {
                            manager.makeSameMod(modName);
                        });
                        manager.regenerateFiles();
                    });
                }));
            });
            program
                .command("generate")
                .description("生成代码")
                .action(() => {
                manager.regenerateFiles();
            });
            program.parse(process.argv);
        }
        catch (e) {
            console.error(e.stack);
            debugLog.error(e.toString());
        }
    });
})();
//# sourceMappingURL=cmd.js.map
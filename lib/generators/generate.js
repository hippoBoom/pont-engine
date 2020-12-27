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
const _ = require("lodash");
const fs = require("fs-extra");
const path = require("path");
const js_yaml_1 = require("js-yaml");
const utils_1 = require("../utils");
const debugLog_1 = require("../debugLog");
class FileStructures {
    constructor(generators, usingMultipleOrigins) {
        this.generators = generators;
        this.usingMultipleOrigins = usingMultipleOrigins;
    }
    getMultipleOriginsFileStructures() {
        const files = {};
        this.generators.forEach(generator => {
            const dsName = generator.dataSource.name;
            const dsFiles = this.getOriginFileStructures(generator, true);
            files[dsName] = dsFiles;
        });
        return Object.assign({}, files, { "index.ts": this.getDataSourcesTs.bind(this), "api-lock.yml": this.getLockContent.bind(this) });
    }
    getBaseClassesInDeclaration(originCode, usingMultipleOrigins) {
        if (usingMultipleOrigins) {
            return `
      declare namespace defs {
        export ${originCode}
      };
      `;
        }
        return `
      declare ${originCode}
    `;
    }
    getModsDeclaration(originCode, usingMultipleOrigins) {
        if (usingMultipleOrigins) {
            return `
      declare namespace API {
        export ${originCode}
      };
      `;
        }
        return `
      declare ${originCode}
    `;
    }
    getOriginFileStructures(generator, usingMultipleOrigins = false) {
        const mods = {};
        const baseClasses = {};
        const dataSource = generator.dataSource;
        dataSource.mods.forEach(mod => {
            const currMod = {};
            mod.interfaces.forEach(inter => {
                currMod[`${inter.name}.ts`] = generator.getInterfaceContent.bind(generator, inter, mod);
                currMod["index.ts"] = generator.getModIndex.bind(generator, mod);
                currMod[`${inter.name}.d.ts`] = generator.getInterfaceDeclaration.bind(generator, inter, mod);
                currMod[`${inter.name}.lock.yml`] = generator.getObjectLockFileContent.bind(generator, inter);
            });
            mods[mod.name] = currMod;
            mods["index.ts"] = generator.getModsIndex.bind(generator);
        });
        dataSource.baseClasses.forEach(baseClass => {
            baseClasses[`${baseClass.name}.d.ts`] = generator.getBaseClassInDeclaration.bind(generator, baseClass);
            baseClasses[`${baseClass.name}.lock.yml`] = generator.getObjectLockFileContent.bind(generator, baseClass);
        });
        generator.getBaseClassesInDeclaration = this.getBaseClassesInDeclaration.bind(this, generator.getBaseClassesInDeclaration(), usingMultipleOrigins);
        generator.getModsDeclaration = this.getModsDeclaration.bind(this, generator.getModsDeclaration(), usingMultipleOrigins);
        const result = {
            "baseClass.d.ts": generator.getBaseClassesIndex.bind(generator),
            mods: mods,
            baseClasses: baseClasses,
            "index.ts": generator.getIndex.bind(generator)
        };
        if (!usingMultipleOrigins) {
            result["api-lock.yml"] = this.getLockContent.bind(this);
        }
        return result;
    }
    getFileStructures() {
        if (this.usingMultipleOrigins || this.generators.length > 1) {
            return this.getMultipleOriginsFileStructures();
        }
        else {
            return this.getOriginFileStructures(this.generators[0]);
        }
    }
    getDataSourcesTs() {
        const dsNames = this.generators.map(ge => ge.dataSource.name);
        return `
      ${dsNames
            .map(name => {
            return `import { defs as ${name}Defs, ${name} } from './${name}';
          `;
        })
            .join("\n")}

      (window as any).defs = {
        ${dsNames.map(name => `${name}: ${name}Defs,`).join("\n")}
      };
      (window as any).API = {
        ${dsNames.join(",\n")}
      };
    `;
    }
    getDataSourcesDeclarationTs() {
        const dsNames = this.generators.map(ge => ge.dataSource.name);
        return `
    ${dsNames
            .map(name => {
            return `/// <reference path="./${name}/api.d.ts" />`;
        })
            .join("\n")}
    `;
    }
    getLockContent() {
        const pureDataSources = JSON.parse(JSON.stringify(this.generators.map(ge => ge.dataSource)));
        const dataSource = pureDataSources.map((source) => ({
            name: source.name,
            baseClasses: source.baseClasses.map(baseClass => baseClass.name),
            mods: source.mods.map(mod => ({
                name: mod.name,
                description: mod.description,
                interfaces: mod.interfaces.map(inter => inter.name)
            }))
        }));
        return ("# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY. \n\n" +
            js_yaml_1.safeDump(dataSource, {
                sortKeys: true,
                noRefs: true
            }));
    }
}
exports.FileStructures = FileStructures;
class CodeGenerator {
    constructor() { }
    setDataSource(dataSource) {
        this.dataSource = dataSource;
        this.dataSource.name = _.camelCase(this.dataSource.name);
    }
    getBaseClassInDeclaration(base) {
        if (base.templateArgs && base.templateArgs.length) {
            return `class ${base.name}<${base.templateArgs
                .map((_, index) => `T${index} = any`)
                .join(", ")}> {
        ${base.properties.map(prop => prop.toPropertyCode(true)).join("\n")}
      }
      `;
        }
        return `class ${base.name} {
      ${base.properties.map(prop => prop.toPropertyCode(true)).join("\n")}
    }
    `;
    }
    getBaseClassesInDeclaration() {
        const content = `namespace ${this.dataSource.name || "defs"} {
      ${this.dataSource.baseClasses
            .map(base => `
        export ${this.getBaseClassInDeclaration(base)}
      `)
            .join("\n")}
    }
    `;
        return content;
    }
    getBaseClassesInDeclarationWithMultipleOrigins() {
        return `
      declare namespace defs {
        export ${this.getBaseClassesInDeclaration()}
      }
    `;
    }
    getBaseClassesInDeclarationWithSingleOrigin() {
        return `
      declare ${this.getBaseClassesInDeclaration()}
    `;
    }
    getInterfaceContentInDeclaration(inter) {
        const bodyParams = inter.getBodyParamsCode();
        const requestParams = bodyParams
            ? `params: Params, bodyParams: ${bodyParams}`
            : `params: Params`;
        return `
      export ${inter.getParamsCode()}

      export type Response = ${inter.responseType};
      export const init: Response;
      export function request(${requestParams}): Promise<${inter.responseType}>;
    `;
    }
    getInterfaceInDeclaration(inter) {
        return `
      /**
        * ${inter.description}
        * ${inter.path}
        */
      export namespace ${inter.name} {
        ${this.getInterfaceContentInDeclaration(inter)}
      }
    `;
    }
    getModsDeclaration() {
        const mods = this.dataSource.mods;
        const content = `namespace ${this.dataSource.name || "API"} {
        ${mods
            .map(mod => `
          /**
           * ${mod.description}
           */
          export namespace ${mod.name} {
            ${mod.interfaces
            .map(this.getInterfaceInDeclaration.bind(this))
            .join("\n")}
          }
        `)
            .join("\n\n")}
      }
    `;
        return content;
    }
    getModsDeclarationWithMultipleOrigins() { }
    getModsDeclarationWithSingleOrigin() { }
    getCommonDeclaration() {
        return "";
    }
    getModDeclaration(mod) {
        return `
      /**
       * ${mod.description}
       */
      export namespace ${mod.name} {
        ${mod.interfaces
            .map(this.getInterfaceInDeclaration.bind(this))
            .join("\n")}
      }
    `;
    }
    getInterfaceDeclaration(inter, mod) {
        return `
      /**
       * ${inter.description}
       */
      export namespace ${mod.name} {
        ${this.getInterfaceInDeclaration.bind(this)}
      }
    `;
    }
    getDeclaration() {
        return `
      type ObjectMap<Key extends string | number | symbol = any, Value = any> = {
        [key in Key]: Value;
      }

      ${this.getCommonDeclaration()}

      ${this.getBaseClassesInDeclaration()}

      ${this.getModsDeclaration()}
    `;
    }
    getIndex() {
        let conclusion = `
      import * as defs from './baseClass';
      import './mods/';

      (window as any).defs = defs;
    `;
        if (this.dataSource.name) {
            conclusion = `
        import { ${this.dataSource.name} as defs } from './baseClass';
        export { ${this.dataSource.name} } from './mods/';
        export { defs };
      `;
        }
        return conclusion;
    }
    getBaseClassesIndex() {
        const clsCodes = this.dataSource.baseClasses.map(base => `
        class ${base.name} {
          ${base.properties
            .map(prop => {
            return prop.toPropertyCodeWithInitValue(base.name);
        })
            .filter(id => id)
            .join("\n")}
        }
      `);
        if (this.dataSource.name) {
            return `
        ${clsCodes.join("\n")}
        export const ${this.dataSource.name} = {
          ${this.dataSource.baseClasses.map(bs => bs.name).join(",\n")}
        }
      `;
        }
        return clsCodes.map(cls => `export ${cls}`).join("\n");
    }
    getInterfaceContent(inter, _mod) {
        const bodyParams = inter.getBodyParamsCode();
        const requestParams = bodyParams ? `params, bodyParams` : `params`;
        return `
    /**
     * @desc ${inter.description}
     */

    import * as defs from '../../baseClass';
    import pontFetch from 'src/utils/pontFetch';

    export ${inter.getParamsCode()}
    export const init = ${inter.response.getInitialValue()};

    export async function request(${requestParams}) {
      return pontFetch({
        url: '${inter.path}',
        ${bodyParams ? "params: bodyParams" : "params"},
        method: '${inter.method}',
      });
    }
   `;
    }
    getModIndex(mod) {
        return `
      /**
       * @description ${mod.description}
       */
      ${mod.interfaces
            .map(inter => {
            return `import * as ${inter.name} from './${inter.name}';`;
        })
            .join("\n")}

      export {
        ${mod.interfaces.map(inter => inter.name).join(", \n")}
      }
    `;
    }
    getObjectLockFileContent(obj) {
        const objLock = JSON.parse(JSON.stringify(obj));
        if (objLock.properties) {
            objLock.properties = utils_1.array2Obj(objLock.properties);
        }
        if (objLock.parameters) {
            objLock.parameters = utils_1.array2Obj(objLock.parameters);
        }
        return ("# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY. \n\n" +
            js_yaml_1.safeDump(objLock, {
                sortKeys: true,
                noRefs: true
            }));
    }
    getModsIndex() {
        let conclusion = `
      (window as any).API = {
        ${this.dataSource.mods.map(mod => mod.name).join(", \n")}
      };
    `;
        if (this.dataSource.name) {
            conclusion = `
        export const ${this.dataSource.name} = {
          ${this.dataSource.mods.map(mod => mod.name).join(", \n")}
        };
      `;
        }
        return `
      ${this.dataSource.mods
            .map(mod => {
            return `import * as ${mod.name} from './${mod.name}';`;
        })
            .join("\n")}

      ${conclusion}
    `;
    }
    getDataSourceCallback(dataSource) {
        if (dataSource) {
            return;
        }
    }
}
exports.CodeGenerator = CodeGenerator;
class FilesManager {
    constructor(fileStructures, baseDir) {
        this.fileStructures = fileStructures;
        this.baseDir = baseDir;
        this.report = debugLog_1.info;
        this.created = false;
    }
    setFormat(files) {
        _.forEach(files, (value, name) => {
            if (name.endsWith(".yml") || name.endsWith(".lock")) {
                return;
            }
            if (typeof value === "function") {
                files[name] = (content) => utils_1.format(value(content), this.prettierConfig);
            }
            this.setFormat(value);
        });
    }
    initPath(path) {
        if (fs.existsSync(path)) {
            fs.removeSync(path);
        }
        fs.mkdirpSync(path);
    }
    regenerate(report) {
        return __awaiter(this, void 0, void 0, function* () {
            if (report) {
                this.report = report;
            }
            const files = this.fileStructures.getFileStructures();
            this.setFormat(files);
            this.initPath(this.baseDir);
            this.created = true;
            yield this.generateFiles(files);
        });
    }
    saveLock() {
        return __awaiter(this, void 0, void 0, function* () {
            const lockFilePath = path.join(this.baseDir, "api-lock.yml");
            const oldLockFilePath = path.join(this.baseDir, "api.lock");
            const isExists = fs.existsSync(lockFilePath);
            const readFilePath = isExists ? lockFilePath : oldLockFilePath;
            const lockContent = yield fs.readFile(readFilePath, "utf8");
            const newLockContent = this.fileStructures.getLockContent();
            if (lockContent !== newLockContent) {
                this.created = true;
                yield fs.writeFile(lockFilePath, newLockContent);
            }
        });
    }
    generateFiles(files, dir = this.baseDir) {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = _.map(files, (value, name) => __awaiter(this, void 0, void 0, function* () {
                if (typeof value === "function") {
                    yield fs.writeFile(`${dir}/${name}`, value());
                    return;
                }
                this.initPath(`${dir}/${name}`);
                yield this.generateFiles(value, `${dir}/${name}`);
            }));
            yield Promise.all(promises);
        });
    }
}
exports.FilesManager = FilesManager;
//# sourceMappingURL=generate.js.map
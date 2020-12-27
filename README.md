<div align="center">
  <h2>Swagger to TS Network Request Code</h2>
</div>

## 介绍

Inspired by [alibaba/pont](https://github.com/alibaba/pont)

将 Swagger 数据源自动生成为符合 TS 规范的网络请求层代码及相应的类型定义代码.

## 命令

配置
项目根目录的 pont-config.json, 一般只有在初始化和有新的后端服务加入(在配置中的 origins 中增加)的时候才会修改, 示例(CC 项目):

```json
{
  "outDir": "./src/services/auto-gen-api/src",
  "templatePath": "./generate-api-template",
  "originType": "SwaggerV2",
  "prettierConfig": {
    "singleQuote": true,
    "trailingComma": "all",
    "tabWidth": 2,
    "endOfLine": "lf",
    "printWidth": 100,
    "proseWrap": "never"
  },
  "origins": [
    {
      "originType": "SwaggerV2",
      "originUrl": "http://peppa-cc-manage.qa.huohua.cn/v2/api-docs?group=api",
      "name": "customerConsultant",
      "usingMultipleOrigins": true,
      "usingOperationId": true
    },
    {
      "originType": "SwaggerV2",
      "originUrl": "http://cti-manage.qa.huohua.cn/v2/api-docs?group=web",
      "name": "callCenter",
      "usingOperationId": true,
      "usingMultipleOrigins": true
    }
  ]
}
```

初始化

```bash
# 全量拉取配置文件中的数据源, 只会在第一次初始化时使用, 开发迭代过程中禁止使用
yarn initApi
```

Diff 检查远端更新

```bash
# Diff检查远端更新, 按照提示进行交互即可
yarn diff
```

更新接口 Interface(Swagger 中的 paths)

```bash
# 拿到需求后先跟后端约定接口, 等后端接口swagger出来后根据约定更新对应的接口, 按照提示进行交互即可
yarn updatInterface
```

更新模块 Mod(Swagger 中的 Controller 或者 Tags)

```bash
# 如果按约定新增加的是一个模块, 则使用本命令, 按照提示进行交互即可
yarn updatMod
```

更新基类 Bo(Swagger 中的 definitions)

```bash
# 更新完接口后, 去生成的代码进行简单review, 如果发现有未同步的基类, 则使用本命令, 按照提示进行交互即可
yarn updatBo
```

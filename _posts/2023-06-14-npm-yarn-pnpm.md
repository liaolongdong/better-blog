---
layout: post
title: npm、yarn和pnpm包管理工具详解
subtitle: npm、yarn和pnpm包管理工具详解
date: 2023-06-14
categories: 技术
# cover: /assets/img/postCover/gulp_cover.png
tags: npm yarn pnpm node包管理工具
---

# npm、yarn和pnpm包管理工具详解

## npm、yarn和pnpm介绍、用法以及注意事项

在现代的前端开发中，包管理工具扮演着重要的角色，帮助开发者下载、安装、管理和共享模块和软件包。本文将对三个常见的包管理工具进行详细介绍和对比：npm、yarn和pnpm。我们将分别探讨它们的用法、优缺点以及注意事项，以帮助开发者选择适合自己项目的工具。

### 1. npm（Node Package Manager）

#### 1.1 安装和用法

npm是Node.js的默认包管理器，安装好node就默认安装了npm，npm使用广泛且成熟。它提供了简单易用的命令行界面，可以通过以下命令进行常见操作：

- 查看所有命令行帮助提示：`npm help`
- 查看某个命令行帮助提示：`npm install -h`
- 初始化一个新项目：`npm init`
- 安装模块：`npm install <package-name>`
- 全局安装模块：`npm install -g <package-name>`
- 安装特定版本的模块：`npm install <package-name>@<version>`
- 更新模块：`npm update <package-name>`
- 卸载模块：`npm uninstall <package-name>`
- 运行自定义脚本：`npm run <script-name>`
- 发布模块：`npm publish`

#### 1.2 优点

- 强大的生态系统和丰富的模块库。
- 简单易用，与Node.js紧密集成。
- 持续改进和更新，广泛支持和文档资源。

#### 1.3 缺点

- 安装依赖时较慢，特别是在网络较差的情况下。
- 无法并行安装多个依赖项，可能导致安装时间较长。
- `node_modules`目录可能会变得庞大，占用磁盘空间。

#### 1.4 注意事项

- 版本兼容性：确保依赖项的版本兼容性，避免引入不兼容的模块版本。
- 定期更新依赖项：获取最新的功能和安全修复。
- 锁文件管理：使用`package-lock.json`确保依赖项的一致性。

### 2. yarn

#### 2.1 安装和用法

yarn是由Facebook开发的包管理工具，旨在解决npm的一些性能和可靠性问题。

安装

- 打开终端或命令行界面。
- 运行以下命令安装pnpm（如果你还没有安装）：`npm install -g yarn`

用法

它的用法与npm非常相似，可以通过以下命令进行操作：

- 查看所有命令行帮助提示：`yarn help`
- 查看某个命令行帮助提示：`yarn add -h`
- 初始化一个新项目：`yarn init`
- 安装模块：`yarn add <package-name>`
- 全局安装模块：`yarn global add <package-name>`
- 安装特定版本的模块：`yarn add <package-name>@<version>`
- 更新模块：`yarn upgrade <package-name>`
- 卸载模块：`yarn remove <package-name>`
- 运行自定义脚本：`yarn run <script-name>` 或者 `yarn <script-name>`

#### 2.2 优点

- 快速的并行安装和缓存机制，提高安装速度。
- 锁文件机制，确保在不同环境中安装的软件包版本一致。
- 与npm兼容，可以无缝迁移现有的npm项目到Yarn上。

#### 2.3 缺点

- 较大的安装包体积。
- 功能与npm相对较少。

#### 2.4 注意事项

- 注意版本控制和更新依赖项的兼容性。
- 使用锁文件（如`yarn.lock`）确保依赖项的一致性。
- 定期清理Yarn缓存以释放磁盘空间。

### 3. pnpm

#### 3.1 安装和用法

pnpm是一种与npm和yarn不同的包管理工具。它采用符号链接（symlink）来共享依赖项，以节省磁盘空间并提高安装速度。

安装

- 确保你已经安装了Node.js，因为pnpm是基于Node.js的包管理工具。
- 打开终端或命令行界面。
- 运行以下命令安装pnpm（如果你还没有安装）：`npm install -g pnpm`

用法

使用pnpm的命令行接口与npm兼容，可以通过以下命令进行操作：

- 初始化一个新项目：`pnpm init`
- 安装模块：`pnpm install <package-name>`
- 全局安装模块：`pnpm install -g <package-name>`
- 安装特定版本的模块：`pnpm install <package-name>@<version>`
- 更新模块：`pnpm update <package-name>`
- 卸载模块：`pnpm uninstall <package-name>`
- 运行自定义脚本：`pnpm run <script-name>` 或者 `pnpm <script-name>`

#### 3.2 优点

- 快速的并行安装和缓存机制，使用符号链接共享依赖项。
- 节省磁盘空间，避免重复安装相同的依赖项。
- 与npm兼容，可以无缝迁移现有的npm项目到pnpm上。

#### 3.3 缺点

- 相对较新，社区支持和文档资源相对较少。
- 与某些工具和脚本不兼容。

#### 3.4 注意事项

- 需要了解符号链接的工作原理和潜在问题。
- 定期清理pnpm缓存以释放磁盘空间。
- 确保依赖项的兼容性和稳定性。

### 小结

在本章节中，我们详细介绍了npm、Yarn和pnpm这三个常见的包管理工具。它们各自有着不同的用法、优缺点和注意事项。选择适合自己项目的包管理工具需要考虑项目需求、团队约定和个人偏好。npm具有强大的生态系统和广泛支持，Yarn则强调性能和可靠性，而pnpm则注重磁盘空间的节省和安装速度。根据项目的特点和需求，开发者可以灵活选择适合自己的包管理工具，提高开发效率和代码质量。

## 依赖关系类型：`dependencies`、`devDependencies`和`peerDependencies`

当使用npm、yarn或pnpm安装包时，你可以将它们分为三个不同的依赖关系类型：`dependencies`、`devDependencies`和`peerDependencies`。下面将介绍这些依赖关系类型的用法、命令行示例以及它们之间的区别。

### dependencies

`dependencies`是项目的运行时依赖关系，指定了项目在运行时所需的外部模块或库。这些模块通常包含项目的核心功能和必要的依赖项。

安装命令：

- npm：`npm install <package-name>`
- Yarn：`yarn add <package-name>`
- pnpm：`pnpm install <package-name>`

示例：

```bash
npm install lodash
yarn add lodash
pnpm install lodash
```

在`package.json`文件的`dependencies`字段中，将添加被安装模块的名称和版本。

### devDependencies

`devDependencies`是项目的开发时依赖关系，指定了在开发过程中需要的工具、测试框架和辅助库等。这些模块通常不会在项目的最终构建或生产环境中使用。

安装命令：

- npm：`npm install --save-dev <package-name>`
- Yarn：`yarn add --dev <package-name>`
- pnpm：`pnpm install --save-dev <package-name>`

示例：

```bash
npm install --save-dev jest
yarn add --dev jest
pnpm install --save-dev jest
```

在`package.json`文件的`devDependencies`字段中，将添加被安装模块的名称和版本。

### peerDependencies

`peerDependencies`是对其他模块的依赖关系，指定了项目对某个模块的特定版本依赖。这些模块通常与项目代码分离，由项目的使用者在其自己的环境中提供。

安装命令：

- npm：`npm install --peer <package-name>`
- Yarn：`yarn add --peer <package-name>`
- pnpm：`pnpm install --peer <package-name>`

示例：

```bash
npm install --peer vue
yarn add --peer vue
pnpm install --peer vue
```

在`package.json`文件的`peerDependencies`字段中，将添加被安装模块的名称和版本。

### 小结

区别：

- `dependencies`是项目运行时必需的模块，而`devDependencies`和`peerDependencies`是开发时或对其他模块的依赖关系。
- `devDependencies`只在开发过程中使用，不会包含在最终构建或生产环境中。
- `peerDependencies`是对其他模块的依赖关系，需要使用者在其自己的环境中提供。

`dependencies`、`devDependencies`和`peerDependencies`是三种不同的依赖关系类型，用于指定项目所需的运行时模块、开发时工具和对其他模块的依赖关系。通过合理使用这些依赖关系，可以更好地管理项目的依赖项，并确保在不同环境中的一致性和可靠性。

## 深度扩展

在pnpm中，符号链接（symlink）是一种机制，通过它可以在不同项目之间共享依赖项，以节省磁盘空间并提高安装速度。当使用pnpm安装依赖项时，它会在项目的`node_modules/.pnpm`目录中创建符号链接，将依赖项链接到该目录下。

符号链接的工作原理如下：

1. 初始安装：当第一个项目使用pnpm进行安装时，依赖项将被下载并安装在`.pnpm`目录中，并在项目的`node_modules`目录中创建符号链接指向`.pnpm`目录中的依赖项。

2. 共享依赖项：当其他项目需要相同版本的依赖项时，pnpm将会创建符号链接，将依赖项链接到`.pnpm`目录中的已安装依赖项，而不是重复下载和安装。

3. 磁盘空间节省：由于依赖项是通过符号链接共享的，所以每个项目只需存储自己的`package.json`文件和项目特定的依赖项。这样可以大大节省磁盘空间，尤其是当多个项目共享相同的依赖项时。

然而，使用符号链接也可能会带来一些潜在问题：

1. 符号链接冲突：如果两个项目使用了不同版本的依赖项，并且其中一个项目更新了依赖项的版本，可能会导致另一个项目的依赖项出现冲突。因此，需要仔细管理和控制项目的依赖项版本，以避免冲突。

2. 外部干扰：由于符号链接指向共享的依赖项，当一个项目修改了共享依赖项的文件时，可能会影响其他项目。因此，需要小心处理对共享依赖项的修改，以避免潜在的外部干扰。

3. 符号链接失效：在某些情况下，如删除或移动符号链接目标，或者手动修改符号链接目标的文件，可能会导致符号链接失效。这可能会导致依赖项无法正确链接或加载，需要重新安装依赖项以修复符号链接。

要避免这些潜在问题，使用pnpm时需要遵循一些最佳实践：

- 注意控制和管理项目的依赖项版本，避免冲突。
- 尽量避免直接修改共享依赖项的文件，以避免外部干扰。
- 确保符号链接的目标文件保持有效和完整，不要手动修改或删除符号链接的目标。

小结：

pnpm通过符号链接机制共享依赖项，节省磁盘空间并提高安装速度。然而，符号链接可能导致依赖项冲突、外部干扰和符号链接失效等潜在问题。使用pnpm时需要小心管理依赖项版本、避免直接修改共享依赖项文件，并确保符号链接的目标文件保持有效和完整。

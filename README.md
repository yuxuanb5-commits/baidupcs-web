# BaiduPCS-Go Web 管理器

一个优雅的 Web 界面，为 BaiduPCS-Go 命令行工具提供现代化的图形界面操作体验。

![BaiduPCS-Go Web Manager](screenshot.png)

## ✨ 特性

- 🎯 **一键操作** - 点击即可下载，无需记忆复杂命令
- 🎨 **现代化界面** - 直观美观的 Material Design 风格
- 📁 **完整文件管理** - 浏览、下载、删除、新建文件夹
- 🔄 **实时进度** - 下载进度实时显示
- 📊 **容量监控** - 实时显示网盘使用情况
- 🔐 **安全登录** - 基于 BDUSS 的便捷登录
- 📱 **响应式设计** - 完美适配桌面和移动端
- ⚡ **轻量快速** - Node.js + WebSocket 实时通信

## 🛠️ 技术栈

- **前端**: HTML5, CSS3, JavaScript (原生)
- **后端**: Node.js, Express, WebSocket
- **命令行**: BaiduPCS-Go
- **通信**: WebSocket 实时双向通信

## 🚀 快速开始

### 前置要求
1. 安装 [BaiduPCS-Go](https://github.com/qjfoidnh/BaiduPCS-Go)
2. 安装 Node.js (v14+)

### 安装步骤
bash
1. 下载该项目zip并解压
https://github.com/yuxuanb5-commits/baidupcs-web
（点击绿色的code按钮，其中的zip选项点击下载）解压缩到任意你喜欢的位置
3. 安装依赖
npm install（安装到你的项目文件位置）
4. 配置 BaiduPCS-Go 路径
编辑 node_backend.js，修改 PCS_PATH 为您的 baidupcs-go 路径
5. 启动服务
node node_backend.js
6. 打开浏览器访问
http://localhost:3000
### 获取 BDUSS
1. 登录百度网盘网页版
2. 按 F12 打开开发者工具
3. 进入 Application/Storage → Cookies
4. 找到 `https://pan.baidu.com` 下的 `BDUSS` 字段并复制

## 📖 使用指南

1. **登录** - 在 Web 界面粘贴 BDUSS
2. **浏览** - 点击文件夹进入，点击文件下载
3. **下载** - 文件自动保存到 `~/Downloads/baidupcs-web/`
4. **管理** - 支持新建文件夹、删除文件
5. **监控** - 实时显示网盘容量使用情况

## 🎯 核心功能

- ✅ 文件列表浏览
- ✅ 文件下载（支持进度显示）
- ✅ 文件夹导航
- ✅ 新建文件夹
- ✅ 删除文件/文件夹
- ✅ 容量信息显示
- ✅ 用户信息显示
- ✅ 操作日志记录
- ✅ 面包屑导航

## 🔧 配置说明

### 下载目录
默认下载目录：`~/Downloads/baidupcs-web/`
可在 `node_backend.js` 中修改 `DOWNLOAD_DIR`

### 端口配置
默认端口：3000
修改 `node_backend.js` 中的 `PORT` 变量

## 📁 项目结构
baidupcs-web/
├── node_backend.js # 后端服务
├── index.html # 前端界面
├── package.json # 项目配置
└── README.md # 说明文档

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 🙏 致谢

- [BaiduPCS-Go](https://github.com/qjfoidnh/BaiduPCS-Go) - 强大的百度网盘命令行工具
- DeepSeek - 提供 AI 编程协助，让代码如诗般优雅
- 所有贡献者和用户

## 📄 许可证

MIT License - 详见 LICENSE 文件

## ⭐ 如果这个项目对您有帮助

请给项目点个 Star！这是对我们最大的鼓励！

---

**Made with ❤️ for the BaiduPCS-Go community**

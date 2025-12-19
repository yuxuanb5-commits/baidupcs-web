// node_backend.js - 完整版本
const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 配置
const PORT = 3000;
const PCS_PATH = '/usr/bin/baidupcs'; // 修改为您的路径
const DOWNLOAD_DIR = process.env.HOME + '/Downloads/baidupcs-web'; // 下载目录

// 创建下载目录
if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 存储WebSocket连接
const clients = new Set();

// WebSocket连接处理
wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('新的WebSocket连接已建立');
    
    ws.send(JSON.stringify({
        type: 'status',
        message: '已连接到BaiduPCS-Go管理后端'
    }));

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            await handleCommand(ws, data);
        } catch (error) {
            console.error('处理消息错误:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: '消息格式错误'
            }));
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log('WebSocket连接已关闭');
    });
});

// 处理命令
async function handleCommand(ws, data) {
    const { command, args, requestId } = data;
    
    console.log(`处理命令: ${command}`, args);
    
    try {
        switch(command) {
            case 'login':
                await handleLogin(ws, args.bduss, requestId);
                break;
            case 'ls':
                await handleListFiles(ws, args.path, requestId);
                break;
            case 'download':
                await handleDownload(ws, args.path, args.filename, requestId);
                break;
            case 'mkdir':
                await handleMkdir(ws, args.path, requestId);
                break;
            case 'rm':
                await handleDelete(ws, args.path, requestId);
                break;
            case 'quota':
                await handleQuota(ws, requestId);
                break;
            case 'mv':
                await handleMove(ws, args.from, args.to, requestId);
                break;
            case 'cp':
                await handleCopy(ws, args.from, args.to, requestId);
                break;
            case 'who':
                await handleWho(ws, requestId);
                break;
            default:
                ws.send(JSON.stringify({
                    type: 'error',
                    message: '未知命令: ' + command,
                    requestId
                }));
        }
    } catch (error) {
        ws.send(JSON.stringify({
            type: 'error',
            message: error.message,
            requestId
        }));
    }
}

// 登录处理
async function handleLogin(ws, bduss, requestId) {
    return new Promise((resolve, reject) => {
        const loginCmd = spawn(PCS_PATH, ['login', '-bduss', bduss]);
        let output = '';
        let errorOutput = '';
        
        loginCmd.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        loginCmd.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        loginCmd.on('close', (code) => {
            if (code === 0) {
                ws.send(JSON.stringify({
                    type: 'login_success',
                    message: '登录成功',
                    requestId
                }));
                resolve();
            } else {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: `登录失败: ${errorOutput || '未知错误'}`,
                    requestId
                }));
                reject(new Error(errorOutput || '登录失败'));
            }
        });
    });
}

// 列出文件
async function handleListFiles(ws, remotePath, requestId) {
    return new Promise((resolve, reject) => {
        const args = ['ls', remotePath || '/'];
        const pcs = spawn(PCS_PATH, args);
        
        let output = '';
        let errorOutput = '';
        
        pcs.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        pcs.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        pcs.on('close', (code) => {
            if (code === 0) {
                try {
                    const files = parseLsOutput(output, remotePath || '/');
                    
                    ws.send(JSON.stringify({
                        type: 'file_list',
                        data: files,
                        path: remotePath || '/',
                        requestId
                    }));
                    resolve();
                } catch (error) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: '解析文件列表失败: ' + error.message,
                        requestId
                    }));
                    reject(error);
                }
            } else {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: `获取文件列表失败: ${errorOutput || '未知错误'}`,
                    requestId
                }));
                reject(new Error(errorOutput || '获取文件列表失败'));
            }
        });
    });
}

// 解析ls输出
function parseLsOutput(text, currentPath) {
    const lines = text.split('\n');
    const files = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // 跳过非数据行
        if (!line || 
            line.startsWith('当前目录:') ||
            line.startsWith('----') ||
            line.includes('文件大小') ||
            line.includes('总:')) {
            continue;
        }
        
        // 匹配数据行
        if (line.match(/^\s*\d+\s+/)) {
            const dataLine = line.replace(/^\s*\d+\s+/, '');
            const parts = dataLine.split(/\s+/);
            
            if (parts.length >= 4) {
                const size = parts[0];
                const date = parts[1];
                const time = parts[2];
                const nameWithSlash = parts.slice(3).join(' ');
                const name = nameWithSlash.endsWith('/') ? 
                    nameWithSlash.slice(0, -1) : nameWithSlash;
                const isDir = nameWithSlash.endsWith('/');
                const modified = `${date} ${time}`;
                
                files.push({
                    name: name,
                    is_dir: isDir,
                    isDir: isDir,
                    size_str: size === '-' ? '-' : size,
                    modified_time: modified,
                    path: currentPath === '/' ? `/${name}` : `${currentPath}/${name}`
                });
            }
        }
    }
    
    return files;
}

// 下载文件 - 改进版
async function handleDownload(ws, filePath, filename, requestId) {
    return new Promise((resolve, reject) => {
        // 生成本地保存路径
        const localFilename = filename || path.basename(filePath);
        const localPath = path.join(DOWNLOAD_DIR, localFilename);
        
        console.log(`开始下载: ${filePath} -> ${localPath}`);
        
        // 发送开始下载消息
        ws.send(JSON.stringify({
            type: 'download_start',
            filename: localFilename,
            requestId
        }));
        
        const downloadCmd = spawn(PCS_PATH, ['download', '--retry', '3', filePath, '--save', localPath]);
        
        let lastProgress = 0;
        let lastTotalSize = null;
        
        downloadCmd.stdout.on('data', (data) => {
            const text = data.toString();
            console.log('下载输出:', text); // 调试用
            
            // 解析下载进度
            const progressData = parseDownloadProgress(text);
            
            if (progressData) {
                // 如果获取到总大小，更新lastTotalSize
                if (progressData.totalSize) {
                    lastTotalSize = progressData.totalSize;
                }
                
                // 计算进度百分比
                let percent = 0;
                if (progressData.currentSize && lastTotalSize) {
                    // 转换为字节计算
                    const currentBytes = convertToBytes(progressData.currentSize);
                    const totalBytes = convertToBytes(lastTotalSize);
                    
                    if (totalBytes > 0) {
                        percent = Math.round((currentBytes / totalBytes) * 100);
                        // 确保百分比不倒退
                        if (percent > lastProgress) {
                            lastProgress = percent;
                        } else {
                            percent = lastProgress;
                        }
                    }
                } else if (progressData.percent) {
                    percent = progressData.percent;
                }
                
                // 发送进度更新
                ws.send(JSON.stringify({
                    type: 'download_progress',
                    progress: percent,
                    current: progressData.currentSize || '',
                    total: progressData.totalSize || '',
                    speed: progressData.speed || '',
                    remaining: progressData.remaining || '',
                    requestId
                }));
            }
        });
        
        downloadCmd.stderr.on('data', (data) => {
            console.error('下载错误:', data.toString());
        });
        
        downloadCmd.on('close', (code) => {
            if (code === 0) {
                ws.send(JSON.stringify({
                    type: 'download_complete',
                    message: '下载完成',
                    localPath: localPath,
                    requestId
                }));
                resolve();
            } else {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: '下载失败，请检查控制台日志',
                    requestId
                }));
                reject(new Error('下载失败'));
            }
        });
    });
}

// 解析下载进度输出
function parseDownloadProgress(text) {
    const lines = text.split('\n');
    
    for (const line of lines) {
        // 匹配格式: ↓ 512.00KB/5.27GB 56.56KB/s in 6s, left 27h7m58s
        const progressMatch = line.match(/↓\s*([\d.]+)([KMGT]?B)\/([\d.]+)([KMGT]?B)\s+([\d.]+)([KMGT]?B\/s).*left\s+([\dhm]+)/);
        
        if (progressMatch) {
            return {
                currentSize: progressMatch[1] + progressMatch[2],
                totalSize: progressMatch[3] + progressMatch[4],
                speed: progressMatch[5] + progressMatch[6],
                remaining: progressMatch[7]
            };
        }
        
        // 匹配格式: [1] ↓ 512.00KB/5.27GB 56.56KB/s in 6s, left 27h7m58s
        const progressMatch2 = line.match(/\[\d+\]\s+↓\s*([\d.]+)([KMGT]?B)\/([\d.]+)([KMGT]?B)\s+([\d.]+)([KMGT]?B\/s)/);
        
        if (progressMatch2) {
            return {
                currentSize: progressMatch2[1] + progressMatch2[2],
                totalSize: progressMatch2[3] + progressMatch2[4],
                speed: progressMatch2[5] + progressMatch2[6]
            };
        }
        
        // 匹配百分比格式: [50%] 或 50%
        const percentMatch = line.match(/(\d+)%/);
        if (percentMatch) {
            return {
                percent: parseInt(percentMatch[1])
            };
        }
        
        // 匹配简单进度: 512.00KB/5.27GB
        const simpleMatch = line.match(/([\d.]+)([KMGT]?B)\/([\d.]+)([KMGT]?B)/);
        if (simpleMatch) {
            return {
                currentSize: simpleMatch[1] + simpleMatch[2],
                totalSize: simpleMatch[3] + simpleMatch[4]
            };
        }
    }
    
    return null;
}

// 转换为字节
function convertToBytes(sizeStr) {
    if (!sizeStr) return 0;
    
    const match = sizeStr.match(/([\d.]+)([KMGT]?B)/i);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    switch(unit) {
        case 'TB': return value * 1024 * 1024 * 1024 * 1024;
        case 'GB': return value * 1024 * 1024 * 1024;
        case 'MB': return value * 1024 * 1024;
        case 'KB': return value * 1024;
        case 'B': return value;
        default: return value;
    }
}

// 创建目录
async function handleMkdir(ws, dirPath, requestId) {
    return new Promise((resolve, reject) => {
        const mkdirCmd = spawn(PCS_PATH, ['mkdir', dirPath]);
        let output = '';
        let errorOutput = '';
        
        mkdirCmd.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        mkdirCmd.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        mkdirCmd.on('close', (code) => {
            if (code === 0) {
                ws.send(JSON.stringify({
                    type: 'mkdir_success',
                    message: '目录创建成功: ' + output.trim(),
                    requestId
                }));
                resolve();
            } else {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: `创建目录失败: ${errorOutput || '未知错误'}`,
                    requestId
                }));
                reject(new Error(errorOutput || '创建目录失败'));
            }
        });
    });
}

// 删除文件/目录
async function handleDelete(ws, itemPath, requestId) {
    return new Promise((resolve, reject) => {
        const rmCmd = spawn(PCS_PATH, ['rm', itemPath]);
        let output = '';
        let errorOutput = '';
        
        rmCmd.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        rmCmd.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        rmCmd.on('close', (code) => {
            if (code === 0) {
                ws.send(JSON.stringify({
                    type: 'delete_success',
                    message: '删除成功: ' + output.trim(),
                    requestId
                }));
                resolve();
            } else {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: `删除失败: ${errorOutput || '未知错误'}`,
                    requestId
                }));
                reject(new Error(errorOutput || '删除失败'));
            }
        });
    });
}

// 获取容量信息
async function handleQuota(ws, requestId) {
    return new Promise((resolve, reject) => {
        const quotaCmd = spawn(PCS_PATH, ['quota']);
        let output = '';
        let errorOutput = '';
        
        quotaCmd.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        quotaCmd.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        quotaCmd.on('close', (code) => {
            if (code === 0) {
                // 解析quota输出
                const quota = parseQuotaOutput(output);
                ws.send(JSON.stringify({
                    type: 'quota_info',
                    data: quota,
                    requestId
                }));
                resolve();
            } else {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: `获取容量信息失败: ${errorOutput || '未知错误'}`,
                    requestId
                }));
                reject(new Error(errorOutput || '获取容量信息失败'));
            }
        });
    });
}

// 解析quota输出
function parseQuotaOutput(text) {
    const lines = text.split('\n');
    const quota = {};
    
    lines.forEach(line => {
        if (line.includes('总空间') && line.includes('已用空间')) {
            const match = line.match(/总空间:\s*([\d.]+)(GB),\s*已用空间:\s*([\d.]+)(GB),\s*比率:\s*([\d.]+)%/);
            if (match) {
                quota.total = match[1] + match[2];
                quota.used = match[3] + match[4];
                quota.percent = match[5];
            }
        }
    });
    
    return quota;
}

// 移动文件/目录
async function handleMove(ws, fromPath, toPath, requestId) {
    return new Promise((resolve, reject) => {
        const mvCmd = spawn(PCS_PATH, ['mv', fromPath, toPath]);
        let output = '';
        let errorOutput = '';
        
        mvCmd.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        mvCmd.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        mvCmd.on('close', (code) => {
            if (code === 0) {
                ws.send(JSON.stringify({
                    type: 'move_success',
                    message: '移动成功: ' + output.trim(),
                    requestId
                }));
                resolve();
            } else {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: `移动失败: ${errorOutput || '未知错误'}`,
                    requestId
                }));
                reject(new Error(errorOutput || '移动失败'));
            }
        });
    });
}

// 复制文件/目录
async function handleCopy(ws, fromPath, toPath, requestId) {
    return new Promise((resolve, reject) => {
        const cpCmd = spawn(PCS_PATH, ['cp', fromPath, toPath]);
        let output = '';
        let errorOutput = '';
        
        cpCmd.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        cpCmd.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        cpCmd.on('close', (code) => {
            if (code === 0) {
                ws.send(JSON.stringify({
                    type: 'copy_success',
                    message: '复制成功: ' + output.trim(),
                    requestId
                }));
                resolve();
            } else {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: `复制失败: ${errorOutput || '未知错误'}`,
                    requestId
                }));
                reject(new Error(errorOutput || '复制失败'));
            }
        });
    });
}

// 获取用户信息
async function handleWho(ws, requestId) {
    return new Promise((resolve, reject) => {
        const whoCmd = spawn(PCS_PATH, ['who']);
        let output = '';
        let errorOutput = '';
        
        whoCmd.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        whoCmd.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        whoCmd.on('close', (code) => {
            if (code === 0) {
                ws.send(JSON.stringify({
                    type: 'who_info',
                    data: parseWhoOutput(output),
                    requestId
                }));
                resolve();
            } else {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: `获取用户信息失败: ${errorOutput || '未知错误'}`,
                    requestId
                }));
                reject(new Error(errorOutput || '获取用户信息失败'));
            }
        });
    });
}

// 解析who输出
function parseWhoOutput(text) {
    const lines = text.split('\n');
    const info = {};
    
    lines.forEach(line => {
        if (line.includes('用户名:')) {
            const match = line.match(/用户名:\s*([^,]+)/);
            if (match) info.username = match[1].trim();
        }
        if (line.includes('uid:')) {
            const match = line.match(/uid:\s*(\d+)/);
            if (match) info.uid = match[1];
        }
    });
    
    return info;
}

// 静态文件服务
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 启动服务器
server.listen(PORT, () => {
    console.log(`BaiduPCS-Go Web管理端已启动`);
    console.log(`服务地址: http://localhost:${PORT}`);
    console.log(`WebSocket地址: ws://localhost:${PORT}`);
    console.log(`下载目录: ${DOWNLOAD_DIR}`);
    console.log(`请确保baidupcs-go已正确安装并在PATH中`);
});

// 清理
process.on('SIGINT', () => {
    console.log('\n正在关闭服务...');
    process.exit(0);
});
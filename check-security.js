#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname;

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

function log(color, message) {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFilePermissions() {
    log('cyan', '\n🔒 检查文件权限...');
    
    const sensitiveFiles = [
        '.env',
        'config.yml',
        'scbackend.db',
        'plugins.db'
    ];
    
    let hasIssues = false;
    
    sensitiveFiles.forEach(fileName => {
        const filePath = path.join(rootDir, fileName);
        if (fs.existsSync(filePath)) {
            try {
                const stats = fs.statSync(filePath);
                const mode = stats.mode.toString(8);
                // 检查权限是否过宽（不是 600 或 400）
                if (mode.slice(-3) !== '600' && mode.slice(-3) !== '400') {
                    log('yellow', `⚠️  文件 ${fileName} 权限过宽: ${mode.slice(-3)}`);
                    hasIssues = true;
                }
            } catch (error) {
                log('yellow', `⚠️  无法检查文件 ${fileName} 的权限`);
            }
        }
    });
    
    if (!hasIssues) {
        log('green', '✅ 文件权限检查通过');
    }
}

function checkEnvFile() {
    log('cyan', '\n🌍 检查环境变量文件...');
    
    const envExample = path.join(rootDir, '.env.example');
    const envFile = path.join(rootDir, '.env');
    
    if (!fs.existsSync(envExample)) {
        log('red', '❌ .env.example 文件不存在');
        return;
    }
    
    if (!fs.existsSync(envFile)) {
        log('yellow', '⚠️  .env 文件不存在，请从 .env.example 创建');
    } else {
        try {
            const envContent = fs.readFileSync(envFile, 'utf8');
            
            // 检查是否使用了默认密码
            if (envContent.includes('change_this_strong_password') || 
                envContent.includes('your_mysql_password') ||
                envContent.includes('your_plugins_db_password')) {
                log('red', '❌ 检测到默认密码，请修改 .env 文件中的密码');
            } else {
                log('green', '✅ 环境变量文件检查通过');
            }
        } catch (error) {
            log('yellow', `⚠️  无法读取环境变量文件: ${error.message}`);
        }
    }
}

function checkDependencies() {
    log('cyan', '\n📦 检查依赖安全...');
    
    try {
        log('blue', '正在检查过时的依赖...');
        execSync('npm outdated', { cwd: rootDir, stdio: 'inherit' });
    } catch (error) {
        // npm outdated 在有过期依赖时会返回非零退出码
        log('yellow', '⚠️  有过期的依赖，建议更新');
    }
    
    try {
        log('blue', '\n正在检查安全漏洞...');
        const auditResult = execSync('npm audit --json', { cwd: rootDir }).toString();
        const auditData = JSON.parse(auditResult);
        
        if (auditData.metadata && auditData.metadata.vulnerabilities) {
            const vulns = auditData.metadata.vulnerabilities;
            const critical = vulns.critical || 0;
            const high = vulns.high || 0;
            
            if (critical > 0 || high > 0) {
                log('red', `❌ 发现 ${critical} 个严重漏洞和 ${high} 个高危漏洞`);
                log('yellow', '运行 npm audit fix 尝试修复');
            } else {
                log('green', '✅ 依赖安全检查通过');
            }
        }
    } catch (error) {
        log('yellow', '⚠️  无法检查依赖安全漏洞');
    }
}

function checkCodeSecurity() {
    log('cyan', '\n🔍 检查代码安全问题...');
    
    const issues = [];
    
    // 检查硬编码密码
    const filesToCheck = [
        'src/index.js',
        'src/server.js',
        'src/config.js',
        'src/database.js'
    ];
    
    filesToCheck.forEach(file => {
        const filePath = path.join(rootDir, file);
        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                
                // 检查硬编码密码
                if (content.includes('password') && content.includes('"scbackend"')) {
                    issues.push(`⚠️  ${file}: 可能包含硬编码密码`);
                }
                
                // 检查路径遍历漏洞
                if (content.includes('path.resolve') && content.includes('req.params')) {
                    if (!content.includes('path.normalize') || !content.includes('startsWith')) {
                        issues.push(`⚠️  ${file}: 可能缺少路径遍历防护`);
                    }
                }
                
                // 检查SQL注入风险
                if (content.includes('query(') && content.includes('+')) {
                    if (!content.includes('?') || !content.includes('params')) {
                        issues.push(`⚠️  ${file}: 可能缺少参数化查询`);
                    }
                }
            } catch (error) {
                log('yellow', `⚠️  无法读取文件 ${file}: ${error.message}`);
            }
        }
    });
    
    if (issues.length > 0) {
        issues.forEach(issue => log('yellow', issue));
    } else {
        log('green', '✅ 代码安全检查通过');
    }
}

function checkConfigFiles() {
    log('cyan', '\n⚙️  检查配置文件...');
    
    const configFile = path.join(rootDir, 'config.yml');
    if (fs.existsSync(configFile)) {
        try {
            const content = fs.readFileSync(configFile, 'utf8');
            if (content.includes('password: scbackend') || content.includes('password: ""')) {
                log('red', '❌ config.yml 中包含默认或空密码');
            } else {
                log('green', '✅ 配置文件检查通过');
            }
        } catch (error) {
            log('yellow', '⚠️  无法读取配置文件');
        }
    } else {
        log('blue', 'ℹ️  未找到 config.yml 文件');
    }
}

function main() {
    log('magenta', '========================================');
    log('magenta', '      ScBackend 安全审计工具');
    log('magenta', '========================================\n');
    
    log('white', `工作目录: ${rootDir}`);
    log('white', `时间: ${new Date().toLocaleString()}\n`);
    
    try {
        checkFilePermissions();
        checkEnvFile();
        checkDependencies();
        checkCodeSecurity();
        checkConfigFiles();
        
        log('magenta', '\n========================================');
        log('green', '✅ 安全检查完成');
        log('magenta', '========================================\n');
        
        log('white', '建议操作:');
        log('white', '1. 定期运行此检查脚本');
        log('white', '2. 及时更新依赖');
        log('white', '3. 使用强密码并定期更换');
        log('white', '4. 配置适当的文件权限');
        log('white', '5. 在生产环境使用HTTPS');
        
    } catch (error) {
        log('red', `❌ 安全检查失败: ${error.message}`);
        process.exit(1);
    }
}

// 运行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export {
    checkFilePermissions,
    checkEnvFile,
    checkDependencies,
    checkCodeSecurity,
    checkConfigFiles
};
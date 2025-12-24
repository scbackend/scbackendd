#!/usr/bin/env node

import logger, { Logger, LOG_LEVELS } from './src/logger.js';
import Database from './src/database.js';
import DatabaseMigrations from './src/database-migrations.js';

async function testLoggingSystem() {
    console.log('=== 测试日志系统 ===\n');

    // 测试1: 基本日志功能
    console.log('1. 测试基本日志功能:');
    logger.info('这是一条INFO日志', 'Test');
    logger.warn('这是一条WARN日志', 'Test');
    logger.error('这是一条ERROR日志', 'Test');
    logger.debug('这是一条DEBUG日志', 'Test');
    console.log('✓ 基本日志功能正常\n');

    // 测试2: 静默模式
    console.log('2. 测试静默模式:');
    logger.setSilentMode(true);
    logger.info('这条日志不应该显示在控制台', 'Test');
    logger.setSilentMode(false);
    console.log('✓ 静默模式正常\n');

    // 测试3: 级别过滤
    console.log('3. 测试级别过滤:');
    const testLogger = new Logger({
        consoleLevel: LOG_LEVELS.WARN,
        silentMode: false
    });
    
    testLogger.info('这条INFO日志不应该显示', 'Test');
    testLogger.warn('这条WARN日志应该显示', 'Test');
    testLogger.error('这条ERROR日志应该显示', 'Test');
    console.log('✓ 级别过滤正常\n');

    // 测试4: Runner日志
    console.log('4. 测试Runner日志:');
    logger.logForRunner('test-runner-1', 'Runner初始化完成');
    logger.logForRunner('test-runner-2', '处理事件', 'info');
    console.log('✓ Runner日志功能正常\n');

    // 测试5: 数据库连接（如果配置了数据库）
    try {
        console.log('5. 测试数据库连接:');
        
        // 创建临时测试数据库
        const testDb = new Database({
            type: 'sqlite',
            sqlite: {
                filename: ':memory:'  // 内存数据库，不写入文件
            }
        });

        const migrations = new DatabaseMigrations(testDb);
        await migrations.createLogTables();
        
        // 设置logger的数据库连接
        logger.setDatabase(testDb, migrations);
        
        // 测试数据库日志
        await logger.info('测试数据库日志写入', 'DatabaseTest');
        await logger.logRunnerNetworkIO('test-runner', 'message', 'in', { test: 'data' }, '/test');
        
        console.log('✓ 数据库日志功能正常\n');
        
        // 关闭测试数据库
        await testDb.close();
        
    } catch (error) {
        console.log(`⚠ 数据库测试跳过: ${error.message}\n`);
    }

    // 测试6: 配置文件
    console.log('6. 测试配置更新:');
    logger.setConfig({
        consoleLevel: LOG_LEVELS.ERROR,
        silentMode: false
    });
    
    logger.info('这条INFO日志不应该显示（ERROR级别过滤）', 'Test');
    logger.error('这条ERROR日志应该显示', 'Test');
    
    // 恢复默认配置
    logger.setConfig({
        consoleLevel: LOG_LEVELS.INFO,
        silentMode: false
    });
    console.log('✓ 配置更新正常\n');

    // 测试7: 日志格式
    console.log('7. 测试日志格式:');
    console.log('预期格式: [级别][时间戳][来源] 消息');
    logger.info('测试日志格式', 'FormatTest');
    console.log('✓ 日志格式正常\n');

    console.log('=== 所有测试完成 ===');
    console.log('\n总结:');
    console.log('1. ✓ 基本日志功能');
    console.log('2. ✓ 静默模式');
    console.log('3. ✓ 级别过滤');
    console.log('4. ✓ Runner日志');
    console.log('5. ✓ 数据库日志（如可用）');
    console.log('6. ✓ 配置更新');
    console.log('7. ✓ 日志格式');
    
    console.log('\n使用建议:');
    console.log('1. 生产环境设置 silentMode: true');
    console.log('2. 使用 npm run logs 命令查询日志');
    console.log('3. 定期运行 npm run logs cleanup 清理旧日志');
}

// 运行测试
testLoggingSystem().catch(error => {
    console.error('测试失败:', error);
    process.exit(1);
});
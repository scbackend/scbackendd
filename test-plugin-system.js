// 测试插件系统
import PluginManager from './src/plugin.js';
import Manager from './src/manager.js';
import Service from './src/service.js';
import Projects from './src/projects.js';
import Config from './src/config.js';
import logger from './src/logger.js';

async function testPluginSystem() {
  console.log('=== 测试插件系统 ===\n');
  
  try {
    // 创建模拟的manager和service
    const config = new Config('./rundir/config.yml', 'yaml', {});
    const projects = new Projects(config.get('database'));
    
    // 模拟manager
    const mockManager = {
      runners: {},
      eventbinding: {},
      registeredExts: [],
      
      addEventListener: function(event, callback) {
        if (!this.eventbinding[event]) {
          this.eventbinding[event] = [];
        }
        this.eventbinding[event].push(callback);
        console.log(`事件监听器已添加: ${event}`);
      },
      
      triggerRunnerEvent: function(runnerId, event, data, callback, field) {
        console.log(`触发Runner事件: ${runnerId} - ${event}`, data);
      },
      
      registerExtension: function(ext) {
        this.registeredExts.push(ext);
        console.log(`扩展已注册: ${ext.getInfo ? ext.getInfo().id : 'unknown'}`);
      },
      
      getRunner: function(runnerId) {
        return this.runners[runnerId];
      },
      
      getAllRunners: function() {
        return { ...this.runners };
      },
      
      getRunnerStatus: function(runnerId) {
        return this.runners[runnerId] ? { status: 'running' } : { status: 'not_found' };
      },
      
      getAllRunnersStatus: function() {
        const statuses = {};
        for (const id in this.runners) {
          statuses[id] = { status: 'running' };
        }
        return statuses;
      }
    };
    
    // 模拟service
    const mockService = {
      port: 3031,
      mappings: new Map(),
      
      sendToSession: function(sessionId, message) {
        console.log(`发送消息到会话 ${sessionId}:`, message);
      },
      
      kickSession: function(sessionId, reason) {
        console.log(`踢出会话 ${sessionId}: ${reason}`);
      }
    };
    
    // 创建插件管理器
    console.log('创建插件管理器...');
    const pluginManager = new PluginManager(mockManager, mockService, config.get('plugins'));
    
    // 等待插件加载完成
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 测试插件列表
    console.log('\n=== 测试插件列表 ===');
    const plugins = pluginManager.listPlugins();
    console.log(`找到 ${plugins.length} 个插件:`);
    plugins.forEach(plugin => {
      console.log(`  - ${plugin.name} (${plugin.id}): ${plugin.enabled ? '已启用' : '已禁用'}`);
    });
    
    // 测试插件信息
    if (plugins.length > 0) {
      console.log('\n=== 测试插件信息 ===');
      const pluginId = plugins[0].id;
      const info = pluginManager.getPluginInfo(pluginId);
      console.log(`插件 ${pluginId} 的信息:`, JSON.stringify(info, null, 2));
    }
    
    // 测试插件启用/禁用
    console.log('\n=== 测试插件管理 ===');
    if (plugins.length > 0) {
      const pluginId = plugins[0].id;
      
      // 测试禁用插件
      try {
        pluginManager.disablePlugin(pluginId);
        console.log(`插件 ${pluginId} 已禁用`);
      } catch (error) {
        console.log(`禁用插件失败: ${error.message}`);
      }
      
      // 测试启用插件
      try {
        pluginManager.enablePlugin(pluginId, ['runner1', 'runner2']);
        console.log(`插件 ${pluginId} 已启用，应用于 runner1, runner2`);
      } catch (error) {
        console.log(`启用插件失败: ${error.message}`);
      }
      
      // 测试为特定runner启用插件
      try {
        pluginManager.enableForRunner(pluginId, 'runner3');
        console.log(`插件 ${pluginId} 已为 runner3 启用`);
      } catch (error) {
        console.log(`为runner启用插件失败: ${error.message}`);
      }
    }
    
    // 测试获取runner的插件
    console.log('\n=== 测试Runner插件 ===');
    const runnerPlugins = pluginManager.getPluginsForRunner('runner1');
    console.log(`runner1 的插件:`, runnerPlugins);
    
    console.log('\n=== 插件系统测试完成 ===');
    
  } catch (error) {
    console.error('测试失败:', error);
    console.error(error.stack);
  }
}

// 运行测试
testPluginSystem();
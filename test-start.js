// 简化的启动测试
import main from './src/index.js';

console.log('启动服务器测试...');
console.log('当前工作目录:', process.cwd());

// 设置环境变量
process.env.NODE_ENV = 'test';

// 运行主函数
try {
  main('./rundir');
  console.log('服务器启动成功！');
  
  // 10秒后自动关闭
  setTimeout(() => {
    console.log('测试完成，退出...');
    process.exit(0);
  }, 10000);
  
} catch (error) {
  console.error('启动失败:', error);
  console.error(error.stack);
  process.exit(1);
}
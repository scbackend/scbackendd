import { unlinkSync } from 'fs';

try {
  unlinkSync('test-plugin-system.js');
  console.log('Deleted test-plugin-system.js');
} catch (e) {
  // 文件可能不存在
}

try {
  unlinkSync('test-start.js');
  console.log('Deleted test-start.js');
} catch (e) {
  // 文件可能不存在
}

try {
  unlinkSync('cleanup-test.js');
  console.log('Deleted cleanup-test.js');
} catch (e) {
  // 忽略错误
}
const { readFileSync, writeFileSync } = require('fs');
const { obfuscate } = require('javascript-obfuscator');

const inputPath = 'dist/scbackendd.cjs';
const outputPath = 'dist/scbackendd_obfuscate.cjs';

const code = readFileSync(inputPath, 'utf8');

const obfuscatedCode = obfuscate(code, {
  "compact": true,
  "controlFlowFlattening": false,
  "deadCodeInjection": false,
  "debugProtection": false,
  "debugProtectionInterval": 0,
  "disableConsoleOutput": false,
  "identifierNamesGenerator": "hexadecimal",
  "log": false,
  "renameGlobals": false,
  "selfDefending": false,
  "simplify": true,
  "splitStrings": false,
  "stringArray": true,
  "stringArrayEncoding": ['base64'],
  "stringArrayThreshold": 0.75,
  "transformObjectKeys": false,
  "unicodeEscapeSequence": false
}
).getObfuscatedCode();

writeFileSync(outputPath, obfuscatedCode, 'utf8');

console.log('build success');
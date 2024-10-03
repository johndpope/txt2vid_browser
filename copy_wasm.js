const fs = require('fs-extra');
const path = require('path');

const sourceDir = path.resolve(__dirname, 'node_modules/onnxruntime-web/dist');
const targetDir = path.resolve(__dirname, 'dist');

fs.readdirSync(sourceDir).forEach(file => {
  if (file.endsWith('.wasm')) {
    fs.copySync(path.join(sourceDir, file), path.join(targetDir, file));
  }
});

console.log('WASM files copied successfully to root of dist');
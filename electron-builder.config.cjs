const path = require('node:path');

module.exports = {
  appId: 'local.chatgpt.webapp.linux',
  productName: 'ChatGPT WebApp',
  electronVersion: '42.3.0',
  npmRebuild: false,
  directories: {
    output: path.join(__dirname, 'release'),
  },
  files: [
    'dist/**/*',
    'assets/**/*',
    'package.json',
  ],
  linux: {
    category: 'Network',
    maintainer: 'Local Desktop App <local@example.invalid>',
    target: [
      'AppImage',
      'deb',
    ],
    icon: 'assets/icons',
  },
  deb: {
    recommends: [],
  },
};

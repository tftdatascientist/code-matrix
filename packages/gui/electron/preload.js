const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('matrixGui', {
  platform: process.platform,
});

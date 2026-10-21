'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('planetDesktop', {
  updateRegions: regions => ipcRenderer.send('planet:regions', regions),
  setDragging: dragging => ipcRenderer.send('planet:dragging', dragging === true),
  hide: () => ipcRenderer.send('planet:hide'),
  onCommand: callback => {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on('planet:command', listener);
    return () => ipcRenderer.removeListener('planet:command', listener);
  },
});

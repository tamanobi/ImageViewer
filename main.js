'use strict';

var app = require('app');
var BrowserWindow = require('browser-window');
var Menu = require('menu');

require('crash-reporter').start();

var mainWindow = null;

app.on('window-all-closed', function() {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function openWindow(baseDir) {
  // ブラウザ(Chromium)の起動, 初期画面のロード
  mainWindow = new BrowserWindow({width: 800, height: 600});
  mainWindow.openDevTools();
  mainWindow.loadUrl(['file://', baseDir, '/index.html'].join(''));
  mainWindow.on('closed', function() {
    mainWindow = null;
  });
}

var template = [
  {
    label: 'Viewer',
    submenu: [
      {
        label: 'Quit', accelerator: 'Command+Q',
        click: function() {
          app.quit();
        }
      }
    ]
  },
  {
    label: 'File',
    submenu: [
      {
        label: 'Open', accelerator: 'Command+O',
        click: function(item, focusedWindow) {
          if (focusedWindow) {
            focusedWindow.webContents.executeJavaScript('imgView()');
          }
        }
      }
    ]
  },
  {
    label: 'View',
    submenu: [
      {
        label: 'Toggle DevTools', accelerator: 'Alt+Command+I',
        click: function() {
          BrowserWindow.getFocusedWindow().toggleDevTools();
        }
      }
    ]
  }
];

var menu = Menu.buildFromTemplate(template);
app.on('ready', function() {
  Menu.setApplicationMenu(menu);
  openWindow(process.cwd());
});

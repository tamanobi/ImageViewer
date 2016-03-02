'use strict';

var app = require('app');
var BrowserWindow = require('browser-window');
var Menu = require('menu');
const ipc = require('electron').ipcMain;
var fs = require('fs');

require('crash-reporter').start();

var mainWindow = null;

app.on('window-all-closed', function() {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

var directory = '';
var page = 0;
ipc.on('setDirectory', function(e, a) {
  directory = a;
});
ipc.on('setPage', function(e, a) {
  page = a;
});
ipc.on('getDirectory', function(e) {
  e.sender.send('getDirectory-Reply', directory);
});
ipc.on('getPage', function(e) {
  e.sender.send('getPage-Reply', String(page));
});
ipc.on('getMostRecent', function(e) {
  e.returnValue = {directory: directory, page: page};
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
          fs.writeFile('./recent.log', ['directory:', directory, '\t', 'page:', page].join(''), function(err) {
            if (err) {
              console.log(err);
            } else {
              console.log('Done');
            }
          });
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
            // focusedWindow.webContents.executeJavaScript('render()');
            focusedWindow.webContents.executeJavaScript('ImgView()');
          }
        }
      },
      {
        label: 'Most Recent', accelerator: 'Command+P',
        click: function(item, focusedWindow) {
          if (focusedWindow) {
            var d;
            fs.readFile('recent.log', 'utf-8', function(err, text) {
              var l = text.split('\t');
              d = l[0].split(':')[1];
              var p = l[1].split(':')[1];
              directory = d;
              page = Number(p);
              focusedWindow.webContents.executeJavaScript('render()');
            });
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

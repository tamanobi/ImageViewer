'use strict';

var moment = require('moment');
var glob = require('glob');
var fs = require('fs');
var remote = require('remote');
var dialog = remote.require('dialog');
var browserWindow = remote.require('browser-window');
const ipc = require('electron').ipcRenderer;
const sql = require('sql.js');
const db_file = __dirname +  '/db.sqlite3';
function toArrayBuffer(buffer) {
    var ab = new ArrayBuffer(buffer.length);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buffer.length; ++i) {
        view[i] = buffer[i];
    }
    return ab;
}
function toBuffer(ab) {
    var buf = new Buffer(ab.byteLength);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buf.length; ++i) {
        buf[i] = view[i];
    }
    return buf;
}
if (fs.existsSync(db_file)) {
    var buf = fs.readFileSync(db_file);
    var db = new sql.Database(buf);
}else{
    var db = new sql.Database();
    db.run('CREATE TABLE history (id integer primary key, filename text not null, page_num integer not null, accessed_at text not null, stay_time integer not null);');
    fs.writeFileSync(db_file, toBuffer(db.export()));
}

var vm = undefined;
var timer = 0;
var stay = 0;

function getDirectoryFileNames(pattern, directory) {
  var fileNames = glob.sync(pattern, {cwd: directory});
  fileNames = fileNames.map(function(v) {
        return {
          name: directory + '/' + v,
          time: fs.statSync(directory + '/' + v).mtime.getTime()
        };
    })
    .sort(function(a, b) { return a.time - b.time; })
    .map(function(v) { return v.name; });
  console.log(fileNames);

  return fileNames;
}

function StatusBar(id, vm) {
  this.id = id;
  this.vm = vm;
}
StatusBar.prototype.draw = function() {
  var a = document.getElementById(this.id);
  a.setAttribute('style', ['width:', window.innerWidth, 'px'].join(''));
  while (a.firstChild) {
    a.removeChild(a.firstChild);
  }
  var b = document.createElement('div');
  b.setAttribute('class', 'indicator');
  var current = this.vm.getCurrentPage();
  var size = this.vm.size();
  var ratio = (1 - current / size);
  var width = ratio * window.innerWidth;
  var height = '2px';
  var styleProperty = ['width:', width, 'px;', 'height:', height, ';', 'background-color:', 'red', ';'].join('');
  b.setAttribute('style', styleProperty);
  a.appendChild(b);
  var text = document.createElement('div');
  var name = this.vm.getCurrentPageName();
  text.innerHTML = [current, '/', size, ':', name].join('');
  a.appendChild(text);
};
StatusBar.prototype.update = function() {
  this.draw();
};
function ViewerManager(directory, page, id) {
  ipc.send('setDirectory', String(directory));
  this.statusId = 'status';
  this.id = id;
  this.fileNames = [];
  this.currentPosition = 0;
  if (page !== undefined) {
    this.currentPosition = page;
  }
  this.lazyload = 10;
  this.pattern = '*.{png,gif,jpg,jpeg,web,mp4}';
  this.fileNames = getDirectoryFileNames(this.pattern, directory);
  var vmb = new ViewElementBuilder(this.fileNames);
  this.viewElements = vmb.build();
  this.loopPage = function(index) {
    if (index < 0) {
      index += this.viewElements.length;
    } else if (index >= this.viewElements.length) {
      index -= this.viewElements.length;
    }
    if (isNaN(index)) {
      index = 0;
    }
    return index;
  };
  this.loadViewElement = function(index) {
    index = this.loopPage(index);
    if (index >= 0 && index < this.size()) {
      this.viewElements[index].load();
      this.viewElements[index].touch();
    }
  };
  this.load = function() {
    this.loadViewElement(this.currentPosition);
    for (var i = 1; i < this.lazyload; i++) {
      this.loadViewElement(this.currentPosition + i);
      this.loadViewElement(this.currentPosition - i);
    }
  };
  this.getCurrentPage = function() {
    return this.currentPosition;
  };
  this.load();
  this.statusbar = new StatusBar(this.statusId, this);
  this.statusbar.update();
}
ViewerManager.prototype.getCurrentPageName = function() {
  return this.fileNames[this.currentPosition];
};
ViewerManager.prototype.updateStatus = function() {
  this.statusbar.update();
};
ViewerManager.prototype.setVisible = function(index) {
  if (index < 0 || index >= this.size()) {
    throw new RangeError('viewerManagerの領域外エラー');
  } else {
    this.viewElements[index].setVisible();
  }
};
ViewerManager.prototype.setVisibleCurrentPage = function() {
  console.log('current', this.currentPosition);
  this.setVisible(this.currentPosition);
};
ViewerManager.prototype.size = function() {
  return this.viewElements.length;
};
ViewerManager.prototype.goPage = function(index) {
  var res = db.run('INSERT INTO history (filename, page_num, accessed_at, stay_time) VALUES (?, ?, ?, ?);', [this.getCurrentPageName(), this.getCurrentPage(), moment().format(), stay]);
  // TODO: 毎度dbを保存しないようにする
  fs.writeFileSync(db_file, toBuffer(db.export()));
  clearInterval(timer);
  stay = 0;
  this.currentPosition = this.loopPage(index);
  ipc.send('setPage', String(this.currentPosition));
  return this.currentPosition;
};
ViewerManager.prototype.nextPage = function() {
  return this.goPage(this.currentPosition + 1);
};
ViewerManager.prototype.prevPage = function() {
  return this.goPage(this.currentPosition - 1);
};
ViewerManager.prototype.goNext = function() {
  this.setAllHidden();
  this.nextPage();
  this.updateView();
};
ViewerManager.prototype.goPrev = function() {
  this.setAllHidden();
  this.prevPage();
  this.updateView();
};
ViewerManager.prototype.random = function() {
  return Math.floor(Math.random() * this.size());
};
ViewerManager.prototype.goRandom = function() {
  this.setAllHidden();
  this.goPage(this.random());
  this.updateView();
};
ViewerManager.prototype.isInRangeLoaded = function(index) {
  var minIndex = this.currentPosition - this.lazyload;
  var maxIndex = this.currentPosition + this.lazyload;
  if (minIndex <= index && index <= maxIndex) {
    return true;
  }
  return false;
};
ViewerManager.prototype.setAllHidden = function() {
  var _this = this;
  this.viewElements.forEach(function(item, index) {
    if (_this.isInRangeLoaded(index)) {
      _this.viewElements[index].setInvisible();
    } else {
      _this.viewElements[index].setHidden();
    }
  });
};
ViewerManager.prototype.destroy = function() {
  var a = document.getElementById(this.id);
  while (a.firstChild) {
    a.removeChild(a.firstChild);
  }
};
ViewerManager.prototype.updateView = function() {
  this.setAllHidden();
  this.load();
  this.setVisibleCurrentPage();
  this.updateStatus();
};
ViewerManager.prototype.display = function() {
  var a = document.getElementById(this.id);
  this.viewElements.forEach(function(item) {
    a.appendChild(item.get());
  });
  this.updateView();
};
ViewerManager.prototype.keydown = function(e, vm) {
  if (e.keyCode === 39) {
    vm.goPrev();
  }
  if (e.keyCode === 37) {
    vm.goNext();
  }
  if (e.keyCode === 82) {
    vm.goRandom();
  }
};
ViewerManager.prototype.click = function(e, vm) {
  if (e.pageX > window.innerWidth / 2.0) {
    vm.goPrev();
  } else {
    vm.goNext();
  }
};
ViewerManager.prototype.resize = function(e, vm) {
  vm.viewElements[this.currentPosition].touch();
};
function ViewElement(tagname, src, index) {
  this.tagname = tagname;
  this.src = src;
  this.loading = false;
  this.element = document.createElement(tagname);
  this.element.setAttribute('id', ['imgview', index].join(''));
  if (this.tagname === 'video') {
    this.element.controls = true;
  }
}
ViewElement.prototype.load = function() {
  if (this.loading === false) {
    if (this.tagname === 'img') {
      var _this = this;
      fs.readFile(this.src, function(err, data){
        if (err) {console.log(err);}
        _this.element.setAttribute('src', window.URL.createObjectURL(new Blob([data])));
      });
    } else {
        this.element.setAttribute('src', this.src);
    }
    this.touch();
    this.loading = true;
  }
};
ViewElement.prototype.display = function() {
  this.touch();
};
ViewElement.prototype.touch = function() {
  var w;
  var h;
  var aspect;
  var newSize;
  if (this.tagname === 'img') {
    w = this.element.naturalWidth;
    h = this.element.naturalHeight;
    aspect = getAspect(w, h);
    newSize = getSizeFillRect([window.innerWidth, window.innerHeight], aspect);
    this.setWidth(newSize[0]);
  } else {
    w = this.element.videoWidth;
    h = this.element.videoHeigh;
    aspect = getAspect(w, h);
    newSize = getSizeFillRect([window.innerWidth, window.innerHeight], aspect);
    this.setWidth(newSize[0]);
  }
};
ViewElement.prototype.get = function() {
  return this.element;
};
ViewElement.prototype.setVisible = function() {
  timer = setInterval(function() {stay += 10;}, 10);
  this.element.style.display = 'block';
  this.load();
};
ViewElement.prototype.setInvisible = function() {
  this.element.style.display = 'none';
};
ViewElement.prototype.unload = function() {
  this.element.setAttribute('src', '');
  this.loading = false;
};
ViewElement.prototype.setHidden = function() {
  this.element.style.display = 'none';
  this.unload();
};
ViewElement.prototype.setWidth = function(val) {
  this.element.setAttribute('width', val);
  this.element.style.width = val;
};
ViewElement.prototype.setHeight = function(val) {
  this.element.setAttribute('height', val);
  this.element.style.width = val;
};

/**
 * アスペクト比を求める
 * @param {integer} w width
 * @param {integer} h width
 * @return {integer} w / h
 */
function getAspect(w, h) {
  return w / h;
}

/**
 * imageAspectを固定してrectSizeに内接するようなサイズを返す
 * @param {size} rectSize [widht, height]で与えられる配列
 * @param {float} imageAspect アスペクト比
 * @return {size} 内接するサイズ([width, height])
 */
function getSizeFillRect(rectSize, imageAspect) {
  var width;
  var height;
  var rectAspect = getAspect(rectSize[0], rectSize[1]);
  if (rectAspect >= imageAspect) {
    width = rectSize[1] * imageAspect;
    height = rectSize[1];
  } else {
    width = rectSize[0];
    height = rectSize[1] / imageAspect;
  }
  return [width, height];
}

function ViewElementBuilder(names) {
  this.names = names;
}
/**
 * ファイル名の拡張子から、画像か動画か判別する
 * @param string name ファイル名
 * @return string img|video
 */
ViewElementBuilder.prototype.getTagName = function(name) {
  // ファイル名から適切なタグを選出する
  var images = /\.(png|gif|jpg|jpeg)$/i;
  var video = /\.(webm|mp4)$/i;
  if (name.match(images)) {
    return 'img';
  } else if(name.match(video)) {
    return 'video';
  } else {
    return undefined;
  }
};
ViewElementBuilder.prototype.build = function() {
  var _this = this;
  var elements = [];
  this.names.forEach(function(item, index) {
    var tagname = _this.getTagName(item);
    var ve = new ViewElement(tagname, item, index);
    elements.push(ve);
  });
  return elements;
};

var vm = undefined;
function func(directory, page) {
  if (vm === undefined) {
    vm = new ViewerManager(directory, page, 'imgview');
    document.addEventListener('keydown', function(e) {
      vm.keydown(e, vm);
    }, false);
    document.addEventListener('click', function(e) {
      vm.click(e, vm);
    }, false);
    setInterval(function() {
      vm.resize(undefined, vm);
    }, 100);
  } else {
    vm.destroy();
    vm = undefined;
    vm = new ViewerManager(directory, page, 'imgview');
  }
  vm.display();
  return vm;
}
function ImgView(d, p) {
  var focusedWindow = browserWindow.getFocusedWindow();
  if (d === undefined || p === undefined) {
    dialog.showOpenDialog(
        focusedWindow,
        {properties: ['openDirectory']},
        function(directories) {
          directories.forEach(
            function(directory) {
              func(directory);
            }
            );
        }
    );
  } else {
    func(d, p);
  }
}
function render() {
  var mostRecent = ipc.sendSync('getMostRecent');
  if (mostRecent.directory.length == 0 || mostRecent.page < 0) {
    ImgView();
  }
  ImgView(mostRecent.directory, mostRecent.page);
}

ipc.on('getDB', function(e){
  e.sender.send('getDB-reply', {DB:db});
});

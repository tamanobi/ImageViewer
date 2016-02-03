'use strict';

var glob = require('glob');
var remote = require('remote');
var dialog = remote.require('dialog');
var browserWindow = remote.require('browser-window');
var vm = undefined;

function getDirectoryFileNames(pattern, directory) {
  var fileNames = glob.sync(pattern, {cwd: directory});
  fileNames.forEach(function(item, index, array) {
    array[index] = [directory, '/', unescape(item)].join('');
    console.log(array[index]);
  });
  return fileNames;
}

function ViewerManager(directory, id) {
  this.statusId = 'status';
  this.id = id;
  this.fileNames = [];
  this.currentPosition = 0;
  this.lazyload = 10;
  this.pattern = '*.{png,gif,jpg,jpeg,web,mp4}';
  this.fileNames = getDirectoryFileNames(this.pattern, directory);
  var vmb = new ViewElementBuilder(this.fileNames);
  this.viewElements = vmb.build();
  this.loadViewElement = function(index) {
    if (index >= 0 && index < this.viewElements.length) {
      this.viewElements[index].load();
      this.viewElements[index].touch();
    }
  };
  this.load = function() {
    for (var i = 0; i < this.lazyload; i++) {
      this.loadViewElement(this.currentPosition + i);
      this.loadViewElement(this.currentPosition - i);
    }
  };
  this.load();
  // console.log(this.viewElements);
}
ViewerManager.prototype.setVisible = function(index) {
  if (index < 0 || index > this.size()) {
    throw new RangeError('viewerManagerの領域外エラー');
  } else {
    this.viewElements[index].setVisible();
    this.load();
  }
};
ViewerManager.prototype.size = function() {
  return this.fileNames.length;
};
ViewerManager.prototype.goNext = function() {
  this.setAllHidden();
  this.currentPosition += 1;
  this.currentPosition = Math.min(this.size() - 1, this.currentPosition);
  this.setVisible(this.currentPosition);
};
ViewerManager.prototype.goPrev = function() {
  this.setAllHidden();
  this.currentPosition -= 1;
  this.currentPosition = Math.max(0, this.currentPosition);
  this.setVisible(this.currentPosition);
};
ViewerManager.prototype.setAllHidden = function() {
  var _this = this;
  this.fileNames.forEach(function(item, index) {
    _this.viewElements[index].setHidden();
  });
};
ViewerManager.prototype.destroy = function() {
  var a = document.getElementById(this.id);
  while (a.firstChild) {
    a.removeChild(a.firstChild);
  }
};
ViewerManager.prototype.display = function() {
  var a = document.getElementById(this.id);
  this.viewElements.forEach(function(item) {
    a.appendChild(item.get());
  });
  this.setAllHidden();
  this.setVisible(this.currentPosition);
};
ViewerManager.prototype.keydown = function(e, vm) {
  if (e.keyCode === 39) {
    vm.goPrev();
  }
  if (e.keyCode === 37) {
    vm.goNext();
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
    this.element.setAttribute('src', this.src);
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
  this.element.style.display = 'block';
};
ViewElement.prototype.setHidden = function() {
  this.element.style.display = 'none';
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
ViewElementBuilder.prototype.getTagName = function(name) {
  // ファイル名から適切なタグを選出する
  var images = /\.(png|gif|jpg|jpeg)$/i;
  var video = /\.(webm|mp4)$/i;
  if (name.match(images)) {
    return 'img';
  }
  if (name.match(video)) {
    return 'video';
  }
};
ViewElementBuilder.prototype.build = function() {
  var _this = this;
  var elements = [];
  this.names.forEach(function(item, index) {
    var tagname = _this.getTagName(item);
    var vm = new ViewElement(tagname, item, index);
    elements.push(vm);
  });
  return elements;
};

function ImgView() {
  var focusedWindow = browserWindow.getFocusedWindow();
  dialog.showOpenDialog(
      focusedWindow,
      {properties: ['openDirectory']},
      function(directories) {
        directories.forEach(
          function(directory) {
            if (vm === undefined) {
              vm = new ViewerManager(directory, 'imgview');
            } else {
              vm.destroy();
              vm = new ViewerManager(directory, 'imgview');
            }
            vm.display();
            document.addEventListener('keydown', function(e) {
              vm.keydown(e, vm);
            }, false);
            document.addEventListener('click', function(e) {
              vm.click(e, vm);
            }, false);
            setInterval(function() {
              vm.resize(undefined, vm);
            }, 100);
          }
        );
      }
  );
}

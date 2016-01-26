'use strict';

var glob = require('glob');
var remote = require('remote');
var dialog = remote.require('dialog');
var browserWindow = remote.require('browser-window');

function ViewerManager(directory) {
  this.fileNames = [];
  this.currentPosition = 0;
  this.lazyload = 10;
  this.fileNames = glob.sync('*.{png,gif,jpg,jpeg}', {cwd: directory});
  this.fileNames.forEach(function(item, index, array) {
    array[index] = [directory, '/', item].join('');
  });
}
ViewerManager.prototype.setVisible = function(index) {
  if (index < 0 || index > this.size()) {
    throw new RangeError('viewerManagerの領域外エラー');
  } else {
    var id = ['imgview', index].join('');
    var target = document.getElementById(id);
    target.style.display = 'block';
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
  this.fileNames.forEach(function(item, index) {
    var img = document.getElementById(['imgview', index].join(''));
    img.style.display = 'none';
  });
};
ViewerManager.prototype.display = function() {
  var a = document.getElementById('imgview');
  var width = window.innerWidth;
  var vmb = new ViewElementBuilder(this.fileNames);
  var imgs = vmb.build();
  console.log(imgs);
  imgs.forEach(function(item) {
    a.appendChild(item);
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
function ViewElement(tagname, src, index) {
  this.element = document.createElement(tagname);
  this.element.setAttribute('src', src);
  this.element.setAttribute('data-index', index);
  this.element.setAttribute('id', ['imgview', index].join(''));
  this.touch();
}
ViewElement.prototype.touch = function() {
  var image = new Image();
  var _this = this;
  image.onload = function() {
    var w = image.width;
    var h = image.height;
    var newSize = sizeFill([window.innerWidth, window.innerHeight], getAspect(w, h));
    _this.setWidth(newSize[0]);
  };
  image.src = this.element.getAttribute('src');
};
function getAspect(w, h) {
  return w / h;
}
function sizeFill(size, imageAspect) {
  var width;
  var height;
  var aspect1 = getAspect(size[0], size[1]);
  if (aspect1 >= imageAspect) {
    width = size[1] * imageAspect;
    height = size[1];
  } else {
    width = size[0];
    height = size[1] / imageAspect;
  }
  return [width, height];
}
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
};
ViewElement.prototype.setHeight = function(val) {
  this.element.setAttribute('height', val);
};

function ViewElementBuilder(names) {
  this.names = names;
}
ViewElementBuilder.prototype.judge = function() {
  // ファイル名から適切なタグを選出する
};
ViewElementBuilder.prototype.build = function() {
  var elements = [];
  this.names.forEach(function(item, index) {
    var vm = new ViewElement('img', item, index);
    elements.push(vm.get());
  });
  return elements;
};

function imgView() {
  var focusedWindow = browserWindow.getFocusedWindow();
  dialog.showOpenDialog(
      focusedWindow,
      {properties: ['openDirectory']},
      function(directories) {
        directories.forEach(
          function(directory) {
            var vm = new ViewerManager(directory);
            vm.display();
            document.addEventListener('keydown', function(e) {
              vm.keydown(e, vm);
            }, false);
            document.addEventListener('click', function(e) {
              vm.click(e, vm);
            }, false);
          }
        );
      }
  );
}

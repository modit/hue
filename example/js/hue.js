function Hue(elem){
  var hue = this;
  
  this.canvas = elem.querySelector('canvas');
  this.ctx    = this.canvas.getContext('2d');
  
  this.color  = { r: 0, g: 0, b: 0, a: 255 }; //black
  this.size   = 3;
  //TODO: add shape and hardness
  
  this.canvas.width = 768;
  this.canvas.height = 400;
  
  this.down       = null;
  this.prev       = null;
  
  this.canvas.addEventListener('mousedown', function(e){
    hue.down = e;
    hue.draw(e);
  });
  
  this.canvas.addEventListener('mousemove', function(e){
    if(hue.down){
      hue.draw(e);
    }
  });
  
  window.addEventListener('mouseup', function(e){
    hue.down = null;
    hue.prev = null;
  });
  
  this.setBrushSize(this.size);
}

Hue.prototype.draw = function(e){
  var x = Math.round(e.pageX - this.canvas.offsetLeft - (this.size / 2))
    , y = Math.round(e.pageY - this.canvas.offsetTop - (this.size / 2))
    , d = 0
    , v = { x: 0, y: 0 }
    , s = 0
  ;
    
  if(this.prev){
    d = Math.sqrt(Math.pow(x - this.prev.x, 2) + Math.pow(y - this.prev.y, 2));
    v.x = d ? (x - this.prev.x) / d : 0;
    v.y = d ? (y - this.prev.y) / d : 0;
    s = Math.ceil(d);
  }
  
  do{
    this.ctx.putImageData(this.brush, x - Math.round(s * v.x), y - Math.round(s * v.y));
    s--;
  }while(s > 0);
  
  this.prev = { x: x, y: y };
};

Hue.prototype.setBrushSize = function(size){
  this.brush = this.ctx.createImageData(size, size);
  //TODO: shape and hardness;
  
  this.setBrushColor(this.color);
};

Hue.prototype.setBrushColor = function(color){
  this.color = color;
  
  var d = this.brush.data;
  for(var i = 0, l = d.length; i < l; i += 4){
    d[i + 0] = Math.max(0, Math.min(255, this.color.r));
    d[i + 1] = Math.max(0, Math.min(255, this.color.g));
    d[i + 2] = Math.max(0, Math.min(255, this.color.b));
    d[i + 3] = Math.max(0, Math.min(255, this.color.a));
  }
};


window.onload = function(){
  new Hue(document.querySelector('.hue'));
};
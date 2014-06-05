function Hue(elem){
  this.elem   = elem;
  this.canvas = new HueCanvas(elem.querySelector('canvas'));
  this.selectTool('draw');
}

Hue.prototype.selectTool = function(tool){
  [].slice.call(this.elem.querySelectorAll('[tool]')).forEach(function(elem){
    elem.classList.remove('active');
  });
  this.elem.querySelector('[tool=' + tool + ']').classList.add('active');
  this.canvas.selectTool(tool);
};


//====Tools=================================================================================
function HueTool(ctx){
  this.ctx = ctx;
  this.init();
}

HueTool.prototype = {
  init: function(){},
  down: function(){},
  move: function(){},
  drag: function(){},
  up: function(){},
  setProperty: function(){},
  colorPixel: function(data, pos, color){
    data[pos + 0] = Math.max(0, Math.min(255, color.r));
    data[pos + 1] = Math.max(0, Math.min(255, color.g));
    data[pos + 2] = Math.max(0, Math.min(255, color.b));
    data[pos + 3] = Math.max(0, Math.min(255, color.a));
  },
  isColor: function(data, pos, r, g, b, a){
    //TODO: add tolerance
    return (data[pos + 0] == r && data[pos + 1] == g && data[pos + 2] == b && data[pos + 3] == a);
  },
  draw: function(imgData){
    this.ctx.canvas.width = this.ctx.canvas.width;
    this.ctx.putImageData(imgData, 0, 0);
  }
};

function HueDrawTool(){
  HueTool.apply(this, arguments);
}

HueDrawTool.prototype = Object.create(HueTool.prototype, {
  init: {
    value: function(){
      this.brushImage = document.createElement('canvas').getContext('2d');
      this.setProperty('size', this.size);
    }
  },
  down: {
    value: function(pX, pY){
      this.drag(pX, pY);
    }
  },
  drag: {
    value: function(pX, pY){
      var x = Math.round(pX - (this.size / 2))
        , y = Math.round(pY - (this.size / 2))
        , d = 0
        , v = { x: 0, y: 0 }
        , s = 0
      ;
      
      //Fill in missing pixels if the move was too fast
      if(this.prev){
        d = Math.sqrt(Math.pow(x - this.prev.x, 2) + Math.pow(y - this.prev.y, 2));
        v.x = d ? (x - this.prev.x) / d : 0;
        v.y = d ? (y - this.prev.y) / d : 0;
        s = Math.ceil(d);
      }
      
      do{
        this.ctx.drawImage(this.brushImage.canvas, x - Math.round(s * v.x), y - Math.round(s * v.y), this.size, this.size);
        s--;
      }while(s > 0);
      
      this.prev = { x: x, y: y };
    }
  },
  up: {
    value: function(){
      this.prev = null;
    }
  },
  setProperty: {
    value: function(prop, value){
      switch(prop){
        case 'size':
          this.size = value;
          break;
        case 'color':
          this.color = value;
          //TODO: shape and hardness;
          break;
      }
      
      //redraw brush data;
      this.brush = this.ctx.createImageData(this.size, this.size);
      for(var pos = 0, l = this.brush.data.length; pos < l; pos += 4){
        this.colorPixel(this.brush.data, pos, this.color);
      }
      this.brushImage.canvas.width = this.size;
      this.brushImage.canvas.height = this.size;
      this.brushImage.putImageData(this.brush, 0, 0);
    }
  },
  prev:       { value: null, writable: true },
  brush:      { value: null, writable: true },
  brushImage: { value: null, writable: true },
  
  //Defaults
  color: { value: { r: 0, g: 0, b: 0, a: 255 }, writable: true },
  size: { value: 3, writable: true }
});

function HueFillTool(){
  HueTool.apply(this, arguments);
}

HueFillTool.prototype = Object.create(HueTool.prototype, {
  down: {
    value: function(pX, pY){
      var x       = Math.round(pX)
        , y       = Math.round(pY)
        , width   = this.ctx.canvas.width
        , height  = this.ctx.canvas.height
        , img     = this.ctx.getImageData(0, 0, width, height)
        , data    = img.data
        , stack   = [[x, y]]
        , pixPos  = (y * width + x) * 4
        , startR  = data[pixPos + 0]
        , startG  = data[pixPos + 1]
        , startB  = data[pixPos + 2]
        , startA  = data[pixPos + 3]
        , newPos
        , reachLeft
        , reachRight
      ;
      
      if(this.isColor(data, pixPos, this.color.r, this.color.g, this.color.b, this.color.a)) return; //already the same color

      while(stack.length){
        newPos = stack.pop();
        x = newPos[0];
        y = newPos[1];
        
        pixPos = (y * width + x) * 4;
        while(y-- >= 0 && this.isColor(data, pixPos, startR, startG, startB, startA)){
          pixPos -= width * 4;
        }
        
        pixPos += width * 4;
				y += 1;
				reachLeft = false;
				reachRight = false;
				
				while (y <= height && this.isColor(data, pixPos, startR, startG, startB, startA)) {
					y += 1;
          
          this.colorPixel(data, pixPos, this.color);

					if (x > 0) {
						if (this.isColor(data, pixPos - 4, startR, startG, startB, startA)) {
							if (!reachLeft) {
								// Add pixel to stack
								stack.push([x - 1, y]);
								reachLeft = true;
							}
						} else if (reachLeft) {
							reachLeft = false;
						}
					}

					if (x < width) {
						if (this.isColor(data, pixPos + 4, startR, startG, startB, startA)) {
							if (!reachRight) {
								// Add pixel to stack
								stack.push([x + 1, y]);
								reachRight = true;
							}
						} else if (reachRight) {
							reachRight = false;
						}
					}

					pixPos += width * 4;
				}
      }
      this.draw(img);
    }
  },
  
  //Defaults
  color: { value: { r: 0, g: 0, b: 0, a: 255 }, writable: true }
});

function HueEraseTool(){
  HueTool.apply(this, arguments);
}

HueEraseTool.prototype = Object.create(HueTool.prototype, {
  init: {
    value: function(){
      this.drawTool = new HueDrawTool(this.ctx);
    }
  },
  down: {
    value: function(pX, pY){
      this.drawTool.drag(pX, pY);
    }
  },
  drag: {
    value: function(pX, pY){
      this.ctx.save();
      this.ctx.globalCompositeOperation = 'destination-out';
      this.drawTool.drag(pX, pY);
      this.ctx.restore();
    }
  },
  up: {
    value: function(pX, pY){
      this.drawTool.up(pX, pY);
    }
  },
  setProperty: {
    value: function(prop, value){
      switch(prop){
        case 'size':
          this.drawTool.setProperty('size', value);
          break;
      }
    }
  },
  drawTool: { value: null, writable: true },
});
//==============================================================================================


function HueCanvas(canvas){
  var self = this;
  
  this.canvas = canvas;
  this.ctx    = this.canvas.getContext('2d');
  
  this.tools = {
    draw:   new HueDrawTool(this.ctx),
    fill:   new HueFillTool(this.ctx),
    erase:  new HueEraseTool(this.ctx)
  };
  
  //TODO: add shape and hardness
  
  this.canvas.width = 768;
  this.canvas.height = 400;
  
  this.down = null;
  
  this.canvas.addEventListener('mousedown', function(e){
    self.down = e;
    self.selectedTool.down(e.pageX - self.canvas.offsetLeft, e.pageY - self.canvas.offsetTop);
  });
  
  window.addEventListener('mousemove', function(e){
    if(self.down){
      self.selectedTool.drag(e.pageX - self.canvas.offsetLeft, e.pageY - self.canvas.offsetTop);
    } else {
      self.selectedTool.move(e.pageX - self.canvas.offsetLeft, e.pageY - self.canvas.offsetTop);
    }
  });
  
  window.addEventListener('mouseup', function(e){
    self.down = null;
    self.selectedTool.up(e.pageX - self.canvas.offsetLeft, e.pageY - self.canvas.offsetTop);
  });
  
  this.selectedTool = this.tools.draw;
}

HueCanvas.setToolProperty = function(prop, value){
  this.selectedTool.setProperty(prop, value);
};

HueCanvas.prototype.selectTool = function(tool){
  this.selectedTool = this.tools[tool];
};


window.onload = function(){
  window.hue = new Hue(document.querySelector('.hue'));
};
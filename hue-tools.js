function HueBrush(){
  this.ctx      = document.createElement('canvas').getContext('2d');
  this.buffer   = document.createElement('canvas').getContext('2d');
  
  //defaults
  this.color  = { r: 0, g: 0, b: 0, a: 1 };
  this.tip    = { size: 24, shape: 'round', hardness: 0.75 };
  
  this.refresh();
}

HueBrush.prototype = {
  refresh: function(){
    this.buffer.canvas.width  = this.tip.size;
    this.buffer.canvas.height = this.tip.size;
    
    var radius = (this.tip.size / 2) - ((this.tip.size / 2) * this.tip.hardness);
    
    this.buffer.translate(-this.tip.size, 0);

    /// offset the shadow to compensate, draws shadow only on canvas
    this.buffer.shadowOffsetX = this.tip.size;
    this.buffer.shadowOffsetY = 0;
    this.buffer.shadowColor = '#000';
    this.buffer.shadowBlur = radius;
    
    if(this.tip.shape === 'square'){
      this.buffer.fillRect(0 + radius, 0 + radius, this.tip.size - radius * 2, this.tip.size - radius * 2);
    } else if(this.tip.shape === 'round'){
      this.buffer.beginPath();
      this.buffer.arc(this.tip.size / 2, this.tip.size / 2, this.tip.size / 2 - radius, 0, 2 * Math.PI, false);
      this.buffer.fill();
    }
    
    this.ctx.canvas.width = this.tip.size;
    this.ctx.canvas.height = this.tip.size;
    this.ctx.fillStyle = 'rgba(' + [this.color.r, this.color.g, this.color.b, this.color.a].join(',') + ')';
    
    this.ctx.fillRect(0, 0, this.tip.size, this.tip.size);
    this.ctx.globalCompositeOperation = 'destination-in';
    this.ctx.drawImage(this.buffer.canvas, 0, 0, this.tip.size, this.tip.size);
    this.url = this.ctx.canvas.toDataURL();
  },
  drawTo: function(ctx, x, y){
    ctx.drawImage(this.ctx.canvas, x, y, this.tip.size, this.tip.size);
  }
};

function HueTool(ctx){
  this.ctx = ctx;
  this.init();
}

HueTool.prototype = {
  init: function(){},
  down: function(){},
  track: function(){},
  up: function(){},
  colorPixel: function(data, pos, color, preserveAlpha){
    data[pos + 0] = Math.max(0, Math.min(255, color.r));
    data[pos + 1] = Math.max(0, Math.min(255, color.g));
    data[pos + 2] = Math.max(0, Math.min(255, color.b));
    
    if(!data[pos + 3] || !preserveAlpha){
      data[pos + 3] = Math.max(0, Math.min(255, color.a));
    }
    
  },
  isColor: function(data, pos, color, checkAlpha, tolerance){
    //TODO: add tolerance
    var r = data[pos + 0];
    var g = data[pos + 1];
    var b = data[pos + 2];
    var a = data[pos + 3];
    var d = Math.abs(r - color.r) + Math.abs(g - color.g) + Math.abs(b - color.b) + (checkAlpha ? Math.abs(a - color.a) : 0);
    return d <= (tolerance || 1e-9);
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
      this.brush = new HueBrush();
    }
  },
  down: {
    value: function(pX, pY, isRightClick){
      if(isRightClick) { return; }
      this.prev = null;
      this.track(pX, pY);
    }
  },
  track: {
    value: function(pX, pY){
      var x = Math.round(pX - (this.brush.tip.size / 2))
        , y = Math.round(pY - (this.brush.tip.size / 2))
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
        this.brush.drawTo(this.ctx, x - Math.round(s * v.x), y - Math.round(s * v.y));
        s--;
      }while(s > 0);
      
      
      this.prev = { x: x, y: y };
    }
  },
  up: {
    value: function(){
      if(this.prev){
        this.prev = null;
        return true;
      }
    }
  },
  prev:       { writable: true, value: null },
  brush:      { writable: true, value: null },
});

function HueFillTool(){
  HueTool.apply(this, arguments);
}

HueFillTool.prototype = Object.create(HueTool.prototype, {
  down: {
    value: function(pX, pY, isRightClick){
      if(isRightClick) { return; }
      
      var x       = Math.round(pX)
        , y       = Math.round(pY)
        , width   = this.ctx.canvas.width
        , height  = this.ctx.canvas.height
        , img     = this.ctx.getImageData(0, 0, width, height)
        , data    = img.data
        , stack   = [[x, y]]
        , pixPos  = (y * width + x) * 4
        , start   = { r: data[pixPos + 0], g: data[pixPos + 1], b: data[pixPos + 2], a: data[pixPos + 3] }
        , newPos
        , reachLeft
        , reachRight
      ;
      if(this.isColor(data, pixPos, this.color, true)) return false; //already the same color
      
      while(stack.length){
        newPos = stack.pop();
        x = newPos[0];
        y = newPos[1];
        
        pixPos = (y * width + x) * 4;
        while(y-- >= 0 && this.isColor(data, pixPos, start, true, this.tolerance)){
          pixPos -= width * 4;
        }
        
        pixPos += width * 4;
				y += 1;
				reachLeft = false;
				reachRight = false;
				
				while (y <= height && this.isColor(data, pixPos, start, true, this.tolerance)) {
					y += 1;
          
          this.colorPixel(data, pixPos, this.color);

					if (x > 0) {
						if (this.isColor(data, pixPos - 4, start, true, this.tolerance)) {
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
						if (this.isColor(data, pixPos + 4, start, true, this.tolerance)) {
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
      
      return true;
    }
  },
  setProperty: {
    value: function(prop, value){
      switch(prop){
        case 'color':
          this[prop] = value;
      }
    }
  },
  
  //Defaults
  color:      { writable: true, value: { r: 0, g: 0, b: 0, a: 1 } },
  tolerance:  { writable: true, value: 100 }
});

function HueEraseTool(){
  HueTool.apply(this, arguments);
}

HueEraseTool.prototype = Object.create(HueTool.prototype, {
  init: {
    value: function(){
      this.drawTool = new HueDrawTool(this.ctx);
      this.brush = this.drawTool.brush;
    }
  },
  down: {
    value: function(pX, pY){
      this.track(pX, pY);
    }
  },
  track: {
    value: function(pX, pY){
      this.ctx.save();
      this.ctx.globalCompositeOperation = 'destination-out';
      this.drawTool.track(pX, pY);
      this.ctx.restore();
    }
  },
  up: {
    value: function(pX, pY){
      return this.drawTool.up(pX, pY);
    }
  },
  drawTool: { writable: true, value: null },
  brush:    { writable: true, value: null }
});
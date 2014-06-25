function Hue(elem){
  this.elem   = elem;
  this.canvas = new HueCanvas(elem.querySelector('canvas'));
  this.selectTool('draw');
}

Hue.prototype = {
  selectTool: function(tool){
    [].slice.call(this.elem.querySelectorAll('[tool]')).forEach(function(elem){
      elem.classList.remove('active');
    });
    this.elem.querySelector('[tool=' + tool + ']').classList.add('active');
    this.canvas.selectTool(tool);
  },
  undo: function(){
    this.canvas.undo();
  },
  redo: function(){
    this.canvas.redo();
  }
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
      this.brush = document.createElement('canvas').getContext('2d');
      this.buffer = document.createElement('canvas').getContext('2d');
      this.drawBrush();
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
        this.ctx.drawImage(this.brush.canvas, x - Math.round(s * v.x), y - Math.round(s * v.y), this.size, this.size);
        s--;
      }while(s > 0);
      
      this.prev = { x: x, y: y };
    }
  },
  up: {
    value: function(){
      this.prev = null;
      return true;
    }
  },
  setProperty: {
    value: function(prop, value){
      switch(prop){
        case 'size':
        case 'color':
        case 'shape':
        case 'hardness':
          this[prop] = value;
      }
      this.drawBrush();
    }
  },
  drawBrush: {
    value: function(){
      
      this.buffer.canvas.width  = this.size;
      this.buffer.canvas.height = this.size;
      
      var radius = (this.size / 2) - ((this.size / 2) * this.hardness);
      
      if(this.shape === 'square'){
        this.buffer.fillRect(0 + radius, 0 + radius, this.size - radius * 2, this.size - radius * 2);
      } else if(this.shape === 'round'){
        this.buffer.beginPath();
        this.buffer.arc(this.size / 2, this.size / 2, this.size / 2 - radius, 0, 2 * Math.PI, false);
        this.buffer.fill();
      }
      
      var imageData = this.buffer.getImageData(0, 0, this.size, this.size);
      stackBlurCanvasRGBA( imageData.data, this.size, this.size, radius );
      this.buffer.putImageData(imageData, 0, 0);
      
      this.brush.canvas.width = this.size;
      this.brush.canvas.height = this.size;
      this.brush.fillStyle = 'rgba(' + [this.color.r, this.color.g, this.color.b, this.color.a].join(',') + ')';
      
      this.brush.fillRect(0, 0, this.size, this.size);
      this.brush.globalCompositeOperation = 'destination-in';
      this.brush.drawImage(this.buffer.canvas, 0, 0, this.size, this.size);
    }
  },
  prev:       { writable: true, value: null },
  brush:      { writable: true, value: null },
  buffer:     { writable: true, value: null },
  
  //Defaults
  color:    { writable: true, value: { r: 0, g: 153, b: 76, a: 255 } },
  size:     { writable: true, value: 50 },
  shape:    { writable: true, value: 'round' },
  hardness: { writable: true, value: 0.5 } //0 - 1
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
  
  //Defaults
  color:      { writable: true, value: { r: 0, g: 0, b: 0, a: 255 } },
  tolerance:  { writable: true, value: 100 }
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
      this.drag(pX, pY);
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
      return this.drawTool.up(pX, pY);
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
    var coords = self.canvasCoords(e);
    
    if(coords && self.selectedTool.down(coords.x, coords.y)){
      self.storeCanvasState();
    }
  });
  
  window.addEventListener('mousemove', function(e){
    var store;
    var coords = self.canvasCoords(e);
    
    if(coords && self.down){
      store = self.selectedTool.drag(coords.x, coords.y);
    } else {
      store = self.selectedTool.move(coords.x, coords.y);
    }
    
    if(store){
      self.storeCanvasState();
    }
  });
  
  window.addEventListener('mouseup', function(e){
    self.down = null;
    var coords = self.canvasCoords(e);
    
    if(coords && self.selectedTool.up(coords.x, coords.y)){
      self.storeCanvasState();
    }
  });
  
  this.selectedTool = this.tools.draw;
  this.history = [this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)];
  this.historyIndex = 0;
}

HueCanvas.prototype = {
  canvasCoords: function(e){
    var x = e.pageX - this.canvas.offsetLeft;
    var y = e.pageY - this.canvas.offsetTop;
    return x > 0 && x < this.canvas.width && y > 0 && y < this.canvas.height && { x: x, y: y };
  },
  selectTool: function(tool){
    this.selectedTool = this.tools[tool];
  },
  setToolProperty: function(prop, value){
    this.selectedTool.setProperty(prop, value);
  },
  storeCanvasState: function(){
    this.history[++this.historyIndex] = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    this.history.length = this.historyIndex + 1;
    
    if(this.history.length > 50){
      this.history.shift();
      this.historyIndex--;
    }
  },
  undo: function(){
    if(this.historyIndex){
      this.canvas.width = this.canvas.width;
      this.ctx.putImageData(this.history[--this.historyIndex], 0, 0);
    }
  },
  redo: function(){
    if(this.historyIndex !== this.history.length - 1){
      this.canvas.width = this.canvas.width;
      this.ctx.putImageData(this.history[++this.historyIndex], 0, 0);
    }
  }
};


window.onload = function(){
  window.hue = new Hue(document.querySelector('.hue'));
};




/*

StackBlur - a fast almost Gaussian Blur For Canvas

Version:  0.5
Author:		Mario Klingemann
Contact:  mario@quasimondo.com
Website:	http://www.quasimondo.com/StackBlurForCanvas
Twitter:	@quasimondo

In case you find this class useful - especially in commercial projects -
I am not totally unhappy for a small donation to my PayPal account
mario@quasimondo.de

Or support me on flattr:
https://flattr.com/thing/72791/StackBlur-a-fast-almost-Gaussian-Blur-Effect-for-CanvasJavascript

Copyright (c) 2010 Mario Klingemann

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/

var mul_table = [
        512,512,456,512,328,456,335,512,405,328,271,456,388,335,292,512,
        454,405,364,328,298,271,496,456,420,388,360,335,312,292,273,512,
        482,454,428,405,383,364,345,328,312,298,284,271,259,496,475,456,
        437,420,404,388,374,360,347,335,323,312,302,292,282,273,265,512,
        497,482,468,454,441,428,417,405,394,383,373,364,354,345,337,328,
        320,312,305,298,291,284,278,271,265,259,507,496,485,475,465,456,
        446,437,428,420,412,404,396,388,381,374,367,360,354,347,341,335,
        329,323,318,312,307,302,297,292,287,282,278,273,269,265,261,512,
        505,497,489,482,475,468,461,454,447,441,435,428,422,417,411,405,
        399,394,389,383,378,373,368,364,359,354,350,345,341,337,332,328,
        324,320,316,312,309,305,301,298,294,291,287,284,281,278,274,271,
        268,265,262,259,257,507,501,496,491,485,480,475,470,465,460,456,
        451,446,442,437,433,428,424,420,416,412,408,404,400,396,392,388,
        385,381,377,374,370,367,363,360,357,354,350,347,344,341,338,335,
        332,329,326,323,320,318,315,312,310,307,304,302,299,297,294,292,
        289,287,285,282,280,278,275,273,271,269,267,265,263,261,259];
        
   
var shg_table = [
    9, 11, 12, 13, 13, 14, 14, 15, 15, 15, 15, 16, 16, 16, 16, 17,
		17, 17, 17, 17, 17, 17, 18, 18, 18, 18, 18, 18, 18, 18, 18, 19,
		19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 20, 20, 20,
		20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 21,
		21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21,
		21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 22, 22, 22, 22, 22, 22,
		22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22,
		22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 23,
		23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
		23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
		23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
		23, 23, 23, 23, 23, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
		24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
		24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
		24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
		24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24 ];

function stackBlurCanvasRGBA( pixels, width, height, radius )
{
	if ( isNaN(radius) || radius < 1 ) return;
	radius |= 0;
			
	var x, y, i, p, yp, yi, yw, r_sum, g_sum, b_sum, a_sum,
	r_out_sum, g_out_sum, b_out_sum, a_out_sum,
	r_in_sum, g_in_sum, b_in_sum, a_in_sum,
	pr, pg, pb, pa, rbs;
			
	var div = radius + radius + 1;
	var w4 = width << 2;
	var widthMinus1  = width - 1;
	var heightMinus1 = height - 1;
	var radiusPlus1  = radius + 1;
	var sumFactor = radiusPlus1 * ( radiusPlus1 + 1 ) / 2;
	
	var stackStart = new BlurStack();
	var stack = stackStart;
	var stackEnd;
	for ( i = 1; i < div; i++ )
	{
		stack = stack.next = new BlurStack();
		if ( i == radiusPlus1 ) stackEnd = stack;
	}
	stack.next = stackStart;
	var stackIn = null;
	var stackOut = null;
	
	yw = yi = 0;
	
	var mul_sum = mul_table[radius];
	var shg_sum = shg_table[radius];
	
	for ( y = 0; y < height; y++ )
	{
		r_in_sum = g_in_sum = b_in_sum = a_in_sum = r_sum = g_sum = b_sum = a_sum = 0;
		
		r_out_sum = radiusPlus1 * ( pr = pixels[yi] );
		g_out_sum = radiusPlus1 * ( pg = pixels[yi+1] );
		b_out_sum = radiusPlus1 * ( pb = pixels[yi+2] );
		a_out_sum = radiusPlus1 * ( pa = pixels[yi+3] );
		
		r_sum += sumFactor * pr;
		g_sum += sumFactor * pg;
		b_sum += sumFactor * pb;
		a_sum += sumFactor * pa;
		
		stack = stackStart;
		
		for( i = 0; i < radiusPlus1; i++ )
		{
			stack.r = pr;
			stack.g = pg;
			stack.b = pb;
			stack.a = pa;
			stack = stack.next;
		}
		
		for( i = 1; i < radiusPlus1; i++ )
		{
			p = yi + (( widthMinus1 < i ? widthMinus1 : i ) << 2 );
			r_sum += ( stack.r = ( pr = pixels[p])) * ( rbs = radiusPlus1 - i );
			g_sum += ( stack.g = ( pg = pixels[p+1])) * rbs;
			b_sum += ( stack.b = ( pb = pixels[p+2])) * rbs;
			a_sum += ( stack.a = ( pa = pixels[p+3])) * rbs;
			
			r_in_sum += pr;
			g_in_sum += pg;
			b_in_sum += pb;
			a_in_sum += pa;
			
			stack = stack.next;
		}
		
		
		stackIn = stackStart;
		stackOut = stackEnd;
		for ( x = 0; x < width; x++ )
		{
			pixels[yi+3] = pa = (a_sum * mul_sum) >> shg_sum;
			if ( pa !== 0 )
			{
				pa = 255 / pa;
				pixels[yi]   = ((r_sum * mul_sum) >> shg_sum) * pa;
				pixels[yi+1] = ((g_sum * mul_sum) >> shg_sum) * pa;
				pixels[yi+2] = ((b_sum * mul_sum) >> shg_sum) * pa;
			} else {
				pixels[yi] = pixels[yi+1] = pixels[yi+2] = 0;
			}
			
			r_sum -= r_out_sum;
			g_sum -= g_out_sum;
			b_sum -= b_out_sum;
			a_sum -= a_out_sum;
			
			r_out_sum -= stackIn.r;
			g_out_sum -= stackIn.g;
			b_out_sum -= stackIn.b;
			a_out_sum -= stackIn.a;
			
			p =  ( yw + ( ( p = x + radius + 1 ) < widthMinus1 ? p : widthMinus1 ) ) << 2;
			
			r_in_sum += ( stackIn.r = pixels[p]);
			g_in_sum += ( stackIn.g = pixels[p+1]);
			b_in_sum += ( stackIn.b = pixels[p+2]);
			a_in_sum += ( stackIn.a = pixels[p+3]);
			
			r_sum += r_in_sum;
			g_sum += g_in_sum;
			b_sum += b_in_sum;
			a_sum += a_in_sum;
			
			stackIn = stackIn.next;
			
			r_out_sum += ( pr = stackOut.r );
			g_out_sum += ( pg = stackOut.g );
			b_out_sum += ( pb = stackOut.b );
			a_out_sum += ( pa = stackOut.a );
			
			r_in_sum -= pr;
			g_in_sum -= pg;
			b_in_sum -= pb;
			a_in_sum -= pa;
			
			stackOut = stackOut.next;

			yi += 4;
		}
		yw += width;
	}

	
	for ( x = 0; x < width; x++ )
	{
		g_in_sum = b_in_sum = a_in_sum = r_in_sum = g_sum = b_sum = a_sum = r_sum = 0;
		
		yi = x << 2;
		r_out_sum = radiusPlus1 * ( pr = pixels[yi]);
		g_out_sum = radiusPlus1 * ( pg = pixels[yi+1]);
		b_out_sum = radiusPlus1 * ( pb = pixels[yi+2]);
		a_out_sum = radiusPlus1 * ( pa = pixels[yi+3]);
		
		r_sum += sumFactor * pr;
		g_sum += sumFactor * pg;
		b_sum += sumFactor * pb;
		a_sum += sumFactor * pa;
		
		stack = stackStart;
		
		for( i = 0; i < radiusPlus1; i++ )
		{
			stack.r = pr;
			stack.g = pg;
			stack.b = pb;
			stack.a = pa;
			stack = stack.next;
		}
		
		yp = width;
		
		for( i = 1; i <= radius; i++ )
		{
			yi = ( yp + x ) << 2;
			
			r_sum += ( stack.r = ( pr = pixels[yi])) * ( rbs = radiusPlus1 - i );
			g_sum += ( stack.g = ( pg = pixels[yi+1])) * rbs;
			b_sum += ( stack.b = ( pb = pixels[yi+2])) * rbs;
			a_sum += ( stack.a = ( pa = pixels[yi+3])) * rbs;
			
			r_in_sum += pr;
			g_in_sum += pg;
			b_in_sum += pb;
			a_in_sum += pa;
			
			stack = stack.next;
		
			if( i < heightMinus1 )
			{
				yp += width;
			}
		}
		
		yi = x;
		stackIn = stackStart;
		stackOut = stackEnd;
		for ( y = 0; y < height; y++ )
		{
			p = yi << 2;
			pixels[p+3] = pa = (a_sum * mul_sum) >> shg_sum;
			if ( pa > 0 )
			{
				pa = 255 / pa;
				pixels[p]   = ((r_sum * mul_sum) >> shg_sum ) * pa;
				pixels[p+1] = ((g_sum * mul_sum) >> shg_sum ) * pa;
				pixels[p+2] = ((b_sum * mul_sum) >> shg_sum ) * pa;
			} else {
				pixels[p] = pixels[p+1] = pixels[p+2] = 0;
			}
			
			r_sum -= r_out_sum;
			g_sum -= g_out_sum;
			b_sum -= b_out_sum;
			a_sum -= a_out_sum;
	 
			r_out_sum -= stackIn.r;
			g_out_sum -= stackIn.g;
			b_out_sum -= stackIn.b;
			a_out_sum -= stackIn.a;
			
			p = ( x + (( ( p = y + radiusPlus1) < heightMinus1 ? p : heightMinus1 ) * width )) << 2;
			
			r_sum += ( r_in_sum += ( stackIn.r = pixels[p]));
			g_sum += ( g_in_sum += ( stackIn.g = pixels[p+1]));
			b_sum += ( b_in_sum += ( stackIn.b = pixels[p+2]));
			a_sum += ( a_in_sum += ( stackIn.a = pixels[p+3]));
		
			stackIn = stackIn.next;
			
			r_out_sum += ( pr = stackOut.r );
			g_out_sum += ( pg = stackOut.g );
			b_out_sum += ( pb = stackOut.b );
			a_out_sum += ( pa = stackOut.a );
			
			r_in_sum -= pr;
			g_in_sum -= pg;
			b_in_sum -= pb;
			a_in_sum -= pa;
			
			stackOut = stackOut.next;
			
			yi += width;
		}
	}
}

function BlurStack()
{
	this.r = 0;
	this.g = 0;
	this.b = 0;
	this.a = 0;
	this.next = null;
}
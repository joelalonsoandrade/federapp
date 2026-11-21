'use strict';
const vectorStrokeGeometry = new WeakMap();
const vectorPathStrings = new WeakMap();

// A small recording context shared by SVG preview and PDF output. Coordinates,
// transforms and curves are identical to those used by the drawing canvas.
class VectorPage {
  constructor() {
    this.items=[];this.matrix=[1,0,0,1,0,0];this.stack=[];this.path=[];
    this.strokeStyle='#000000';this.fillStyle='#000000';this.lineWidth=1;
    this.lineCap='round';this.lineJoin='round';this.font='16px cursive';
  }
  save(){this.stack.push({matrix:[...this.matrix],strokeStyle:this.strokeStyle,fillStyle:this.fillStyle,lineWidth:this.lineWidth,font:this.font});}
  restore(){Object.assign(this,this.stack.pop());}
  transform(a,b,c,d,e,f){const [aa,bb,cc,dd,ee,ff]=this.matrix;this.matrix=[aa*a+cc*b,bb*a+dd*b,aa*c+cc*d,bb*c+dd*d,aa*e+cc*f+ee,bb*e+dd*f+ff];}
  translate(x,y){this.transform(1,0,0,1,x,y);}
  scale(x,y){this.transform(x,0,0,y,0,0);}
  beginPath(){this.path=[];this.cursor=null;}
  moveTo(x,y){this.path.push(['M',x,y]);this.cursor=[x,y];}
  lineTo(x,y){this.path.push(['L',x,y]);this.cursor=[x,y];}
  quadraticCurveTo(x,y,endX,endY){const [startX,startY]=this.cursor;this.bezierCurveTo(startX+2/3*(x-startX),startY+2/3*(y-startY),endX+2/3*(x-endX),endY+2/3*(y-endY),endX,endY);}
  bezierCurveTo(...points){this.path.push(['C',...points]);this.cursor=points.slice(-2);}
  closePath(){this.path.push(['Z']);}
  arc(x,y,r){const k=r*.5522847498307936;this.moveTo(x+r,y);this.bezierCurveTo(x+r,y+k,x+k,y+r,x,y+r);this.bezierCurveTo(x-k,y+r,x-r,y+k,x-r,y);this.bezierCurveTo(x-r,y-k,x-k,y-r,x,y-r);this.bezierCurveTo(x+k,y-r,x+r,y-k,x+r,y);this.closePath();}
  record(type,extra){this.items.push({type,matrix:[...this.matrix],stroke:this.strokeStyle,fill:this.fillStyle,width:this.lineWidth,...extra});}
  stroke(){this.record('path',{path:this.path,paint:'stroke'});}
  fill(){this.record('path',{path:this.path,paint:'fill'});}
  fillRect(x,y,w,h){this.record('path',{paint:'fill',path:[['M',x,y],['L',x+w,y],['L',x+w,y+h],['L',x,y+h],['Z']]});}
  drawImage(image,x,y,w,h){this.record('image',{source:image.src,x,y,w,h});}
  fillText(text,x,y){this.record('text',{text,x,y,font:this.font});}
  traceStrokes(lines,pen,color){
    let paths=vectorStrokeGeometry.get(lines);
    if(!paths){
      paths=lines.map(points=>{
        if(points.length===1)return null;
        const builder=new VectorPage();builder.beginPath();builder.moveTo(points[0][0],points[0][1]);
        for(let i=1;i<points.length-1;i++){const point=points[i],next=points[i+1];builder.quadraticCurveTo(point[0],point[1],(point[0]+next[0])/2,(point[1]+next[1])/2);}
        const last=points[points.length-1];builder.lineTo(last[0],last[1]);return builder.path;
      });vectorStrokeGeometry.set(lines,paths);
    }
    this.strokeStyle=color;this.fillStyle=color;this.lineWidth=pen;
    paths.forEach((path,index)=>{
      if(path)this.record('path',{path,paint:'stroke'});
      else{this.beginPath();this.arc(lines[index][0][0],lines[index][0][1],pen/2);this.fill();}
    });
  }
  svg(width,height,prefix='vp'){
    const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
    const number=n=>Number(n.toFixed(5));const definitions=new Map();const body=[];
    for(const item of this.items){
      const transform=`matrix(${item.matrix.map(number).join(' ')})`;
      if(item.type==='path'){
        let d=vectorPathStrings.get(item.path);
        if(!d){d=item.path.map(([op,...values])=>op+values.map(number).join(' ')).join(' ');vectorPathStrings.set(item.path,d);}
        if(!definitions.has(d))definitions.set(d,`${prefix}${definitions.size}`);
        body.push(`<use href="#${definitions.get(d)}" transform="${transform}" fill="${item.paint==='fill'?escape(item.fill):'none'}" stroke="${item.paint==='stroke'?escape(item.stroke):'none'}" stroke-width="${number(item.width)}" stroke-linecap="round" stroke-linejoin="round"/>`);
      }else if(item.type==='image')body.push(`<image href="${escape(item.source)}" x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" preserveAspectRatio="none" transform="${transform}"/>`);
      else body.push(`<text x="${item.x}" y="${item.y}" fill="${escape(item.fill)}" style="font:${escape(item.font)}" transform="${transform}">${escape(item.text)}</text>`);
    }
    return `<defs>${[...definitions].map(([d,id])=>`<path id="${id}" d="${d}"/>`).join('')}</defs>${body.join('')}`;
  }
  async toPDF(document,page,cache){
    const p=PDFLib;const color=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
    for(const item of this.items){
      page.pushOperators(p.pushGraphicsState(),p.concatTransformationMatrix(...item.matrix));
      if(item.type==='path'){
        const operators=[p.setLineCap(1),p.setLineJoin(1),p.setLineWidth(item.width),item.paint==='fill'?p.setFillingRgbColor(...color(item.fill)):p.setStrokingRgbColor(...color(item.stroke))];
        for(const [op,...values] of item.path)operators.push(op==='M'?p.moveTo(...values):op==='L'?p.lineTo(...values):op==='C'?p.appendBezierCurve(...values):p.closePath());
        operators.push(item.paint==='fill'?p.fill():p.stroke());page.pushOperators(...operators);
      }else{
        let image,x,y,w,h;
        if(item.type==='image'){
          const key=item.source;
          if(!cache.has(key))cache.set(key,await (/^data:image\/jpeg/.test(key)?document.embedJpg(key):document.embedPng(key)));
          image=cache.get(key);({x,y,w,h}=item);
        }else{
          // Only the temporary system-font fallback is rasterized. Own strokes
          // and built-in paper never pass through an image encoder.
          const key=`${item.font}|${item.fill}|${item.text}`;
          if(!cache.has(key)){
            const canvas=globalThis.document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font=item.font;
            const m=ctx.measureText(item.text),left=Math.ceil(m.actualBoundingBoxLeft || 0)+2,top=Math.ceil(m.actualBoundingBoxAscent || 0)+2;
            const width=Math.max(1,Math.ceil(left+(m.actualBoundingBoxRight || m.width))+2),height=Math.max(1,Math.ceil(top+(m.actualBoundingBoxDescent || 0))+2);
            canvas.width=width*4;canvas.height=height*4;ctx.scale(4,4);ctx.font=item.font;ctx.fillStyle=item.fill;ctx.fillText(item.text,left,top);
            cache.set(key,{image:await document.embedPng(canvas.toDataURL('image/png')),left,top,width,height});
          }
          const cached=cache.get(key);image=cached.image;x=item.x-cached.left;y=item.y-cached.top;w=cached.width;h=cached.height;
        }
        // PDF image space points upwards; the page recording points downwards.
        page.pushOperators(p.concatTransformationMatrix(1,0,0,-1,x,y+h));page.drawImage(image,{x:0,y:0,width:w,height:h});
      }
      page.pushOperators(p.popGraphicsState());
    }
  }
}

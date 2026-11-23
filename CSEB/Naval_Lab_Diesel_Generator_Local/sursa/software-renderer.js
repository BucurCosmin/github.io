/* Small Canvas2D painter renderer for this teaching model, used only when WebGL is unavailable. */
class TeachingCanvasRenderer {
 constructor(){this.domElement=document.createElement('canvas');this.ctx=this.domElement.getContext('2d');this.color='#101f2d';this.width=800;this.height=600;this.isSoftware=true;this.cache=new WeakMap();}
 setPixelRatio(){} setClearColor(c){this.color=c;}setSize(w,h){this.width=w;this.height=h;this.domElement.width=w;this.domElement.height=h;}
 render(scene,camera){
  const ctx=this.ctx,w=this.width,h=this.height;ctx.fillStyle=this.color;ctx.fillRect(0,0,w,h);scene.updateMatrixWorld();camera.updateMatrixWorld();
  const vp=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),ve=vp.elements,triangles=[];
  const project=p=>{const X=p[0],Y=p[1],Z=p[2],W=ve[3]*X+ve[7]*Y+ve[11]*Z+ve[15];if(W<=.1)return null;return [(ve[0]*X+ve[4]*Y+ve[8]*Z+ve[12])/W*w*.5+w*.5,-(ve[1]*X+ve[5]*Y+ve[9]*Z+ve[13])/W*h*.5+h*.5,(ve[2]*X+ve[6]*Y+ve[10]*Z+ve[14])/W];};
  // Quiet ground grid, independent of GPU resources.
  ctx.strokeStyle='#253b49';ctx.lineWidth=.7;for(let n=-12;n<=12;n++){for(const ps of [[[-12,0,n],[12,0,n]],[[n,0,-12],[n,0,12]]]){const a=project(ps[0]),b=project(ps[1]);if(a&&b){ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}}}
  const clip=poly=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ia=a[2]<=0,ib=b[2]<=0;if(ia)out.push(a);if(ia!==ib){const t=-a[2]/(b[2]-a[2]);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]),0]);}}return out;};
  scene.traverseVisible(obj=>{
   if(!obj.isMesh||!obj.userData.part||!obj.geometry.attributes.position)return;
   const geo=obj.geometry,pos=geo.attributes.position,idx=geo.index,me=obj.matrixWorld.elements,points=new Array(pos.count);
   for(let j=0;j<pos.count;j++){const X=pos.getX(j),Y=pos.getY(j),Z=pos.getZ(j);points[j]=[me[0]*X+me[4]*Y+me[8]*Z+me[12],me[1]*X+me[5]*Y+me[9]*Z+me[13],me[2]*X+me[6]*Y+me[10]*Z+me[14]];}
   const mat=obj.material,c=mat.color,emi=mat.emissive||new THREE.Color(0),count=idx?idx.count:pos.count;
   for(let j=0;j<count;j+=3){let p=[points[idx?idx.getX(j):j],points[idx?idx.getX(j+1):j+1],points[idx?idx.getX(j+2):j+2]];
    const a=p[0],b=p[1],d=p[2],u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[d[0]-a[0],d[1]-a[1],d[2]-a[2]],nx=u[1]*v[2]-u[2]*v[1],ny=u[2]*v[0]-u[0]*v[2],nz=u[0]*v[1]-u[1]*v[0],nl=Math.hypot(nx,ny,nz)||1;
    if(mat.clippingPlanes?.length)p=clip(p);if(p.length<3)continue;
    const screen=p.map(project);if(screen.some(v=>!v))continue;
    if(screen.every(v=>v[0]<-20)||screen.every(v=>v[0]>w+20)||screen.every(v=>v[1]<-20)||screen.every(v=>v[1]>h+20))continue;
    const bright=.48+.52*Math.abs((nx*.3+ny*.8+nz*.52)/nl);const col=new THREE.Color(Math.min(1,c.r*bright+emi.r*.6),Math.min(1,c.g*bright+emi.g*.6),Math.min(1,c.b*bright+emi.b*.6));
    triangles.push({p:screen,z:screen.reduce((s,v)=>s+v[2],0)/screen.length,c:col.getStyle(),a:mat.opacity});
   }
  });
  triangles.sort((a,b)=>b.z-a.z);ctx.lineWidth=.35;for(const t of triangles){ctx.globalAlpha=t.a;ctx.fillStyle=t.c;ctx.strokeStyle=t.c;ctx.beginPath();t.p.forEach((v,i)=>i?ctx.lineTo(v[0],v[1]):ctx.moveTo(v[0],v[1]));ctx.closePath();ctx.fill();if(t.a===1)ctx.stroke();}ctx.globalAlpha=1;
 }
}

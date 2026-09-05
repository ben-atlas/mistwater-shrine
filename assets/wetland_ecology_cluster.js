export default function (THREE) {
  const g=new THREE.Group();
  const mk=(name,color,r)=>{const m=new THREE.MeshStandardMaterial({color,roughness:r,metalness:.015});m.name=name;return m;};
  const dark=mk('ground',0x202d24,.72), green=mk('foliage',0x315841,.66), moss=mk('foliage',0x496b45,.58), rock=mk('stone',0x536762,.54);
  const mound=new THREE.Mesh(new THREE.LatheGeometry([[0,0],[1.95,.02],[2.30,.14],[1.86,.29],[1.05,.38],[0,.43]].map(p=>new THREE.Vector2(...p)),32),dark);mound.scale.z=.40;mound.receiveShadow=true;g.add(mound);

  function bentRoot(points,radius){const holder=new THREE.Group();for(let i=0;i<points.length-1;i++){const a=new THREE.Vector3(...points[i]),b=new THREE.Vector3(...points[i+1]),mid=a.clone().add(b).multiplyScalar(.5),len=a.distanceTo(b);const seg=new THREE.Mesh(new THREE.CylinderGeometry(radius*.78,radius,len,9),dark);seg.position.copy(mid);seg.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());seg.castShadow=true;holder.add(seg);}g.add(holder);}
  bentRoot([[-2.18,.20,.20],[-1.65,.58,.46],[-1.05,.87,.48],[-.44,.61,.34],[.02,.22,.18]],.105);
  bentRoot([[2.12,.18,.40],[1.68,.52,.63],[1.05,.73,.61],[.46,.42,.44]],.095);
  bentRoot([[-1.75,.18,-.44],[-1.20,.48,-.67],[-.52,.59,-.65],[.15,.20,-.42]],.08);

  const pillarData=[[-.65,.67,-.14,.46,.82,.42,-.08],[.02,.54,-.14,.52,.58,.46,.06],[.60,.39,-.10,.48,.42,.40,-.05]];
  for(const [x,y,z,w,h,d,ry] of pillarData){
    const base=new THREE.Mesh(new THREE.BoxGeometry(w,h,d,2,3,2),rock);base.position.set(x,y,z);base.rotation.set(.03,ry,.02);base.castShadow=base.receiveShadow=true;g.add(base);
    for(let k=0;k<3;k++){const chip=new THREE.Mesh(new THREE.DodecahedronGeometry(.12+(k%2)*.035,0),rock);chip.scale.set(1.35,.65,1);chip.position.set(x+(k-1)*w*.31,y+h*.48+(k%2)*.04,z+.02);chip.rotation.set(k*.3,k*.7,0);g.add(chip);}
  }
  const lintel=new THREE.Mesh(new THREE.BoxGeometry(1.72,.22,.48,4,2,2),rock);lintel.position.set(-.12,1.17,-.13);lintel.rotation.set(.02,-.04,-.055);lintel.castShadow=true;g.add(lintel);
  for(const p of [[-.55,1.29,-.02,.42,.07,.22],[.12,1.17,.02,.36,.06,.20],[.58,.63,.10,.27,.055,.18]]){const m=new THREE.Mesh(new THREE.SphereGeometry(1,11,6),moss);m.scale.set(p[3],p[4],p[5]);m.position.set(p[0],p[1],p[2]);g.add(m);}

  const clusters=[[-1.98,-.42,9],[1.74,.52,10],[-1.12,.64,7],[1.08,-.65,8]];
  for(const [cx,cz,count] of clusters){
    for(let i=0;i<count;i++){
      const h=1.05+(i%5)*.25,ang=(i*.91)%6.28,rr=.07+(i%4)*.055;
      const stalk=new THREE.Mesh(new THREE.CylinderGeometry(.014,.034,h,7),green);stalk.position.set(cx+Math.cos(ang)*rr,.35+h/2,cz+Math.sin(ang)*rr);stalk.rotation.z=(i%2?1:-1)*(.025+(i%3)*.018);stalk.castShadow=true;g.add(stalk);
      if(i%2===0){const head=new THREE.Mesh(new THREE.CylinderGeometry(.025,.055,.22,8),moss);head.position.set(stalk.position.x,.35+h,stalk.position.z);head.rotation.z=stalk.rotation.z;g.add(head);}
    }
  }
  const box=new THREE.Box3(),v=new THREE.Vector3(),m=new THREE.Matrix4(),im=new THREE.Matrix4();g.updateMatrixWorld(true);g.traverse(n=>{const p=n.isMesh&&n.geometry.attributes.position;if(!p)return;const put=mx=>{for(let i=0;i<p.count;i++)box.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(mx));};if(n.isInstancedMesh){for(let c=0;c<n.count;c++){n.getMatrixAt(c,im);put(m.multiplyMatrices(n.matrixWorld,im));}}else put(n.matrixWorld);});const c=box.getCenter(new THREE.Vector3());g.children.forEach(o=>{o.position.x-=c.x;o.position.y-=box.min.y;o.position.z-=c.z;});return g;
}

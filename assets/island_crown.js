// Winner of job 1441's independent bank-crown batch: overlapping cellular
// hummocks create a continuous, non-polygonal walkable crown and broken edge.
export default function (THREE) {
  const g=new THREE.Group();
  const ground=new THREE.MeshStandardMaterial({color:0x304b2c,roughness:.96,flatShading:true});ground.name='ground';
  const moss=new THREE.MeshStandardMaterial({color:0x65834a,roughness:.9,flatShading:true});moss.name='foliage';
  const wet=new THREE.MeshStandardMaterial({color:0x263f38,roughness:.56,flatShading:true});wet.name='stone';
  const cells=[[-3.9,-2.4,2.7,2.1],[-1.5,-2.8,3.1,2.3],[1.4,-2.5,3.3,2.1],[4,-1.9,2.4,2.2],[-4,.3,2.8,2.5],[-1.2,.1,3.4,2.8],[2.1,.2,3.5,2.7],[4.2,.8,2.2,2.4],[-2.8,2.7,3,2],[.2,2.5,3.7,2.2],[3.4,2.7,2.7,2]];
  cells.forEach((c,i)=>{const geo=new THREE.SphereGeometry(1,12,7),p=geo.attributes.position;for(let n=0;n<p.count;n++){const x=p.getX(n),y=p.getY(n),z=p.getZ(n),q=1+.08*Math.sin(n*1.7+i);p.setXYZ(n,x*q,Math.max(-.72,y)*(1+.08*Math.cos(n+i)),z*q);}geo.computeVertexNormals();const m=new THREE.Mesh(geo,i%4===0?moss:ground);m.position.set(c[0],.28,c[1]);m.scale.set(c[2],.52+.12*(i%3),c[3]);m.castShadow=m.receiveShadow=true;g.add(m);});
  for(let i=0;i<24;i++){const a=i/24*Math.PI*2,r=4.7+.4*Math.sin(i*1.9),m=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),wet);m.position.set(Math.cos(a)*r,.12,Math.sin(a)*r*.82);m.scale.set(.55+.25*(i%3),.24+.09*(i%4),.62);m.castShadow=m.receiveShadow=true;g.add(m);}
  const b=new THREE.Box3().setFromObject(g),s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3());g.scale.set(12/s.x,1.1/s.y,10/s.z);g.children.forEach(o=>{o.position.x-=c.x;o.position.y-=b.min.y;o.position.z-=c.z;});
  g.userData.staticBakeable=true;g.userData.assetRole='connected_organic_island_crown';return g;
}

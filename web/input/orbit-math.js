export const identity=[0,0,0,1];
const clamp=x=>Math.max(-1,Math.min(1,x));
export const normalize=q=>{const n=Math.hypot(...q);return q.map(v=>v/n);};
export function multiply(a,b){return normalize([a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]]);}
export function axisAngle(axis,angle){const n=Math.hypot(...axis);if(!n)return identity.slice();const s=Math.sin(angle/2)/n;return [...axis.map(v=>v*s),Math.cos(angle/2)];}
export function matrix(q){const [x,y,z,w]=q;return [1-2*(y*y+z*z),2*(x*y+w*z),2*(x*z-w*y),2*(x*y-w*z),1-2*(x*x+z*z),2*(y*z+w*x),2*(x*z+w*y),2*(y*z-w*x),1-2*(x*x+y*y)];}
export function quaternion(m){
 const trace=m[0]+m[4]+m[8];let q;
 if(trace>0){const s=Math.sqrt(trace+1)*2;q=[(m[5]-m[7])/s,(m[6]-m[2])/s,(m[1]-m[3])/s,s/4];}
 else if(m[0]>m[4]&&m[0]>m[8]){const s=Math.sqrt(1+m[0]-m[4]-m[8])*2;q=[s/4,(m[3]+m[1])/s,(m[6]+m[2])/s,(m[5]-m[7])/s];}
 else if(m[4]>m[8]){const s=Math.sqrt(1+m[4]-m[0]-m[8])*2;q=[(m[3]+m[1])/s,s/4,(m[7]+m[5])/s,(m[6]-m[2])/s];}
 else{const s=Math.sqrt(1+m[8]-m[0]-m[4])*2;q=[(m[6]+m[2])/s,(m[7]+m[5])/s,s/4,(m[1]-m[3])/s];}
 return normalize(q);
}
export function distance(a,b){return 2*Math.acos(Math.min(1,Math.abs(a.reduce((s,v,i)=>s+v*b[i],0))));}
export function slerp(a,b,t){let d=a.reduce((s,v,i)=>s+v*b[i],0);if(d<0){b=b.map(v=>-v);d=-d;}d=clamp(d);if(d>.9995)return normalize(a.map((v,i)=>v+(b[i]-v)*t));const angle=Math.acos(d),den=Math.sin(angle);return a.map((v,i)=>(v*Math.sin((1-t)*angle)+b[i]*Math.sin(t*angle))/den);}
const axes=[[1,0,0],[0,1,0],[0,0,1]],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const cubeRotations=[];
for(let a=0;a<3;a++)for(let b=0;b<3;b++)if(a!==b)for(const sa of [-1,1])for(const sb of [-1,1]){const x=axes[a].map(v=>v*sa),y=axes[b].map(v=>v*sb);cubeRotations.push([...x,...y,...cross(x,y)]);}
// Select the closest outward normal first; then choose the nearest upright
// quarter-turn of that face. Target tilt is camera-relative, with optional roll.
export function frontFace(m){let axis=0;for(let k=1;k<3;k++)if(Math.abs(m[k*3+2])>Math.abs(m[axis*3+2]))axis=k;return {axis,sign:m[axis*3+2]>=0?1:-1};}
export function snapTarget(q,settings){
 const face=frontFace(matrix(q)),rad=Math.PI/180;
 const tilt=multiply(multiply(axisAngle([0,1,0],settings.orbitHorizontal*rad),axisAngle([1,0,0],-settings.orbitVertical*rad)),axisAngle([0,0,1],settings.orbitRoll*rad));
 let best=null,error=Infinity;
 for(const m of cubeRotations)if(m[face.axis*3+2]*face.sign>.99){const target=multiply(tilt,quaternion(m)),d=distance(q,target);if(d<error){best=target;error=d;}}
 return {q:best,face,error};
}
export function dragAxis(dx,dy,s){
 const angle=Math.atan2(dy,dx)*180/Math.PI,a=((angle%180)+180)%180,t=s.orbitTolerance;
 if(Math.min(a,180-a)<=t)return 'Y';if(Math.abs(a-90)<=t)return 'X';
 if(s.orbitDiagonalRoll&&Math.min(Math.abs(a-45),Math.abs(a-135))<=t)return 'Z';return 'XY';
}
export function dragRotation(dx,dy,axis,s,direction=[1,1]){
 const gain=s.orbitSensitivity*Math.PI/180;
 if(axis==='X')return axisAngle([1,0,0],dy*gain);
 if(axis==='Y')return axisAngle([0,1,0],dx*gain);
 if(axis==='Z'){const n=Math.hypot(...direction)||1;return axisAngle([0,0,1],-(dx*direction[0]+dy*direction[1])/n*Math.sign(direction[0]||1)*gain);}
 return axisAngle([dy,dx,0],Math.hypot(dx,dy)*gain);
}

// Captured axes can follow the cube. Post-multiply for cube-local rotation;
// pre-multiply for window-relative rotation. Uncaptured XY stays camera-relative.
export function cubeAxisEnabled(axis,s){return !!s[{X:'orbitCubeLR',Y:'orbitCubeUD',Z:'orbitCubeFB'}[axis]];}
export function applyDragRotation(q,dx,dy,axis,s,direction){
 const rotation=dragRotation(dx,dy,axis,s,direction);
 return cubeAxisEnabled(axis,s)?multiply(q,rotation):multiply(rotation,q);
}
export function axisLabel(axis,s){
 return cubeAxisEnabled(axis,s)?{X:'L-R',Y:'U-D',Z:'F-B'}[axis]:axis==='XY'?'Free XY':`Camera ${axis}`;
}
// Split exactly at capture boundaries, using the same precedence as dragAxis.
export function captureSectors(s){
 const bounds=new Set([0,360]);
 for(const a of [0,45,90,135,180,225,270,315])for(const d of [-s.orbitTolerance,s.orbitTolerance])bounds.add(((a+d)%360+360)%360);
 const ordered=[...bounds].sort((a,b)=>a-b),segments=[];
 for(let i=1;i<ordered.length;i++){
  const start=ordered[i-1],end=ordered[i],mid=(start+end)/2*Math.PI/180;
  const axis=dragAxis(Math.cos(mid),Math.sin(mid),s),prev=segments.at(-1);
  if(s.orbitTolerance>0&&prev?.axis===axis)prev.end=end;else segments.push({start,end,axis});
 }
 return segments;
}

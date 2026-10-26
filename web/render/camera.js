export const CAMERA_DISTANCE = 7;
export function viewPoint(r, [x,y,z]) {
 const m=r.orientation;
 return [m[0]*x+m[3]*y+m[6]*z,m[1]*x+m[4]*y+m[7]*z,m[2]*x+m[5]*y+m[8]*z];
}
export function projectPoint(r,p) {
 const [x,y,z]=viewPoint(r,p),w=r.perspective ? 1-z/CAMERA_DISTANCE : 1;
 return [x/w,y/w,z];
}
export function pointerRay(r,e) {
 const rect=r.canvas.getBoundingClientRect(),m=r.orientation;
 const x=(e.clientX-rect.left-rect.width/2)/r.unit,y=-(e.clientY-rect.top-rect.height/2)/r.unit;
 const inverse=v=>[0,1,2].map(i=>m[i*3]*v[0]+m[i*3+1]*v[1]+m[i*3+2]*v[2]);
 return r.perspective ? {origin:inverse([0,0,CAMERA_DISTANCE]),dir:inverse([x,y,-CAMERA_DISTANCE])}
 : {origin:inverse([x,y,8]),dir:inverse([0,0,-1])};
}

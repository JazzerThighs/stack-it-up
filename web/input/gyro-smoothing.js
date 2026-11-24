import {multiply, axisAngle, distance, slerp} from './orbit-math.js';
const rad=Math.PI/180;
const inverse=q=>[-q[0],-q[1],-q[2],q[3]];
const limit=(v,max)=>{const n=Math.hypot(...v);return n>max?v.map(x=>x*max/n):v;};

// A critically damped angular spring gives an eased trajectory without restarting
// a Bezier curve at every packet. Velocity survives target changes; acceleration
// and speed limits keep large jumps and reversals readable.
export function createGyroSmoothing({tightness=()=>1,response=()=>180,speed=()=>180,acceleration=()=>1200}={}){
 let pose,target,velocity=[0,0,0];
 return {
  reset(q){pose=target=q;velocity=[0,0,0];},
  target(q){target=q;},
  settle(seconds,tightness){
   // Follow the shortest arc without carrying angular velocity from the turn.
   velocity=[0,0,0];
   pose=slerp(pose,target,1-Math.exp(-Math.max(0,seconds)*tightness/0.1));
   const done=distance(pose,target)<.01*rad;
   if(done)pose=target;
   return {pose,done};
  },
  step(seconds){
   if(!pose||!target)return {pose,done:true};
   let remaining=Math.max(0,Math.min(seconds,.05));
   const omega=4000*tightness()/Math.max(10,response());
   const maxAcceleration=acceleration()*rad;
   while(remaining>1e-9){
    const dt=Math.min(remaining,1/240);remaining-=dt;
    let error=multiply(target,inverse(pose));
    if(error[3]<0)error=error.map(x=>-x);
    const n=Math.hypot(...error.slice(0,3));
    const angle=2*Math.atan2(n,Math.max(0,error[3]));
    const vector=n>1e-12?error.slice(0,3).map(x=>x*angle/n):[0,0,0];
    // Keep enough distance to brake, even at the shortest easing time.
    const brakingSpeed=Math.sqrt(2*maxAcceleration*angle+(maxAcceleration*dt)**2)-maxAcceleration*dt;
    const desired=limit(vector.map(x=>x*omega/2),brakingSpeed);
    const gain=Math.min(2*omega,1/dt);
    const a=limit(desired.map((v,i)=>(v-velocity[i])*gain),maxAcceleration);
    velocity=limit(velocity.map((x,i)=>x+a[i]*dt),speed()*rad);
    const rate=Math.hypot(...velocity);
    if(rate>1e-12)pose=multiply(axisAngle(velocity,rate*dt),pose);
   }
   const done=distance(pose,target)<.01*rad&&Math.hypot(...velocity)<.1*rad;
   if(done){pose=target;velocity=[0,0,0];}
   return {pose,done};
  }
 };
}

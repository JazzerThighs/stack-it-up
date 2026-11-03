// A soft, finite light in camera space. Position supplies most of the gradient;
// normals contribute only a small amount to keep the relief walls legible.
export const gameboyLightingGLSL=`
float gameboyLight(vec3 position, vec3 normal, vec3 direction) {
  vec3 delta=direction*4.-position;
  float distanceSquared=dot(delta,delta);
  float proximity=12./(8.+distanceSquared);
  float facing=max(0.,dot(normal,delta*inversesqrt(max(distanceSquared,.0001))));
  return proximity*(.9+.1*facing);
}`;
export function gameboyLight(position,normal,direction) {
  const delta=direction.map((v,i)=>v*4-position[i]);
  const distanceSquared=delta.reduce((s,v)=>s+v*v,0);
  const facing=Math.max(0,normal.reduce((s,v,i)=>s+v*delta[i],0)/Math.sqrt(Math.max(distanceSquared,.0001)));
  return 12/(8+distanceSquared)*(.9+.1*facing);
}

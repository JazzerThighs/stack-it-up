import {orbitSettings} from '../input/orbit-settings.js';
import {jellyStyleKey} from '../render/visual-settings.js';
import {controlSettings,subscribeControls,setControlSetting} from '../input/control-settings.js';
import {sceneDecorations} from '../render/decorations.js';
import {createMoveButtons} from '../ui/move-buttons.js';
import {S} from '../engine/snapshot.js';
import {gameboyCell} from '../render/gameboy-mesh.js';
import {unregisterRenderer} from '../render/recovery.js';
import {solidStyleKey} from '../render/identity-solids.js';
import {visualSettings} from '../render/visual-settings.js';
import {mergeFragments,joinMeshes,exposedFragment,neighborCell} from '../render/cell-fragments.js';
import {turnTransform,composeRotation,movedCell} from '../render/transforms.js';
import {CubeStack} from '../engine/coordinates.js';
import {explorationMeshes} from "./exploration-mesh.js";
import {CAMERA_DISTANCE} from "../render/camera.js";
import {compositeParts,jellyCell} from "../render/piece-mesh.js";
import { Renderer } from "../render/renderer.js";
import { balloon, box, xyz, rgb, rotateCell } from "../render/geometry.js";
import { renderPackets } from "../render/pipeline.js";
import { PALETTE, NOTATION, turn } from "./model.js";

// Uses the game's WebGL buffers, shaders, camera, rounded geometry and drag
// picker. Packing state is independent of the game's rules and shared context.
export class PackingCube extends Renderer {
  constructor(
    host,
    { readOnly = false, onChange = () => {}, controls = true } = {},
  ) {
    const canvas = document.createElement("canvas"),
      labels = document.createElement("canvas");
    canvas.className = "packing-canvas";
    canvas.tabIndex = 0;
    canvas.setAttribute(
      "aria-label",
      readOnly
        ? "Target packing. Drag to orbit."
        : "Packing cube. Drag a sticker to turn; right-drag or drag background to orbit.",
    );
    host.replaceChildren(canvas);
    let view;
    const context = {
      get state() {
        return view?.cells;
      },
      get busy() {
        return view?.busy;
      },
      setBusy: (v) => (view.busy = v),
      play: (m, t) => view.play(m, t),
      animate: (ms, fn) => view.animate(ms, fn),
      invalidate: () => view?.invalidate(),
    };
    super(canvas, labels, {
      onOrbit: (dx, dy, orientation) => {
        if(orientation)view.orientation=orientation.slice();
        else if(controlSettings.freeOrbit)view.orbit(dx,dy);
        else {view.yaw=Math.atan2(Math.sin(view.yaw+dx),Math.cos(view.yaw+dx));view.pitch=Math.max(-1.4,Math.min(1.4,view.pitch+dy));view.resetOrientation();}
        view.invalidate();
      },
      inputContext: context,
    });
    view = this;
    this.host = host;
    this.orbitOnly = readOnly;
    this.skipGameLocks = true;
    this.onChange = onChange;
    this.cells = [];
    this.history = [];
    this.busy = false;
    this.generation = 0;
    this.opacity = 1;
    this.connected = false;
    this.status = document.createElement("span");
    this.status.className = "packing-move-status";
    this.status.setAttribute("role", "status");
    const toolbar = document.createElement("div");
    toolbar.className = "packing-actions";
    const button = (text, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      b.onclick = fn;
      toolbar.append(b);
      return b;
    };
    if (!readOnly && controls) {
      this.moveSelect = document.createElement("select");
      this.moveSelect.setAttribute("aria-label", "Cube move");
      for (let m = 0; m < 30; m++) {
        const o = document.createElement("option");
        o.value = m;
        o.textContent = NOTATION[m % 15] + (m >= 15 ? "'" : "");
        this.moveSelect.append(o);
      }
      toolbar.append(this.moveSelect);
      button("Turn", () => this.play(Number(this.moveSelect.value)));
      this.undoButton = button("Undo", () => this.undo());
      button("Reset", () => this.reset());
    }
    button("Reset view", () => {
      this.resetOrientation();
      this.invalidate();
    });
    toolbar.append(this.status);
    host.append(toolbar);
    this.arrowHost=document.createElement('div');this.arrowHost.className='packing-arrow-controls';host.append(this.arrowHost);
    this.classicGrid=document.createElement('div');this.classicGrid.className='packing-classic-controls';host.append(this.classicGrid);
    this.attachedNodes=[];
    if(!readOnly){
      const arrows=createMoveButtons({renderers:[this],get state(){return null;},get busy(){return view.busy;},play:m=>this.play(m),invalidate:()=>this.invalidate(),
        getElementById:id=>id==='cubeMoves'?this.arrowHost:{checked:controlSettings[id]}});
      this.attachedNodes=arrows.attachedNodes;this.layoutArrows=arrows.layoutCubeControls;
      for(let m=0;m<30;m++){
        const b=document.createElement('button');b.type='button';b.textContent=NOTATION[m%15]+(m>=15?"'":'');
        b.onclick=()=>this.play(m);this.classicGrid.append(b);
      }
      this.widthButton=button('Regular turns',()=>setControlSetting('wideTurns',!controlSettings.wideTurns));
    }
    this.stopControls=subscribeControls(()=>this.syncControls());this.syncControls();
    this.observer = new ResizeObserver(() => this.invalidate());
    this.observer.observe(host);
    canvas.addEventListener("keydown", (e) => {
      if (e.key === "Home") {
        this.resetOrientation();
        this.invalidate();
        e.preventDefault();
      }
      const m = NOTATION.indexOf(e.key.toUpperCase());
      if (!readOnly && m >= 0 && m < 9 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        this.play(m + (e.shiftKey ? 15 : 0));
      }
    });

  }
  syncControls() {
    this.wideTurns=controlSettings.wideTurns;this.perspective=controlSettings.perspectiveCamera;
    if(!controlSettings.freeOrbit&&!orbitSettings.orbitSettling){this.pitch=Math.max(-1.4,Math.min(1.4,this.pitch));this.resetOrientation();}
    this.arrowHost.hidden=this.orbitOnly || !controlSettings.showArrows;
    this.classicGrid.hidden=this.orbitOnly || !controlSettings.classicControls;
    if(this.widthButton){this.widthButton.textContent=this.wideTurns?'Wide turns':'Regular turns';this.widthButton.setAttribute('aria-pressed',String(this.wideTurns));}
    this.refreshTurnHover?.();this.invalidate();
  }
  hoverCellGeometry(i) {
    const out=[];
    if(['jelly','angular'].includes(this.modelShape) && this.meshGenerator)jellyCell(out,i,[1,1,1],this.meshGenerator,.465,this.modelShape);
    else (this.modelShape==='gameboy'?gameboyCell:balloon)(out,xyz(i),.465,[1,1,1],this.cells[i]?.piece<0?'bomb':'O');
    return out;
  }
  setCells(cells) {
    this.generation++;
    this.busy = false;
    this.cells = cells.slice();
    this.initial = cells.slice();
    this.history = [];
    this.setState(this.cells);
    this.changed();
  }
  setState(cells, animation = null) {
    this.currentAnimation = animation;
    const out = [];
    if (this.familyExploration && this.meshGenerator) {
      const signature=JSON.stringify([cells,cells.map(c=>c?.solidRotation),this.modelShape,this.explorationSolids,this.explorationGray,this.fixedPieceColors,solidStyleKey(),jellyStyleKey(),PALETTE]);
      if(signature!==this.explorationSignature) {
        this.explorationSignature=signature;
        this.explorationGeometry=explorationMeshes(cells,this.meshGenerator,this.modelShape,this.explorationSolids,this.explorationGray,this.fixedPieceColors);
        const fixed=visualSettings.solidFixed;
        {
          this.fixedSolidBuffers ??= Array.from({length:27},()=>this.buffer());
          for(let cell=0;cell<27;cell++)this.upload(this.fixedSolidBuffers[cell],joinMeshes(this.explorationGeometry.filter(m=>m.identityCell===cell)));
        }
        const turningGeometry=this.explorationGeometry.filter(m=>m.identityCell===undefined);
        const fragments=mergeFragments(turningGeometry);
        this.explorationLayers ??= Array.from({length:45},()=>this.buffer());
        // Five motion partitions per axis: three single slices and two wide turns.
        for(let axis=0;axis<3;axis++)for(let mode=0;mode<5;mode++) {
          const moving=i=>mode<3 ? i===mode : i!== (mode===3?2:0);
          const visible=fragments.map((mesh,cell)=>exposedFragment(mesh,cell,(a,side)=>{
            const neighbor=neighborCell(cell,a,side);
            return neighbor<0 || moving(CubeStack.xyz(cell)[axis])!==moving(CubeStack.xyz(neighbor)[axis]);
          }));
          for(let layer=0;layer<3;layer++)
            this.upload(this.explorationLayers[(axis*5+mode)*3+layer],joinMeshes(visible.filter((_,i)=>CubeStack.xyz(i)[axis]===layer)));
        }
        this.upload(this.solid,joinMeshes(turningGeometry));
      }
      this.invalidate();this.onFrame?.(cells,animation);return;
    }
    if (this.connected && this.meshGenerator && !animation) {
      const parts=compositeParts(cells.map(c=>c?.color || 0), cells.map((c,i)=>c?.piece>=0 ? c.piece+1 : i+100), PALETTE, this.meshGenerator, this.modelShape,false,cells.reduce((mask,c,i)=>c && c.piece<0?mask|(1<<i):mask,0));
      const mesh=joinMeshes(parts);
      this.upload(this.solid,mesh); this.invalidate(); this.onFrame?.(cells,animation); return;
    }
    cells.forEach((cell, i) => {
      if (!cell) return;
      const start = out.length;
      if(['jelly','angular'].includes(this.modelShape) && this.meshGenerator)jellyCell(out,i,rgb(PALETTE[cell.color] || PALETTE.d),this.meshGenerator,.465,this.modelShape);
      else (this.modelShape==='gameboy'?gameboyCell:balloon)(out, xyz(i), 0.465, rgb(PALETTE[cell.color] || PALETTE.d),cell.piece<0?'bomb':'O');
      if (animation?.kind === "turn") rotateCell(out, start, i, animation.move, animation.t);
    });
    this.upload(this.solid, new Float32Array(out));
    this.invalidate();
    this.onFrame?.(cells, animation);
  }
  changed() {
    if (this.undoButton) this.undoButton.disabled = !this.history.length;
    this.status.textContent = `${this.history.length} turns`;
    this.onChange(this);
  }
  async animate(ms, fn) {
    const generation = this.generation;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      fn(1);
      return;
    }
    const start = performance.now();
    await new Promise((resolve) => {
      const frame = (now) => {
        if (generation !== this.generation) {
          resolve();
          return;
        }
        const t = this.isVisible() ? Math.min(1, (now - start) / ms) : 1;
        fn(t);
        this.invalidate();
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
  }
  async play(move, start = 0) {
    if (this.busy || this.orbitOnly || !this.cells.length) return;
    this.busy = true;
    const generation = this.generation,
      from = this.cells.slice();
    await this.animate(180 * (1 - start), (t) =>
      this.setState(from, { kind: "turn", move, t: start + (1 - start) * t }),
    );
    if (generation !== this.generation) return;
    this.history.push({ cells: from, move });
    this.cells = turn(from.map((cell,i)=>cell && movedCell(i,move)?Object.defineProperty({...cell},'solidRotation',{value:composeRotation(turnTransform(move,1),cell.solidRotation)}):cell), move);
    this.busy = false;
    this.setState(this.cells);
    this.changed();
  }
  undo() {
    if (this.busy || !this.history.length) return;
    this.cells = this.history.pop().cells;
    this.setState(this.cells);
    this.changed();
  }
  reset() {
    if (this.initial) this.setCells(this.initial);
  }
  isVisible() {
    return !document.hidden && !document.getElementById("explorerPage")?.hidden;
  }
  invalidate() {
    if (!this.isVisible()) return;
    if (this.pendingFrame) return;
    this.pendingFrame = requestAnimationFrame(() => {
      this.pendingFrame = 0;
      this.draw();
    });
  }
  draw() {
    if (this.contextLost || this.gl.isContextLost?.()) return;
    if (!this.isVisible()) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const gl = this.gl,
      dpr = Math.min(devicePixelRatio || 1, 2),
      w = Math.round(rect.width * dpr),
      h = Math.round(rect.height * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.unit = Math.max(8, Math.min(rect.width - 32, rect.height - 120) / (this.fitScale || 6.0));
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniform1f(this.uniforms.cameraDistance,this.perspective ? CAMERA_DISTANCE : 0);
    gl.uniformMatrix3fv(this.uniforms.orientation, false, this.orientation);
    gl.uniform2f(
      this.uniforms.scale,
      (2 * this.unit) / rect.width,
      (2 * this.unit) / rect.height,
    );
    gl.disable(gl.CULL_FACE);
    let packets=[{id:'packing',target:this.solid,type:gl.TRIANGLES,opacity:this.opacity,unlit:false,breathe:1}];
    if(this.familyExploration && this.currentAnimation?.kind==='turn' && this.currentAnimation.t>0) {
      const {move,t}=this.currentAnimation,[,axis,layer,side]=CubeStack.moves[move%15];
      const rotation=turnTransform(move,t);
      packets=[0,1,2].map(i=>({id:'packing',target:this.explorationLayers[(axis*5+(layer==='wide'?(side===0?3:4):layer))*3+i],type:gl.TRIANGLES,
        opacity:this.opacity,unlit:false,breathe:1,rotation:(layer==='wide'?i!==2-side:i===layer)?rotation:undefined}));
    }
    if(this.familyExploration)for(let cell=0;cell<27;cell++) {
      const target=this.fixedSolidBuffers?.[cell];if(!target?.count)continue;
      const animation=this.currentAnimation;
      packets.push({id:'packing',target,type:gl.TRIANGLES,opacity:this.opacity,unlit:false,breathe:1,lightingClass:'Solids',fixedShape:!!visualSettings.solidFixed,
        rotation:animation?.kind==='turn' && movedCell(cell,animation.move)?turnTransform(animation.move,animation.t):undefined});
    }
    if(controlSettings.showArrows && !this.orbitOnly)this.layoutArrows?.(rect.width,rect.height,this.unit,p=>this.project(p));
    const feedback=new Uint32Array(300);
    for(let i=0;i<27;i++)if(this.cells[i])feedback[S.ACTIVE]|=1<<i;
    if(!this.busy && !this.orbitOnly && !this.currentAnimation && !this.orbitDragging && (this.hover || controlSettings.showArrows))sceneDecorations.call(this,(id,target,type,opacity,unlit)=>packets.push({id,target,type,opacity,unlit,breathe:1}),this.unit,{
      hideLabels:true,state:feedback,busy:this.busy || this.orbitOnly,attachedNodes:this.orbitOnly?[]:this.attachedNodes,
      getControl:id=>({checked:id==='placementGlow'?false:!!controlSettings[id]}),
    });
    renderPackets.call(
      this,
      packets, /* retained cell fragments, moved entirely by GPU uniforms */
      { customLayers: false, layerOrder: [] },
    );
  }
  destroy() {
    this.orbitController?.dispose();
    this.stopControls?.();
    unregisterRenderer(this);
    this.generation++;
    this.observer.disconnect();
    if (this.pendingFrame) cancelAnimationFrame(this.pendingFrame);
    for (const value of this.buffers) {
      this.gl.deleteBuffer(value.buffer);this.gl.deleteBuffer(value.coverageBuffer);
      this.gl.deleteVertexArray(value.vao);
    }
    this.buffers.clear();
    this.asciiPass?.destroy();
    this.ditherPass?.destroy();
    this.gl.deleteProgram(this.program);
    this.host.replaceChildren();
  }
}

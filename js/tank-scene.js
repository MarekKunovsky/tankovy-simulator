import * as THREE     from 'https://unpkg.com/three@0.156.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.156.0/examples/jsm/loaders/GLTFLoader.js';
////////////////////////////////////////////////////////////////////////////////
// 1) Pointer-lock + kurzor / Ctrl=re-lock / blok pravého menu
const container = document.getElementById('game-container');
container.style.position = 'relative';
container.style.cursor   = 'none';
container.addEventListener('click',       () => container.requestPointerLock());
container.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('pointerlockchange', () => {
 container.style.cursor =
   document.pointerLockElement === container ? 'none' : 'auto';
});
window.addEventListener('keyup', e => {
 if (e.key === 'Control') container.requestPointerLock();
});
// ** Auto-lock immediately on load **
container.requestPointerLock();
////////////////////////////////////////////////////////////////////////////////
// 2) Scéna + kamera (sférické souřadnice)
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa0a0a0);
const camera = new THREE.PerspectiveCamera(
 60, window.innerWidth/window.innerHeight, 0.001, 1000
);
const spherical = new THREE.Spherical(0.2, THREE.MathUtils.degToRad(45), 0);
const minPhi    = THREE.MathUtils.degToRad(5);
const maxPhi    = THREE.MathUtils.degToRad(175);
const minRadius = 0.1;
const maxRadius = 0.5;
let sniperMode = false;
////////////////////////////////////////////////////////////////////////////////
// 3) Renderer + světla
const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff,0x444444,1.2));
const dirLight = new THREE.DirectionalLight(0xffffff,0.8);
dirLight.position.set(-10,20,-10);
scene.add(dirLight);
////////////////////////////////////////////////////////////////////////////////
// 4) WSAD + SHIFT toggle sniper + pravé tlačítko pauza věže
const keys = { w:0, s:0, a:0, d:0 };
window.addEventListener('keydown', e => {
 if (keys[e.key] !== undefined) keys[e.key] = 1;
 if (e.key === 'Shift') {
   sniperMode = !sniperMode;
   // realign camera to barrel on entering sniper
   if (sniperMode && pGun) {
     const quat = new THREE.Quaternion();
     pGun.getWorldQuaternion(quat);
     const dir = new THREE.Vector3(0,0,1).applyQuaternion(quat).normalize();
     // spherical: phi = angle from y‐axis, theta = around y
     spherical.phi   = Math.acos(dir.y);
     spherical.theta = Math.atan2(dir.x, dir.z);
   }
   crosshair.style.display = sniperMode ? 'block' : 'none';
   if (pTurret && pGun) {
     pTurret.visible = !sniperMode;
     pGun.visible    = !sniperMode;
   }
 }
});
window.addEventListener('keyup', e => {
 if (keys[e.key] !== undefined) keys[e.key] = 0;
});
let rightDown = false;
window.addEventListener('mousedown', e => { if (e.button===2) rightDown = true; });
window.addEventListener('mouseup',   e => { if (e.button===2) rightDown = false; });
////////////////////////////////////////////////////////////////////////////////
// 5) Free-look myší (pointermove)
document.addEventListener('pointermove', e => {
 if (document.pointerLockElement !== container) return;
 spherical.theta = (spherical.theta - e.movementX*0.003 + 2*Math.PI)%(2*Math.PI);
 const dy = e.movementY * 0.003;
 if (sniperMode) {
   spherical.phi = THREE.MathUtils.clamp(spherical.phi + dy, minPhi, maxPhi);
 } else {
   spherical.phi = THREE.MathUtils.clamp(spherical.phi - dy, minPhi, maxPhi);
 }
});
////////////////////////////////////////////////////////////////////////////////
// 6) Zoom kolečkem (20 kroků)
document.addEventListener('wheel', e => {
 const step = (maxRadius - minRadius)/20;
 spherical.radius = THREE.MathUtils.clamp(
   spherical.radius + (e.deltaY>0 ? step : -step),
   minRadius, maxRadius
 );
});
////////////////////////////////////////////////////////////////////////////////
// 7) Crosshair overlay (HTML/CSS)
const crosshair = document.createElement('div');
crosshair.style.position      = 'absolute';
crosshair.style.top           = '50%';
crosshair.style.left          = '50%';
crosshair.style.transform     = 'translate(-50%,-50%)';
crosshair.style.pointerEvents = 'none';
crosshair.style.zIndex        = '10000';
crosshair.style.display       = 'none';
crosshair.innerHTML = `
<svg width="24" height="24" viewBox="0 0 24 24">
<line x1="12" y1="0"   x2="12" y2="24" stroke="white" stroke-width="2"/>
<line x1="0"  y1="12"  x2="24" y2="12" stroke="white" stroke-width="2"/>
</svg>`;
container.appendChild(crosshair);
////////////////////////////////////////////////////////////////////////////////
// 8) Načtení mapy + tanků
const loader     = new GLTFLoader();
const playerTank = new THREE.Group(), enemyTank = new THREE.Group();
scene.add(playerTank, enemyTank);
enemyTank.position.set(2,0,0);
playerTank.userData = {
 speed:              0,
 hp:                 3000, maxHp:3000,
 baseDispersion:     0.005,
 maxDispersion:      0.02,
 shotDispersion:     0.015,
 recoverSpeed:       0.005,
 moveDispersion:     0.002,   // full when at max speed
 chassisDispersion:  0.0015,  // full when yawing 5s
 turretDispersion:   0.0005,  // full when turret yawing 5s
 chassisTimeToFull:  5.0,
 turretTimeToFull:   5.0,
 currentShotDisp:    0
};
enemyTank.userData = { hp:3000, maxHp:3000 };
let pTurret, pGun, eTurret, eGun, barOffsetY;
const enemyMeshes = [];
const turnSpeed   = THREE.MathUtils.degToRad(20);
const MAX_PITCH   = THREE.MathUtils.degToRad(24);
const MIN_PITCH   = THREE.MathUtils.degToRad(-8);
// dispersion ring (bright yellow, always on top)
let dispersionRing;
{
 const thickness = 0.05;
 const geo = new THREE.RingGeometry(1-thickness,1+thickness,64);
 const mat = new THREE.MeshBasicMaterial({
   color:       0xffff00,
   side:        THREE.DoubleSide,
   transparent: true,
   opacity:     0.7,
   depthTest:   false,
   depthWrite:  false
 });
 dispersionRing = new THREE.Mesh(geo, mat);
 dispersionRing.renderOrder = 9999;
 scene.add(dispersionRing);
}
loader.load('models/Mapa.glb', gltf => scene.add(gltf.scene));
loader.load('models/Maus_Tank.glb', gltf => {
 gltf.scene.traverse(n => { if (n.isMesh) console.log('loaded mesh:',n.name); });
 const rp = gltf.scene.clone(true), re = gltf.scene.clone(true);
 playerTank.add(rp); setupTank(rp, playerTank, true);
 enemyTank.add(re);  setupTank(re, enemyTank, false);
});
////////////////////////////////////////////////////////////////////////////////
// 9) setupTank
function setupTank(root, grp, isPlayer) {
 if (isPlayer) {
   const bb = new THREE.Box3().setFromObject(root);
   barOffsetY = bb.max.y + 0.02;
 }
 let tm = null, guns = [];
 root.traverse(n => {
   if (!n.isMesh) return;
   const nm = n.name.toLowerCase();
   if (nm.includes('turret')) tm = n;
   if (nm.includes('gun'))    guns.push(n);
 });
 // turret pivot
 const tP = new THREE.Object3D();
 tP.position.copy(tm.position);
 root.add(tP);
 tm.position.set(0,0,0);
 tP.add(tm);
 // gun pivot
 const gP = new THREE.Object3D();
 tP.add(gP);
 const muzzle = new THREE.Vector3();
 guns[0].getWorldPosition(muzzle);
 tP.worldToLocal(muzzle);
 gP.position.copy(muzzle);
 guns.forEach(m => gP.attach(m));
 if (isPlayer) { pTurret = tP; pGun = gP; }
 else           { eTurret = tP; eGun = gP; }
 root.traverse(n => { if (n.isMesh && !isPlayer) enemyMeshes.push(n); });
}
////////////////////////////////////////////////////////////////////////////////
// 10) Health-bary
const barGeo = new THREE.PlaneGeometry(0.03,0.01);
const bgMat  = new THREE.MeshBasicMaterial({ color:0x333333 });
const fgMat  = new THREE.MeshBasicMaterial({ color:0x00ff00 });
const pBG = new THREE.Mesh(barGeo,bgMat), pFG = new THREE.Mesh(barGeo,fgMat);
[pBG,pFG].forEach(m => { m.rotation.x=-Math.PI/2; scene.add(m); });
const eBG = pBG.clone(), eFG = pFG.clone(); scene.add(eBG,eFG);
////////////////////////////////////////////////////////////////////////////////
// 11) Projektily & kolize
const projectiles = [];
const projGeo     = new THREE.SphereGeometry(0.005,8,8);
const projMat     = new THREE.MeshBasicMaterial({ color:0xff0000 });
const ray         = new THREE.Raycaster();
window.addEventListener('mousedown', e => {
 if (e.button!==0 || !pGun) return;
 const ud = playerTank.userData;
 ud.currentShotDisp = Math.min(ud.currentShotDisp + ud.shotDispersion, ud.maxDispersion);
 const shot = new THREE.Mesh(projGeo,projMat);
 const origin= new THREE.Vector3(); pGun.getWorldPosition(origin);
 const quat  = new THREE.Quaternion(); pGun.getWorldQuaternion(quat);
 shot.position.copy(origin);
 const cosMax = Math.cos(ud.baseDispersion + ud.currentShotDisp);
 const z      = cosMax + (1-cosMax)*Math.random();
 const sinT   = Math.sqrt(1-z*z);
 const phi    = 2*Math.PI*Math.random();
 const local  = new THREE.Vector3(Math.cos(phi)*sinT, Math.sin(phi)*sinT, z);
 const dir    = local.applyQuaternion(quat).normalize();
 scene.add(shot);
 projectiles.push({ mesh:shot, dir, prev:origin.clone() });
});
////////////////////////////////////////////////////////////////////////////////
// 12) Resize
window.addEventListener('resize', ()=>{
 camera.aspect = window.innerWidth/window.innerHeight;
 camera.updateProjectionMatrix();
 renderer.setSize(window.innerWidth,window.innerHeight);
});
////////////////////////////////////////////////////////////////////////////////
// 13) Hlavní animační smyčka
const clock = new THREE.Clock();
(function animate(){
 const dt = clock.getDelta(), ud = playerTank.userData;
 // a) pohyb + chassis yaw
 if (playerTank) {
   const maxS=0.075, acc=maxS/6, drag=maxS/0.3;
   let v = ud.speed;
   if      (keys.w) v = Math.min(maxS, v+acc*dt);
   else if (keys.s) v = Math.max(-maxS, v-acc*dt);
   else             v = v>0 ? Math.max(0, v-drag*dt) : Math.min(0, v+drag*dt);
   ud.speed = v;
   playerTank.translateZ(v*dt);
   if (keys.a) playerTank.rotation.y += turnSpeed*dt;
   if (keys.d) playerTank.rotation.y -= turnSpeed*dt;
 }
 // b) turret yaw
 if (pTurret && !rightDown) {
   const wp   = new THREE.Vector3(); pTurret.getWorldPosition(wp);
   const camD = sniperMode
     ? spherical.theta
     : Math.atan2(camera.position.x-wp.x, camera.position.z-wp.z);
   const tgt  = camD - playerTank.rotation.y + (sniperMode?0:Math.PI);
   const diff = Math.atan2(Math.sin(tgt-pTurret.rotation.y),
                           Math.cos(tgt-pTurret.rotation.y));
   const d    = THREE.MathUtils.clamp(diff, -turnSpeed*dt, turnSpeed*dt);
   pTurret.rotation.y += d;
 }
 // c) gun pitch
 if (pGun && !rightDown) {
   let raw = sniperMode
     ? (Math.PI/2 - spherical.phi)
     : (spherical.phi - Math.PI/2);
   raw = THREE.MathUtils.clamp(raw, MIN_PITCH, MAX_PITCH);
   const dx = THREE.MathUtils.clamp(-raw - pGun.rotation.x, -turnSpeed*dt, turnSpeed*dt);
   pGun.rotation.x += dx;
 }
 // d) progressive dispersion
 ud.currentShotDisp = Math.max(0, ud.currentShotDisp - ud.recoverSpeed*dt);
 const moveF = Math.min(1, Math.abs(ud.speed)/0.075);
 const dispMove = moveF * ud.moveDispersion;
 let dispCh  = 0;
 if (keys.a||keys.d) {
   dispCh = Math.min(ud.chassisDispersion,
     (Math.min(ud.chassisTimeToFull, clock.elapsedTime)/ud.chassisTimeToFull)*
     ud.chassisDispersion
   );
 }
 let dispTur = 0;
 if (pTurret && (keys.a||keys.d)) {
   dispTur = Math.min(ud.turretDispersion,
     (Math.min(ud.turretTimeToFull, clock.elapsedTime)/ud.turretTimeToFull)*
     ud.turretDispersion
   );
 }
 let totalDisp = ud.baseDispersion + dispMove + dispCh + dispTur + ud.currentShotDisp;
 totalDisp = THREE.MathUtils.clamp(totalDisp, ud.baseDispersion, ud.maxDispersion);
 // e) update ring
 if (dispersionRing && pGun) {
   const gp = new THREE.Vector3(), gq = new THREE.Quaternion();
   pGun.getWorldPosition(gp);
   pGun.getWorldQuaternion(gq);
   const forward = new THREE.Vector3(0,0,1).applyQuaternion(gq);
   dispersionRing.position.copy(gp).add(forward.multiplyScalar(10));
   dispersionRing.quaternion.copy(gq);
   const scale = Math.tan(totalDisp)*10;
   dispersionRing.scale.set(scale,scale,1);
 }
 // f) projectiles & collisions
 projectiles.forEach((p,i)=>{
   const prev = p.prev;
   p.mesh.position.addScaledVector(p.dir,10*dt);
   const curr = p.mesh.position;
   ray.set(prev,curr.clone().sub(prev).normalize());
   ray.far = prev.distanceTo(curr);
   const hits = ray.intersectObjects(enemyMeshes,false);
   if (hits.length) {
     enemyTank.userData.hp = Math.max(0,enemyTank.userData.hp-500);
     scene.remove(p.mesh); projectiles.splice(i,1);
   } else if (curr.distanceTo(camera.position)>50) {
     scene.remove(p.mesh); projectiles.splice(i,1);
   } else {
     p.prev.copy(curr);
   }
 });
 // g) health bars
 [[playerTank,pBG,pFG],[enemyTank,eBG,eFG]].forEach(([grp,bg,fg])=>{
   const hp=grp.userData.hp, mx=grp.userData.maxHp;
   const c = new THREE.Vector3(); grp.getWorldPosition(c);
   bg.position.set(c.x,c.y+barOffsetY,c.z);
   fg.position.set(c.x-(0.03*(1-hp/mx))/2,c.y+barOffsetY,c.z);
   fg.scale.x = THREE.MathUtils.clamp(hp/mx,0,1);
   bg.lookAt(camera.position); fg.lookAt(camera.position);
 });
 // h) camera & render
 const ctr = new THREE.Vector3();
 if (sniperMode && pGun) {
   pGun.getWorldPosition(ctr);
   camera.position.copy(ctr);
   const dir = new THREE.Vector3().setFromSpherical(
     new THREE.Spherical(1,spherical.phi,spherical.theta)
   );
   camera.lookAt(ctr.clone().add(dir));
   crosshair.style.display = 'block';
 } else {
   playerTank.getWorldPosition(ctr);
   camera.position.copy(new THREE.Vector3().setFromSpherical(spherical).add(ctr));
   camera.lookAt(ctr);
   crosshair.style.display = 'none';
 }
 renderer.render(scene,camera);
 requestAnimationFrame(animate);
})();
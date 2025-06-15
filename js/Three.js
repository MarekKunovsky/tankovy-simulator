// three-scene.js
// 1) Renderer
const container = document.getElementById('game-container');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);
// 2) Scéna
const scene = new THREE.Scene();
// 3) Kamera
const camera = new THREE.PerspectiveCamera(
 75,
 window.innerWidth / window.innerHeight,
 0.1,
 1000
);
camera.position.z = 5;
// 4) Světlo
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 1, 1).normalize();
scene.add(light);
// 5) Testovací geometrie (krychle)
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);
// 6) Animační smyčka
function animate() {
 requestAnimationFrame(animate);
 cube.rotation.x += 0.01;
 cube.rotation.y += 0.01;
 renderer.render(scene, camera);
}
animate();
// 7) Responzivní okno
window.addEventListener('resize', () => {
 renderer.setSize(window.innerWidth, window.innerHeight);
 camera.aspect = window.innerWidth / window.innerHeight;
 camera.updateProjectionMatrix();
});
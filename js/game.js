// js/game.js
import { initEnvironment, updateEnvironment, updateWeatherFog } from './environment.js';
import { createPlayer, updatePlayerMovement, player } from './player.js';
import { initControls, keys, isRaining, isDay, isPaused, togglePause, isTriggerDown } from './controls.js';
import { zombies, Zombie } from './zombie.js';
import { updateWeaponParticles, tryAutoFire } from './weapons.js';
import { initSounds, resumeOnUserGesture, startAmbient } from './sounds.js';

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });

let gameOver = false;
let gameStarted = false; 
let playerHp = 100;

function spawnZombie() {
    let x, z;
    do {
        x = Math.random() * 200 - 100;
        z = Math.random() * 200 - 100;
    } while (Math.hypot(x - player.position.x, z - player.position.z) < 25);

    const newZombie = new Zombie(x, z, false);
    scene.add(newZombie.mesh);
    zombies.push(newZombie);
}

// Public helper to start the local game (usable from other pages)
export function startLocalGame(mapName) {
    // resume audio on user gesture
    try { resumeOnUserGesture(); } catch (e) {}
    const container = document.getElementById('canvas-container');
    if (container && !container.contains(renderer.domElement)) container.appendChild(renderer.domElement);
    const menuEl = document.getElementById('menu');
    if (menuEl) menuEl.style.display = 'none';

    const cfg = typeof mapName === 'string' ? { name: mapName } : (mapName || {});
    initEnvironment(scene, cfg);
    createPlayer(scene);
    initControls(document.getElementById('canvas-container'), scene, () => { updateWeatherFog(isRaining, isDay, scene); });
    gameStarted = true;
    for (let i = 0; i < 12; i++) spawnZombie();
    animate();
}

function init() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    const container = document.getElementById('canvas-container');
    container.appendChild(renderer.domElement);
    
    // No inicializar el entorno aquí: se hace al seleccionar un mapa e iniciar

    // --- MENÚS ---
    // Iniciar Juego
    const btnStartEl = document.getElementById('btn-start');
    if (btnStartEl) btnStartEl.addEventListener('click', async () => {
        const mapName = (document.getElementById('map-select') || {}).value || 'forest';
        // Cargar configuración del mapa dinámicamente
        const mapModule = await import(`../maps/${mapName}.js`);
        const mapCfg = mapModule.default || {};

        document.getElementById('menu').style.display = 'none';
        try { resumeOnUserGesture(); } catch (e) {}
        initEnvironment(scene, mapCfg);
        createPlayer(scene);
        initControls(container, scene, () => {
            updateWeatherFog(isRaining, isDay, scene);
        });

        gameStarted = true;
        for (let i = 0; i < 12; i++) spawnZombie();
        animate();
    });



    // LAN removed: no remote message handling

    // Pausa: Reanudar
    const btnResume = document.getElementById('btn-resume');
    if (btnResume) btnResume.addEventListener('click', () => { togglePause(); });

    // Pausa: Salir al menú
    const btnQuit = document.getElementById('btn-quit');
    if (btnQuit) btnQuit.addEventListener('click', () => { location.reload(); });
}

function animate() {
    requestAnimationFrame(animate);

    // Si no ha empezado o está pausado, solo renderizamos pero no actualizamos lógica
    if (!gameStarted || isPaused) {
        renderer.render(scene, camera);
        return; 
    }
    
    let timeNow = performance.now() * 0.001;
    
    if (!gameOver) {
        updateEnvironment(timeNow, isRaining, isDay, player.position.x, player.position.z);
        updatePlayerMovement(keys, camera);
        updateWeaponParticles();
        
        // Handle automatic fire if trigger held
        tryAutoFire(scene, isTriggerDown);

        for (let i = zombies.length - 1; i >= 0; i--) {
            let z = zombies[i];
            if (z.toRemove) { zombies.splice(i, 1); continue; }
            
            z.update(gameOver, (damage) => {
                playerHp -= damage;
                const hpEl = document.getElementById('hp');
                if(hpEl) hpEl.innerText = Math.max(0, Math.floor(playerHp));
                
                if (playerHp <= 0) {
                    gameOver = true;
                    document.getElementById('game-over').style.display = 'block';
                }
            });
        }
    }
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

init();
// js/controls.js
import { updateMouseRotation, handlePlayerJump, flashlight } from './player.js';
import { switchWeapon, reloadCurrentWeapon, shoot } from './weapons.js';

export const keys = { w: false, a: false, s: false, d: false, shift: false };
export let flashlightOn = true;
export let isDay = false;
export let isRaining = false;
export let isPaused = false; // Nueva variable de estado de pausa
export let isTriggerDown = false;

let onWeatherChangeCallback = null;

export function initControls(canvasContainer, scene, onWeatherChange) {
    onWeatherChangeCallback = onWeatherChange;

    if (!canvasContainer) {
        console.error("Error crítico: El contenedor 'canvas-container' no fue proveído.");
        return;
    }

    canvasContainer.addEventListener('click', () => {
        // Solo bloquear puntero si no estamos en pausa
        if (!isPaused) canvasContainer.requestPointerLock();
    });

    document.addEventListener('mousemove', e => {
        if (document.pointerLockElement !== canvasContainer || isPaused) return;
        updateMouseRotation(e.movementX, e.movementY);
    });

    window.addEventListener('keydown', e => {
        let key = e.key.toLowerCase();
        
        // Control de pausa con Escape
        if (e.key === 'Escape') {
            togglePause();
            return;
        }

        // Si está en pausa, ignorar los demás controles de juego
        if (isPaused) return;

        if (key in keys) keys[key] = true;
        if (e.key === 'Shift') keys.shift = true;
        
        if (e.key === '1') switchWeapon(1);
        if (e.key === '2') switchWeapon(2);
        if (e.key === '3') switchWeapon(3);
        if (key === 'r') reloadCurrentWeapon();
        if (e.key === ' ') handlePlayerJump(0.28);
        
        if (key === 'f') { 
            flashlightOn = !flashlightOn; 
            flashlight.visible = flashlightOn;
        }
        if (key === 'g') toggleTimeOfDay();
        if (key === 'h') toggleRain();
    });

    window.addEventListener('keyup', e => { 
        let key = e.key.toLowerCase();
        if (key in keys) keys[key] = false; 
        if (e.key === 'Shift') keys.shift = false;
    });

    window.addEventListener('mousedown', e => { 
        if (isPaused) return;
        if (e.button === 0 && document.pointerLockElement === canvasContainer) {
            isTriggerDown = true;
            shoot(scene); // initial shot on press
        }
    });

    window.addEventListener('mouseup', e => {
        if (e.button === 0) isTriggerDown = false;
    });
}

// Función para alternar el estado de pausa
export function togglePause() {
    isPaused = !isPaused;
    const pauseMenu = document.getElementById('pause-menu');
    
    if (isPaused) {
        pauseMenu.style.display = 'flex';
        document.exitPointerLock(); // Soltar el mouse
    } else {
        pauseMenu.style.display = 'none';
    }
}

export function toggleTimeOfDay() {
    isDay = !isDay;
    if(onWeatherChangeCallback) onWeatherChangeCallback();
}

export function toggleRain() {
    isRaining = !isRaining;
    if(onWeatherChangeCallback) onWeatherChangeCallback();
}
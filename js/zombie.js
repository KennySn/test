// js/zombie.js
import { checkCollision } from './environment.js';
import { player } from './player.js';
import { createSplatter } from './weapons.js';

export const zombies = [];
const zombieRadius = 0.5;
const bossRadius = 1.4;

export class Zombie {
    constructor(x, z, isBoss = false) {
        this.mesh = new THREE.Group();
        this.mesh.position.set(x, 0, z);
        this.isBoss = isBoss;

        // Configuración de texturas y escala según el tipo de monstruo
        let zPiel = new THREE.MeshStandardMaterial({ color: isBoss ? 0x6e1414 : 0x162e16, roughness: 0.7 });
        let zRopa = new THREE.MeshStandardMaterial({ color: isBoss ? 0x111111 : 0x231d19, roughness: 0.9 });
        let scaleFactor = isBoss ? 1.75 : 1.0;

        // Construcción geométrica del cuerpo del zombie
        let torso = new THREE.Mesh(new THREE.BoxGeometry(0.9 * scaleFactor, 1.5 * scaleFactor, 0.6 * scaleFactor), zRopa); 
        torso.position.y = 1.4 * scaleFactor; 
        torso.castShadow = true; 
        torso.receiveShadow = true;
        
        let cabeza = new THREE.Mesh(new THREE.BoxGeometry(0.6 * scaleFactor, 0.6 * scaleFactor, 0.6 * scaleFactor), zPiel); 
        cabeza.position.y = 2.3 * scaleFactor; 
        cabeza.castShadow = true;
        // Ojos rojos del zombi
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const eyeGeo = new THREE.SphereGeometry(0.06 * scaleFactor, 6, 6);
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        // Posicionar ojos relativamente a la cabeza
        // Colocar ojos en la parte frontal de la cabeza (Z negativo)
        leftEye.position.set(-0.12 * scaleFactor, 0.12 * scaleFactor, -0.31 * scaleFactor);
        rightEye.position.set(0.12 * scaleFactor, 0.12 * scaleFactor, -0.31 * scaleFactor);
        leftEye.castShadow = false; rightEye.castShadow = false;
        if (isBoss) { leftEye.scale.set(1.6,1.6,1.6); rightEye.scale.set(1.6,1.6,1.6); }
        cabeza.add(leftEye, rightEye);
        
        let brazoIzq = new THREE.Mesh(new THREE.BoxGeometry(0.18 * scaleFactor, 0.18 * scaleFactor, 0.85 * scaleFactor), zPiel); 
        brazoIzq.position.set(-0.5 * scaleFactor, 1.6 * scaleFactor, -0.4 * scaleFactor); 
        brazoIzq.castShadow = true;
        
        let brazoDer = brazoIzq.clone(); 
        brazoDer.position.x = 0.5 * scaleFactor;

        this.mesh.add(torso, cabeza, brazoIzq, brazoDer); 

        // Atributos de combate y físicas
        this.hp = isBoss ? 15 : 3; 
        this.speed = isBoss ? 0.044 : 0.027; 
        this.damage = isBoss ? 1.1 : 0.5; 
        this.isAlerted = isBoss; 
        this.detectionRadius = 100;
        this.toRemove = false;
        this.avoidanceSide = Math.random() < 0.5 ? 1 : -1;
        this._lastPos = new THREE.Vector2(this.mesh.position.x, this.mesh.position.z);
        this._stuckFrames = 0;
    }

    update(gameOver, onPlayerHit) {
        if (this.toRemove) return;

        // CORRECCIÓN: Cálculo manual y nativo de distancia para evitar el error de "dist is not defined"
        let distanceX = player.position.x - this.mesh.position.x;
        let distanceZ = player.position.z - this.mesh.position.z;
        let currentDistance = Math.hypot(distanceX, distanceZ);
        const currentRadius = this.isBoss ? bossRadius : zombieRadius;

        // Si el zombie quedó solapado con un obstáculo (por spawn u otro), intentar empujarle hacia afuera
        if (checkCollision(this.mesh.position.x, this.mesh.position.z, currentRadius)) {
            let freed = false;
            for (let r = 0.15; r <= 6.0 && !freed; r += 0.15) {
                for (let i = 0; i < 16; i++) {
                    const a = (i / 16) * Math.PI * 2;
                    const nx = this.mesh.position.x + Math.cos(a) * r;
                    const nz = this.mesh.position.z + Math.sin(a) * r;
                    if (!checkCollision(nx, nz, currentRadius)) {
                        this.mesh.position.x = nx;
                        this.mesh.position.z = nz;
                        freed = true;
                        break;
                    }
                }
            }
        }

        // Activar persecución si el jugador entra en su rango táctico
        if (!this.isAlerted && currentDistance < this.detectionRadius) {
            this.isAlerted = true;
        }

        if (this.isAlerted && !gameOver) {
            let angle = Math.atan2(distanceX, distanceZ);
            let currentRadius = this.isBoss ? bossRadius : zombieRadius;
            // Intentos de navegación local: probar ángulos en incrementos hasta encontrar paso libre
            let moved = false;
            const degStep = 15 * (Math.PI/180);
            // Antes de buscar desvíos, intenta avanzar derecho
            let tryAngles = [0];
            for (let s = 1; s <= 12; s++) { // cubre hasta 180 grados con pasos de 15°
                tryAngles.push(s * degStep * this.avoidanceSide);
                tryAngles.push(-s * degStep * this.avoidanceSide);
            }

            for (let i = 0; i < tryAngles.length; i++) {
                const a = angle + tryAngles[i];
                const nx = this.mesh.position.x + Math.sin(a) * this.speed;
                const nz = this.mesh.position.z + Math.cos(a) * this.speed;
                if (!checkCollision(nx, nz, currentRadius)) {
                    this.mesh.position.x = nx;
                    this.mesh.position.z = nz;
                    // adjust facing smoothly to chosen direction
                    angle = a;
                    moved = true;
                    break;
                }
            }

            if (!moved) {
                // Si no pudo moverse, marca frames atascado y alterna lado de evasión para intentar variar ruta
                this._stuckFrames++;
                if (this._stuckFrames > 10) {
                    this.avoidanceSide *= -1;
                    // intentar un pequeño salto lateral forzado si sigue atascado
                    const forceAngle = angle + (Math.PI / 2) * this.avoidanceSide;
                    const fx = this.mesh.position.x + Math.sin(forceAngle) * this.speed * 1.5;
                    const fz = this.mesh.position.z + Math.cos(forceAngle) * this.speed * 1.5;
                    if (!checkCollision(fx, fz, currentRadius)) {
                        this.mesh.position.x = fx;
                        this.mesh.position.z = fz;
                        moved = true;
                    }
                    this._stuckFrames = 0;
                }
            } else {
                // si se movió, resetea contador
                this._stuckFrames = 0;
            }
            // Rotar cuerpo mirando hacia la dirección de avance
            this.mesh.rotation.y = angle + Math.PI;
        }

        // Sistema de ataque por proximidad física
        let attackRange = this.isBoss ? 2.3 : 1.2;
        if (currentDistance < attackRange && !gameOver) {
            onPlayerHit(this.damage);
        }
    }

    hit(point, scene) {
        this.hp--;
        this.isAlerted = true; 
        
        // Genera partículas de sangre usando tu módulo de armas
        createSplatter(scene, point, this.isBoss ? 0xff0000 : 0x720202, this.isBoss ? 20 : 14); 
        
        if (this.hp <= 0) {
            scene.remove(this.mesh); // Elimina el modelo de la simulación visual
            this.toRemove = true;    // Bandera para que el bucle de game.js limpie el array
            
            // Actualización dinámica del marcador de bajas en la UI
            if (!this.isBoss) {
                let scoreEl = document.getElementById('score');
                if (scoreEl) {
                    let currentScore = parseInt(scoreEl.innerText) || 0;
                    scoreEl.innerText = currentScore + 1;
                }
            } else {
                let bossStatusEl = document.getElementById('boss-status');
                if (bossStatusEl) {
                    bossStatusEl.innerText = "ELIMINADO 🏆";
                    bossStatusEl.style.color = "#2ecc71";
                }
            }
        }
    }
}
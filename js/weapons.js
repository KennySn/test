// js/weapons.js
import { gun, player } from './player.js';
import { playGunShot, playSMGShot, playReload } from './sounds.js';
import { collidableMeshes } from './environment.js';
import { zombies } from './zombie.js';

export let currentWeapon = 1;
export let isReloading = false;

export const weaponStats = {
    1: { name: "PISTOLA", ammo: 10, maxAmmo: 10, meshScale: new THREE.Vector3(0.12, 0.18, 0.5), color: 0x050505 },
    2: { name: "ESCOPETA", ammo: 3, maxAmmo: 3, meshScale: new THREE.Vector3(0.16, 0.22, 1.1), color: 0x1c1c1c },
    3: { name: "SMG", ammo: 30, maxAmmo: 30, meshScale: new THREE.Vector3(0.14, 0.16, 0.7), color: 0x333333, fireRate: 12 }
};

export const particles = [];

export function switchWeapon(id) {
    if (id === currentWeapon || isReloading) return;
    currentWeapon = id;
    let stats = weaponStats[id];
    
    gun.scale.copy(stats.meshScale);
    gun.material.color.setHex(stats.color);
    // Posición relativa a la mano derecha (ajusta según el arma)
    if (id === 2) {
        gun.position.set(0.16, -0.06, -0.7);
    } else if (id === 3) {
        gun.position.set(0.18, -0.07, -0.5);
    } else {
        gun.position.set(0.18, -0.08, -0.38);
    }

    document.getElementById('weapon-name').innerText = stats.name;
    updateAmmoUI();
}

export function updateAmmoUI() {
    document.getElementById('ammo').innerText = weaponStats[currentWeapon].ammo;
    document.getElementById('max-ammo').innerText = weaponStats[currentWeapon].maxAmmo;
}

export function reloadCurrentWeapon() {
    if (isReloading || weaponStats[currentWeapon].ammo === weaponStats[currentWeapon].maxAmmo) return;
    isReloading = true;
    document.getElementById('reload-lbl').style.display = "inline";

    try { playReload(); } catch (e) {}

    setTimeout(() => {
        weaponStats[currentWeapon].ammo = weaponStats[currentWeapon].maxAmmo;
        isReloading = false;
        document.getElementById('reload-lbl').style.display = "none";
        updateAmmoUI();
    }, 1200);
}

export function shoot(scene) {
    if (isReloading) return;
    if (weaponStats[currentWeapon].ammo <= 0) {
        reloadCurrentWeapon();
        return;
    }

    weaponStats[currentWeapon].ammo--;
    updateAmmoUI();

    const raycaster = new THREE.Raycaster();
    let wPos = new THREE.Vector3(); gun.getWorldPosition(wPos);
    const flash = new THREE.PointLight(0xffbb44, 28, 18);
    flash.position.copy(wPos);
    // Añadimos el flash a la escena global (player no es escena aquí)
    if (player.parent) player.parent.add(flash);
    setTimeout(() => { if (flash.parent) flash.parent.remove(flash); }, 35);

    let zombieTargets = [];
    zombies.forEach(z => { 
        if(!z.toRemove) zombieTargets.push(z.mesh.children[0], z.mesh.children[1], z.mesh.children[2], z.mesh.children[3]); 
    });
    let allTargets = [...zombieTargets, ...collidableMeshes];

    // collect shot directions to broadcast over LAN
    const shotDirs = [];
    if (currentWeapon === 1) {
        let dir = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion).normalize();
        shotDirs.push(dir.clone());
        processRaycastShot(scene, raycaster, wPos, dir, allTargets, zombieTargets);
        try { playGunShot(); } catch (e) {}
    } 
    else if (currentWeapon === 2) {
        const spreads = [-0.07, 0.0, 0.07];
        spreads.forEach(offset => {
            let dir = new THREE.Vector3(offset, 0, -1).applyQuaternion(player.quaternion).normalize();
            shotDirs.push(dir.clone());
            processRaycastShot(scene, raycaster, wPos, dir, allTargets, zombieTargets);
            try { playGunShot(); } catch (e) {}
        });
    }
    else if (currentWeapon === 3) {
        // SMG: fast automatic weapon with slight per-shot spread
        const spreadAngle = 0.03; // radians (~1.7 degrees)
        const rx = (Math.random() * 2 - 1) * spreadAngle;
        const ry = (Math.random() * 2 - 1) * spreadAngle * 0.6; // less vertical spread
        let dir = new THREE.Vector3(rx, ry, -1).applyQuaternion(player.quaternion).normalize();
        shotDirs.push(dir.clone());
        processRaycastShot(scene, raycaster, wPos, dir, allTargets, zombieTargets);
        try { playSMGShot(); } catch (e) {}
    }

    // LAN removed: local-only shot events

    if (weaponStats[currentWeapon].ammo === 0) {
        reloadCurrentWeapon();
    }
}

function processRaycastShot(scene, raycaster, origin, direction, targets, zombieGroup) {
    raycaster.set(origin, direction);
    let hits = raycaster.intersectObjects(targets);

    if (hits.length > 0) {
        let firstHit = hits[0];
        if (firstHit.object.parent && zombieGroup.includes(firstHit.object)) {
            let parentMesh = firstHit.object.parent;
            let zObj = zombies.find(z => z.mesh === parentMesh);
            if (zObj) zObj.hit(firstHit.point, scene);
        } else {
            createSplatter(scene, firstHit.point, 0x555555, 5);
            createBulletHole(scene, firstHit.point);
        }
    }
}

export function createSplatter(scene, pos, colorHex, count) {
    let pMat = new THREE.MeshBasicMaterial({ color: colorHex });
    for (let i = 0; i < count; i++) {
        let size = 0.05 + Math.random() * 0.08;
        let p = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), pMat);
        p.position.copy(pos);
        
        // CORRECCIÓN CLAVE: Pasamos y guardamos la escena dentro de la partícula
        p.userData = { 
            vx: (Math.random() * 2 - 1) * 0.09, 
            vy: (Math.random() * 2) * 0.1, 
            vz: (Math.random() * 2 - 1) * 0.09, 
            life: 1.0,
            targetScene: scene 
        };
        particles.push(p); 
        scene.add(p);
    }
}

function createBulletHole(scene, pos) {
    let holeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    let hole = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), holeMat);
    hole.position.copy(pos); 
    scene.add(hole);
    setTimeout(() => scene.remove(hole), 14000);
}

export function updateWeaponParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; 
        
        // Aplicar físicas vectoriales de caída
        p.position.x += p.userData.vx; 
        p.position.y += p.userData.vy; 
        p.position.z += p.userData.vz;
        
        p.userData.vy -= 0.007; // Fuerza de gravedad simulada
        p.userData.life -= 0.025; // Reducción de opacidad/tiempo de vida
        
        // Control de destrucción física e higienización de memoria RAM
        if (p.userData.life <= 0) { 
            if (p.userData.targetScene) {
                p.userData.targetScene.remove(p); // Borrado físico del renderizado
            }
            p.geometry.dispose(); 
            particles.splice(i, 1); 
        }
    }
}

// Automatic fire control
let _lastAutoShot = 0; // ms
export function tryAutoFire(scene, triggerDown) {
    const ws = weaponStats[currentWeapon];
    if (!ws) return;
    // Only SMG (id 3) is automatic
    if (currentWeapon !== 3) return;
    if (!triggerDown) return;
    const now = performance.now();
    const fireRate = ws.fireRate || 12; // shots per second default for SMG
    const interval = 1000 / fireRate;
    if (now - _lastAutoShot >= interval) {
        // If no ammo, trigger reload
        if (ws.ammo <= 0) {
            reloadCurrentWeapon();
            return;
        }
        shoot(scene);
        _lastAutoShot = now;
    }
}
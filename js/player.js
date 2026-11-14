import { checkCollision, currentCeilingY } from './environment.js';

export const player = new THREE.Group();
export const playerRadius = 0.6;

export let playerVelocityY = 0;
export let isGrounded = true;
const gravity = -0.012;
const PLAYER_HEIGHT = 2.4; // approximate from model (head top relative to position.y)

export let yaw = 0;
export let pitch = 0.05;
const cameraRadius = 3.6;
const shoulderOffset = 0.85;

export let gun;
export let flashlight;

export function createPlayer(scene) {
    // place player at a safe spawn near the origin (tries to avoid obstacles)
    const spawn = findSafeSpawn();
    player.position.set(spawn.x, 0, spawn.z);
    scene.add(player);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.6), new THREE.MeshStandardMaterial({ color: 0x1b2631, roughness: 0.7 }));
    torso.position.y = 1.4; torso.castShadow = true; torso.receiveShadow = true; player.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: 0xdca78e, roughness: 0.8 }));
    head.position.y = 2.3; head.castShadow = true; player.add(head);

    // Malla del Arma Base
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.4, metalness: 0.8 });
    gun = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), gunMat);
    gun.scale.set(0.12, 0.18, 0.5);
    gun.castShadow = true;

    // Manos del jugador (visual)
    const handMat = new THREE.MeshStandardMaterial({ color: 0xdca78e, roughness: 0.8 });
    const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), handMat);
    leftHand.position.set(-0.45, 1.95, -0.05); leftHand.castShadow = true; player.add(leftHand);

    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), handMat);
    rightHand.position.set(0.45, 1.95, -0.05); rightHand.castShadow = true; player.add(rightHand);

    // Colocar el arma como hijo de la mano derecha (posición relativa a la mano)
    gun.position.set(0.18, -0.08, -0.38);
    rightHand.add(gun);

    // Linterna
    // Linterna en el hombro derecho
    const rightShoulder = new THREE.Object3D();
    rightShoulder.position.set(0.40, 2.0, -0.02);
    player.add(rightShoulder);

    flashlight = new THREE.SpotLight(0xfffbe6, 22, 70, Math.PI / 5, 0.3, 1.0);
    flashlight.position.set(-0.05, 0.14, -0.08); flashlight.castShadow = true;
    rightShoulder.add(flashlight);

    const lightTarget = new THREE.Object3D(); lightTarget.position.set(-0.05, 0.14, -20); rightShoulder.add(lightTarget);
    flashlight.target = lightTarget;

    // Modelo 3D simple de la linterna (cuerpo + reflector)
    const flashGroup = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x212121, metalness: 0.9, roughness: 0.25 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.28, 8), metalMat);
    body.rotation.z = Math.PI/2; body.position.set(0, 0, -0.05); body.castShadow = true; flashGroup.add(body);
    const flashHeadMat = new THREE.MeshStandardMaterial({ color: 0xddddcc, metalness: 0.2, roughness: 0.4 });
    const flashHead = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.12, 12), flashHeadMat);
    flashHead.rotation.x = Math.PI/2; flashHead.position.set(0.14, 0, -0.05); flashHead.castShadow = true; flashGroup.add(flashHead);
    flashGroup.position.set(-0.05, 0.12, -0.08);
    rightShoulder.add(flashGroup);

    // Puntero láser
    const laser = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-40)]), 
        new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.2 })
    );
    // El láser lo colocamos relativo al arma (será hijo del `gun`)
    laser.position.set(0, 0, -1.0);
    gun.add(laser);
}

function findSafeSpawn() {
    // prefer near origin (where many maps expect the player). Try jittering outwards.
    const maxRadius = 18;
    for (let attempt = 0; attempt < 200; attempt++) {
        // biased towards small radii
        const r = Math.pow(Math.random(), 0.7) * maxRadius;
        const a = Math.random() * Math.PI * 2;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (!checkCollision(x, z, playerRadius)) return { x, z };
    }
    // as last resort, nudge out from origin until free
    let x = 0, z = 0;
    if (!checkCollision(x, z, playerRadius)) return { x, z };
    for (let r = 0.3; r < 30; r += 0.3) {
        for (let s = 0; s < 12; s++) {
            const a = (s / 12) * Math.PI * 2;
            const nx = Math.cos(a) * r;
            const nz = Math.sin(a) * r;
            if (!checkCollision(nx, nz, playerRadius)) return { x: nx, z: nz };
        }
    }
    return { x: 0, z: 0 };

}

function resolveOverlap() {
    // If player is overlapping an obstacle, try to push them out to nearest free spot
    if (!checkCollision(player.position.x, player.position.z, playerRadius)) return false;
    const startX = player.position.x;
    const startZ = player.position.z;
    for (let r = 0.15; r <= 6.0; r += 0.15) {
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            const nx = startX + Math.cos(a) * r;
            const nz = startZ + Math.sin(a) * r;
            if (!checkCollision(nx, nz, playerRadius)) {
                player.position.x = nx;
                player.position.z = nz;
                return true;
            }
        }
    }
    return false;
}

export function updateMouseRotation(movementX, movementY) {
    yaw -= movementX * 0.0022;
    pitch += movementY * 0.0022;
    pitch = Math.max(-Math.PI / 6, Math.min(Math.PI / 4, pitch));
}

export function handlePlayerJump(strength) {
    if (isGrounded) {
        // prevent jumping into a low ceiling
        if (currentCeilingY !== Infinity) {
            const maxAllowed = currentCeilingY - PLAYER_HEIGHT - 0.05;
            if (player.position.y >= maxAllowed) return; // too close to ceiling
        }
        playerVelocityY = strength;
        isGrounded = false;
    }
}

export function updatePlayerMovement(keys, camera) {
    player.rotation.y = yaw;

    if (!isGrounded) {
        playerVelocityY += gravity;
        player.position.y += playerVelocityY;
        // ceiling collision (prevent passing through indoor ceilings)
        if (currentCeilingY !== Infinity) {
            const maxY = currentCeilingY - PLAYER_HEIGHT;
            if (player.position.y > maxY) {
                player.position.y = maxY;
                playerVelocityY = 0;
            }
        }
        if (player.position.y <= 0) {
            player.position.y = 0; playerVelocityY = 0; isGrounded = true;
        }
    }

    let forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    let right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    let moveDirection = new THREE.Vector3();

    if (keys.w) moveDirection.add(forward);
    if (keys.s) moveDirection.add(forward.clone().negate()); 
    if (keys.a) moveDirection.add(right.clone().negate());   
    if (keys.d) moveDirection.add(right);                  

    moveDirection.normalize();

    if (moveDirection.lengthSq() > 0) {
        let speed = keys.shift ? 0.23 : 0.13;
        let nextX = player.position.x + moveDirection.x * speed;
        let nextZ = player.position.z + moveDirection.z * speed;

        if (!checkCollision(nextX, player.position.z, playerRadius)) player.position.x = nextX;
        if (!checkCollision(player.position.x, nextZ, playerRadius)) player.position.z = nextZ;
    }

    // If somehow embedded in geometry, try to resolve overlap automatically
    if (checkCollision(player.position.x, player.position.z, playerRadius)) {
        resolveOverlap();
    }

    // Cámara en tercera persona sobre el hombro
    let hDistance = cameraRadius * Math.cos(pitch);
    let vDistance = cameraRadius * Math.sin(pitch);
    let camRightOffset = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).multiplyScalar(shoulderOffset);

    camera.position.x = player.position.x + Math.sin(yaw) * hDistance + camRightOffset.x;
    camera.position.z = player.position.z + Math.cos(yaw) * hDistance + camRightOffset.z;
    camera.position.y = player.position.y + 1.95 + vDistance; 
    camera.lookAt(player.position.x + camRightOffset.x * 0.4, player.position.y + 1.45, player.position.z + camRightOffset.z * 0.4);
}
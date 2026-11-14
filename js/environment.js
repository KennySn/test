export const obstacles = [];
export const collidableMeshes = [];
export const puddles = [];
const campfires = [];
const fallingLeaves = [];

// Current ceiling Y (Infinity when open sky). Set by indoor generators (backrooms).
export let currentCeilingY = Infinity;

// Waters used for simple wave animation on beaches
export const beachWaters = [];

// Global collision clearance (extra separation to avoid being too close to solids)
const COLLISION_CLEARANCE = 0.35;

let rainGeometry, rainParticles;
const rainCount = 10000;

let nightColor = new THREE.Color(0x010502);
let nightRainColor = new THREE.Color(0x000201); 
let dayColor = new THREE.Color(0x4a5d4a);
const defaultFogDensity = 0.055;

export let ambientLight, sunLight;

export function initEnvironment(scene, mapConfig = {}) {
    // reset ceiling by default (open sky)
    currentCeilingY = Infinity;
    scene.background = nightColor;
    scene.fog = new THREE.FogExp2(0x010502, defaultFogDensity); 

    ambientLight = new THREE.AmbientLight(0x0a1c0f, 0.5);
    scene.add(ambientLight);

    sunLight = new THREE.DirectionalLight(0xffffff, 0.0);
    sunLight.position.set(60, 100, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048; 
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0005; 
    const d = 80;
    sunLight.shadow.camera.left = -d; sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d; sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);

    // Colores y suelo según configuración del mapa
    if (mapConfig.dayColor) dayColor = new THREE.Color(mapConfig.dayColor);
    if (mapConfig.nightColor) nightColor = new THREE.Color(mapConfig.nightColor);
    if (mapConfig.nightRainColor) nightRainColor = new THREE.Color(mapConfig.nightRainColor);

    const floorGeo = new THREE.PlaneGeometry(300, 300);
    const floorMat = new THREE.MeshStandardMaterial({ color: mapConfig.groundColor !== undefined ? mapConfig.groundColor : 0x050a05, roughness: 0.95 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    collidableMeshes.push(floor);

    // Inicializar Charcos PBR Reflectivos (desde configuración del mapa si existe)
    const puddlesCfg = mapConfig.puddles || [ {x:8,z:12,r:4.0}, {x:-15,z:-8,r:5.5}, {x:35,z:-25,r:4.5}, {x:-30,z:30,r:4.2} ];
    puddlesCfg.forEach(p => createPuddle(scene, p.x, p.z, p.r));

    // Sistema de lluvia
    rainGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(rainCount * 3);
    for(let i=0; i<rainCount*3; i+=3) {
        positions[i] = Math.random() * 160 - 80;       
        positions[i+1] = Math.random() * 45;            
        positions[i+2] = Math.random() * 160 - 80;       
    }
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const rainMat = new THREE.PointsMaterial({ 
        color: 0x8cb6d9, size: 0.08, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending 
    });
    rainParticles = new THREE.Points(rainGeometry, rainMat);
    scene.add(rainParticles);

    // Crear entorno según tipo de mapa
    const terrain = mapConfig.terrain || (mapConfig.name === 'backrooms' ? 'indoor' : (mapConfig.name === 'playa' ? 'beach' : (mapConfig.name === 'un_circo' ? 'fair' : 'forest')));
    if (terrain === 'indoor' || mapConfig.name === 'backrooms') generateBackrooms(scene, mapConfig);
    else if (terrain === 'beach' || mapConfig.name === 'playa') generateBeach(scene, mapConfig);
    else if (terrain === 'fair' || mapConfig.name === 'un_circo') generateCircus(scene, mapConfig);
    else generateForest(scene, mapConfig);
}

function createPuddle(scene, x, z, radius) {
    const puddleGeo = new THREE.CircleGeometry(radius, 12);
    const puddleMat = new THREE.MeshStandardMaterial({
        color: 0x020503, roughness: 0.0, metalness: 1.0, transparent: true, opacity: 0.2
    });
    const puddle = new THREE.Mesh(puddleGeo, puddleMat);
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(x, 0.02, z);
    puddle.receiveShadow = true;
    scene.add(puddle);
    puddles.push(puddle);
}

function generateForest(scene, mapConfig = {}) {
    // open sky
    currentCeilingY = Infinity;
    // Materials por defecto (bosque)
    const leafColor = mapConfig.leafColor !== undefined ? mapConfig.leafColor : 0x091c09;
    const tallGrassColor = mapConfig.tallGrassColor !== undefined ? mapConfig.tallGrassColor : 0x112b11;
    const shortGrassColor = mapConfig.shortGrassColor !== undefined ? mapConfig.shortGrassColor : 0x0c1f0c;
    const trunkColor = mapConfig.trunkColor !== undefined ? mapConfig.trunkColor : 0x1c130b;
    const rockColor = mapConfig.rockColor !== undefined ? mapConfig.rockColor : 0x333333;

    const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.9, flatShading: true });
    const tallGrassMat = new THREE.MeshStandardMaterial({ color: tallGrassColor, roughness: 0.9, flatShading: true });
    const shortGrassMat = new THREE.MeshStandardMaterial({ color: shortGrassColor, roughness: 0.9, flatShading: true });
    const trunkMat = new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.85, flatShading: true });
    const rockMat = new THREE.MeshStandardMaterial({ color: rockColor, roughness: 0.7, metalness: 0.2, flatShading: true });

    const totalCount = mapConfig.totalCount || 3800;

    // Probabilidades configurables (valores acumulativos)
    const treeChance = mapConfig.treeChance !== undefined ? mapConfig.treeChance : 0.12;
    const shortGrassChance = mapConfig.shortGrassChance !== undefined ? mapConfig.shortGrassChance : 0.38; // hasta 0.50
    const tallGrassChance = mapConfig.tallGrassChance !== undefined ? mapConfig.tallGrassChance : 0.32; // hasta 0.82
    const rockChance = mapConfig.rockChance !== undefined ? mapConfig.rockChance : 0.08; // hasta 0.90

    const tTree = treeChance;
    const tShort = tTree + shortGrassChance;
    const tTall = tShort + tallGrassChance;
    const tRock = tTall + rockChance;
    let countTrees = 0, countShortGrass = 0, countTallGrass = 0, countRocks = 0, countLogs = 0;
    const positions = [];

    for(let i=0; i<totalCount; i++) {
        let x = Math.random() * 260 - 130;
        let z = Math.random() * 260 - 130;
        if (Math.hypot(x, z) < 12) continue; 
        
        let rand = Math.random();
        positions.push({x, z, rand});

        if (rand < tTree) countTrees++;
        else if (rand < tShort) countShortGrass++;
        else if (rand < tTall) countTallGrass++;
        else if (rand < tRock) countRocks++;
        else countLogs++;
    }

    const instTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.6, 1, 18, 4), trunkMat, countTrees);
    const instLeaves = new THREE.InstancedMesh(new THREE.ConeGeometry(4, 12, 4), leafMat, countTrees);
    const instShortGrass = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.5, 0), shortGrassMat, countShortGrass);
    const instTallGrass = new THREE.InstancedMesh(new THREE.ConeGeometry(0.12, 2.2, 3), tallGrassMat, countTallGrass * 3);
    const instRocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(2.5, 0), rockMat, countRocks);
    const instLogs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.4, 0.4, 5, 4), trunkMat, countLogs);

    instTrunk.castShadow = true; instTrunk.receiveShadow = true;
    instLeaves.castShadow = true; instLeaves.receiveShadow = true;
    instRocks.castShadow = true; instRocks.receiveShadow = true;
    instLogs.castShadow = true; instLogs.receiveShadow = true;

    let idxTree = 0, idxSGrass = 0, idxTGrass = 0, idxRock = 0, idxLog = 0;
    const dummy = new THREE.Object3D();

    positions.forEach(p => {
        dummy.position.set(p.x, 0, p.z);
        dummy.rotation.set(0,0,0);
        dummy.scale.set(1,1,1);

        if (p.rand < tTree) { 
            let scaleH = 0.8 + Math.random() * 1.2;
            let treeHeight = 18 * scaleH;
            dummy.position.y = treeHeight / 2;
            dummy.scale.set(scaleH, scaleH, scaleH);
            dummy.updateMatrix();
            instTrunk.setMatrixAt(idxTree, dummy.matrix);

            dummy.position.y = treeHeight;
            dummy.updateMatrix();
            instLeaves.setMatrixAt(idxTree, dummy.matrix);
            idxTree++;

            obstacles.push({ x: p.x, z: p.z, radius: 1.2 * scaleH });
            fallingLeaves.push({ treeX: p.x, treeZ: p.z, startY: treeHeight - 2, currentPos: new THREE.Vector3(p.x, 0, p.z), mesh: null, speedY: 0.02 + Math.random()*0.04, wobbleSpeed: 1.8 + Math.random()*2.5, wobbleOffset: Math.random()*15 });
        } 
        else if (p.rand < tShort) { 
            dummy.position.y = 0.05;
            dummy.scale.set(2.5 + Math.random(), 0.3 + Math.random()*0.2, 2.5 + Math.random());
            dummy.rotation.y = Math.random() * Math.PI;
            dummy.updateMatrix();
            instShortGrass.setMatrixAt(idxSGrass, dummy.matrix);
            idxSGrass++;
        } 
        else if (p.rand < tTall) { 
            for(let b=0; b<3; b++) {
                dummy.position.set(p.x + (Math.random()*0.6 - 0.3), 0.8, p.z + (Math.random()*0.6 - 0.3));
                dummy.rotation.set(Math.random()*0.2 - 0.1, Math.random()*Math.PI, Math.random()*0.2 - 0.1);
                dummy.scale.set(1, 0.6 + Math.random()*0.8, 1);
                dummy.updateMatrix();
                instTallGrass.setMatrixAt(idxTGrass, dummy.matrix);
                idxTGrass++;
            }
        } 
        else if (p.rand < tRock) { 
            let s = 0.6 + Math.random() * 1.4;
            dummy.position.y = 2.5 * s * 0.4;
            dummy.scale.set(s, s * 1.5, s);
            dummy.rotation.set(Math.random(), Math.random(), Math.random());
            dummy.updateMatrix();
            instRocks.setMatrixAt(idxRock, dummy.matrix);
            idxRock++;
            obstacles.push({ x: p.x, z: p.z, radius: 2.6 * s });
        } 
        else { 
            dummy.position.y = 0.25;
            dummy.rotation.set(0, Math.random() * Math.PI, Math.PI / 2);
            dummy.updateMatrix();
            instLogs.setMatrixAt(idxLog, dummy.matrix);
            idxLog++;
            obstacles.push({ x: p.x, z: p.z, radius: 1.8 });
        }
    });

    scene.add(instTrunk, instLeaves, instShortGrass, instTallGrass, instRocks, instLogs);
    collidableMeshes.push(instTrunk, instRocks, instLogs);

    // Hojas cayendo físicas individuales
    const singleLeafGeo = new THREE.BoxGeometry(0.14, 0.02, 0.14);
    const fallingLeafMat = new THREE.MeshStandardMaterial({ color: 0x142e14, roughness: 0.9 });
    fallingLeaves.forEach(lf => {
        const m = new THREE.Mesh(singleLeafGeo, fallingLeafMat);
        m.position.set(lf.treeX + (Math.random() * 4 - 2), lf.startY - Math.random() * 6, lf.treeZ + (Math.random() * 4 - 2));
        scene.add(m); lf.mesh = m;
    });

    // Campamentos fijos (desde configuración del mapa si existe)
    const camps = mapConfig.campfires || [ {x:40,z:40}, {x:-55,z:-45} ];
    camps.forEach(c => createCampfire(scene, c.x, c.z));
}

function createCampfire(scene, x, z) {
    const camp = new THREE.Group();
    camp.position.set(x, 0, z);
    let tent = new THREE.Mesh(new THREE.ConeGeometry(3, 4, 4), new THREE.MeshStandardMaterial({ color: 0x34495e, roughness: 0.8, flatShading: true }));
    tent.position.set(-4, 2, -2); tent.castShadow = true; tent.receiveShadow = true; camp.add(tent);
    collidableMeshes.push(tent);

    let fireLight = new THREE.PointLight(0xff5500, 4, 30, 1.3); fireLight.position.set(0, 0.8, 0); fireLight.castShadow = true; camp.add(fireLight);
    let fireMesh = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 4), new THREE.MeshBasicMaterial({ color: 0xffaa00 })); fireMesh.position.y = 0.5; camp.add(fireMesh);

    campfires.push({ light: fireLight, mesh: fireMesh, baseTime: Math.random() * 20 });
    scene.add(camp);
    obstacles.push({ x: x - 4, z: z - 2, radius: 3.2 }, { x: x, z: z, radius: 1.0 });
}

export function checkCollision(nextX, nextZ, entityRadius) {
    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        const dx = nextX - obs.x;
        const dz = nextZ - obs.z;
        const dist = Math.hypot(dx, dz);
        const padding = (obs.padding || 0) + COLLISION_CLEARANCE;
        if (dist < (entityRadius + obs.radius + padding)) return true;
    }
    if (Math.abs(nextX) > 145 || Math.abs(nextZ) > 145) return true;
    return false;
}

export function updateEnvironment(timeNow, isRaining, isDay, playerX, playerZ) {
    campfires.forEach(c => {
        let wave = Math.sin(timeNow * 5 + c.baseTime);
        c.light.intensity = isDay ? 0.4 : (3.5 + wave * 0.9);
    });

    fallingLeaves.forEach(lf => {
        if(lf.mesh) {
            lf.mesh.position.y -= lf.speedY;
            let wobble = Math.sin(timeNow * lf.wobbleSpeed + lf.wobbleOffset);
            lf.mesh.position.x = lf.treeX + wobble * 0.9;
            lf.mesh.position.z = lf.treeZ + Math.cos(timeNow * 1.8) * 0.4;
            if(lf.mesh.position.y <= 0.05) lf.mesh.position.y = lf.startY;
        }
    });

        // Simple beach water animation (gentle bobbing)
        beachWaters.forEach(w => {
            const off = w.userData.waveOffset || 0;
            w.position.y = w.userData.baseY + Math.sin(timeNow * 0.8 + off) * 0.06;
        });

    if(isRaining && rainParticles) {
        const positions = rainGeometry.attributes.position.array;
        for(let i=1; i<positions.length; i+=3) {
            positions[i] -= 0.95;
            if(positions[i] <= 0) {
                positions[i] = 42; 
                positions[i-1] = playerX + (Math.random() * 120 - 60);
                positions[i+1] = playerZ + (Math.random() * 120 - 60);
            }
        }
        rainGeometry.attributes.position.needsUpdate = true;
    }
}

export function updateWeatherFog(isRaining, isDay, scene) {
    if(isRaining) {
        rainParticles.material.opacity = 0.75;
        scene.fog.density = 0.085;
        scene.background = isDay ? new THREE.Color(0x2d382d) : nightRainColor;
        scene.fog.color = isDay ? new THREE.Color(0x2d382d) : nightRainColor;
        puddles.forEach(p => p.material.opacity = 0.85);
    } else {
        rainParticles.material.opacity = 0.0;
        scene.fog.density = defaultFogDensity;
        scene.background = isDay ? dayColor : nightColor;
        scene.fog.color = isDay ? dayColor : nightColor;
        puddles.forEach(p => p.material.opacity = 0.2);
    }
}

// ---------------------- Backrooms (interior) ----------------------
function generateBackrooms(scene, mapConfig = {}) {
    // Backrooms: larger corridors, stained yellow palette, and a continuous high ceiling
    const spacing = mapConfig.backroomSpacing || 16; // distance between wall centers
    const wallHeight = mapConfig.wallHeight || 4.2;
    const ceilingHeight = mapConfig.ceilingHeight || 4.8;
    const floorColor = mapConfig.groundColor || 0xE7DFAE; // warm yellowed tiles
    const wallColor = mapConfig.wallColor || 0xE1D18B; // dirty yellow

    // Adjust ambient / fog / background to match the yellowed indoor mood
    scene.background = new THREE.Color(mapConfig.dayColor || 0xF1E8D0);
    if (scene.fog) scene.fog.color = new THREE.Color(mapConfig.dayColor || 0xF1E8D0);
    if (ambientLight) { ambientLight.color.setHex(mapConfig.ambientLightColor || 0x3a2c10); ambientLight.intensity = mapConfig.ambientIntensity || 0.38; }
    if (sunLight) sunLight.intensity = 0.0;

    const floorMat = new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.95 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor); collidableMeshes.push(floor);

    // Walls generating a loose grid but with larger spacing so corridors feel roomy
    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.95 });
    const halfCount = 9; // grid extent
    for (let i = -halfCount; i <= halfCount; i++) {
        for (let j = -halfCount; j <= halfCount; j++) {
            if (Math.random() < (mapConfig.wallDensity || 0.72)) {
                const len = spacing - 2 + (Math.random() - 0.5) * 2; // vary length slightly
                const thickness = 0.6;
                const w = new THREE.Mesh(new THREE.BoxGeometry(len, wallHeight, thickness), wallMat);
                w.position.set(i * spacing + (Math.random()-0.5) * 2.0, wallHeight / 2, j * spacing + (Math.random()-0.5) * 2.0);
                w.rotation.y = (Math.random() < 0.5) ? 0 : Math.PI/2;
                w.receiveShadow = true; w.castShadow = true;
                scene.add(w); collidableMeshes.push(w);
                // obstacle radius approximated from spacing so entities keep clear of walls
                obstacles.push({ x: w.position.x, z: w.position.z, radius: Math.max(3.0, spacing * 0.45) });
            }
        }
    }

    // Smooth solid ceiling: a single box acting visually and logically as the ceiling
    const ceilingThickness = 0.3;
    const ceilingMat = new THREE.MeshStandardMaterial({ color: mapConfig.ceilingColor || 0xF6F0C8, roughness: 0.98 });
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(320, ceilingThickness, 320), ceilingMat);
    // Position ceiling so its bottom sits at `ceilingHeight`
    ceiling.position.set(0, ceilingHeight + ceilingThickness / 2, 0);
    ceiling.receiveShadow = true; ceiling.castShadow = false; scene.add(ceiling);
    collidableMeshes.push(ceiling);
    // expose the ceiling height for vertical collision handling
    currentCeilingY = ceilingHeight;

    // Ceiling fluorescent lights: long emissive boxes with some randomness and optional flicker
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: mapConfig.lightEmissive || 1.2, roughness: 1.0 });
    for (let x = -80; x <= 80; x += 20) {
        for (let z = -80; z <= 80; z += 40) {
            const lum = new THREE.Mesh(new THREE.BoxGeometry(8, 0.18, 20), lightMat);
            lum.position.set(x + (Math.random()-0.5)*6, ceilingHeight - 0.12, z + (Math.random()-0.5)*6);
            scene.add(lum);
            // small point light under the luminaire to give local illumination
            const pl = new THREE.PointLight(0xfff9d8, 0.9, 28, 2);
            pl.position.set(lum.position.x, lum.position.y - 0.6, lum.position.z);
            scene.add(pl);
        }
    }

    // Add a few scattered details (boxes, stains) to make the backrooms feel lived-in
    for (let i = 0; i < (mapConfig.detailCount || 60); i++) {
        const bx = Math.random() * 260 - 130;
        const bz = Math.random() * 260 - 130;
        if (Math.hypot(bx, bz) < 6) continue;
        if (Math.random() < 0.25) {
            const box = new THREE.Mesh(new THREE.BoxGeometry(0.8 + Math.random()*1.6, 0.6 + Math.random()*1.2, 0.6 + Math.random()*1.6), new THREE.MeshStandardMaterial({ color: 0x5a4a3a }));
            box.position.set(bx, box.geometry.parameters.height / 2, bz); scene.add(box); collidableMeshes.push(box); obstacles.push({ x: bx, z: bz, radius: 1.0 + Math.max(box.scale.x, box.scale.z) });
        } else if (Math.random() < 0.15) {
            // small stain decal approximated by a flat dark circle
            const stain = new THREE.Mesh(new THREE.CircleGeometry(1 + Math.random()*1.8, 12), new THREE.MeshStandardMaterial({ color: 0x2b1f13, roughness: 1.0 }));
            stain.rotation.x = -Math.PI/2; stain.position.set(bx, 0.02, bz); scene.add(stain);
        }
    }

    // Scatter small mushrooms on the floor to give the backrooms more detail
    const mushCount = mapConfig.mushroomCount || 48;
    for (let i = 0; i < mushCount; i++) {
        const mx = Math.random() * 260 - 130;
        const mz = Math.random() * 260 - 130;
        if (Math.hypot(mx, mz) < 8) continue; // avoid immediate player spawn area
        createMushroom(scene, mx, mz);
    }
}

// Create a small stylized mushroom (stem + cap) and register it for collisions/shadows
function createMushroom(scene, x, z) {
    const mushroom = new THREE.Group();

    // Stem: thin cylinder
    const stemGeom = new THREE.CylinderGeometry(0.18, 0.22, 0.5, 10);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
    const stem = new THREE.Mesh(stemGeom, stemMat);
    stem.position.y = 0.25;
    stem.castShadow = true; stem.receiveShadow = true;

    // Cap: flattened sphere
    const capGeom = new THREE.SphereGeometry(0.48, 12, 12);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.7 });
    const cap = new THREE.Mesh(capGeom, capMat);
    cap.scale.y = 0.5;
    cap.position.y = 0.7;
    cap.castShadow = true; cap.receiveShadow = true;

    mushroom.add(stem, cap);
    mushroom.position.set(x, 0, z);
    // small random rotation/scale for variety
    mushroom.rotation.y = Math.random() * Math.PI * 2;
    const s = 0.7 + Math.random() * 0.7; mushroom.scale.set(s, s, s);

    scene.add(mushroom);
    // register as collidable and obstacle so player can't walk through
    collidableMeshes.push(stem, cap);
    // Use a slightly larger obstacle radius and let global clearance add margin
    obstacles.push({ x: x, z: z, radius: 0.9 * s });
    return mushroom;
}

// ---------------------- Beach (playa) ----------------------
function generateBeach(scene, mapConfig = {}) {
    // open sky
    currentCeilingY = Infinity;

    // sandy floor
    const sandMat = new THREE.MeshStandardMaterial({ color: mapConfig.groundColor || 0xEED9B7, roughness: 0.95 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), sandMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor); collidableMeshes.push(floor);

    // water at one edge
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x2a7fb8, roughness: 0.3, metalness: 0.2, transparent: true, opacity: 0.85 });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(300, 120), waterMat);
    water.rotation.x = -Math.PI / 2; water.position.set(0, -0.05, -90); scene.add(water);
    // store base Y for a simple gentle wave animation
    water.userData = { baseY: water.position.y, waveOffset: Math.random() * Math.PI * 2 };
    beachWaters.push(water);

    // foam line near the shore (subtle faded plane)
    const foamMat = new THREE.MeshStandardMaterial({ color: 0xfaf7f2, roughness: 1.0, transparent: true, opacity: 0.65 });
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(300, 6), foamMat);
    foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.01, -66); scene.add(foam);

    // palm helper: trunk + crown
    function addPalm(x, z, h = 8) {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, h, 6), new THREE.MeshStandardMaterial({ color: 0x8b5a2b }));
        trunk.position.set(x, h/2, z); trunk.castShadow = true; scene.add(trunk); collidableMeshes.push(trunk);
        const leaves = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.2, 6), new THREE.MeshStandardMaterial({ color: mapConfig.leafColor || 0x69a23b }));
        leaves.position.set(x, h+0.3, z); leaves.rotation.x = Math.PI; scene.add(leaves);
    }

    // scatter palms and umbrellas
    for (let i = 0; i < 30; i++) {
        const x = Math.random() * 220 - 110;
        const z = Math.random() * 80 - 60;
        if (z < -30) continue; // keep palms more inland
        addPalm(x, z, 6 + Math.random()*6);
    }

    // beach umbrellas (simple cones on poles)
    for (let i = 0; i < 8; i++) {
        const x = Math.random() * 180 - 90; const z = Math.random() * 60 - 60;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8), new THREE.MeshStandardMaterial({ color: 0x444444 }));
        pole.position.set(x, 0.9, z); scene.add(pole);
        const top = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0xff4444 }));
        top.position.set(x, 1.6, z); scene.add(top);
    }

    // a few rocks and driftwood
    for (let i = 0; i < 12; i++) {
        const x = Math.random() * 260 - 130; const z = Math.random() * 120 - 60;
        const r = 0.6 + Math.random() * 2.4;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), new THREE.MeshStandardMaterial({ color: mapConfig.rockColor || 0x85746a }));
        rock.position.set(x, r*0.2, z); scene.add(rock); collidableMeshes.push(rock); obstacles.push({ x, z, radius: r*1.2 });
    }
}

// ---------------------- Circus (un_circo) ----------------------
function generateCircus(scene, mapConfig = {}) {
    // open sky
    currentCeilingY = Infinity;
    const groundMat = new THREE.MeshStandardMaterial({ color: mapConfig.groundColor || 0x7b3a2a, roughness: 0.95 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), groundMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor); collidableMeshes.push(floor);

    // central ring
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 0.5, 32), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    ring.position.set(0, 0.25, 0); ring.receiveShadow = true; scene.add(ring); collidableMeshes.push(ring); obstacles.push({ x:0, z:0, radius: 9 });

    // tents from config or some defaults
    const tents = mapConfig.tents || [ { x: 0, z: 0, size: 8 }, { x: 18, z: 10, size: 6 }, { x: -20, z: -6, size: 5 } ];
    tents.forEach(t => {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(t.size*0.9, t.size*0.9, 0.6, 12), new THREE.MeshStandardMaterial({ color: 0x6b3a3a }));
        base.position.set(t.x, 0.3, t.z); scene.add(base); collidableMeshes.push(base);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(t.size, t.size*1.2, 12), new THREE.MeshStandardMaterial({ color: 0xffcc66 }));
        cone.position.set(t.x, t.size*0.6 + 0.2, t.z); scene.add(cone);
        obstacles.push({ x: t.x, z: t.z, radius: t.size + 1 });
    });

    // colorful banners and small stands
    for (let i = 0; i < 14; i++) {
        const x = Math.random()*220 - 110; const z = Math.random()*220 - 110;
        const banner = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.2), new THREE.MeshStandardMaterial({ color: 0xff66aa, side: THREE.DoubleSide }));
        banner.position.set(x, 2.2, z); banner.rotation.y = Math.random()*Math.PI; scene.add(banner);
    }
}
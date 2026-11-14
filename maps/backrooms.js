export default {
    name: 'backrooms',
    // Un espacio interior laberíntico: pocas plantas, suelo sucio y luces fluorescentes
    terrain: 'indoor',
    totalCount: 200,
    groundColor: 0xE7DFAE,
    wallColor: 0xE1D18B,
    ceilingColor: 0xF6F0C8,
    dayColor: 0xF1E8D0,
    nightColor: 0x2a2418,
    nightRainColor: 0x15120d,
    puddles: [ { x: -10, z: 8, r: 3 }, { x: 6, z: -5, r: 2 } ],
    campfires: [],
    // vegetación mínima
    treeChance: 0.00,
    shortGrassChance: 0.02,
    tallGrassChance: 0.00,
    rockChance: 0.01,
    leafColor: 0x6b6b6b,
    trunkColor: 0x444444,
    // lights/flicker hints (no usados por environment pero útiles para futuras personalizaciones)
    fluorescentLights: [ { x: 0, z: 0 }, { x: 20, z: -10 }, { x: -18, z: 14 } ],
    backroomSpacing: 16,
    wallHeight: 4.2,
    ceilingHeight: 4.8,
    wallDensity: 0.72,
    detailCount: 80,
    description: 'Pasillos fluorescentes, moho y baldosas rotas. Espacio claustrofóbico.'
};

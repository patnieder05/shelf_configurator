const fs = require('fs');
const path = require('path');

function getGlbInfo(filename) {
    const p = path.join(__dirname, '..', 'cad_files', '3d', filename);
    const buf = fs.readFileSync(p);
    const jsonLen = buf.readUInt32LE(12);
    const jsonStr = buf.toString('utf8', 20, 20 + jsonLen);
    const gltf = JSON.parse(jsonStr);

    const binOffset = 20 + jsonLen + 8;
    const binData = buf.slice(binOffset);

    console.log(`\n=== ${filename} ===`);
    gltf.accessors.forEach((acc, i) => {
        if (acc.type === 'VEC3') {
            console.log(`Acc ${i} (${gltf.bufferViews[acc.bufferView].target === 34962 ? 'INDEX/POS' : 'ATTR'}): min=${JSON.stringify(acc.min)}, max=${JSON.stringify(acc.max)}`);
        }
    });
}

getGlbInfo('tablar_1200x300.glb');
getGlbInfo('tablar_1900x300.glb');
getGlbInfo('tablar_1900x300_spezial.glb');

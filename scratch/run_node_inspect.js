const fs = require('fs');
const path = require('path');

const glbPath = path.join(__dirname, '..', 'cad_files', '3d', 'tablar_1900x300_spezial.glb');
const buf = fs.readFileSync(glbPath);

const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.toString('utf8', 20, 20 + jsonLen);
const gltf = JSON.parse(jsonStr);

const binOffset = 20 + jsonLen + 8;
const binData = buf.slice(binOffset);

let output = `GLTF JSON Structure for tablar_1900x300_spezial.glb:\n`;
output += `Nodes: ${JSON.stringify(gltf.nodes, null, 2)}\n`;
output += `Meshes: ${JSON.stringify(gltf.meshes, null, 2)}\n`;

gltf.accessors.forEach((acc, i) => {
    if (acc.type === 'VEC3') {
        const bv = gltf.bufferViews[acc.bufferView];
        const start = (bv.byteOffset || 0) + (acc.byteOffset || 0);
        const count = acc.count;
        const stride = bv.byteStride || 12;

        const verts = [];
        for (let k = 0; k < count; k++) {
            const off = start + k * stride;
            const x = binData.readFloatLE(off);
            const y = binData.readFloatLE(off + 4);
            const z = binData.readFloatLE(off + 8);
            verts.push({ x, y, z });
        }

        const xs = verts.map(v => v.x);
        const ys = verts.map(v => v.y);
        const zs = verts.map(v => v.z);

        output += `\nAccessor ${i} (${acc.type}):\n`;
        output += `  X: min=${Math.min(...xs).toFixed(2)}, max=${Math.max(...xs).toFixed(2)}\n`;
        output += `  Y: min=${Math.min(...ys).toFixed(2)}, max=${Math.max(...ys).toFixed(2)}\n`;
        output += `  Z: min=${Math.min(...zs).toFixed(2)}, max=${Math.max(...zs).toFixed(2)}\n`;

        output += `  Sample Vertices (x, y, z):\n`;
        verts.slice(0, 30).forEach(v => {
            output += `    (${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})\n`;
        });
    }
});

fs.writeFileSync(path.join(__dirname, 'glb_vertices.txt'), output);
console.log("Wrote glb_vertices.txt");

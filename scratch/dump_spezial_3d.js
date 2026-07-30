const fs = require('fs');
const path = require('path');

const glbPath = path.join(__dirname, '..', 'cad_files', '3d', 'tablar_1900x300_spezial.glb');
const buf = fs.readFileSync(glbPath);

const magic = buf.toString('utf8', 0, 4);
const version = buf.readUInt32LE(4);
const length = buf.readUInt32LE(8);

const jsonLen = buf.readUInt32LE(12);
const jsonType = buf.readUInt32LE(16);
const jsonStr = buf.toString('utf8', 20, 20 + jsonLen);
const gltf = JSON.parse(jsonStr);

const binHeaderOffset = 20 + jsonLen;
const binLen = buf.readUInt32LE(binHeaderOffset);
const binData = buf.slice(binHeaderOffset + 8, binHeaderOffset + 8 + binLen);

console.log("GLTF Accessors for tablar_1900x300_spezial.glb:");
gltf.accessors.forEach((acc, i) => {
    console.log(`Acc ${i}: type=${acc.type}, min=${JSON.stringify(acc.min)}, max=${JSON.stringify(acc.max)}`);
});

gltf.meshes.forEach(mesh => {
    mesh.primitives.forEach(prim => {
        const posAccIdx = prim.attributes.POSITION;
        if (posAccIdx !== undefined) {
            const acc = gltf.accessors[posAccIdx];
            const bv = gltf.bufferViews[acc.bufferView];
            const start = (bv.byteOffset || 0) + (acc.byteOffset || 0);
            const count = acc.count;
            const stride = bv.byteStride || 12;

            const verts = [];
            for (let k = 0; k < count; k++) {
                const off = start + k * stride;
                const x = binData.readFloatLE(off);
                const y = binData.readFloatLE(off + 4);
                const z = binData.readFloatLE(off + 6); // wait 3 floats: x, y, z
                const zReal = binData.readFloatLE(off + 8);
                verts.push({ x, y, z: zReal });
            }

            const xs = verts.map(v => v.x);
            const ys = verts.map(v => v.y);
            const zs = verts.map(v => v.z);

            console.log("\nVertex Bounds:");
            console.log(`X min=${Math.min(...xs)}, max=${Math.max(...xs)}`);
            console.log(`Y min=${Math.min(...ys)}, max=${Math.max(...ys)}`);
            console.log(`Z min=${Math.min(...zs)}, max=${Math.max(...zs)}`);

            const uniqueY = [...new Set(ys.map(y => Math.round(y * 100) / 100))].sort((a,b)=>a-b);
            const uniqueZ = [...new Set(zs.map(z => Math.round(z * 100) / 100))].sort((a,b)=>a-b);
            console.log("Unique Y levels:", uniqueY);
            console.log("Unique Z levels:", uniqueZ);
        }
    });
});

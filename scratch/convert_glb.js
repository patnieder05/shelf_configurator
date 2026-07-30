const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'cad_files', '3d');
const outputFile = path.join(__dirname, '..', 'js', 'glb-defaults.js');

const files = {
    regal: 'regal.glb',
    tablar_300x1200: 'tablar_1200x300.glb',
    tablar_350x1200: 'tablar_1200x350.glb',
    tablar_300x1900: 'tablar_1900x300.glb'
};

const result = {};

for (const [key, filename] of Object.entries(files)) {
    const filePath = path.join(baseDir, filename);
    if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        result[key] = buffer.toString('base64');
        console.log(`Converted ${filename} (${buffer.length} bytes) to base64`);
    } else {
        console.warn(`File ${filename} not found!`);
    }
}

const jsContent = `/**
 * Embedded Default GLB 3D Model Data (Base64)
 * Guarantees that opening index.html directly via file:// protocol renders the real GLTF 3D CAD models
 * (with all 10mm holes, notches, and rebates) 100% reliably in any browser without CORS restriction.
 */
const GLB_DEFAULTS = ${JSON.stringify(result, null, 2)};
`;

fs.writeFileSync(outputFile, jsContent, 'utf8');
console.log(`Wrote embedded GLB data to ${outputFile}`);

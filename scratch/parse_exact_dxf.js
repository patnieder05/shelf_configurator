const fs = require('fs');
const path = require('path');

const dxfPath = path.join(__dirname, '..', 'cad_files', '2d', 'tablar_300x1900_spezial.dxf');
const dxfText = fs.readFileSync(dxfPath, 'utf8');

// Load DXFParser class logic from dxf-parser.js
const parserCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'dxf-parser.js'), 'utf8');
eval(parserCode);

const parsed = DXFParser.parse(dxfText);

console.log("=== 1:1 Parsed tablar_300x1900_spezial.dxf ===");
console.log("Bounds:", parsed.bounds);
console.log("Holes count:", parsed.holes.length);
parsed.holes.forEach((h, i) => console.log(`  Hole ${i+1}: x=${h.x}, y=${h.y}, radius=${h.radius}`));

console.log("\nEntities count:", parsed.entities.length);
parsed.entities.forEach((e, i) => {
    if (e.type === 'LWPOLYLINE') {
        console.log(`  Entity ${i+1} LWPOLYLINE (closed=${e.isClosed}): points=${JSON.stringify(e.points)}`);
    } else {
        console.log(`  Entity ${i+1} ${e.type}: ${JSON.stringify(e)}`);
    }
});

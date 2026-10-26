/**
 * STEPParser - 3D STEP Geometry & Feature Extractor
 * Reads STEP files from cad_files/3d/ and constructs exact 3D STEP solid models for Three.js
 */
class STEPParser {
    static parse(stepText) {
        const lines = stepText.split(/\r?\n/);
        const cartesianPoints = [];

        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.includes('CARTESIAN_POINT')) {
                const match = trimmed.match(/CARTESIAN_POINT\s*\(\s*'.*?'\s*,\s*\(\s*([\d\.\-\+eE]+)\s*,\s*([\d\.\-\+eE]+)\s*,\s*([\d\.\-\+eE]+)\s*\)\s*\)/i);
                if (match) {
                    cartesianPoints.push({
                        x: parseFloat(match[1]),
                        y: parseFloat(match[2]),
                        z: parseFloat(match[3])
                    });
                }
            }
        });

        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        cartesianPoints.forEach(p => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
            minZ = Math.min(minZ, p.z);
            maxZ = Math.max(maxZ, p.z);
        });

        if (minX === Infinity) {
            minX = 0; minY = 0; minZ = 0;
            maxX = 100; maxY = 100; maxZ = 100;
        }

        return {
            cartesianPoints,
            bounds: {
                minX, minY, minZ,
                maxX, maxY, maxZ,
                width: maxX - minX,
                height: maxY - minY,
                depth: maxZ - minZ
            }
        };
    }

    /**
     * Constructs exact 3D extruded STEP shelf geometry with post notches and 10mm pin holes
     * Matches exact CAD STEP coordinates (Post 1: 0..35, Post 2: 700..735, Post 3: 1400..1435)
     */
    static createShelfGeometry(width, depth, is3Span = false) {
        const shape = new THREE.Shape();
        const backZ = -26; // Back of shelf around notch
        const notchZ = 0;  // Inside notch (front edge of post)
        const frontZ = backZ + depth; // Front edge of shelf

        const minX = -232.5;
        const maxX = minX + width;

        // Start back-left corner
        shape.moveTo(minX, backZ);

        // Notch 1 (Post 1: X = 0 to 35 mm)
        shape.lineTo(0, backZ);
        shape.lineTo(0, notchZ);
        shape.lineTo(35, notchZ);
        shape.lineTo(35, backZ);

        // Notch 2 (Post 2: X = 700 to 735 mm) - Exact CAD STEP position!
        shape.lineTo(700, backZ);
        shape.lineTo(700, notchZ);
        shape.lineTo(735, notchZ);
        shape.lineTo(735, backZ);

        // Notch 3 (Post 3: X = 1400 to 1435 mm) - Exact CAD STEP position for 1800mm (180cm) shelf!
        if (is3Span || width > 1500) {
            shape.lineTo(1400, backZ);
            shape.lineTo(1400, notchZ);
            shape.lineTo(1435, notchZ);
            shape.lineTo(1435, backZ);
        }

        // To back-right corner
        shape.lineTo(maxX, backZ);

        // Front edge
        shape.lineTo(maxX, frontZ);
        shape.lineTo(minX, frontZ);
        shape.lineTo(minX, backZ);

        // 10mm Pin Holes at Z = -13mm (center of 26mm notch depth)
        const hole1 = new THREE.Path();
        hole1.absarc(17.5, -13, 5, 0, Math.PI * 2, true);
        shape.holes.push(hole1);

        const hole2 = new THREE.Path();
        hole2.absarc(717.5, -13, 5, 0, Math.PI * 2, true);
        shape.holes.push(hole2);

        if (is3Span || width > 1500) {
            const hole3 = new THREE.Path();
            hole3.absarc(1417.5, -13, 5, 0, Math.PI * 2, true);
            shape.holes.push(hole3);
        }

        const extrudeSettings = {
            steps: 1,
            depth: 24, // 24mm board thickness
            bevelEnabled: true,
            bevelThickness: 1.5,
            bevelSize: 1.5,
            bevelSegments: 3
        };

        const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        
        // Rotate X by +90 deg so Shape (X, Z) maps to 3D Space (X, Z) and Extrude Y is Height
        geom.rotateX(Math.PI / 2);

        return geom;
    }
}

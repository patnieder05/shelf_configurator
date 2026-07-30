/**
 * SVGParser - Native 2D SVG Parser for Wall Shelf Configurator
 * Converts SVG path, polygon, rect, line, circle, and ellipse elements into clean 2D vector geometries
 * and normalizes physical size ratios (1200mm, 1900mm, 2600mm, 3535mm) to match wall posts.
 */
class SVGParser {
    static parsePathD(d) {
        const points = [];
        let currentX = 0, currentY = 0;
        let startX = 0, startY = 0;
        let isClosed = false;

        const tokens = d.match(/([a-df-zA-DF-Z])|([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/g);
        if (!tokens) return { points: [], isClosed: false };

        let cmd = '';
        let i = 0;

        while (i < tokens.length) {
            const token = tokens[i];
            if (/^[a-df-zA-DF-Z]$/.test(token)) {
                cmd = token;
                i++;
            }

            if (cmd === 'M' || cmd === 'm') {
                const x = parseFloat(tokens[i++]);
                const y = parseFloat(tokens[i++]);
                currentX = (cmd === 'm') ? currentX + x : x;
                currentY = (cmd === 'm') ? currentY + y : y;
                startX = currentX;
                startY = currentY;
                points.push({ x: currentX, y: currentY });

                while (i < tokens.length && !/^[a-df-zA-DF-Z]$/.test(tokens[i])) {
                    const lx = parseFloat(tokens[i++]);
                    const ly = parseFloat(tokens[i++]);
                    currentX = (cmd === 'm') ? currentX + lx : lx;
                    currentY = (cmd === 'm') ? currentY + ly : ly;
                    points.push({ x: currentX, y: currentY });
                }
            } else if (cmd === 'L' || cmd === 'l') {
                while (i < tokens.length && !/^[a-df-zA-DF-Z]$/.test(tokens[i])) {
                    const x = parseFloat(tokens[i++]);
                    const y = parseFloat(tokens[i++]);
                    currentX = (cmd === 'l') ? currentX + x : x;
                    currentY = (cmd === 'l') ? currentY + y : y;
                    points.push({ x: currentX, y: currentY });
                }
            } else if (cmd === 'H' || cmd === 'h') {
                while (i < tokens.length && !/^[a-df-zA-DF-Z]$/.test(tokens[i])) {
                    const x = parseFloat(tokens[i++]);
                    currentX = (cmd === 'h') ? currentX + x : x;
                    points.push({ x: currentX, y: currentY });
                }
            } else if (cmd === 'V' || cmd === 'v') {
                while (i < tokens.length && !/^[a-df-zA-DF-Z]$/.test(tokens[i])) {
                    const y = parseFloat(tokens[i++]);
                    currentY = (cmd === 'v') ? currentY + y : y;
                    points.push({ x: currentX, y: currentY });
                }
            } else if (cmd === 'Z' || cmd === 'z') {
                isClosed = true;
                currentX = startX;
                currentY = startY;
            } else {
                i++;
            }
        }

        return { points, isClosed };
    }

    static parse(svgText, targetWidth = null) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgEl = doc.querySelector('svg');

        if (!svgEl) {
            console.error('Invalid SVG document');
            return null;
        }

        const rawEntities = [];
        const rawHoles = [];

        // 1. Parse <path>
        doc.querySelectorAll('svg > g path, svg g.Graphic path, svg g.Slide path, svg path').forEach(path => {
            const d = path.getAttribute('d');
            if (d && !path.classList.contains('BoundingBox') && !path.closest('defs')) {
                const parsedPath = SVGParser.parsePathD(d);
                if (parsedPath.points.length > 1) {
                    rawEntities.push({
                        type: 'LWPOLYLINE',
                        isClosed: parsedPath.isClosed,
                        points: parsedPath.points
                    });
                }
            }
        });

        // 2. Parse <rect>
        doc.querySelectorAll('rect').forEach(rect => {
            if (rect.classList.contains('BoundingBox') || rect.closest('defs')) return;
            const x = parseFloat(rect.getAttribute('x') || 0);
            const y = parseFloat(rect.getAttribute('y') || 0);
            const w = parseFloat(rect.getAttribute('width') || 0);
            const h = parseFloat(rect.getAttribute('height') || 0);
            if (w > 0 && h > 0) {
                rawEntities.push({
                    type: 'LWPOLYLINE',
                    isClosed: true,
                    points: [
                        { x, y },
                        { x: x + w, y },
                        { x: x + w, y: y + h },
                        { x, y: y + h }
                    ]
                });
            }
        });

        // 3. Parse <ellipse> and <circle>
        doc.querySelectorAll('ellipse, circle').forEach(el => {
            if (el.closest('defs')) return;
            const cx = parseFloat(el.getAttribute('cx') || el.getAttribute('x') || 0);
            const cy = parseFloat(el.getAttribute('cy') || el.getAttribute('y') || 0);
            const rx = parseFloat(el.getAttribute('rx') || el.getAttribute('r') || 5);
            const ry = parseFloat(el.getAttribute('ry') || el.getAttribute('r') || 5);
            const r = (rx + ry) / 2;

            if (r > 0) {
                rawEntities.push({ type: 'CIRCLE', x: cx, y: cy, radius: r });
                rawHoles.push({ x: cx, y: cy, radius: r });
            }
        });

        if (rawEntities.length === 0) return null;

        // Compute Raw Bounding Box in SVG space
        let rawMinX = Infinity, rawMaxX = -Infinity, rawMinY = Infinity, rawMaxY = -Infinity;
        rawEntities.forEach(e => {
            if (e.points) {
                e.points.forEach(p => {
                    if (p.x < rawMinX) rawMinX = p.x;
                    if (p.x > rawMaxX) rawMaxX = p.x;
                    if (p.y < rawMinY) rawMinY = p.y;
                    if (p.y > rawMaxY) rawMaxY = p.y;
                });
            } else if (e.x !== undefined) {
                if (e.x < rawMinX) rawMinX = e.x;
                if (e.x > rawMaxX) rawMaxX = e.x;
                if (e.y < rawMinY) rawMinY = e.y;
                if (e.y > rawMaxY) rawMaxY = e.y;
            }
        });

        const rawWidth = rawMaxX - rawMinX;
        if (rawWidth <= 0) return null;

        // Scale to physical target width (e.g. 1200mm, 1900mm, 2600mm, 3535mm)
        let scale = 1.0;
        if (targetWidth && targetWidth > 0) {
            scale = targetWidth / rawWidth;
        } else if (rawHoles.length >= 2) {
            rawHoles.sort((a, b) => a.x - b.x);
            const svgHoleDist = Math.abs(rawHoles[1].x - rawHoles[0].x);
            if (svgHoleDist > 10) {
                scale = 700.0 / svgHoleDist;
            }
        }

        // Align Hole 1 or MinX to CAD origin (-232.5mm overhang for 1900mm, etc.)
        let originX = rawMinX * scale;
        let originY = rawMinY * scale;

        if (targetWidth === 1900) {
            originX = rawMinX * scale + 232.5;
        } else if (targetWidth === 1200) {
            originX = rawMinX * scale + 232.5;
        } else if (targetWidth === 2600) {
            originX = rawMinX * scale + 232.5;
        } else if (rawHoles.length > 0) {
            rawHoles.sort((a, b) => a.x - b.x);
            originX = rawHoles[0].x * scale - 17.5;
            originY = rawHoles[0].y * scale;
        }

        // Transform all entities directly into millimeter CAD space
        const entities = rawEntities.map(e => {
            if (e.points) {
                return {
                    ...e,
                    points: e.points.map(p => ({
                        x: p.x * scale - originX,
                        y: -(p.y * scale - originY)
                    }))
                };
            } else if (e.type === 'CIRCLE') {
                return {
                    ...e,
                    x: e.x * scale - originX,
                    y: -(e.y * scale - originY),
                    radius: Math.max(3, e.radius * scale)
                };
            }
            return e;
        });

        const holes = rawHoles.map(h => ({
            x: h.x * scale - originX,
            y: -(h.y * scale - originY),
            radius: Math.max(4, h.radius * scale)
        }));

        // Compute normalized Bounds
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        entities.forEach(e => {
            if (e.points) {
                e.points.forEach(p => {
                    if (p.x < minX) minX = p.x;
                    if (p.x > maxX) maxX = p.x;
                    if (p.y < minY) minY = p.y;
                    if (p.y > maxY) maxY = p.y;
                });
            } else if (e.x !== undefined) {
                if (e.x < minX) minX = e.x;
                if (e.x > maxX) maxX = e.x;
                if (e.y < minY) minY = e.y;
                if (e.y > maxY) maxY = e.y;
            }
        });

        return {
            entities,
            holes,
            bounds: {
                minX,
                maxX,
                minY,
                maxY,
                width: maxX - minX,
                height: maxY - minY
            }
        };
    }
}

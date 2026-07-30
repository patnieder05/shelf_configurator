/**
 * DXFParser - Standalone ASCII DXF Parser for Browser
 * Parses LINE, LWPOLYLINE, CIRCLE, ARC entities.
 * Supports 180° rotation and Y-coordinate normalization.
 */
class DXFParser {
    static parse(dxfText, options = {}) {
        const lines = dxfText.split(/\r?\n/);
        let idx = 0;
        
        let inEntities = false;
        const entities = [];
        
        while (idx < lines.length - 1) {
            const code = lines[idx].trim();
            const val = lines[idx + 1].trim();
            idx += 2;
            
            if (code === '0' && val === 'SECTION') {
                if (idx < lines.length - 1 && lines[idx].trim() === '2' && lines[idx + 1].trim() === 'ENTITIES') {
                    inEntities = true;
                    idx += 2;
                    continue;
                }
            }
            
            if (inEntities && code === '0' && val === 'ENDSEC') {
                break;
            }
            
            if (inEntities && code === '0') {
                const entityType = val;
                const entityData = DXFParser._parseEntity(lines, idx, entityType);
                if (entityData) {
                    if (entityData.entity) entities.push(entityData.entity);
                    idx = entityData.nextIdx;
                }
            }
        }
        
        // Initial bounds calculation
        let bounds = DXFParser._computeBounds(entities);

        let parsed = {
            entities,
            holes: [],
            bounds
        };

        // Apply 180° rotation if requested
        if (options.rotate180) {
            parsed = DXFParser.rotate180(parsed);
            bounds = parsed.bounds;
        }

        // Normalize Y coordinates if negative (e.g., regal_basis drew downwards from 0 to -2230)
        if (bounds.minY < -100) {
            const yShift = -bounds.minY; // e.g. +2230
            parsed.entities.forEach(e => {
                if (e.type === 'LINE') {
                    e.y1 += yShift;
                    e.y2 += yShift;
                } else if (e.type === 'CIRCLE' || e.type === 'ARC') {
                    e.y += yShift;
                } else if (e.type === 'LWPOLYLINE' && e.points) {
                    e.points.forEach(p => p.y += yShift);
                }
            });
            parsed.bounds = DXFParser._computeBounds(parsed.entities);
        }

        // Extract 10mm holes
        parsed.holes = parsed.entities
            .filter(e => e.type === 'CIRCLE' && e.radius >= 4 && e.radius <= 6)
            .map(e => ({ x: e.x, y: e.y, radius: e.radius }));

        return parsed;
    }

    static rotate180(parsedDxf) {
        const b = parsedDxf.bounds || DXFParser._computeBounds(parsedDxf.entities);
        const centerX = b.minX + b.maxX;
        const centerY = b.minY + b.maxY;

        parsedDxf.entities.forEach(e => {
            if (e.type === 'LINE') {
                e.x1 = centerX - e.x1;
                e.y1 = centerY - e.y1;
                e.x2 = centerX - e.x2;
                e.y2 = centerY - e.y2;
            } else if (e.type === 'CIRCLE' || e.type === 'ARC') {
                e.x = centerX - e.x;
                e.y = centerY - e.y;
            } else if (e.type === 'LWPOLYLINE' && e.points) {
                e.points.forEach(p => {
                    p.x = centerX - p.x;
                    p.y = centerY - p.y;
                });
            }
        });

        parsedDxf.bounds = DXFParser._computeBounds(parsedDxf.entities);
        return parsedDxf;
    }

    static _parseEntity(lines, startIdx, type) {
        let idx = startIdx;
        
        if (type === 'LINE') {
            let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
            while (idx < lines.length - 1) {
                const code = lines[idx].trim();
                const val = lines[idx + 1].trim();
                if (code === '0') break;
                idx += 2;
                if (code === '10') x1 = parseFloat(val);
                else if (code === '20') y1 = parseFloat(val);
                else if (code === '11') x2 = parseFloat(val);
                else if (code === '21') y2 = parseFloat(val);
            }
            return { entity: { type: 'LINE', x1, y1, x2, y2 }, nextIdx: idx };
        }
        
        if (type === 'CIRCLE') {
            let x = 0, y = 0, radius = 0;
            while (idx < lines.length - 1) {
                const code = lines[idx].trim();
                const val = lines[idx + 1].trim();
                if (code === '0') break;
                idx += 2;
                if (code === '10') x = parseFloat(val);
                else if (code === '20') y = parseFloat(val);
                else if (code === '40') radius = parseFloat(val);
            }
            return { entity: { type: 'CIRCLE', x, y, radius }, nextIdx: idx };
        }
        
        if (type === 'ARC') {
            let x = 0, y = 0, radius = 0, startAngle = 0, endAngle = 0;
            while (idx < lines.length - 1) {
                const code = lines[idx].trim();
                const val = lines[idx + 1].trim();
                if (code === '0') break;
                idx += 2;
                if (code === '10') x = parseFloat(val);
                else if (code === '20') y = parseFloat(val);
                else if (code === '40') radius = parseFloat(val);
                else if (code === '50') startAngle = parseFloat(val);
                else if (code === '51') endAngle = parseFloat(val);
            }
            return { entity: { type: 'ARC', x, y, radius, startAngle, endAngle }, nextIdx: idx };
        }
        
        if (type === 'LWPOLYLINE') {
            const points = [];
            let isClosed = false;
            let currentX = null;
            
            while (idx < lines.length - 1) {
                const code = lines[idx].trim();
                const val = lines[idx + 1].trim();
                if (code === '0') break;
                idx += 2;
                if (code === '70') {
                    isClosed = (parseInt(val, 10) & 1) === 1;
                } else if (code === '10') {
                    currentX = parseFloat(val);
                } else if (code === '20') {
                    if (currentX !== null) {
                        points.push({ x: currentX, y: parseFloat(val) });
                        currentX = null;
                    }
                }
            }
            return { entity: { type: 'LWPOLYLINE', points, isClosed }, nextIdx: idx };
        }
        
        while (idx < lines.length - 1) {
            if (lines[idx].trim() === '0') break;
            idx += 2;
        }
        return { entity: null, nextIdx: idx };
    }

    static _computeBounds(entities) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        entities.forEach(e => {
            if (!e) return;
            if (e.type === 'LINE') {
                minX = Math.min(minX, e.x1, e.x2);
                maxX = Math.max(maxX, e.x1, e.x2);
                minY = Math.min(minY, e.y1, e.y2);
                maxY = Math.max(maxY, e.y1, e.y2);
            } else if (e.type === 'CIRCLE' || e.type === 'ARC') {
                minX = Math.min(minX, e.x - e.radius);
                maxX = Math.max(maxX, e.x + e.radius);
                minY = Math.min(minY, e.y - e.radius);
                maxY = Math.max(maxY, e.y + e.radius);
            } else if (e.type === 'LWPOLYLINE' && e.points && e.points.length > 0) {
                e.points.forEach(p => {
                    minX = Math.min(minX, p.x);
                    maxX = Math.max(maxX, p.x);
                    minY = Math.min(minY, p.y);
                    maxY = Math.max(maxY, p.y);
                });
            }
        });
        
        if (minX === Infinity) {
            minX = 0; minY = 0; maxX = 100; maxY = 100;
        }
        
        return {
            minX, minY, maxX, maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }
}

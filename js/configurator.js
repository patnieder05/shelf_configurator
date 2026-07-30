/**
 * Configurator2D - 2D Interactive Canvas Engine for Wall Shelf System
 * Handles DXF Rendering, Drag & Drop, DXF Hole-to-Hole Snapping, Material Count,
 * 90° Orthogonal Angle Snapping & Right Angle (Rechter Winkel) Dimensioning
 */
class Configurator2D {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.actionBarEl = document.getElementById('shelf-action-bar');
        this.actionBarTitleEl = document.getElementById('action-bar-title');

        // Layout Data
        this.basisData = null; // regal_basis.dxf parsed
        this.tvData = null;    // tv.dxf parsed
        this.templates = {};   // id -> parsed DXF data
        this.placedShelves = [];

        // Selection & Interaction State
        this.selectedShelf = null;
        this.hoveredShelf = null;
        this.isDragging = false;
        this.isPanning = false;
        this.is3DModeActive = false;
        this.dragOffset = { x: 0, y: 0 };
        this.panStart = { x: 0, y: 0 };

        // Measurement Tool State
        this.isMeasuringMode = false;
        this.measureStart = null;
        this.measureCurrent = null;
        this.savedMeasurements = [];

        // Viewport Transform
        this.scale = 0.35;
        this.offsetX = 200;
        this.offsetY = 650;

        // Snapping Configuration
        this.snapRadius = 35; // mm snap distance
        this.activeSnapGuide = null;

        // Event Listeners
        this._initEvents();
        this._resizeCanvas();
        window.addEventListener('resize', () => this._resizeCanvas());

        // Animation Frame
        this._renderLoop();
    }

    set3DModeActive(isActive) {
        this.is3DModeActive = !!isActive;
        this._updateActionBarPosition();
    }

    hideActionBar() {
        if (this.actionBarEl) {
            this.actionBarEl.style.display = 'none';
        }
    }

    _resizeCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.render();
    }

    setBasisData(parsedDxf) {
        this.basisData = parsedDxf;
        if (parsedDxf && parsedDxf.bounds) {
            const b = parsedDxf.bounds;
            const viewWidth = this.canvas.width;
            const viewHeight = this.canvas.height;
            this.scale = Math.min((viewWidth - 100) / b.width, (viewHeight - 100) / b.height, 0.45);
            this.offsetX = (viewWidth - b.width * this.scale) / 2 - b.minX * this.scale;
            this.offsetY = (viewHeight + b.height * this.scale) / 2 + b.minY * this.scale;
        }

        this.placedShelves.forEach(s => this._applyHoleSnapping(s));
        this.render();
    }

    setTvData(parsedDxf) {
        this.tvData = parsedDxf;
        if (this.tvData) {
            if (typeof this.tvData.x !== 'number') this.tvData.x = 0;
            if (typeof this.tvData.y !== 'number') this.tvData.y = 0;
        }
        this.render();
    }

    registerTemplate(id, name, parsedDxf) {
        this.templates[id] = { id, name, dxf: parsedDxf };
    }

    addShelf(templateId) {
        const tpl = this.templates[templateId];
        if (!tpl) return;

        let defaultX = 0;
        let defaultY = 1130;

        if (this.basisData && this.basisData.holes && this.basisData.holes.length > 0) {
            const midY = (this.basisData.bounds.minY + this.basisData.bounds.maxY) / 2;
            let closestHole = this.basisData.holes[0];
            let minDist = Infinity;
            this.basisData.holes.forEach(bh => {
                const d = Math.abs(bh.y - midY);
                if (d < minDist) {
                    minDist = d;
                    closestHole = bh;
                }
            });
            const shelfHoleOffsetY = (tpl.dxf.holes && tpl.dxf.holes[0]) ? tpl.dxf.holes[0].y : 0;
            defaultY = closestHole.y - shelfHoleOffsetY;
        }

        const newShelf = {
            id: 'shelf_' + Date.now(),
            templateId,
            name: tpl.name,
            x: defaultX,
            y: defaultY,
            dxf: tpl.dxf,
            bounds: tpl.dxf.bounds,
            isSelected: true
        };

        this.placedShelves.forEach(s => s.isSelected = false);
        this._applyHoleSnapping(newShelf);

        this.placedShelves.push(newShelf);
        this.selectedShelf = newShelf;
        
        this.onStateChanged();
        this.render();
    }

    duplicateSelectedShelf() {
        if (!this.selectedShelf) return;

        const original = this.selectedShelf;
        const clone = {
            id: 'shelf_' + Date.now(),
            templateId: original.templateId,
            name: original.name,
            x: original.x,
            y: original.y + 80,
            dxf: original.dxf,
            bounds: original.bounds,
            isSelected: true
        };

        this.placedShelves.forEach(s => s.isSelected = false);
        this._applyHoleSnapping(clone);

        this.placedShelves.push(clone);
        this.selectedShelf = clone;

        this.onStateChanged();
        this.render();
    }

    moveSelectedShelf(deltaY) {
        if (!this.selectedShelf) return;
        this.selectedShelf.y += deltaY;
        this._applyHoleSnapping(this.selectedShelf);
        this.onStateChanged();
        this.render();
    }

    deleteSelectedShelf() {
        if (!this.selectedShelf) return;
        this.placedShelves = this.placedShelves.filter(s => s.id !== this.selectedShelf.id);
        this.selectedShelf = null;
        this.onStateChanged();
        this.render();
    }

    clearAllShelves() {
        this.placedShelves = [];
        this.selectedShelf = null;
        this.savedMeasurements = [];
        this.onStateChanged();
        this.render();
    }

    toggleMeasurementMode(forceState) {
        this.isMeasuringMode = (typeof forceState === 'boolean') ? forceState : !this.isMeasuringMode;
        this.measureStart = null;
        this.measureCurrent = null;
        this.canvas.style.cursor = this.isMeasuringMode ? 'crosshair' : 'grab';
        this.render();
        return this.isMeasuringMode;
    }

    clearMeasurements() {
        this.savedMeasurements = [];
        this.render();
    }

    worldToCanvas(wx, wy) {
        return {
            x: this.offsetX + wx * this.scale,
            y: this.offsetY - wy * this.scale
        };
    }

    canvasToWorld(cx, cy) {
        return {
            x: (cx - this.offsetX) / this.scale,
            y: (this.offsetY - cy) / this.scale
        };
    }

    // Snapping Logic: Hole-to-Hole alignment
    _applyHoleSnapping(shelf) {
        if (!this.basisData || !this.basisData.holes || this.basisData.holes.length === 0) return;
        if (!shelf.dxf || !shelf.dxf.holes || shelf.dxf.holes.length === 0) return;

        let bestSnapDelta = null;
        let minDistanceSq = Infinity;

        shelf.dxf.holes.forEach(sh => {
            const worldShX = shelf.x + sh.x;
            const worldShY = shelf.y + sh.y;

            this.basisData.holes.forEach(bh => {
                const dx = bh.x - worldShX;
                const dy = bh.y - worldShY;
                const distSq = dx * dx + dy * dy;

                if (distSq < (this.snapRadius * this.snapRadius) && distSq < minDistanceSq) {
                    minDistanceSq = distSq;
                    bestSnapDelta = { dx, dy };
                }
            });
        });

        if (bestSnapDelta && minDistanceSq < (this.snapRadius * this.snapRadius)) {
            shelf.x += bestSnapDelta.dx;
            shelf.y += bestSnapDelta.dy;

            // Find all aligned hole pairs for green snap indicators
            const alignedHolePairs = [];
            shelf.dxf.holes.forEach(sh => {
                const wx = shelf.x + sh.x;
                const wy = shelf.y + sh.y;
                const targetHole = this.basisData.holes.find(bh => 
                    Math.abs(bh.x - wx) < 1.5 && Math.abs(bh.y - wy) < 1.5
                );
                if (targetHole) {
                    alignedHolePairs.push({
                        shelfHole: { x: wx, y: wy },
                        postHole: { x: targetHole.x, y: targetHole.y }
                    });
                }
            });

            this.activeSnapGuide = {
                isSnapped: true,
                pairs: alignedHolePairs
            };
        } else {
            // Outside snap radius: no snap active
            this.activeSnapGuide = null;
        }
    }

    _findMeasurementSnapPoint(worldPos) {
        let bestSnap = { x: worldPos.x, y: worldPos.y, label: '', is90Deg: false };
        let minDistSq = 40 * 40;

        this.placedShelves.forEach((shelf) => {
            const topY = shelf.y + shelf.bounds.maxY;
            const bottomY = shelf.y + shelf.bounds.minY;
            const leftX = shelf.x + shelf.bounds.minX;
            const rightX = shelf.x + shelf.bounds.maxX;

            if (worldPos.x >= leftX && worldPos.x <= rightX) {
                const distTop = Math.abs(worldPos.y - topY);
                if (distTop * distTop < minDistSq) {
                    minDistSq = distTop * distTop;
                    bestSnap = { x: worldPos.x, y: topY, label: `${shelf.name} Oberkante` };
                }
                const distBottom = Math.abs(worldPos.y - bottomY);
                if (distBottom * distBottom < minDistSq) {
                    minDistSq = distBottom * distBottom;
                    bestSnap = { x: worldPos.x, y: bottomY, label: `${shelf.name} Unterkante` };
                }
            }

            if (shelf.dxf && shelf.dxf.holes) {
                shelf.dxf.holes.forEach(sh => {
                    const hx = shelf.x + sh.x;
                    const hy = shelf.y + sh.y;
                    const distSq = (worldPos.x - hx)*(worldPos.x - hx) + (worldPos.y - hy)*(worldPos.y - hy);
                    if (distSq < minDistSq) {
                        minDistSq = distSq;
                        bestSnap = { x: hx, y: hy, label: `${shelf.name} Bohrung` };
                    }
                });
            }
        });

        if (this.measureStart) {
            const dx = Math.abs(bestSnap.x - this.measureStart.x);
            const dy = Math.abs(bestSnap.y - this.measureStart.y);

            if (dx < 25 && dy > 10) {
                bestSnap.x = this.measureStart.x;
                bestSnap.is90Deg = true;
                bestSnap.angleLabel = '90° Vertikal (Rechter Winkel)';
            }
            else if (dy < 25 && dx > 10) {
                bestSnap.y = this.measureStart.y;
                bestSnap.is90Deg = true;
                bestSnap.angleLabel = '90° Horizontal (Rechter Winkel)';
            }
        }

        return bestSnap;
    }

    getBillOfMaterials() {
        const shelfCounts = {};
        this.placedShelves.forEach(shelf => {
            shelfCounts[shelf.name] = (shelfCounts[shelf.name] || 0) + 1;
        });
        return {
            totalShelves: this.placedShelves.length,
            shelfCounts
        };
    }

    onStateChanged() {
        this._updateActionBarPosition();
        if (typeof this.onBOMUpdate === 'function') {
            this.onBOMUpdate(this.getBillOfMaterials());
        }
    }

    _updateActionBarPosition() {
        if (!this.actionBarEl) return;

        if (this.selectedShelf && !this.isMeasuringMode && !this.is3DModeActive) {
            const shelf = this.selectedShelf;
            const centerWorldX = shelf.x + (shelf.bounds.minX + shelf.bounds.maxX) / 2;
            const topWorldY = shelf.y + shelf.bounds.maxY;

            const pos = this.worldToCanvas(centerWorldX, topWorldY);

            this.actionBarEl.style.left = `${pos.x}px`;
            this.actionBarEl.style.top = `${pos.y - 14}px`;
            this.actionBarEl.style.display = 'flex';

            if (this.actionBarTitleEl) {
                this.actionBarTitleEl.textContent = `${shelf.name}`;
            }
        } else {
            this.actionBarEl.style.display = 'none';
        }
    }

    // Interactive Event Handlers
    _initEvents() {
        this.canvas.addEventListener('mousedown', e => this._onMouseDown(e));
        this.canvas.addEventListener('mousemove', e => this._onMouseMove(e));
        this.canvas.addEventListener('mouseup', e => this._onMouseUp(e));
        this.canvas.addEventListener('wheel', e => this._onWheel(e), { passive: false });
    }

    _onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldPos = this.canvasToWorld(mouseX, mouseY);

        if (this.isMeasuringMode) {
            const snap = this._findMeasurementSnapPoint(worldPos);
            if (!this.measureStart) {
                this.measureStart = snap;
            } else {
                this.savedMeasurements.push({
                    start: this.measureStart,
                    end: snap
                });
                this.measureStart = null;
                this.measureCurrent = null;
            }
            this.render();
            return;
        }

        let clickedShelf = null;
        for (let i = this.placedShelves.length - 1; i >= 0; i--) {
            const shelf = this.placedShelves[i];
            const minX = shelf.x + shelf.bounds.minX;
            const maxX = shelf.x + shelf.bounds.maxX;
            const minY = shelf.y + shelf.bounds.minY;
            const maxY = shelf.y + shelf.bounds.maxY;

            if (worldPos.x >= minX && worldPos.x <= maxX && worldPos.y >= minY && worldPos.y <= maxY) {
                clickedShelf = shelf;
                break;
            }
        }

        let clickedTv = false;
        if (!clickedShelf && this.tvData && this.tvData.bounds) {
            const tvX = this.tvData.x || 0;
            const tvY = this.tvData.y || 0;
            const minX = tvX + this.tvData.bounds.minX;
            const maxX = tvX + this.tvData.bounds.maxX;
            const minY = tvY + this.tvData.bounds.minY;
            const maxY = tvY + this.tvData.bounds.maxY;

            if (worldPos.x >= minX && worldPos.x <= maxX && worldPos.y >= minY && worldPos.y <= maxY) {
                clickedTv = true;
                this.isDraggingTv = true;
                this.dragTvOffset = { x: worldPos.x - tvX, y: worldPos.y - tvY };
            }
        }

        if (clickedShelf) {
            this.selectedShelf = clickedShelf;
            this.placedShelves.forEach(s => s.isSelected = (s.id === clickedShelf.id));
            this.isDragging = true;
            this.dragOffset = {
                x: worldPos.x - clickedShelf.x,
                y: worldPos.y - clickedShelf.y
            };
        } else if (clickedTv) {
            this.placedShelves.forEach(s => s.isSelected = false);
            this.selectedShelf = null;
        } else {
            this.placedShelves.forEach(s => s.isSelected = false);
            this.selectedShelf = null;
            this.isPanning = true;
            this.panStart = { x: e.clientX - this.offsetX, y: e.clientY - this.offsetY };
        }

        this.onStateChanged();
        this.render();
    }

    _onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldPos = this.canvasToWorld(mouseX, mouseY);

        if (this.isMeasuringMode) {
            this.measureCurrent = this._findMeasurementSnapPoint(worldPos);
            this.render();
            return;
        }

        if (this.isDraggingTv && this.tvData) {
            const rawX = worldPos.x - this.dragTvOffset.x;
            const rawY = worldPos.y - this.dragTvOffset.y;

            // Snap TV position to 80mm hole raster grid with origin at standard position (0,0)
            this.tvData.x = Math.round(rawX / 80) * 80;
            this.tvData.y = Math.round(rawY / 80) * 80;

            this.render();
            this.onStateChanged();
        } else if (this.isDragging && this.selectedShelf) {
            this.selectedShelf.x = worldPos.x - this.dragOffset.x;
            this.selectedShelf.y = worldPos.y - this.dragOffset.y;

            this._applyHoleSnapping(this.selectedShelf);
            this._updateActionBarPosition();
            this.render();
        } else if (this.isPanning) {
            this.offsetX = e.clientX - this.panStart.x;
            this.offsetY = e.clientY - this.panStart.y;
            this._updateActionBarPosition();
            this.render();
        } else {
            let hovered = null;
            for (let i = this.placedShelves.length - 1; i >= 0; i--) {
                const shelf = this.placedShelves[i];
                const minX = shelf.x + shelf.bounds.minX;
                const maxX = shelf.x + shelf.bounds.maxX;
                const minY = shelf.y + shelf.bounds.minY;
                const maxY = shelf.y + shelf.bounds.maxY;

                if (worldPos.x >= minX && worldPos.x <= maxX && worldPos.y >= minY && worldPos.y <= maxY) {
                    hovered = shelf;
                    break;
                }
            }
            if (this.hoveredShelf !== hovered) {
                this.hoveredShelf = hovered;
                this.canvas.style.cursor = hovered ? 'pointer' : 'grab';
                this.render();
            }
        }
    }

    _onMouseUp() {
        this.isDragging = false;
        this.isDraggingTv = false;
        this.isPanning = false;
        this.activeSnapGuide = null;
        this._updateActionBarPosition();
        this.render();
    }

    _onWheel(e) {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldPos = this.canvasToWorld(mouseX, mouseY);

        this.scale *= zoomFactor;
        this.scale = Math.max(0.1, Math.min(2.0, this.scale));

        this.offsetX = mouseX - worldPos.x * this.scale;
        this.offsetY = mouseY + worldPos.y * this.scale;

        this._updateActionBarPosition();
        this.render();
    }

    _renderLoop() {
        this.render();
        requestAnimationFrame(() => this._renderLoop());
    }

    // MAIN RENDER METHOD
    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Draw Axis & Grid Guides
        this._drawGrid(ctx);

        // 2. Draw Base Shelf Wall (regal_basis.dxf)
        if (this.basisData) {
            this._drawDXF(ctx, this.basisData, 0, 0, null, '#a0aec0', 1.5);
            this._drawHoles(ctx, this.basisData.holes, 0, 0, '#718096');
        }

        // 3. Draw TV (tv.dxf with dark OLED screen fill & position offset)
        if (this.tvData) {
            const tvX = this.tvData.x || 0;
            const tvY = this.tvData.y || 0;
            this._drawDXF(ctx, this.tvData, tvX, tvY, 'rgba(15, 23, 42, 0.92)', '#475569', 2);
            if (this.tvData.bounds) {
                const center = this.worldToCanvas(
                    tvX + (this.tvData.bounds.minX + this.tvData.bounds.maxX) / 2,
                    tvY + (this.tvData.bounds.minY + this.tvData.bounds.maxY) / 2
                );
                ctx.fillStyle = '#94a3b8';
                ctx.font = '600 13px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('📺 TV (Verschiebbar)', center.x, center.y);
            }
        }

        // 4. Draw Placed Shelves
        this.placedShelves.forEach(shelf => {
            const isSelected = shelf.isSelected;
            const isHovered = (this.hoveredShelf && this.hoveredShelf.id === shelf.id);
            
            let strokeColor = isSelected ? '#3182ce' : (isHovered ? '#63b3ed' : '#8c5e34');
            let fillColor = isSelected ? 'rgba(212, 163, 115, 0.4)' : 'rgba(212, 163, 115, 0.25)';

            this._drawDXF(ctx, shelf.dxf, shelf.x, shelf.y, fillColor, strokeColor, isSelected ? 2.5 : 1.5);

            if (shelf.dxf.holes) {
                this._drawHoles(ctx, shelf.dxf.holes, shelf.x, shelf.y, '#e2e8f0');
            }

            // Alustangen connection glow pins
            if (this.basisData && this.basisData.holes && shelf.dxf.holes) {
                shelf.dxf.holes.forEach(sh => {
                    const wx = shelf.x + sh.x;
                    const wy = shelf.y + sh.y;
                    const aligns = this.basisData.holes.some(bh => 
                        Math.abs(bh.x - wx) < 1.0 && Math.abs(bh.y - wy) < 1.0
                    );
                    if (aligns) {
                        const cp = this.worldToCanvas(wx, wy);
                        ctx.fillStyle = '#00f2fe';
                        ctx.beginPath();
                        ctx.arc(cp.x, cp.y, 5 * this.scale, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                    }
                });
            }

            const cp = this.worldToCanvas(shelf.x + shelf.bounds.minX, shelf.y + shelf.bounds.maxY + 15);
            ctx.fillStyle = isSelected ? '#63b3ed' : '#cbd5e0';
            ctx.font = '11px Inter, monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`${shelf.name} (${Math.round(shelf.bounds.width)}mm)`, cp.x, cp.y);
        });

        // 5. Draw Active Snap Indicators ONLY when dragging AND snapped!
        if (this.activeSnapGuide && this.isDragging && this.activeSnapGuide.isSnapped) {
            this.activeSnapGuide.pairs.forEach(pair => {
                const p = this.worldToCanvas(pair.postHole.x, pair.postHole.y);

                // Green snap glow circle for each aligned hole
                ctx.strokeStyle = '#2ecc71';
                ctx.lineWidth = 2.5;
                ctx.fillStyle = 'rgba(46, 204, 113, 0.35)';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                // Inner green snap dot
                ctx.fillStyle = '#2ecc71';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // 6. Draw Saved Measurements & Active Measurement Tool Line
        this._drawMeasurements(ctx);
    }

    _drawMeasurements(ctx) {
        this.savedMeasurements.forEach(m => {
            this._renderDimensionLine(ctx, m.start, m.end, '#f6e05e', false);
        });

        if (this.isMeasuringMode) {
            if (this.measureStart && this.measureCurrent) {
                this._renderDimensionLine(ctx, this.measureStart, this.measureCurrent, '#2ecc71', true);
            } else if (this.measureCurrent) {
                const p = this.worldToCanvas(this.measureCurrent.x, this.measureCurrent.y);
                ctx.fillStyle = '#63b3ed';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
                ctx.fill();

                if (this.measureCurrent.label) {
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '11px Inter, sans-serif';
                    ctx.textAlign = 'left';
                    ctx.fillText(this.measureCurrent.label, p.x + 10, p.y - 10);
                }
            }
        }
    }

    _renderDimensionLine(ctx, pStart, pEnd, color, isDotted) {
        const c1 = this.worldToCanvas(pStart.x, pStart.y);
        const c2 = this.worldToCanvas(pEnd.x, pEnd.y);

        const dx = Math.abs(pEnd.x - pStart.x);
        const dy = Math.abs(pEnd.y - pStart.y);
        const dist = Math.round(Math.sqrt(dx * dx + dy * dy));

        const is90Deg = (dx < 1 || dy < 1 || pEnd.is90Deg);

        ctx.strokeStyle = is90Deg ? '#2ecc71' : color;
        ctx.lineWidth = is90Deg ? 2.5 : 2;
        if (isDotted) ctx.setLineDash([4, 4]);

        ctx.beginPath();
        ctx.moveTo(c1.x, c1.y);
        ctx.lineTo(c2.x, c2.y);
        ctx.stroke();
        ctx.setLineDash([]);

        if (is90Deg) {
            const sqSize = 12;
            ctx.strokeStyle = '#2ecc71';
            ctx.lineWidth = 2;
            ctx.beginPath();
            if (dx < 1) {
                const dirY = c2.y > c1.y ? 1 : -1;
                ctx.moveTo(c1.x, c1.y + dirY * sqSize);
                ctx.lineTo(c1.x + sqSize, c1.y + dirY * sqSize);
                ctx.lineTo(c1.x + sqSize, c1.y);
            } else if (dy < 1) {
                const dirX = c2.x > c1.x ? 1 : -1;
                ctx.moveTo(c1.x + dirX * sqSize, c1.y);
                ctx.lineTo(c1.x + dirX * sqSize, c1.y - sqSize);
                ctx.lineTo(c1.x, c1.y - sqSize);
            }
            ctx.stroke();

            ctx.fillStyle = '#2ecc71';
            ctx.beginPath();
            const dotX = dx < 1 ? c1.x + 5 : c1.x + (c2.x > c1.x ? 5 : -5);
            const dotY = dy < 1 ? c1.y - 5 : c1.y + (c2.y > c1.y ? 5 : -5);
            ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = is90Deg ? '#2ecc71' : color;
        ctx.beginPath();
        ctx.arc(c1.x, c1.y, 4, 0, Math.PI * 2);
        ctx.arc(c2.x, c2.y, 4, 0, Math.PI * 2);
        ctx.fill();

        const midX = (c1.x + c2.x) / 2;
        const midY = (c1.y + c2.y) / 2;

        let labelText = `${dist} mm`;
        if (dx < 1) labelText = `📐 90° | Vertikal: ${Math.round(dy)} mm (Lichte Höhe)`;
        else if (dy < 1) labelText = `📐 90° | Horizontal: ${Math.round(dx)} mm`;
        else if (is90Deg) labelText = `📐 90° (Rechter Winkel): ${dist} mm`;

        ctx.font = 'bold 12px Inter, monospace';
        const textWidth = ctx.measureText(labelText).width;

        ctx.fillStyle = 'rgba(26, 30, 36, 0.95)';
        ctx.fillRect(midX - textWidth / 2 - 8, midY - 18, textWidth + 16, 24);

        ctx.strokeStyle = is90Deg ? '#2ecc71' : color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(midX - textWidth / 2 - 8, midY - 18, textWidth + 16, 24);

        ctx.fillStyle = is90Deg ? '#2ecc71' : color;
        ctx.textAlign = 'center';
        ctx.fillText(labelText, midX, midY - 3);
    }

    _drawGrid(ctx) {
        if (this.basisData && this.basisData.bounds) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 1;
            ctx.setLineDash([6, 6]);

            const postCenters = [17.5, 717.5, 1417.5, 2117.5, 2817.5, 3517.5];
            postCenters.forEach((x, idx) => {
                const pStart = this.worldToCanvas(x, 0);
                const pEnd = this.worldToCanvas(x, 2300);
                ctx.beginPath();
                ctx.moveTo(pStart.x, pStart.y);
                ctx.lineTo(pEnd.x, pEnd.y);
                ctx.stroke();

                ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.font = '10px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`Pfosten ${idx + 1}`, pStart.x, pStart.y + 15);
            });
            ctx.setLineDash([]);
        }
    }

    _drawDXF(ctx, parsedDxf, offsetX, offsetY, fillColor, strokeColor, lineWidth) {
        if (!parsedDxf || !parsedDxf.entities) return;

        // 1. Fill entire outer board geometry with ONE uniform color (prevents double-overlapping colors & transparent gaps)
        if (fillColor && parsedDxf.bounds) {
            const b = parsedDxf.bounds;
            const p1 = this.worldToCanvas(b.minX + offsetX, b.minY + offsetY);
            const p2 = this.worldToCanvas(b.maxX + offsetX, b.minY + offsetY);
            const p3 = this.worldToCanvas(b.maxX + offsetX, b.maxY + offsetY);
            const p4 = this.worldToCanvas(b.minX + offsetX, b.maxY + offsetY);

            ctx.fillStyle = fillColor;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.lineTo(p4.x, p4.y);
            ctx.closePath();
            ctx.fill();
        }

        // 2. Stroke all CAD lines, polylines, and notch outlines cleanly
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;

        parsedDxf.entities.forEach(e => {
            if (e.type === 'LINE') {
                const p1 = this.worldToCanvas(e.x1 + offsetX, e.y1 + offsetY);
                const p2 = this.worldToCanvas(e.x2 + offsetX, e.y2 + offsetY);
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            } else if (e.type === 'LWPOLYLINE' && e.points.length > 0) {
                ctx.beginPath();
                e.points.forEach((p, idx) => {
                    const cp = this.worldToCanvas(p.x + offsetX, p.y + offsetY);
                    if (idx === 0) ctx.moveTo(cp.x, cp.y);
                    else ctx.lineTo(cp.x, cp.y);
                });
                if (e.isClosed) ctx.closePath();
                ctx.stroke();
            } else if (e.type === 'CIRCLE' && e.radius > 6) {
                const cp = this.worldToCanvas(e.x + offsetX, e.y + offsetY);
                ctx.beginPath();
                ctx.arc(cp.x, cp.y, e.radius * this.scale, 0, Math.PI * 2);
                ctx.stroke();
            } else if (e.type === 'ARC') {
                const cp = this.worldToCanvas(e.x + offsetX, e.y + offsetY);
                const startRad = -e.startAngle * Math.PI / 180;
                const endRad = -e.endAngle * Math.PI / 180;
                ctx.beginPath();
                ctx.arc(cp.x, cp.y, e.radius * this.scale, startRad, endRad, true);
                ctx.stroke();
            }
        });
    }

    _drawHoles(ctx, holes, offsetX, offsetY, color) {
        if (!holes) return;
        ctx.fillStyle = color;
        holes.forEach(h => {
            const cp = this.worldToCanvas(h.x + offsetX, h.y + offsetY);
            ctx.beginPath();
            ctx.arc(cp.x, cp.y, Math.max(2, h.radius * this.scale), 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

/**
 * Application Entry Point - Schreiner Wandregal Konfigurator
 * Connects UI elements, DXF file loading from cad_files/2d/, 3D views, Floating Action Bar, Measurement Tool, and Export functions.
 */
document.addEventListener('DOMContentLoaded', () => {
    const configurator = new Configurator2D('configurator-canvas');
    let threeView = null;
    try {
        if (typeof ThreeView !== 'undefined') {
            threeView = new ThreeView('three-canvas-container');
        }
    } catch (e) {
        console.warn('3D View initialization warning:', e);
    }

    let currentViewMode = '2d';
    let basisRawText = DEFAULT_DXF_BASIS;

    // Connect BOM Update Callback (Only Shelves)
    configurator.onBOMUpdate = (bom) => {
        const bomTableBody = document.getElementById('bom-table-body');
        if (!bomTableBody) return;

        let rowsHTML = `
            <tr>
                <td><strong>Gesamt Tablare</strong></td>
                <td class="bom-highlight">${bom.totalShelves} Stk.</td>
            </tr>
        `;

        Object.keys(bom.shelfCounts).forEach(name => {
            rowsHTML += `
                <tr>
                    <td>${name}</td>
                    <td>${bom.shelfCounts[name]} Stk.</td>
                </tr>
            `;
        });

        bomTableBody.innerHTML = rowsHTML;
    };

    // Load Default CAD Data from cad_files/2d/
    function initializeCadData() {
        try {
            const parsedBasis = DXFParser.parse(basisRawText, { rotate180: true });
            configurator.setBasisData(parsedBasis);
        } catch (e) { console.error('Error parsing basis DXF:', e); }

        try {
            const parsedTv = DXFParser.parse(DEFAULT_DXF_TV);
            configurator.setTvData(parsedTv);
        } catch (e) { console.error('Error parsing TV DXF:', e); }

        try {
            const parsed1200 = DXFParser.parse(DEFAULT_DXF_TABLAR_1200);
            configurator.registerTemplate('tablar_300x1200', 'Tablar 300x1200 mm', parsed1200);

            const parsed350x1200 = DXFParser.parse(DEFAULT_DXF_TABLAR_350X1200);
            configurator.registerTemplate('tablar_350x1200', 'Tablar 350x1200 mm', parsed350x1200);

            const parsed1900 = DXFParser.parse(DEFAULT_DXF_TABLAR_1900);
            configurator.registerTemplate('tablar_300x1900', 'Tablar 300x1900 mm', parsed1900);

            // Spezial Tablar: 90°-Steg liegt in der Mitte von Feld 2 (zwischen Pfosten 2 und Pfosten 3)
            function getZTablarSpezialData() {
                const STEP_H = 400; // 5 Rasterstufen = 400mm Versatz
                // Pfosten 1: X=17.5, Pfosten 2: X=717.5, Pfosten 3: X=1417.5
                // Steg-Mitte in Feld 2 (zwischen 717.5 und 1417.5) = X=1067.5
                const R_X1 = 1041.5;
                const R_X2 = 1067.5;

                return {
                    entities: [
                        // 1. Unteres Tablar links (von Pfosten 1 über Pfosten 2 bis Mitte Feld 2, X = -232.5..1067.5, Y = -13..+13)
                        {
                            type: 'LWPOLYLINE',
                            isClosed: true,
                            points: [
                                { x: -232.5, y: 13 },
                                { x: R_X2, y: 13 },
                                { x: R_X2, y: -13 },
                                { x: -232.5, y: -13 }
                            ]
                        },
                        // 2. Senkrechter 90°-Steg in der Mitte von Feld 2 (X = 1041.5..1067.5, Y = 13..387)
                        {
                            type: 'LWPOLYLINE',
                            isClosed: true,
                            points: [
                                { x: R_X1, y: 13 },
                                { x: R_X2, y: 13 },
                                { x: R_X2, y: 387 },
                                { x: R_X1, y: 387 }
                            ]
                        },
                        // 3. Oberes Tablar rechts (ab Steg in Feld 2 über Pfosten 3 bis Ende, X = 1041.5..1667.5, Y = 387..413)
                        {
                            type: 'LWPOLYLINE',
                            isClosed: true,
                            points: [
                                { x: R_X1, y: 413 },
                                { x: 1667.5, y: 413 },
                                { x: 1667.5, y: 387 },
                                { x: R_X1, y: 387 }
                            ]
                        },
                        // Details für Pfosten 1 (X = 0..35)
                        { type: 'LINE', x1: 0, y1: 13, x2: 0, y2: -13 },
                        { type: 'LINE', x1: 35, y1: 13, x2: 35, y2: -13 },
                        // Details für Pfosten 2 (X = 700..735)
                        { type: 'LINE', x1: 700, y1: 13, x2: 700, y2: -13 },
                        { type: 'LINE', x1: 735, y1: 13, x2: 735, y2: -13 },
                        // Details für Pfosten 3 auf oberer Ebene (X = 1400..1435)
                        { type: 'LINE', x1: 1400, y1: 413, x2: 1400, y2: 387 },
                        { type: 'LINE', x1: 1435, y1: 413, x2: 1435, y2: 387 },
                        // 3 Bohrlöcher: Pfosten 1 (Y=0), Pfosten 2 (Y=0), Pfosten 3 (Y=400 auf oberer Ebene)
                        { type: 'CIRCLE', x: 17.5, y: 0, radius: 5 },
                        { type: 'CIRCLE', x: 717.5, y: 0, radius: 5 },
                        { type: 'CIRCLE', x: 1417.5, y: STEP_H, radius: 5 }
                    ],
                    holes: [
                        { x: 17.5, y: 0, radius: 5 },
                        { x: 717.5, y: 0, radius: 5 },
                        { x: 1417.5, y: STEP_H, radius: 5 }
                    ],
                    bounds: {
                        minX: -232.5,
                        maxX: 1667.5,
                        minY: -13,
                        maxY: 413,
                        width: 1900,
                        height: 426
                    }
                };
            }

            configurator.registerTemplate('tablar_300x1900_spezial', 'Tablar 300x1900 mm Spezial (90° Stufe in Feld 2)', getZTablarSpezialData());

            const parsed2600 = DXFParser.parse(DEFAULT_DXF_TABLAR_2600);
            configurator.registerTemplate('tablar_300x2600', 'Tablar 300x2600 mm', parsed2600);
        } catch (e) { console.error('Error registering tablar DXFs:', e); }

        // Fetch external SVG / DXF files from cad_files/2d/
        // Fetch external 2D CAD basis files (DXF primary for exact 180° orientation)
        fetch('cad_files/2d/regal_basis.dxf').then(r => r.text()).then(txt => {
            configurator.setBasisData(DXFParser.parse(txt, { rotate180: true }));
        }).catch(() => {
            fetch('cad_files/2d/regal_basis.svg').then(r => r.text()).then(txt => {
                const svgParsed = SVGParser.parse(txt, 3535);
                if (svgParsed) configurator.setBasisData(svgParsed);
            }).catch(() => {});
        });

        fetch('cad_files/2d/tv.dxf').then(r => r.text()).then(txt => {
            configurator.setTvData(DXFParser.parse(txt));
        }).catch(() => {});

        fetch('cad_files/2d/tablar_300x1200.svg').then(r => r.text()).then(txt => {
            const svgParsed = SVGParser.parse(txt, 1200);
            if (svgParsed) configurator.registerTemplate('tablar_300x1200', 'Tablar 300x1200 mm', svgParsed);
        }).catch(() => {});

        fetch('cad_files/2d/tablar_350x1200.svg').then(r => r.text()).then(txt => {
            const svgParsed = SVGParser.parse(txt, 1200);
            if (svgParsed) configurator.registerTemplate('tablar_350x1200', 'Tablar 350x1200 mm', svgParsed);
        }).catch(() => {});

        fetch('cad_files/2d/tablar_300x1900.svg').then(r => r.text()).then(txt => {
            const svgParsed = SVGParser.parse(txt, 1900);
            if (svgParsed) configurator.registerTemplate('tablar_300x1900', 'Tablar 300x1900 mm', svgParsed);
        }).catch(() => {});

        fetch('cad_files/2d/tablar_300x2600.svg').then(r => r.text()).then(txt => {
            const svgParsed = SVGParser.parse(txt, 2600);
            if (svgParsed) configurator.registerTemplate('tablar_300x2600', 'Tablar 300x2600 mm', svgParsed);
        }).catch(() => {});

        // Add initial demo shelf
        configurator.addShelf('tablar_300x1200');
    }

    initializeCadData();

    // Floating Shelf Action Bar Buttons
    document.getElementById('btn-action-delete')?.addEventListener('click', () => {
        configurator.deleteSelectedShelf();
    });

    document.getElementById('btn-action-duplicate')?.addEventListener('click', () => {
        configurator.duplicateSelectedShelf();
    });

    document.getElementById('btn-action-flip-h')?.addEventListener('click', () => {
        configurator.flipSelectedShelfH();
    });

    document.getElementById('btn-action-flip-v')?.addEventListener('click', () => {
        configurator.flipSelectedShelfV();
    });

    document.getElementById('btn-action-up')?.addEventListener('click', () => {
        configurator.moveSelectedShelf(80);
    });

    document.getElementById('btn-action-down')?.addEventListener('click', () => {
        configurator.moveSelectedShelf(-80);
    });

    // Measurement Tool Button
    const btnMeasure = document.getElementById('btn-measure');
    btnMeasure?.addEventListener('click', () => {
        const isMeasuring = configurator.toggleMeasurementMode();
        if (isMeasuring) {
            btnMeasure.classList.add('active');
            btnMeasure.innerHTML = '📐 Mess-Modus (Aktiv)';
        } else {
            btnMeasure.classList.remove('active');
            btnMeasure.innerHTML = '📏 Abstände Messen';
        }
    });

    document.getElementById('btn-clear-measurements')?.addEventListener('click', () => {
        configurator.clearMeasurements();
    });

    // UI Buttons Handlers
    document.getElementById('btn-add-1200')?.addEventListener('click', () => {
        configurator.addShelf('tablar_300x1200');
    });

    document.getElementById('btn-add-350x1200')?.addEventListener('click', () => {
        configurator.addShelf('tablar_350x1200');
    });

    document.getElementById('btn-add-1900')?.addEventListener('click', () => {
        configurator.addShelf('tablar_300x1900');
    });

    document.getElementById('btn-add-1900-spezial')?.addEventListener('click', () => {
        configurator.addShelf('tablar_300x1900_spezial');
    });

    document.getElementById('btn-add-2600')?.addEventListener('click', () => {
        configurator.addShelf('tablar_300x2600');
    });

    document.getElementById('btn-delete-selected')?.addEventListener('click', () => {
        configurator.deleteSelectedShelf();
    });

    document.getElementById('btn-clear-all')?.addEventListener('click', () => {
        if (confirm('Möchtest du wirklich alle Tablare löschen?')) {
            configurator.clearAllShelves();
        }
    });

    // Toggle 2D / 3D View
    const btnToggle3d = document.getElementById('btn-toggle-3d');
    const threeContainer = document.getElementById('three-canvas-container');

    const controlsLegend = document.getElementById('controls-legend');

    btnToggle3d?.addEventListener('click', () => {
        if (currentViewMode === '2d') {
            currentViewMode = '3d';
            threeContainer.style.display = 'block';
            btnToggle3d.classList.add('active');
            btnToggle3d.textContent = '2D Plan-Ansicht';
            configurator.set3DModeActive(true);
            configurator.hideActionBar();

            if (controlsLegend) {
                controlsLegend.innerHTML = `
                    <div class="hint-item">
                        <span class="hint-badge">🔄 3D Drehen</span>
                        <span>Linksklick &amp; ziehen</span>
                    </div>
                    <div class="hint-item">
                        <span class="hint-badge">🖐️ Kamera Verschieben (Pan)</span>
                        <span>Rechtsklick &amp; ziehen</span>
                    </div>
                    <div class="hint-item">
                        <span class="hint-badge">🔍 Zoom</span>
                        <span>Mausrad</span>
                    </div>
                `;
            }

            threeView.updateScene(configurator);
        } else {
            currentViewMode = '2d';
            threeContainer.style.display = 'none';
            btnToggle3d.classList.remove('active');
            btnToggle3d.textContent = '3D Visualisierung';
            configurator.set3DModeActive(false);
            configurator.onStateChanged();

            if (controlsLegend) {
                controlsLegend.innerHTML = `
                    <div class="hint-item">
                        <span class="hint-badge">🖐️ Plan Verschieben (Pan)</span>
                        <span>Linksklick auf freie Fläche &amp; ziehen</span>
                    </div>
                    <div class="hint-item">
                        <span class="hint-badge">📦 Tablar / TV Bewegen</span>
                        <span>Anklicken &amp; ziehen (Lochraster Snap)</span>
                    </div>
                    <div class="hint-item">
                        <span class="hint-badge">🔍 Zoom</span>
                        <span>Mausrad</span>
                    </div>
                `;
            }

            configurator.render();
        }
    });

    // Export & Save Configuration
    document.getElementById('btn-export-json')?.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(configurator.placedShelves, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `wandregal_konfiguration_${Date.now()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            configurator.deleteSelectedShelf();
        } else if (e.key === 'Escape') {
            if (configurator.isMeasuringMode) {
                configurator.toggleMeasurementMode(false);
                if (btnMeasure) {
                    btnMeasure.classList.remove('active');
                    btnMeasure.innerHTML = '📏 Abstände Messen';
                }
            }
        }
    });
});

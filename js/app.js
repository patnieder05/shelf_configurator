/**
 * Application Entry Point - Schreiner Wandregal Konfigurator
 * Connects UI elements, DXF file loading from cad_files/2d/, 3D views, Floating Action Bar, Measurement Tool, and Export functions.
 */
document.addEventListener('DOMContentLoaded', () => {
    const configurator = new Configurator2D('configurator-canvas');
    const threeView = new ThreeView('three-canvas-container');

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

            const parsed2600 = DXFParser.parse(DEFAULT_DXF_TABLAR_2600);
            configurator.registerTemplate('tablar_300x2600', 'Tablar 300x2600 mm', parsed2600);
        } catch (e) { console.error('Error registering tablar DXFs:', e); }

        // Fetch external files from cad_files/2d/ if available
        fetch('cad_files/2d/regal_basis.dxf').then(r => r.text()).then(txt => {
            basisRawText = txt;
            configurator.setBasisData(DXFParser.parse(txt, { rotate180: true }));
        }).catch(() => {});

        fetch('cad_files/2d/tv.dxf').then(r => r.text()).then(txt => {
            configurator.setTvData(DXFParser.parse(txt));
        }).catch(() => {});

        fetch('cad_files/2d/tablar_300x1200.dxf').then(r => r.text()).then(txt => {
            configurator.registerTemplate('tablar_300x1200', 'Tablar 300x1200 mm', DXFParser.parse(txt));
        }).catch(() => {});

        fetch('cad_files/2d/tablar_350x1200.dxf').then(r => r.text()).then(txt => {
            configurator.registerTemplate('tablar_350x1200', 'Tablar 350x1200 mm', DXFParser.parse(txt));
        }).catch(() => {});

        fetch('cad_files/2d/tablar_300x1900.dxf').then(r => r.text()).then(txt => {
            configurator.registerTemplate('tablar_300x1900', 'Tablar 300x1900 mm', DXFParser.parse(txt));
        }).catch(() => {});

        fetch('cad_files/2d/tablar_300x2600.dxf').then(r => r.text()).then(txt => {
            configurator.registerTemplate('tablar_300x2600', 'Tablar 300x2600 mm', DXFParser.parse(txt));
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

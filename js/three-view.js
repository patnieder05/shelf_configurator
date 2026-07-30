/**
 * ThreeView - 3D WebGL Visualizer for Wall Shelf System using GLTF/GLB CAD Models
 * Clean White Wall Studio Theme with Hardwood Oak Parquet Floor (Eichen-Parkett).
 * Materials: Posts = Dark Walnut (Nussbaum), Shelves = Natural Oak (Eichenholz), Floor = Polished Parquet.
 * Wall stands EXACTLY on the parquet floor at Y = 0 (Y from 0 to 2800mm).
 * Parquet floor starts EXACTLY at the wall (Z = backZ).
 */
class ThreeView {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.isInitialized = false;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.objectGroup = null;
        this.glbCache = {};
        this.statusBadgeEl = null;
        this.parquetTexture = null;
        this.floorMesh = null;
    }

    /* ------------------------------------------------------------------ */
    /* Init                                                                 */
    /* ------------------------------------------------------------------ */
    _init() {
        if (this.isInitialized) return;
        if (typeof THREE === 'undefined') { console.error('Three.js not loaded'); return; }

        const W = this.container.clientWidth || window.innerWidth;
        const H = this.container.clientHeight || window.innerHeight;

        /* Scene: Clean White Wall Studio Theme */
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf8fafc);
        this.scene.fog = new THREE.Fog(0xf8fafc, 6000, 20000);

        /* Camera – looking at white wall & parquet floor from the front */
        this.camera = new THREE.PerspectiveCamera(40, W / H, 1, 25000);
        this.camera.position.set(1767.5, 1150, 4200);

        /* Renderer */
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(W, H);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        /* Create Status Badge Overlay */
        this._createStatusBadge();

        /* Orbit controls */
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.target.set(1767.5, 1150, 0);
            this.controls.minDistance = 200;
            this.controls.maxDistance = 18000;
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.update();
        }

        /* Lighting for White Wall Studio */
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));

        /* Key light (warm studio light, soft shadows on wall & floor) */
        const key = new THREE.DirectionalLight(0xfff8ee, 0.85);
        key.position.set(2500, 3500, 3000);
        key.castShadow = true;
        key.shadow.mapSize.set(2048, 2048);
        key.shadow.camera.left   = -4000;
        key.shadow.camera.right  =  4000;
        key.shadow.camera.top    =  3000;
        key.shadow.camera.bottom = -1000;
        key.shadow.camera.near   =  100;
        key.shadow.camera.far    =  10000;
        key.shadow.bias = -0.0005;
        this.scene.add(key);

        /* Soft Fill light */
        const fill = new THREE.DirectionalLight(0xe2e8f0, 0.5);
        fill.position.set(-1500, 1500, 2000);
        this.scene.add(fill);

        /* Generate Hardwood Oak Parquet Texture */
        this.parquetTexture = this._createParquetTexture();

        /* Create Polished Oak Parquet Floor */
        const parquetMat = new THREE.MeshStandardMaterial({
            map: this.parquetTexture,
            roughness: 0.32,
            metalness: 0.05
        });

        // Floor depth = 3000mm, initially centered at Z = 1500 (will update to match wall Z in _buildScene)
        const floorGeo = new THREE.BoxGeometry(6000, 20, 3000);
        this.floorMesh = new THREE.Mesh(floorGeo, parquetMat);
        this.floorMesh.position.set(1767.5, -10, 1500);
        this.floorMesh.receiveShadow = true;
        this.scene.add(this.floorMesh);

        /* Group for everything we'll rebuild on each updateScene() */
        this.objectGroup = new THREE.Group();
        this.scene.add(this.objectGroup);

        this.isInitialized = true;

        /* Preload GLTF Models */
        this._preloadGLTF();

        window.addEventListener('resize', () => this._onResize());
        this._animate();
    }

    _createParquetTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Base oak parquet background
        ctx.fillStyle = '#b88344';
        ctx.fillRect(0, 0, 512, 512);

        // Draw Schiffsboden Eichenparkett Planks
        const plankW = 128;
        const plankH = 32;

        const oakShades = ['#c8965a', '#b88344', '#d4a373', '#ad783b', '#c28e52'];

        for (let y = 0; y < 512; y += plankH) {
            const rowShift = ((y / plankH) % 2 === 0) ? 0 : 64;
            for (let x = -64; x < 512 + 64; x += plankW) {
                const px = x + rowShift;

                // Pick random oak plank shade
                const shadeIdx = Math.abs(Math.sin(px * 12.9898 + y * 78.233) * 43758.5453) % oakShades.length;
                const shade = oakShades[Math.floor(shadeIdx)];
                ctx.fillStyle = shade;
                ctx.fillRect(px, y, plankW - 2, plankH - 2);

                // Subtle wood grain lines
                ctx.strokeStyle = 'rgba(70, 40, 15, 0.12)';
                ctx.lineWidth = 1;
                for (let g = 4; g < plankH - 2; g += 7) {
                    ctx.beginPath();
                    ctx.moveTo(px + 2, y + g);
                    ctx.lineTo(px + plankW - 4, y + g);
                    ctx.stroke();
                }
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(10, 6);
        return texture;
    }

    _createStatusBadge() {
        if (this.statusBadgeEl) return;
        this.statusBadgeEl = document.createElement('div');
        this.statusBadgeEl.style.cssText = `
            position: absolute;
            top: 16px;
            right: 16px;
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid #cbd5e0;
            border-radius: 6px;
            padding: 8px 14px;
            font-size: 0.8rem;
            color: #1e293b;
            z-index: 10;
            pointer-events: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        this.statusBadgeEl.innerHTML = `<span>🔄 Lade CAD 3D GLTF-Modelle...</span>`;
        this.container.appendChild(this.statusBadgeEl);
    }

    _preloadGLTF() {
        if (typeof THREE.GLTFLoader === 'undefined') return;
        const loader = new THREE.GLTFLoader();

        const gltfModels = [
            { id: 'regal', path: 'cad_files/3d/regal.glb' },
            { id: 'tablar_300x1200', path: 'cad_files/3d/tablar_1200x300.glb' },
            { id: 'tablar_350x1200', path: 'cad_files/3d/tablar_1200x350.glb' },
            { id: 'tablar_300x1900', path: 'cad_files/3d/tablar_1900x300.glb' },
            { id: 'tablar_300x2600', path: 'cad_files/3d/tablar_2600x300.glb' }
        ];

        let loadedCount = 0;

        gltfModels.forEach(item => {
            loader.load(item.path, (gltf) => {
                const model = gltf.scene;

                // Enable shadows & double-sided rendering for all CAD meshes
                model.traverse(node => {
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                        if (node.material) {
                            node.material.side = THREE.DoubleSide;
                        }
                    }
                });

                // Compute bounding box
                let box = new THREE.Box3().setFromObject(model);
                let size = new THREE.Vector3();
                box.getSize(size);

                // Auto-detect unit scaling (Meters vs Millimeters)
                const maxDim = Math.max(size.x, size.y, size.z);
                if (maxDim > 0 && maxDim < 10) {
                    model.scale.set(1000, 1000, 1000);
                    model.updateMatrixWorld(true);
                    box.setFromObject(model);
                    box.getSize(size);
                }

                const center = new THREE.Vector3();
                box.getCenter(center);

                this.glbCache[item.id] = {
                    scene: model,
                    size,
                    center,
                    box
                };

                loadedCount++;
                if (this.statusBadgeEl) {
                    this.statusBadgeEl.innerHTML = `<span style="color:#16a34a; font-weight:600;">🟢 CAD 3D GLTF geladen: ${item.id} (${loadedCount}/${gltfModels.length})</span>`;
                }

                if (this.currentConfigurator) {
                    this._buildScene(this.currentConfigurator);
                }
            }, undefined, (err) => {
                console.warn(`GLTF model ${item.path} not loaded:`, err);
            });
        });
    }

    _onResize() {
        if (!this.isInitialized) return;
        const W = this.container.clientWidth;
        const H = this.container.clientHeight;
        if (W === 0 || H === 0) return;
        this.camera.aspect = W / H;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(W, H);
    }

    _animate() {
        requestAnimationFrame(() => this._animate());
        if (this.controls) this.controls.update();
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    /* ------------------------------------------------------------------ */
    /* Update scene from configurator state                                 */
    /* ------------------------------------------------------------------ */
    updateScene(configurator) {
        this.currentConfigurator = configurator;
        if (!this.isInitialized) {
            requestAnimationFrame(() => {
                this._init();
                if (this.isInitialized) {
                    this._onResize();
                    this._buildScene(configurator);
                }
            });
        } else {
            this._onResize();
            this._buildScene(configurator);
        }
    }

    /* ------------------------------------------------------------------ */
    /* Build all 3D objects                                                 */
    /* ------------------------------------------------------------------ */
    _buildScene(configurator) {
        /* Clear previous objects */
        while (this.objectGroup.children.length > 0) {
            const obj = this.objectGroup.children[0];
            if (obj.geometry) obj.geometry.dispose();
            this.objectGroup.remove(obj);
        }

        /* ---- Schreiner Wood Materials ---- */
        // Pfosten: Nussbaum (Dark Walnut Wood)
        const matNussbaum = new THREE.MeshStandardMaterial({ 
            color: 0x4a2e1b, 
            roughness: 0.38, 
            metalness: 0.05, 
            side: THREE.DoubleSide 
        });

        // Tablare: Eichenholz (Natural Golden Oak Wood)
        const matEiche = new THREE.MeshStandardMaterial({ 
            color: 0xd4a373, 
            roughness: 0.45, 
            metalness: 0.02, 
            side: THREE.DoubleSide 
        });

        const matAlum  = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.15, metalness: 0.9 });
        const matTV    = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });
        const matWall  = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.FrontSide });

        /* Find back surface Z coordinate of regal.glb to place white wall & parquet floor start */
        let backZ = 0;
        if (this.glbCache['regal']) {
            backZ = this.glbCache['regal'].box.min.z;
        }

        /* Update Parquet Floor position so its back edge touches the wall EXACTLY at Z = backZ */
        if (this.floorMesh) {
            // Floor depth = 3000mm, back edge at backZ -> center Z = backZ + 1500mm
            this.floorMesh.position.set(1767.5, -10, backZ + 1500);
        }

        /* ---- 1. Pure White Wall (Stands EXACTLY on the parquet floor at Y = 0; Y from 0 to 2800mm) ---- */
        const wallGeo = new THREE.BoxGeometry(4000, 2800, 20);
        const wallMesh = new THREE.Mesh(wallGeo, matWall);
        // Wall bottom at Y = 0 (center Y = 1400), wall front at Z = backZ - 0.5mm (center Z = backZ - 10.5)
        wallMesh.position.set(1767.5, 1400, backZ - 10.5);
        wallMesh.receiveShadow = true;
        this.objectGroup.add(wallMesh);

        /* ---- 2. Regal Gestell / Pfosten: NUSSBAUM (Walnut Wood) ---- */
        if (this.glbCache['regal']) {
            const regalData = this.glbCache['regal'];
            const regalModel = regalData.scene.clone(true);
            
            // Apply Nussbaum (Walnut) material to GLTF meshes
            regalModel.traverse(node => {
                if (node.isMesh) {
                    node.material = matNussbaum;
                }
            });

            regalModel.position.set(0, 0, 0);
            this.objectGroup.add(regalModel);
        } else {
            // Fallback: 6 Posts in Nussbaum (Walnut)
            const postXCenters = [17.5, 717.5, 1417.5, 2117.5, 2817.5, 3517.5];
            const postW = 35, postH = 2300, postD = 40;
            const postCenterY = 1150;
            const postCenterZ = 20;

            postXCenters.forEach(cx => {
                const geo = new THREE.BoxGeometry(postW, postH, postD);
                const mesh = new THREE.Mesh(geo, matNussbaum);
                mesh.position.set(cx, postCenterY, postCenterZ);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                this.objectGroup.add(mesh);
            });
        }

        /* ---- 3. TV (Positioned with 2D Drag Offset & Z = 65mm) ---- */
        if (configurator.tvData && configurator.tvData.bounds) {
            const b = configurator.tvData.bounds;
            const tvX = configurator.tvData.x || 0;
            const tvY = configurator.tvData.y || 0;

            const cx = tvX + (b.minX + b.maxX) / 2;
            const cy = tvY + (b.minY + b.maxY) / 2;

            const tvGeo = new THREE.BoxGeometry(b.width, b.height, 50);
            const tvMesh = new THREE.Mesh(tvGeo, matTV);
            tvMesh.position.set(cx, cy, 65);
            tvMesh.castShadow = true;
            this.objectGroup.add(tvMesh);
        }

        /* ---- 4. Placed Shelves: EICHENHOLZ (Oak Wood) ---- */
        configurator.placedShelves.forEach(shelf => {
            const templateId = shelf.templateId;
            const glbData = this.glbCache[templateId];

            if (glbData) {
                /* Render actual loaded CAD GLB 3D Model with Eichenholz (Oak) material */
                const shelfModel = glbData.scene.clone(true);
                
                shelfModel.traverse(node => {
                    if (node.isMesh) {
                        node.material = matEiche;
                    }
                });

                // Target World Hole 1 position
                const hole1 = (shelf.dxf && shelf.dxf.holes && shelf.dxf.holes[0]) ? shelf.dxf.holes[0] : { x: 17.5, y: 1100 };
                const targetHoleX = shelf.x + hole1.x;
                const targetHoleY = shelf.y + hole1.y;

                // Hole 1 in local GLB model space (located 250mm from glb min.x, and centered vertically in Y)
                const glbHoleX = glbData.box.min.x + 250.0;
                const glbHoleY = glbData.box.min.y + (glbData.box.max.y - glbData.box.min.y) / 2;

                const posX = targetHoleX - glbHoleX;
                const posY = targetHoleY - glbHoleY;

                shelfModel.position.set(posX, posY, 0);
                this.objectGroup.add(shelfModel);
            } else {
                /* Fallback: Extruded solid board geometry in Eichenholz */
                const b = shelf.bounds;
                const depth = (templateId === 'tablar_350x1200' || templateId.includes('350x')) ? 350 : 300;
                const centerZ = depth / 2;
                const boardW = b.maxX - b.minX;
                const boardH = b.maxY - b.minY;
                const boardCX = shelf.x + (b.minX + b.maxX) / 2;
                const boardCY = shelf.y + (b.minY + b.maxY) / 2;

                const shelfGeo = new THREE.BoxGeometry(boardW, boardH, depth);
                const shelfMesh = new THREE.Mesh(shelfGeo, matEiche);
                shelfMesh.position.set(boardCX, boardCY, centerZ);
                shelfMesh.castShadow = true;
                shelfMesh.receiveShadow = true;
                this.objectGroup.add(shelfMesh);
            }

            /* Alu pins through post holes (Z = 20mm) */
            if (shelf.dxf && shelf.dxf.holes) {
                shelf.dxf.holes.forEach(hole => {
                    const hx = shelf.x + hole.x;
                    const hy = shelf.y + hole.y;
                    const pinLen = 80;

                    const pinGeo = new THREE.CylinderGeometry(5, 5, pinLen, 16);
                    const pinMesh = new THREE.Mesh(pinGeo, matAlum);
                    pinMesh.rotation.x = Math.PI / 2;
                    pinMesh.position.set(hx, hy, 20);
                    pinMesh.castShadow = true;
                    this.objectGroup.add(pinMesh);
                });
            }
        });

        /* Recentre camera target */
        if (this.controls) {
            this.controls.target.set(1767.5, 1150, 0);
            this.controls.update();
        }
    }
}

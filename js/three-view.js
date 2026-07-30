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
            { id: 'tablar_300x1900_spezial', path: 'cad_files/3d/tablar_1900x300_spezial.glb' },
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

        /* ---- Schreiner Wood & Metal Materials ---- */
        // Pfosten: Nussbaum (Dark Walnut Wood)
        const matNussbaum = new THREE.MeshStandardMaterial({ 
            color: 0x3b2314, 
            roughness: 0.35, 
            metalness: 0.05 
        });

        // Tablare: Eichenholz (Natural Golden Oak Wood)
        const matEiche = new THREE.MeshStandardMaterial({ 
            color: 0xd4a373, 
            roughness: 0.42, 
            metalness: 0.02 
        });

        const matAlum = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.15, metalness: 0.9 });
        const matTV   = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.18, metalness: 0.3 });
        const matWall = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.95 });

        const matRedWarning = new THREE.MeshStandardMaterial({
            color: 0xef4444,
            roughness: 0.4,
            transparent: true,
            opacity: 0.82
        });

        /* ---- 1. Pure White Studio Wall (Stands on parquet floor at Y = 0; Z = 0) ---- */
        const wallGeo = new THREE.BoxGeometry(4500, 2800, 20);
        const wallMesh = new THREE.Mesh(wallGeo, matWall);
        wallMesh.position.set(1767.5, 1400, -10);
        wallMesh.receiveShadow = true;
        this.objectGroup.add(wallMesh);

        /* ---- 2. Regal Gestell: 6 Wandpfosten mit Boden-Abfalzung (Sockelleisten-Ausklinkung) ---- */
        if (this.glbCache['regal']) {
            const regalData = this.glbCache['regal'];
            const regalModel = regalData.scene.clone(true);
            
            // Apply Nussbaum (Walnut) material to GLTF meshes
            regalModel.traverse(node => {
                if (node.isMesh) {
                    node.material = matNussbaum;
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });

            // Align GLB box to Y=0 (floor) and Z=0 (wall)
            const box = regalData.box;
            const offsetY = -box.min.y;
            const offsetZ = -box.min.z;
            regalModel.position.set(0, offsetY, offsetZ);
            this.objectGroup.add(regalModel);
        } else {
            const postXCenters = [17.5, 717.5, 1417.5, 2117.5, 2817.5, 3517.5];
            const postW = 35, postH = 2300, postD = 40;
            const notchH = 80; // 80mm Sockelleisten-Abfalzung unten
            const notchD = 20; // 20mm Tiefe Ausklinkung hinten

            postXCenters.forEach(cx => {
                const postGroup = new THREE.Group();

                // Upper Post Body (Y = 80..2300mm, full depth 40mm)
                const upperGeo = new THREE.BoxGeometry(postW, postH - notchH, postD);
                const upperMesh = new THREE.Mesh(upperGeo, matNussbaum);
                upperMesh.position.set(0, notchH + (postH - notchH) / 2, postD / 2);
                upperMesh.castShadow = true;
                upperMesh.receiveShadow = true;
                postGroup.add(upperMesh);

                // Lower Rebate Foot (Y = 0..80mm, reduced depth 20mm at front, creating 20mm rebate at back)
                const footGeo = new THREE.BoxGeometry(postW, notchH, postD - notchD);
                const footMesh = new THREE.Mesh(footGeo, matNussbaum);
                footMesh.position.set(0, notchH / 2, notchD + (postD - notchD) / 2);
                footMesh.castShadow = true;
                footMesh.receiveShadow = true;
                postGroup.add(footMesh);

                postGroup.position.set(cx, 0, 0);
                this.objectGroup.add(postGroup);

                // Add Metallic Hole Pins along each post
                for (let y = 120; y < 2280; y += 80) {
                    const pinGeo = new THREE.CylinderGeometry(4, 4, postD + 4, 16);
                    pinGeo.rotateX(Math.PI / 2);
                    const pinMesh = new THREE.Mesh(pinGeo, matAlum);
                    pinMesh.position.set(cx, y, postD / 2);
                    this.objectGroup.add(pinMesh);
                }
            });
        }

        /* ---- 3. TV (OLED 3D Screen with Position Offset) ---- */
        if (configurator.tvData && configurator.tvData.bounds) {
            const b = configurator.tvData.bounds;
            const tvX = configurator.tvData.x || 0;
            const tvY = configurator.tvData.y || 0;

            const cx = tvX + (b.minX + b.maxX) / 2;
            const cy = tvY + (b.minY + b.maxY) / 2;

            const tvGeo = new THREE.BoxGeometry(b.width, b.height, 45);
            const tvMesh = new THREE.Mesh(tvGeo, matTV);
            tvMesh.position.set(cx, cy, 65);
            tvMesh.castShadow = true;
            this.objectGroup.add(tvMesh);
        }

        /* ---- 4. Placed Shelves (Oak Wood / Red Warning) ---- */
        configurator.placedShelves.forEach(shelf => {
            const templateId = shelf.templateId;
            const isInvalid = shelf.isOffGrid || shelf.isOverlapping;
            const activeMat = isInvalid ? matRedWarning : matEiche;
            const flipX = !!shelf.flipX;
            const flipY = !!shelf.flipY;
            const depth = (templateId === 'tablar_350x1200' || templateId.includes('350x')) ? 350 : 300;
            const centerZ = depth / 2 + 10;

            if (templateId === 'tablar_300x1900_spezial') {
                /* Render 3D 1-Step Z-Stufentablar (Lower left board, 90° Vertical Riser in Span 2, Upper right board) */
                const STEP_H = 400;
                const R_X = 1054.5;
                const spezGroup = new THREE.Group();

                // 1. Lower Left Board (X = -232.5..1067.5, Y = 0)
                const lowerW = 1067.5 - (-232.5); // 1300
                const lowerGeo = new THREE.BoxGeometry(lowerW, 26, depth);
                const lowerMesh = new THREE.Mesh(lowerGeo, activeMat);
                lowerMesh.position.set(-232.5 + lowerW / 2, 0, centerZ);
                lowerMesh.castShadow = true;
                lowerMesh.receiveShadow = true;
                spezGroup.add(lowerMesh);

                // 2. Vertical 90° Riser in middle of Span 2 (X = 1054.5, Y = 13..387)
                const riserGeo = new THREE.BoxGeometry(26, STEP_H - 26, depth);
                const riserMesh = new THREE.Mesh(riserGeo, activeMat);
                riserMesh.position.set(R_X, STEP_H / 2, centerZ);
                riserMesh.castShadow = true;
                riserMesh.receiveShadow = true;
                spezGroup.add(riserMesh);

                // 3. Upper Right Board (X = 1041.5..1667.5, Y = 400)
                const upperW = 1667.5 - 1041.5; // 626
                const upperGeo = new THREE.BoxGeometry(upperW, 26, depth);
                const upperMesh = new THREE.Mesh(upperGeo, activeMat);
                upperMesh.position.set(1041.5 + upperW / 2, STEP_H, centerZ);
                upperMesh.castShadow = true;
                upperMesh.receiveShadow = true;
                spezGroup.add(upperMesh);

                const spezCenterX = (shelf.bounds.minX + shelf.bounds.maxX) / 2;
                const spezCenterY = (shelf.bounds.minY + shelf.bounds.maxY) / 2;

                spezGroup.scale.x = flipX ? -1 : 1;
                spezGroup.scale.y = flipY ? -1 : 1;

                const posX = flipX ? (shelf.x + 2 * spezCenterX) : shelf.x;
                const posY = flipY ? (shelf.y + 2 * spezCenterY) : shelf.y;

                spezGroup.position.set(posX, posY, 0);
                this.objectGroup.add(spezGroup);
            } else {
                /* Render Extruded Oak Board Geometry for Standard Shelves */
                const b = shelf.bounds;
                const boardW = b.maxX - b.minX;
                const boardH = Math.max(26, b.maxY - b.minY);
                const centerX = (b.minX + b.maxX) / 2;
                const centerY = (b.minY + b.maxY) / 2;

                const shelfGroup = new THREE.Group();
                const shelfGeo = new THREE.BoxGeometry(boardW, 26, depth);
                const shelfMesh = new THREE.Mesh(shelfGeo, activeMat);
                shelfMesh.position.set(b.minX + boardW / 2, centerY, centerZ);
                shelfMesh.castShadow = true;
                shelfMesh.receiveShadow = true;
                shelfGroup.add(shelfMesh);

                shelfGroup.scale.x = flipX ? -1 : 1;
                shelfGroup.scale.y = flipY ? -1 : 1;

                const posX = flipX ? (shelf.x + 2 * centerX) : shelf.x;
                const posY = flipY ? (shelf.y + 2 * centerY) : shelf.y;

                shelfGroup.position.set(posX, posY, 0);
                this.objectGroup.add(shelfGroup);
            }
        });

        /* Recentre camera target */
        if (this.controls) {
            this.controls.target.set(1767.5, 1150, 0);
            this.controls.update();
        }
    }
}

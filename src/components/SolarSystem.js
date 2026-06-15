import * as THREE from 'three';
import gsap from 'gsap';
import Sun from './Sun';
import Planet from './Planet';
import { getStarTexture } from '../utils/StarTexture';

export default class SolarSystem {
    constructor(scene, camera) {
        this.scene  = scene;
        this.camera = camera;
        this.group  = new THREE.Group();
        this.scene.add(this.group);

        this.planets  = [];
        this.visible  = false;
        this.group.visible = false;

        // Hover raycasting
        this._raycaster = new THREE.Raycaster();
        this._pointer   = new THREE.Vector2();
        this._hoveredPlanet = null;

        this.init();
        this._addPointerListener();
    }

    init() {
        // ── Sun ──
        this.sun = new Sun(this.group);

        // ── Planets ──
        const planetData = [
            { name: 'Mercury', size: 0.8,  z: -50  },
            { name: 'Venus',   size: 1.5,  z: -100 },
            { name: 'Earth',   size: 1.6,  z: -150 },
            { name: 'Mars',    size: 1.0,  z: -200 },
            { name: 'Jupiter', size: 6.0,  z: -300 },
            { name: 'Saturn',  size: 5.0,  z: -400, ring: true },
            { name: 'Uranus',  size: 3.0,  z: -500 },
            { name: 'Neptune', size: 2.9,  z: -600 },
        ];

        planetData.forEach(p => {
            const planet = new Planet(this.group, p);
            this.planets.push(planet);
        });

        // ── Stars ──
        this.createStars();

        // ── Position so the Sun is behind camera by ~50 units ──
        this.group.position.z = -50;
    }

    // ─── Stars ────────────────────────────────────────────────────────────────
    createStars() {
        const geo   = new THREE.BufferGeometry();
        const count = 6000;
        const pos   = new Float32Array(count * 3);
        const sizes = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            const r     = 900 * Math.cbrt(Math.random());
            const theta = Math.random() * Math.PI * 2;
            const phi   = Math.acos(2 * Math.random() - 1);
            pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
            pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            pos[i * 3 + 2] = r * Math.cos(phi);
            sizes[i] = Math.random() * 2.0;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

        const mat = new THREE.PointsMaterial({
            color:       0xffffff,
            sizeAttenuation: true,
            transparent: true,
            opacity:     0.9,
            map:         getStarTexture(),
            alphaTest:   0.01,
            depthWrite:  false,
            blending:    THREE.AdditiveBlending,
        });

        this.stars = new THREE.Points(geo, mat);
        this.group.add(this.stars);
    }

    // ─── Hover raycaster ──────────────────────────────────────────────────────
    _addPointerListener() {
        window.addEventListener('pointermove', (e) => {
            if (!this.visible) return;
            this._pointer.x =  (e.clientX / window.innerWidth)  * 2 - 1;
            this._pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
            this._checkPlanetHover();
        });
    }

    _checkPlanetHover() {
        this._raycaster.setFromCamera(this._pointer, this.camera);
        const meshes = this.planets.map(p => p.mesh).filter(Boolean);
        const hits   = this._raycaster.intersectObjects(meshes, false);

        if (hits.length > 0) {
            const hitMesh = hits[0].object;
            const planet  = this.planets.find(p => p.mesh === hitMesh);
            if (planet && planet !== this._hoveredPlanet) {
                if (this._hoveredPlanet) this._hoveredPlanet.onHoverOut();
                this._hoveredPlanet = planet;
                planet.onHoverIn();
                document.body.style.cursor = 'pointer';
            }
        } else {
            if (this._hoveredPlanet) {
                this._hoveredPlanet.onHoverOut();
                this._hoveredPlanet = null;
                document.body.style.cursor = 'default';
            }
        }
    }

    // ─── Show / hide ──────────────────────────────────────────────────────────
    show() {
        this.group.visible = true;
        this.visible       = true;
    }

    // ─── Update loop ──────────────────────────────────────────────────────────
    update(time, scroll, maxScroll) {
        if (!this.visible) return;

        this.sun.update(time);
        this.planets.forEach(p => p.update(time, this.camera.position));
        this.stars.rotation.y = time * 0.01;

        // Camera scroll sync (direct — Lenis already smooths)
        const maxDist    = 750;
        const scrollFrac = Math.max(0, Math.min(1, scroll / maxScroll));
        const targetZ    = 10 - scrollFrac * maxDist;
        this.camera.position.z = targetZ;

        // Organic float
        this.camera.position.x = Math.sin(time * 0.3) * 2;
        this.camera.position.y = Math.cos(time * 0.4) * 2;
    }
}

import * as THREE from 'three';
import gsap from 'gsap';
import Sun from './Sun';
import Planet from './Planet';
import { getStarTexture } from '../utils/StarTexture';

export default class SolarSystem {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.planets = [];
        this.visible = false;
        this.group.visible = false;

        this.init();
    }

    init() {
        const isMobile = window.innerWidth <= 768;

        // 1. Sun (Staggered layout handled dynamically on resize)
        this.sun = new Sun(this.group, isMobile);

        // 2. Planets Config (Perfectly aligned coordinates in X, Y, Z to satisfy perfect alignment)
        this.planetData = [
            { name: "Mercury", size: 0.8, x: 0, y: 0, z: -50, type: 'rocky' },
            { name: "Venus", size: 1.5, x: 0, y: 0, z: -100, type: 'atmosphere' },
            { name: "Earth", size: 1.6, x: 0, y: 0, z: -150, type: 'earth' },
            { name: "Mars", size: 1.0, x: 0, y: 0, z: -200, type: 'rocky' },
            { name: "Jupiter", size: 6.0, x: 0, y: 0, z: -300, type: 'gas' },
            { name: "Saturn", size: 5.0, x: 0, y: 0, z: -400, ring: true, type: 'gas' },
            { name: "Uranus", size: 3.2, x: 0, y: 0, z: -500, type: 'gas' },
            { name: "Neptune", size: 3.0, x: 0, y: 0, z: -600, type: 'gas' },
        ];

        this.planetData.forEach(p => {
            const planet = new Planet(this.group, p, isMobile);
            this.planets.push(planet);
        });

        // 3. Stars / Nebula Background
        this.createStars();

        // 4. Position Correction
        this.group.position.z = -50;

        // 5. Initial resize to lay out staggered objects and scale sizes properly
        this.resize();
    }

    createStars() {
        const isMobile = window.innerWidth <= 768;
        
        // Layer 1: Realistic Distant Stars
        const starsGeo = new THREE.BufferGeometry();
        const count = isMobile ? 1500 : 6000;
        const pos = new Float32Array(count * 3);
        const sizes = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            const r = 900 * Math.cbrt(Math.random());
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos(2 * Math.random() - 1);

            pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            pos[i * 3 + 2] = r * Math.cos(phi);

            sizes[i] = Math.random() * 2.0;
        }

        starsGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        starsGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const texture = getStarTexture();

        const starsMat = new THREE.PointsMaterial({
            color: 0xffffff,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.9,
            map: texture,
            alphaTest: 0.01,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.stars = new THREE.Points(starsGeo, starsMat);
        this.group.add(this.stars);

        // Layer 2: Nebula Clouds (Multi-colored rotating cosmic dust for parallax)
        const nebulaColors = [0x4400ff, 0xaa0088, 0x00aa99]; // Indigo, Magenta, Cosmic Teal
        this.nebulae = [];

        nebulaColors.forEach((color, idx) => {
            const nebulaGeo = new THREE.BufferGeometry();
            const nebCount = isMobile ? 6 : 15;
            const nebPos = new Float32Array(nebCount * 3);
            for (let i = 0; i < nebCount * 3; i++) {
                nebPos[i] = (Math.random() - 0.5) * 600;
            }
            nebulaGeo.setAttribute('position', new THREE.BufferAttribute(nebPos, 3));

            const nebulaMat = new THREE.PointsMaterial({
                color: color,
                size: isMobile ? 80 : 150,
                map: texture, // Apply the soft circular texture to remove square blocks in space!
                transparent: true,
                opacity: isMobile ? 0.04 : 0.07, // Smoother opacity for a clean space void look
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const nebula = new THREE.Points(nebulaGeo, nebulaMat);
            nebula.rotation.z = idx * (Math.PI / 3);
            this.group.add(nebula);
            this.nebulae.push(nebula);
        });
    }

    resize() {
        const isMobile = window.innerWidth <= 768;
        const aspect = window.innerWidth / window.innerHeight;
        
        // Spacing scales
        const depthScale = isMobile ? 0.6 : 1.0;
        
        // On very narrow screens (aspect < 0.5), compress staggering more to avoid going off-screen
        const widthScale = isMobile ? (aspect < 0.5 ? 0.25 : 0.35) : 1.0;
        
        // Planet size scale
        const sizeScale = isMobile ? 0.55 : 1.0;

        // Resize the Sun
        if (this.sun) {
            this.sun.resize(isMobile, sizeScale);
        }

        // Resize all planets
        this.planets.forEach(p => {
            p.resize(isMobile, depthScale, widthScale, sizeScale);
        });
    }

    show() {
        this.group.visible = true;
        this.visible = true;
    }

    update(time, scroll, maxScroll) {
        if (!this.visible) return;

        this.sun.update(time);

        this.planets.forEach(p => p.update(time, this.camera.position));

        this.stars.rotation.y = time * 0.01;
        
        if (this.nebulae) {
            this.nebulae.forEach((neb, idx) => {
                neb.rotation.y = time * (0.002 * (idx + 1));
                neb.rotation.x = time * (0.001 * (idx + 1));
            });
        }

        // Camera Logic
        const isMobile = window.innerWidth <= 768;
        const maxDist = isMobile ? 420 : 720;
        const scrollFactor = scroll / maxScroll; // 0 to 1

        let targetZ = 10 - (scrollFactor * maxDist);
        this.camera.position.z += (targetZ - this.camera.position.z) * 0.1;

        // Base camera path starts dead-center (0, 0) to align with centered planets
        let targetX = 0;
        let targetY = 0;

        const depthScale = isMobile ? 0.6 : 1.0;

        // 1. Sun Cockpit Weave: Glides beautifully around the giant Sun (size 8.0)
        const sunAbsoluteZ = -50;
        const distSunZ = Math.abs(this.camera.position.z - sunAbsoluteZ);
        if (distSunZ < 35) {
            const factor = Math.cos((distSunZ / 35) * Math.PI / 2); // 0 at edge, 1 at closest pass
            const weaveX = isMobile ? 8.0 : 13.0; // Fly past offset X for Sun
            const weaveY = isMobile ? 1.0 : 2.0; // Fly past offset Y for Sun
            targetX += weaveX * factor;
            targetY += weaveY * factor;
        }

        // 2. Planets Cockpit Weaves
        this.planets.forEach(p => {
            const planetAbsoluteZ = -50 + p.config.z * depthScale;
            const distZ = Math.abs(this.camera.position.z - planetAbsoluteZ);
            
            // If camera is within 22 units of the planet, smoothly glide to the right to fly past it
            if (distZ < 22) {
                // Smooth interpolation curve (bell shape using cosine)
                const factor = Math.cos((distZ / 22) * Math.PI / 2); // 0 at edge, 1 at closest pass
                
                const weaveX = isMobile ? 2.8 : 5.0; // Fly past offset X
                const weaveY = isMobile ? 0.4 : 0.8; // Fly past offset Y
                
                targetX += weaveX * factor;
                targetY += weaveY * factor;
            }
        });

        // Add subtle floating astronaut drift to the camera
        const driftFactor = isMobile ? 0.2 : 0.6;
        const driftX = Math.sin(time * 0.4) * driftFactor;
        const driftY = Math.cos(time * 0.3) * driftFactor;

        // Apply smooth interpolation for camera X/Y to prevent any jumpy motion
        this.camera.position.x += (targetX + driftX - this.camera.position.x) * 0.1;
        this.camera.position.y += (targetY + driftY - this.camera.position.y) * 0.1;

        // 3. Keep camera locked forward down the scroll lane, resolving any intro parallax tilt
        this.camera.lookAt(0, 0, this.camera.position.z - 50);
    }
}

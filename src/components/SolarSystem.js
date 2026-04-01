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
        // 1. Sun (New Shader Component)
        this.sun = new Sun(this.group);

        // 2. Planets Config
        // Z positions deeper into space
        const planetData = [
            { name: "Mercury", size: 0.8, z: -50, type: 'rocky' },
            { name: "Venus", size: 1.5, z: -100, type: 'atmosphere' },
            { name: "Earth", size: 1.6, z: -150, type: 'earth' },
            { name: "Mars", size: 1.0, z: -200, type: 'rocky' },
            { name: "Jupiter", size: 6.0, z: -300, type: 'gas' },
            { name: "Saturn", size: 5.0, z: -400, ring: true, type: 'gas' },
            { name: "Uranus", size: 3.0, z: -500, type: 'gas' },
            { name: "Neptune", size: 2.9, z: -600, type: 'gas' },
        ];

        planetData.forEach(p => {
            const planet = new Planet(this.group, p);
            this.planets.push(planet);
        });

        // 3. Stars / Nebula Background
        this.createStars();

        // 4. Position Correction for Full Visibility
        // Move the entire system back so the Sun (at 0,0,0 local) is fully visible 
        // from the camera's starting position (z=10).
        this.group.position.z = -50;
    }

    createStars() {
        // Layer 1: Realistic Distant Stars
        const starsGeo = new THREE.BufferGeometry();
        const count = 6000;
        const pos = new Float32Array(count * 3);
        const sizes = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            // Spherical distribution for deep space feel
            const r = 900 * Math.cbrt(Math.random()); // Use cbrt for uniform volume distribution
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos(2 * Math.random() - 1);

            pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            pos[i * 3 + 2] = r * Math.cos(phi);

            // Natural size variation (small pinpoints to slightly larger glows)
            sizes[i] = Math.random() * 2.0;
        }

        starsGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        starsGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        // Use the generated soft texture
        const texture = getStarTexture();

        const starsMat = new THREE.PointsMaterial({
            color: 0xffffff,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.9,
            map: texture,          // Apply the circle texture
            alphaTest: 0.01,       // Fix transparency issues
            depthWrite: false,     // Don't occlude other transparent objects
            blending: THREE.AdditiveBlending
        });

        this.stars = new THREE.Points(starsGeo, starsMat);
        this.group.add(this.stars);

        // Layer 2: Nebula Clouds (Sprites)
        const nebulaGeo = new THREE.BufferGeometry();
        const nebCount = 20;
        const nebPos = new Float32Array(nebCount * 3);
        for (let i = 0; i < nebCount * 3; i++) {
            nebPos[i] = (Math.random() - 0.5) * 500;
        }
        nebulaGeo.setAttribute('position', new THREE.BufferAttribute(nebPos, 3));

        // Since we can't load texture, use soft Point material
        const nebulaMat = new THREE.PointsMaterial({
            color: 0x4400ff,
            size: 50,
            transparent: true,
            opacity: 0.1,
            blending: THREE.AdditiveBlending
        });
        this.nebula = new THREE.Points(nebulaGeo, nebulaMat);
        this.group.add(this.nebula);
    }

    show() {
        this.group.visible = true;
        this.visible = true;
        // Camera position is now handled by smooth transition in main loop or preserved from intro
    }

    update(time, scroll, maxScroll) {
        if (!this.visible) return;

        this.sun.update(time);

        this.planets.forEach(p => p.update(time, this.camera.position));

        this.stars.rotation.y = time * 0.01;
        this.nebula.rotation.y = time * 0.005;

        // Camera Logic
        const maxDist = 750;
        const scrollFactor = scroll / maxScroll; // 0 to 1

        let targetZ = 10 - (scrollFactor * maxDist);

        // Easing / Inertia
        this.camera.position.z += (targetZ - this.camera.position.z) * 0.1;

        // Dynamic Camera X/Y for "Spaceship" feel
        this.camera.position.x = Math.sin(time * 0.3) * 2;
        this.camera.position.y = Math.cos(time * 0.4) * 2;
    }
}

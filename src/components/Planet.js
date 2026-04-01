import * as THREE from 'three';
import { createNoiseTexture } from '../utils/TextureUtils';

const atmosphereVertex = `
varying vec3 vNormal;
varying vec3 vEyeVector;
void main() {
    vNormal = normalize(normalMatrix * normal);
    vEyeVector = normalize(cameraPosition - (modelMatrix * vec4(position, 1.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const atmosphereFragment = `
varying vec3 vNormal;
varying vec3 vEyeVector;
uniform vec3 uColor;
void main() {
    float dotP = dot(vNormal, vEyeVector);
    float intensity = pow(0.5 - dotP, 3.0); 
    gl_FragColor = vec4(uColor, 1.0) * intensity * 1.5;
}
`;

export default class Planet {
    constructor(group, config) {
        this.group = group;
        this.name = config.name;
        this.size = config.size;
        this.zPos = config.z;
        this.hasRing = config.ring;
        this.type = config.type || 'rocky';

        this.planetGroup = new THREE.Group();
        this.planetGroup.position.set(0, 0, this.zPos);
        this.group.add(this.planetGroup);

        this.init();
    }

    init() {
        // Texture Loading
        const loader = new THREE.TextureLoader();
        let texturePath = '';

        switch (this.name) {
            case 'Mercury': texturePath = '/textures/mercury.jpg'; break;
            case 'Venus': texturePath = '/textures/venus.jpg'; break;
            case 'Earth': texturePath = '/textures/earth.jpg'; break;
            case 'Mars': texturePath = '/textures/mars.jpg'; break;
            case 'Jupiter': texturePath = '/textures/jupiter.jpg'; break;
            case 'Saturn': texturePath = '/textures/saturn.jpg'; break;
            case 'Uranus': texturePath = '/textures/uranus.jpg'; break;
            case 'Neptune': texturePath = '/textures/neptune.jpg'; break;
            default: texturePath = '/textures/earth.jpg'; // Fallback
        }

        const texture = loader.load(texturePath);

        const geometry = new THREE.SphereGeometry(this.size, 64, 64);
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 1.0, // Matte finish matching reference
            metalness: 0.0
        });

        if (this.name === 'Earth') {
            // Earth needs some specularity for oceans
            material.bumpMap = texture;
            material.bumpScale = 0.05;
            material.roughness = 0.6; // Slightly reflective
            material.metalness = 0.1;
        }

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.rotation.z = 23.5 * (Math.PI / 180);
        this.planetGroup.add(this.mesh);

        // Atmosphere & Extras
        if (this.name === 'Earth') {
            this.addAtmosphere(0x00aaff, 1.03);
            this.addClouds(); // We will use procedural clouds still, or download cloud map? Stick to procedural or transparent sphere

            // Moon
            const moonTexture = loader.load('/textures/moon.jpg');
            const moonGeo = new THREE.SphereGeometry(this.size * 0.27, 32, 32);
            const moonMat = new THREE.MeshStandardMaterial({ map: moonTexture });
            this.moon = new THREE.Mesh(moonGeo, moonMat);
            this.moonGroup = new THREE.Group();
            this.moon.position.set(this.size * 5, 0, 0);
            this.moonGroup.add(this.moon);
            this.planetGroup.add(this.moonGroup);
        }

        if (this.name === 'Venus') {
            this.addAtmosphere(0xffddaa, 1.05);
        }

        if (this.hasRing) {
            this.createRing(this.size);
        }

        this.createLabel(this.name);
    }

    addAtmosphere(color, scale) {
        const atmoGeo = new THREE.SphereGeometry(this.size * scale, 64, 64);
        const atmoMat = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: new THREE.Color(color) }
            },
            vertexShader: atmosphereVertex,
            fragmentShader: atmosphereFragment,
            transparent: true,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const atmo = new THREE.Mesh(atmoGeo, atmoMat);
        this.planetGroup.add(atmo);
    }

    addClouds() {
        const canvas = createNoiseTexture({ type: 'noise', color1: '#ffffff', color2: '#000000', scale: 3 });
        const texture = new THREE.CanvasTexture(canvas);

        const geometry = new THREE.SphereGeometry(this.size * 1.01, 64, 64);
        const material = new THREE.MeshStandardMaterial({
            alphaMap: texture,
            transparent: true,
            opacity: 0.8,
            color: 0xffffff,
            side: THREE.DoubleSide
        });

        this.clouds = new THREE.Mesh(geometry, material);
        this.planetGroup.add(this.clouds);
    }

    createRing(planetSize) {
        const loader = new THREE.TextureLoader();
        const texture = loader.load('/textures/saturn_ring.png');
        texture.rotation = Math.PI / 2;

        const geometry = new THREE.RingGeometry(planetSize * 1.4, planetSize * 2.5, 128);
        const pos = geometry.attributes.position;
        const uv = geometry.attributes.uv;
        // UV Remap for Ring to use texture radially
        for (let i = 0; i < uv.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const r = Math.sqrt(x * x + y * y);
            // Map radius to V (0 to 1) 
            const v = (r - planetSize * 1.4) / (planetSize * 1.1);
            uv.setY(i, v);
            uv.setX(i, 0.5);
        }

        const material = new THREE.MeshStandardMaterial({
            map: texture,
            alphaMap: texture, // Use lightness for alpha (rings are bright, space is black)
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 1.0,
            roughness: 0.4
        });

        const ring = new THREE.Mesh(geometry, material);
        ring.rotation.x = Math.PI / 2;
        ring.castShadow = true;
        ring.receiveShadow = true;
        this.planetGroup.add(ring);
    }

    createLabel(text) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;
        context.font = 'Bold 40px Arial';
        context.shadowColor = "black";
        context.shadowBlur = 10;
        context.fillStyle = 'rgba(255, 255, 255, 0.9)';
        context.textAlign = 'center';
        context.fillText(text, 256, 64);

        const texture = new THREE.CanvasTexture(canvas);
        const label = new THREE.Mesh(
            new THREE.PlaneGeometry(4, 1),
            new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthTest: false })
        );
        label.renderOrder = 999;
        label.position.set(this.size + 2, this.size, 0);
        this.planetGroup.add(label);
        this.label = label;
    }

    update(time, cameraPosition) {
        this.mesh.rotation.y = time * 0.05;
        if (this.clouds) this.clouds.rotation.y = time * 0.06;
        if (this.moonGroup) {
            this.moonGroup.rotation.y = time * 0.2;
            this.moon.rotation.y = time * 0.1;
        }
        if (this.label) {
            this.label.lookAt(cameraPosition);
        }
    }
}

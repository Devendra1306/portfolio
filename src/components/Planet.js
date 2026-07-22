import * as THREE from 'three';
import gsap from 'gsap';
import { createNoiseTexture } from '../utils/TextureUtils';

// ─── Atmosphere shader (Sun-lit dynamic glow) ───────────────────────────────
const atmosphereVertex = `
varying vec3 vNormal;
varying vec3 vEyeVector;
varying vec3 vSunDir;
uniform vec3 uSunPos;
void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 localPos = vec4(position, 1.0);
    vEyeVector = normalize(cameraPosition - (modelMatrix * localPos).xyz);
    vSunDir = normalize(uSunPos - position);
    gl_Position = projectionMatrix * modelViewMatrix * localPos;
}`;

const atmosphereFragment = `
varying vec3 vNormal;
varying vec3 vEyeVector;
varying vec3 vSunDir;
uniform vec3  uColor;
uniform float uIntensity;
uniform float uPower;
void main() {
    // Fresnel glow at the edge of the planet
    float edge = 1.0 - max(dot(vNormal, vEyeVector), 0.0);
    float intensity = pow(edge, uPower);
    
    // Sun lighting (so atmosphere is dark on the night side of the planet)
    float sunLit = smoothstep(-0.35, 0.25, dot(vNormal, vSunDir));
    
    gl_FragColor = vec4(uColor, 1.0) * intensity * uIntensity * sunLit;
}`;

// ─── Glow ring shader (Soft volumetric halo — no outlines!) ──────────────────
const ringGlowVertex = `
varying vec2 vUv;
void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}`;

const ringGlowFragment = `
varying vec2 vUv;
uniform vec3  uColor;
uniform float uOpacity;
void main(){
    float r = distance(vUv, vec2(0.5));
    // Soft radial dropoff starting outside the planet core
    float glow = smoothstep(0.50, 0.35, r);
    // Cutoff inside the planet body so it blooms outwards
    float innerMask = smoothstep(0.28, 0.38, r);
    gl_FragColor = vec4(uColor, glow * innerMask * uOpacity);
}`;

// ─── Per-planet configs ──────────────────────────────────────────────────────
const PLANET_CFG = {
    Mercury: { atmo: null,                  ring: false, rotSpeed: 0.015, glowColor: 0xffaa55 },
    Venus:   { atmo: [0xffddaa, 1.06, 3.0], ring: false, rotSpeed: 0.009, glowColor: 0xffcc66 },
    Earth:   { atmo: [0x3399ff, 1.04, 3.0], ring: false, rotSpeed: 0.05,  glowColor: 0x33aaff },
    Mars:    { atmo: [0xff5533, 1.03, 4.0], ring: false, rotSpeed: 0.048, glowColor: 0xff6633 },
    Jupiter: { atmo: [0xcc8844, 1.03, 3.5], ring: false, rotSpeed: 0.12,  glowColor: 0xddaa55 },
    Saturn:  { atmo: [0xddcc99, 1.03, 3.5], ring: true,  rotSpeed: 0.09,  glowColor: 0xeedd99 },
    Uranus:  { atmo: [0x77ddee, 1.04, 3.0], ring: false, rotSpeed: 0.07,  glowColor: 0x55ccee },
    Neptune: { atmo: [0x4466ff, 1.03, 3.5], ring: false, rotSpeed: 0.065, glowColor: 0x6688ff },
};

export default class Planet {
    constructor(group, config) {
        this.group     = group;
        this.config    = config;
        this.name      = config.name;
        this.size      = config.size;
        this.zPos      = config.z;
        this.hasRing   = config.ring;
        this.type      = config.type || 'rocky';
        this._cfg      = PLANET_CFG[config.name] || {};

        this._hovered    = false;
        this._glowRing   = null;
        this._glowActive = false;

        this.planetGroup = new THREE.Group();
        this.planetGroup.position.set(0, 0, this.zPos);
        this.group.add(this.planetGroup);

        this.init();
    }

    // ─── Build planet ─────────────────────────────────────────────────────────
    init() {
        const loader = new THREE.TextureLoader();
        const texMap = {
            Mercury: '/textures/mercury.jpg',
            Venus:   '/textures/venus.jpg',
            Earth:   '/textures/earth.jpg',
            Mars:    '/textures/mars.jpg',
            Jupiter: '/textures/jupiter.jpg',
            Saturn:  '/textures/saturn.jpg',
            Uranus:  '/textures/uranus.jpg',
            Neptune: '/textures/neptune.jpg',
        };
        const texturePath = texMap[this.name] || '/textures/earth.jpg';
        const texture = loader.load(texturePath);

        const geometry = new THREE.SphereGeometry(this.size, 96, 96);
        const material = new THREE.MeshStandardMaterial({
            map:       texture,
            roughness: 0.7,
            metalness: 0.0,
        });

        // Set realistic material properties based on physical properties
        if (this.name === 'Earth') {
            material.bumpMap   = texture;
            material.bumpScale = 0.035;
            material.roughness = 0.45; // semi-glossy for water Specular
            material.metalness = 0.1;
        } else if (this.name === 'Mars') {
            material.bumpMap   = texture;
            material.bumpScale = 0.025;
            material.roughness = 0.85;
        } else if (this.name === 'Mercury') {
            material.bumpMap   = texture;
            material.bumpScale = 0.015;
            material.roughness = 0.9;
        } else if (this.name === 'Venus') {
            material.roughness = 0.8;
        } else if (this.name === 'Jupiter' || this.name === 'Saturn') {
            material.roughness = 0.6;
        } else if (this.name === 'Uranus' || this.name === 'Neptune') {
            material.roughness = 0.5;
        }

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.rotation.z = 23.5 * (Math.PI / 180);
        this.planetGroup.add(this.mesh);

        // ── Atmosphere ──
        const atmoCfg = this._cfg.atmo;
        if (atmoCfg) {
            this.addAtmosphere(atmoCfg[0], atmoCfg[1], atmoCfg[2]);
        }

        // ── Earth extras ──
        if (this.name === 'Earth') {
            this.addClouds();
            const moonTex  = loader.load('/textures/moon.jpg');
            const moonGeo  = new THREE.SphereGeometry(this.size * 0.27, 32, 32);
            const moonMat  = new THREE.MeshStandardMaterial({ map: moonTex, roughness: 0.9 });
            this.moon      = new THREE.Mesh(moonGeo, moonMat);
            this.moonGroup = new THREE.Group();
            this.moon.position.set(this.size * 5, 0, 0);
            this.moonGroup.add(this.moon);
            this.planetGroup.add(this.moonGroup);
        }

        // ── Saturn ring ──
        if (this.hasRing) this.createRing(this.size);

        // ── Floating label ──
        this.createLabel(this.name);

        // ── Hover glow ring ──
        this._buildGlowRing();

        // ── Entrance animation ──
        this.planetGroup.scale.setScalar(0.01);
        gsap.to(this.planetGroup.scale, {
            x: 1, y: 1, z: 1,
            duration: 1.4, ease: 'elastic.out(1, 0.6)',
            delay: 0.3,
        });
    }

    // ─── Atmosphere ───────────────────────────────────────────────────────────
    addAtmosphere(color, scale, power) {
        const geo = new THREE.SphereGeometry(this.size * scale, 64, 64);
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uColor:     { value: new THREE.Color(color) },
                uIntensity: { value: 1.8 },
                uPower:     { value: power },
                uSunPos:    { value: new THREE.Vector3(0, 0, -this.zPos) },
            },
            vertexShader:   atmosphereVertex,
            fragmentShader: atmosphereFragment,
            transparent:    true,
            side:           THREE.BackSide,
            blending:       THREE.AdditiveBlending,
            depthWrite:     false,
        });
        this.atmosphere = new THREE.Mesh(geo, mat);
        this.planetGroup.add(this.atmosphere);
    }

    // ─── Procedural clouds ───────────────────────────────────────────────────
    addClouds() {
        const canvas  = createNoiseTexture({ type: 'noise', color1: '#ffffff', color2: '#000000', scale: 3 });
        const texture = new THREE.CanvasTexture(canvas);
        const geo     = new THREE.SphereGeometry(this.size * 1.015, 64, 64);
        const mat     = new THREE.MeshStandardMaterial({
            alphaMap:    texture,
            transparent: true,
            opacity:     0.75,
            color:       0xffffff,
            side:        THREE.DoubleSide,
            depthWrite:  false,
        });
        this.clouds = new THREE.Mesh(geo, mat);
        this.planetGroup.add(this.clouds);
    }

    // ─── Saturn-style ring ────────────────────────────────────────────────────
    createRing(planetSize) {
        const loader   = new THREE.TextureLoader();
        const texture  = loader.load('/textures/saturn_ring.png');
        texture.rotation = Math.PI / 2;

        const geometry = new THREE.RingGeometry(planetSize * 1.4, planetSize * 2.5, 128);
        const pos      = geometry.attributes.position;
        const uv       = geometry.attributes.uv;
        for (let i = 0; i < uv.count; i++) {
            const x = pos.getX(i), y = pos.getY(i);
            const r = Math.sqrt(x * x + y * y);
            const v = (r - planetSize * 1.4) / (planetSize * 1.1);
            uv.setY(i, v); uv.setX(i, 0.5);
        }

        const mat = new THREE.MeshStandardMaterial({
            map:         texture,
            alphaMap:    texture,
            side:        THREE.DoubleSide,
            transparent: true,
            opacity:     1.0,
            roughness:   0.4,
        });
        const ring = new THREE.Mesh(geometry, mat);
        ring.rotation.x = Math.PI / 2;
        ring.castShadow = ring.receiveShadow = true;
        this.planetGroup.add(ring);
    }

    // ─── Hover glow ring (Three.js shader plane) ──────────────────────────────
    _buildGlowRing() {
        const sz  = this.size * 2.6;
        const geo = new THREE.PlaneGeometry(sz, sz, 1, 1);
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uColor:   { value: new THREE.Color(this._cfg.glowColor || 0xffffff) },
                uOpacity: { value: 0.0 },
            },
            vertexShader:   ringGlowVertex,
            fragmentShader: ringGlowFragment,
            transparent:    true,
            depthWrite:     false,
            blending:       THREE.AdditiveBlending,
            side:           THREE.DoubleSide,
        });
        this._glowRing = new THREE.Mesh(geo, mat);
        this._glowRing.renderOrder = 5;
        this.planetGroup.add(this._glowRing);
    }

    // ─── Hover in/out (called from SolarSystem raycaster) ─────────────────────
    onHoverIn() {
        if (this._hovered) return;
        this._hovered = true;

        gsap.to(this._glowRing.material.uniforms.uOpacity, {
            value: 1.2, duration: 0.5, ease: 'power2.out'
        });
        gsap.to(this.mesh.scale, {
            x: 1.05, y: 1.05, z: 1.05, duration: 0.4, ease: 'power2.out'
        });

        // Atmosphere intensity boost
        if (this.atmosphere?.material?.uniforms?.uIntensity) {
            gsap.to(this.atmosphere.material.uniforms.uIntensity, {
                value: 3.0, duration: 0.5
            });
        }
    }

    onHoverOut() {
        if (!this._hovered) return;
        this._hovered = false;

        gsap.to(this._glowRing.material.uniforms.uOpacity, {
            value: 0.0, duration: 0.6, ease: 'power2.out'
        });
        gsap.to(this.mesh.scale, {
            x: 1.0, y: 1.0, z: 1.0, duration: 0.5, ease: 'power2.out'
        });
        if (this.atmosphere?.material?.uniforms?.uIntensity) {
            gsap.to(this.atmosphere.material.uniforms.uIntensity, {
                value: 1.8, duration: 0.5
            });
        }
    }

    // ─── Canvas label ─────────────────────────────────────────────────────────
    createLabel(text) {
        const canvas  = document.createElement('canvas');
        const ctx     = canvas.getContext('2d');
        canvas.width  = 512;
        canvas.height = 128;

        ctx.font        = '700 38px "Outfit", Arial, sans-serif';
        ctx.textAlign   = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor  = this._cfg.glowColor
            ? `#${this._cfg.glowColor.toString(16).padStart(6, '0')}`
            : '#00ccff';
        ctx.shadowBlur   = 22;
        ctx.fillStyle    = 'rgba(255,255,255,0.92)';
        ctx.fillText(text, 256, 64);

        const texture = new THREE.CanvasTexture(canvas);
        this.label = new THREE.Mesh(
            new THREE.PlaneGeometry(4, 1),
            new THREE.MeshBasicMaterial({
                map: texture, transparent: true,
                side: THREE.DoubleSide, depthTest: false,
            })
        );
        this.label.renderOrder = 999;
        this.label.position.set(this.size + 2.2, this.size * 0.8, 0);
        this.planetGroup.add(this.label);
    }

    // ─── Per-frame update ─────────────────────────────────────────────────────
    update(time, cameraPosition) {
        const speed = this._cfg.rotSpeed || 0.05;
        this.mesh.rotation.y = time * speed;

        if (this.clouds)    this.clouds.rotation.y    = time * (speed * 1.12);
        if (this.moonGroup) {
            this.moonGroup.rotation.y = time * 0.2;
            this.moon.rotation.y      = time * 0.1;
        }

        // Glow ring always faces camera
        if (this._glowRing && cameraPosition) {
            this._glowRing.lookAt(cameraPosition);
        }

        // Label billboarding
        if (this.label && cameraPosition) {
            this.label.lookAt(cameraPosition);
        }

        // Atmosphere subtle pulse
        if (this.atmosphere?.material?.uniforms?.uIntensity) {
            const base = this._hovered ? 3.0 : 1.8;
            this.atmosphere.material.uniforms.uIntensity.value =
                base + 0.15 * Math.sin(time * 1.4 + this.zPos * 0.01);
        }
    }

    resize(isMobile, depthScale, widthScale, sizeScale) {
        // Adjust planetGroup position based on depthScale (stagger spacing)
        this.planetGroup.position.set(0, 0, this.zPos * depthScale);
        
        // Update mesh scale based on sizeScale
        if (this.mesh) {
            this.mesh.scale.setScalar(sizeScale);
        }
        
        // Update atmosphere scale if exists
        if (this.atmosphere) {
            this.atmosphere.scale.setScalar(sizeScale);
            if (this.atmosphere.material?.uniforms?.uSunPos) {
                this.atmosphere.material.uniforms.uSunPos.value.set(0, 0, -this.zPos * depthScale);
            }
        }
        
        // Update glow ring scale
        if (this._glowRing) {
            this._glowRing.scale.setScalar(sizeScale);
        }

        // Update label position and scale
        if (this.label) {
            this.label.position.set(this.size * sizeScale + 2.2, this.size * sizeScale * 0.8, 0);
        }
    }
}

import * as THREE from 'three';

const vertexShader = `
uniform float uTime;
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vLayer0;
varying vec3 vLayer1;
varying vec3 vLayer2;
varying vec3 vEyeVector;

float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}

float noise(vec3 p){
    vec3 a = floor(p);
    vec3 d = p - a;
    d = d * d * (3.0 - 2.0 * d);

    vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
    vec4 k1 = perm(b.xyxy);
    vec4 k2 = perm(k1.xyxy + b.zzww);

    vec4 c = k2 + a.zzzz;
    vec4 k3 = perm(c);
    vec4 k4 = perm(c + 1.0);

    vec4 o1 = fract(k3 * (1.0 / 41.0));
    vec4 o2 = fract(k4 * (1.0 / 41.0));

    vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
    vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);

    return o4.y * d.y + o4.x * (1.0 - d.y);
}

void main() {
    vNormal = normal;
    vPosition = position;
    vUv = uv;
    vEyeVector = normalize(cameraPosition - position); // For fresnel/glow effect

    float time = uTime * 0.05;
    
    // Generate noise layers for surface movement
    mat3 rot1 = mat3(0.5, -0.87, 0.0, 0.87, 0.5, 0.0, 0.0, 0.0, 1.0);
    mat3 rot2 = mat3(0.8, 0.6, 0.0, -0.6, 0.8, 0.0, 0.0, 0.0, 1.0);
    
    vec3 pos = position;
    
    vLayer0 = pos;
    vLayer1 = pos * rot1;
    vLayer2 = pos * rot2;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform float uTime;
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vLayer0;
varying vec3 vLayer1;
varying vec3 vLayer2;
varying vec3 vEyeVector;

float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}

float noise(vec3 p){
    vec3 a = floor(p);
    vec3 d = p - a;
    d = d * d * (3.0 - 2.0 * d);

    vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
    vec4 k1 = perm(b.xyxy);
    vec4 k2 = perm(k1.xyxy + b.zzww);

    vec4 c = k2 + a.zzzz;
    vec4 k3 = perm(c);
    vec4 k4 = perm(c + 1.0);

    vec4 o1 = fract(k3 * (1.0 / 41.0));
    vec4 o2 = fract(k4 * (1.0 / 41.0));

    vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
    vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);

    return o4.y * d.y + o4.x * (1.0 - d.y);
}

void main() {
    float time = uTime * 0.1;
    
    float n1 = noise(vLayer0 * 4.0 + time);
    float n2 = noise(vLayer1 * 4.0 - time);
    float n3 = noise(vLayer2 * 2.0 + time);
    
    float intensity = n1 * n2 + n3 * 0.5; // Renamed 'bright' to 'intensity' for clarity
    
    // Color Ramp: Deep Red -> Bright Orange -> Yellow Core
    vec3 dark = vec3(0.6, 0.0, 0.0); // Darker Red
    vec3 orange = vec3(1.0, 0.2, 0.0); // Rich Orange
    vec3 yellow = vec3(1.0, 0.8, 0.0); // Golden Yellow
    vec3 white = vec3(1.0, 1.0, 0.8); // Hot Center
    
    // REDUCED BRIGHTNESS: Lower multiplier (was 2.5)
    vec3 color = mix(dark, orange, intensity * 2.0); 
    color = mix(color, yellow, smoothstep(0.5, 0.8, intensity));
    // REDUCED BRIGHTNESS: Higher threshold for white (was 0.8, 1.0)
    color = mix(color, white, smoothstep(0.9, 1.0, intensity));
    
    // Fresnel / Corona Edge - Reddish Glow
    float fresnel = dot(vEyeVector, vNormal);
    float glow = (1.0 - fresnel);
    glow = pow(glow, 3.0);
    
    // REDUCED BRIGHTNESS: Lower glow multiplier (was 1.5)
    color += vec3(1.0, 0.3, 0.0) * glow * 1.0; 

    gl_FragColor = vec4(color, 1.0);
}
`;

export default class Sun {
    constructor(scene, isMobile = false) {
        this.scene = scene;
        this.isMobile = isMobile;
        this.init();
    }

    init() {
        // High def geometry
        const segments = this.isMobile ? 32 : 128;
        const geometry = new THREE.SphereGeometry(8, segments, segments); // Size 8
        this.uniforms = {
            uTime: { value: 0 },
        };

        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            side: THREE.FrontSide
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(0, 0, 0);

        // DISABLE INTERACTION: Raycaster will ignore this object
        this.mesh.raycast = () => { };

        this.scene.add(this.mesh);

        // Sun Light - REDUCED INTENSITY (was 2) + SHADOW CASTING ENABLED
        this.sunLight = new THREE.PointLight(0xffffff, 1.5, 500);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = this.isMobile ? 512 : 2048;
        this.sunLight.shadow.mapSize.height = this.isMobile ? 512 : 2048;
        this.sunLight.shadow.bias = -0.0005;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 500;
        this.mesh.add(this.sunLight);

        // Volumetric Glow (Sprite) - Always instantiate but toggle visibility dynamically on resize
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(255, 120, 0, 0.8)'); // Reduced alpha (was 1)
        gradient.addColorStop(0.3, 'rgba(255, 60, 0, 0.4)'); // Reduced alpha (was 0.5)
        gradient.addColorStop(0.6, 'rgba(255, 20, 0, 0.05)'); // Reduced alpha (was 0.1)
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);
        const texture = new THREE.CanvasTexture(canvas);

        const spriteMat = new THREE.SpriteMaterial({
            map: texture,
            color: 0xffaa00,
            transparent: true,
            blending: THREE.AdditiveBlending
        });
        this.glow = new THREE.Sprite(spriteMat);
        this.glow.scale.set(40, 40, 1);

        // DISABLE INTERACTION on glow sprite too
        this.glow.raycast = () => { };

        this.mesh.add(this.glow); // Add to sun so it moves with it
        this.glow.visible = !this.isMobile;
    }

    resize(isMobile, sizeScale) {
        this.isMobile = isMobile;

        // Position Sun dead-center (0,0) in group coordinate space to align perfectly with centered layout
        this.mesh.position.set(0, 0, 0);

        // Update Sun scale
        this.mesh.scale.setScalar(sizeScale);

        // Update glow visibility and scale
        if (this.glow) {
            this.glow.visible = !isMobile;
            if (!isMobile) {
                this.glow.scale.set(40 * sizeScale, 40 * sizeScale, 1);
            }
        }

        // Adjust light intensity/distance on mobile to prevent over-exposure
        if (this.sunLight) {
            this.sunLight.intensity = isMobile ? 1.0 : 1.5;
            this.sunLight.distance = isMobile ? 300 : 500;
        }
    }

    update(time) {
        this.uniforms.uTime.value = time;
        this.mesh.rotation.y = time * 0.005; // Very slow rotation
    }
}

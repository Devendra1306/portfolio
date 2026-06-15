import * as THREE from 'three';

// ── Shared noise functions (both shaders need them) ────────────────────────────
const NOISE_GLSL = `
float mod289f(float x){ return x - floor(x*(1.0/289.0))*289.0; }
vec4  mod289v(vec4 x){ return x - floor(x*(1.0/289.0))*289.0; }
vec4  perm(vec4 x){ return mod289v(((x*34.0)+10.0)*x); }

float noise(vec3 p){
    vec3 a = floor(p), d = p - a;
    d = d*d*(3.0-2.0*d);
    vec4 b  = a.xxyy + vec4(0,1,0,1);
    vec4 k1 = perm(b.xyxy);
    vec4 k2 = perm(k1.xyxy + b.zzww);
    vec4 c  = k2 + a.zzzz;
    vec4 k3 = perm(c), k4 = perm(c+1.0);
    vec4 o1 = fract(k3*(1.0/41.0));
    vec4 o2 = fract(k4*(1.0/41.0));
    vec4 o3 = o2*d.z + o1*(1.0-d.z);
    vec2 o4 = o3.yw*d.x + o3.xz*(1.0-d.x);
    return o4.y*d.y + o4.x*(1.0-d.y);
}

// 5-octave FBM with rotating basis to remove axis bias
float fbm(vec3 p, float t){
    float v = 0.0, a = 0.52;
    mat3 rot = mat3(0.866,0.5,0.0,-0.5,0.866,0.0,0.0,0.0,1.0);
    for(int i=0; i<5; i++){
        v += a * noise(p + vec3(t));
        p  = rot * p * 2.02;
        a *= 0.48;
        t *= 1.08;
    }
    return v;
}
`;

// ── Vertex shader (simple pass-through, varyings for fragment) ─────────────────
const vertexShader = `
uniform float uTime;
varying vec3 vPos;
varying vec3 vNrm;
varying vec3 vEye;

void main(){
    vPos = position;
    vNrm = normalize(normalMatrix * normal);
    vEye = normalize(cameraPosition - (modelMatrix * vec4(position,1.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// ── Fragment shader: granulation + sunspots + limb darkening + corona fringe ──
const fragmentShader = `
uniform float uTime;
varying vec3 vPos;
varying vec3 vNrm;
varying vec3 vEye;

${NOISE_GLSL}

void main(){
    vec3 p = normalize(vPos);
    float t = uTime * 0.09;

    // Three noise scales → granulation cells
    float n1 = fbm(p * 2.5,  t);
    float n2 = fbm(p * 6.0, -t * 0.65 + 3.5);
    float n3 = fbm(p * 13.0,  t * 1.4  + 8.0);
    float raw = n1*0.52 + n2*0.32 + n3*0.16;

    // Stretch contrast so granules really pop
    float gran = smoothstep(0.22, 0.78, raw);

    // Sunspot darkening: some regions are cooler
    float spot = smoothstep(0.34, 0.42, n1);

    // ── Solar colour ramp (matches real solar images) ──
    vec3 lane    = vec3(0.60, 0.06, 0.00); // dark intergranular lane
    vec3 surface = vec3(1.00, 0.55, 0.02); // orange-yellow normal surface
    vec3 peak    = vec3(1.00, 0.90, 0.28); // bright yellow granule top
    vec3 nucleus = vec3(1.00, 0.98, 0.88); // near-white hot granule core

    vec3 col = lane;
    col = mix(col, surface, smoothstep(0.00, 0.44, gran));
    col = mix(col, peak,    smoothstep(0.44, 0.80, gran));
    col = mix(col, nucleus, smoothstep(0.80, 1.00, gran));

    // Apply sunspot darkening
    col = mix(col * 0.12, col, spot);

    // Limb darkening: edges are ~40% as bright as the centre (real physics)
    float limbCos = max(dot(vEye, vNrm), 0.0);
    float limb    = 0.40 + 0.60 * pow(limbCos, 0.32);
    col *= limb;

    // Chromosphere fringe: reddish glow right at the edge
    float edge = 1.0 - limbCos;
    col += vec3(1.0, 0.20, 0.00) * pow(edge, 4.5) * 1.6;

    gl_FragColor = vec4(col * 1.3, 1.0);
}
`;

export default class Sun {
    constructor(scene) {
        this.scene = scene;
        this.init();
    }

    init() {
        // ── 1. Photosphere surface ─────────────────────────────────────────────
        const geometry = new THREE.SphereGeometry(8, 128, 128);
        this.uniforms = { uTime: { value: 0 } };

        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader,
            fragmentShader,
            side: THREE.FrontSide
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(0, 0, 0);
        this.mesh.raycast = () => {};
        this.scene.add(this.mesh);

        // ── 2. Sun point light — illuminates planets ───────────────────────────
        const sunLight = new THREE.PointLight(0xfff0dd, 2.5, 0, 0.7);
        this.mesh.add(sunLight);

        // ── 3. Multi-layer corona glow (sprites) ───────────────────────────────
        this._addCorona(80, 0.10, '#ff3300'); // far faint corona
        this._addCorona(46, 0.28, '#ff7000'); // mid corona
        this._addCorona(26, 0.52, '#ffaa22'); // inner golden halo
        this._addCorona(15, 0.70, '#ffdd66'); // tight photosphere halo
    }

    _addCorona(scale, opacity, hex) {
        const sz = 256, c = sz / 2;
        const cv = document.createElement('canvas');
        cv.width = cv.height = sz;
        const ctx = cv.getContext('2d');
        const col = new THREE.Color(hex);
        const r = Math.round(col.r*255), g = Math.round(col.g*255), b = Math.round(col.b*255);
        const gr = ctx.createRadialGradient(c,c,0, c,c,c);
        gr.addColorStop(0.00, `rgba(${r},${g},${b},1.0)`);
        gr.addColorStop(0.15, `rgba(${r},${g},${b},0.85)`);
        gr.addColorStop(0.40, `rgba(${r},${g},${b},0.25)`);
        gr.addColorStop(0.70, `rgba(${r},${g},${b},0.05)`);
        gr.addColorStop(1.00, `rgba(${r},${g},${b},0.00)`);
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, sz, sz);

        const spriteMat = new THREE.SpriteMaterial({
            map: new THREE.CanvasTexture(cv),
            transparent: true,
            opacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(scale, scale, 1);
        sprite._baseScale = scale;
        sprite.raycast = () => {};
        this.mesh.add(sprite);

        // Store for pulsing
        if (!this._coronaSprites) this._coronaSprites = [];
        this._coronaSprites.push(sprite);
    }

    update(time) {
        this.uniforms.uTime.value = time;
        this.mesh.rotation.y = time * 0.005; // slow solar rotation

        // Gently pulse corona layers at different frequencies
        if (this._coronaSprites) {
            this._coronaSprites.forEach((s, i) => {
                const pulse = 1.0 + 0.06 * Math.sin(time * (0.6 + i * 0.25));
                s.scale.setScalar(s._baseScale * pulse);
            });
        }
    }
}

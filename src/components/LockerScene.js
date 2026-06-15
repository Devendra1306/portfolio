import * as THREE from 'three';
import gsap from 'gsap';

// ─── Particle ring geometry (Three.js) ──────────────────────────────────────
function createOrbitRing(radius, count, color) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const jitter = (Math.random() - 0.5) * 0.15;
        pos[i * 3]     = Math.cos(angle) * (radius + jitter);
        pos[i * 3 + 1] = Math.sin(angle) * (radius + jitter);
        pos[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
        sizes[i] = 0.02 + Math.random() * 0.04;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
        color,
        size: 0.04,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
    });
    return new THREE.Points(geo, mat);
}

export default class LockerScene {
    constructor(scene, camera, renderer) {
        this.scene    = scene;
        this.camera   = camera;
        this.renderer = renderer;
        this.raycaster = new THREE.Raycaster();
        this.pointer   = new THREE.Vector2();

        this.isOpen     = false;
        this.isHovering = false;
        this._mouse     = { x: 0, y: 0 };
        this._magnetX   = 0;
        this._magnetY   = 0;

        this.lockerGroup = new THREE.Group();
        this.scene.add(this.lockerGroup);

        this.init();
        this._buildDOMButton();
        this.addEventListeners();
    }

    // ─── Three.js decorative elements ─────────────────────────────────────────
    init() {
        // Ambient light for intro phase
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
        this.scene.add(this.ambientLight);
        this.pointLight = new THREE.PointLight(0xffffff, 1);
        this.pointLight.position.set(5, 5, 5);
        this.scene.add(this.pointLight);

        // Floating 3-D glow sphere behind button
        const sphereGeo = new THREE.SphereGeometry(1.2, 64, 64);
        const sphereMat = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x00aaff) } },
            vertexShader: `
                varying vec3 vNrm; varying vec3 vEye;
                void main(){
                    vNrm = normalize(normalMatrix * normal);
                    vEye = normalize(cameraPosition - (modelMatrix * vec4(position,1.0)).xyz);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
                }`,
            fragmentShader: `
                uniform float uTime; uniform vec3 uColor;
                varying vec3 vNrm; varying vec3 vEye;
                void main(){
                    float edge = 1.0 - max(dot(vEye, vNrm), 0.0);
                    float pulse = 0.6 + 0.4 * sin(uTime * 1.8);
                    gl_FragColor = vec4(uColor, pow(edge, 2.5) * 0.7 * pulse);
                }`,
            transparent: true,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        this.glowSphere = new THREE.Mesh(sphereGeo, sphereMat);
        this.lockerGroup.add(this.glowSphere);

        // Particle orbit rings
        this.ring1 = createOrbitRing(1.8, 200, 0x00ccff);
        this.ring2 = createOrbitRing(2.3, 160, 0x8844ff);
        this.ring3 = createOrbitRing(2.8, 120, 0x00ffcc);
        this.lockerGroup.add(this.ring1, this.ring2, this.ring3);

        // Invisible hitbox mesh for raycasting
        const hitGeo = new THREE.PlaneGeometry(3.5, 1.8);
        const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthTest: false });
        this.hitMesh = new THREE.Mesh(hitGeo, hitMat);
        this.hitMesh.userData = { isInteractable: true };
        this.lockerGroup.add(this.hitMesh);

        // Reveal rings after short delay
        gsap.to([this.ring1.material, this.ring2.material, this.ring3.material], {
            opacity: 0.7, duration: 2, delay: 0.5, stagger: 0.3, ease: 'power2.out'
        });

        this.lockerGroup.position.set(0, 0, 0);
        this._time = 0;
    }

    // ─── DOM-based ENTER button (layered over canvas) ─────────────────────────
    _buildDOMButton() {
        // Wrapper
        this._overlay = document.createElement('div');
        this._overlay.id = 'enter-overlay';
        Object.assign(this._overlay.style, {
            position: 'fixed', inset: '0', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            zIndex: '100', pointerEvents: 'none',
        });

        // Outer magnetic container (Gateway Card)
        this._magWrap = document.createElement('div');
        this._magWrap.id = 'gateway-card';
        Object.assign(this._magWrap.style, {
            position: 'relative', display: 'flex',
            flexDirection: 'column', gap: '1.5rem',
            width: '420px', padding: '2.5rem',
            background: 'rgba(7, 18, 36, 0.55)',
            backdropFilter: 'blur(25px)',
            WebkitBackdropFilter: 'blur(25px)',
            border: '1px solid rgba(0, 204, 255, 0.25)',
            borderRadius: '24px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6), inset 0 0 20px rgba(0,204,255,0.05)',
            pointerEvents: 'auto', cursor: 'pointer',
            transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
            opacity: '0',
            transform: 'scale(0.9)',
        });

        // Laser Scanner line
        const scanner = document.createElement('div');
        scanner.className = 'gateway-scanner';
        this._magWrap.appendChild(scanner);

        // Gateway Header
        const header = document.createElement('div');
        header.className = 'gateway-header';
        
        const status = document.createElement('div');
        status.className = 'gateway-status';
        const led = document.createElement('div');
        led.className = 'status-led';
        status.appendChild(led);
        const statusText = document.createTextNode(' STATUS: ACTIVE');
        status.appendChild(statusText);

        const ver = document.createElement('div');
        ver.textContent = '[ SYS_GATEWAY v3.1 ]';

        header.appendChild(status);
        header.appendChild(ver);
        this._magWrap.appendChild(header);

        // Diagnostics display
        const diagnostics = document.createElement('div');
        diagnostics.className = 'gateway-diagnostics';

        const lines = [
            { label: 'PROPULSION_DRIVE', val: 'ION_THRUSTERS' },
            { label: 'COORDINATES_LOCK', val: '54.09.81.2' },
            { label: 'TRANSITION_STATUS', val: 'READY', highlight: true }
        ];

        lines.forEach(line => {
            const row = document.createElement('div');
            row.className = 'diag-line';
            row.style.opacity = '0'; // will fade in via GSAP
            
            const lbl = document.createElement('span');
            lbl.textContent = `> ${line.label}:`;
            
            const val = document.createElement('span');
            val.textContent = line.val;
            if (line.highlight) {
                val.className = 'diag-ok';
            }
            
            row.appendChild(lbl);
            row.appendChild(val);
            diagnostics.appendChild(row);
        });

        this._magWrap.appendChild(diagnostics);

        // Button pill (inside the card)
        this._btn = document.createElement('button');
        this._btn.id = 'enter-btn';
        this._btn.textContent = 'ENTER SPACE';
        Object.assign(this._btn.style, {
            position: 'relative', zIndex: '2',
            background: 'linear-gradient(135deg, rgba(0,204,255,0.12) 0%, rgba(136,68,255,0.12) 100%)',
            border: '1px solid rgba(0,204,255,0.4)',
            borderRadius: '50px',
            color: '#fff',
            fontFamily: "'Outfit', sans-serif",
            fontWeight: '700',
            fontSize: '1.05rem',
            letterSpacing: '0.35em',
            padding: '1rem 2.2rem',
            cursor: 'pointer',
            outline: 'none',
            textShadow: '0 0 10px rgba(0,204,255,0.5)',
            overflow: 'hidden',
            textTransform: 'uppercase',
            transition: 'box-shadow 0.3s ease, border-color 0.3s ease, background 0.3s ease',
        });

        // Ripple container
        this._rippleContainer = document.createElement('div');
        Object.assign(this._rippleContainer.style, {
            position: 'absolute', inset: '0', borderRadius: '50px',
            overflow: 'hidden', pointerEvents: 'none',
        });
        this._btn.appendChild(this._rippleContainer);

        this._magWrap.appendChild(this._btn);

        // Scroll hint
        this._hint = document.createElement('p');
        this._hint.textContent = '✦ CLICK TO ENGAGE SYSTEM ✦';
        Object.assign(this._hint.style, {
            marginTop: '0.5rem', width: '100%', textAlign: 'center',
            fontFamily: "'Outfit', sans-serif", fontSize: '0.65rem',
            letterSpacing: '0.25em', color: 'rgba(255,255,255,0.3)',
            textTransform: 'uppercase',
        });
        this._magWrap.appendChild(this._hint);

        this._overlay.appendChild(this._magWrap);
        document.body.appendChild(this._overlay);

        // Inject keyframe CSS
        const style = document.createElement('style');
        style.id = 'enter-styles';
        style.textContent = `
            #gateway-card {
                position: relative;
                overflow: hidden;
            }
            #gateway-card::after {
                content: '';
                position: absolute;
                inset: 0;
                background: linear-gradient(
                    rgba(18, 16, 16, 0) 50%, 
                    rgba(0, 0, 0, 0.25) 50%
                );
                background-size: 100% 4px;
                z-index: 5;
                pointer-events: none;
                opacity: 0.35;
            }
            .gateway-scanner {
                position: absolute;
                left: 0; right: 0;
                height: 30px;
                background: linear-gradient(to bottom, transparent, rgba(0, 204, 255, 0.15), transparent);
                animation: gatewayScan 3s linear infinite;
                z-index: 10;
                pointer-events: none;
            }
            @keyframes gatewayScan {
                0%   { top: -40px; }
                100% { top: 100%;  }
            }
            .gateway-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-family: 'Outfit', sans-serif;
                font-size: 0.7rem;
                letter-spacing: 0.15em;
                color: rgba(255, 255, 255, 0.4);
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                padding-bottom: 0.8rem;
                text-transform: uppercase;
            }
            .gateway-status {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .status-led {
                width: 6px;
                height: 6px;
                background: #00ffaa;
                border-radius: 50%;
                box-shadow: 0 0 10px #00ffaa;
                animation: ledBlink 1.5s infinite ease-in-out;
            }
            @keyframes ledBlink {
                0%, 100% { opacity: 0.3; }
                50% { opacity: 1; }
            }
            .gateway-diagnostics {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                font-family: monospace;
                font-size: 0.72rem;
                color: rgba(255, 255, 255, 0.6);
                text-align: left;
                background: rgba(0, 0, 0, 0.25);
                padding: 1rem;
                border-radius: 12px;
                border: 1px solid rgba(255, 255, 255, 0.04);
            }
            .diag-line {
                display: flex;
                justify-content: space-between;
            }
            .diag-ok {
                color: #00ffcc;
                font-weight: bold;
                text-shadow: 0 0 8px rgba(0,255,204,0.3);
            }
            #gateway-card::before {
                content: '';
                position: absolute;
                top: 0; left: 0; right: 0; height: 1px;
                background: linear-gradient(90deg, transparent, #00ccff, #8844ff, transparent);
            }
            #enter-btn::before {
                content: '';
                position: absolute;
                inset: -1px;
                border-radius: 50px;
                padding: 1px;
                background: linear-gradient(90deg, #00ccff, #8844ff, #ff0055, #00ccff);
                background-size: 300% 100%;
                -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                -webkit-mask-composite: xor;
                mask-composite: exclude;
                pointer-events: none;
                animation: borderMove 4s linear infinite;
                opacity: 0.6;
                transition: opacity 0.3s ease;
            }
            @keyframes borderMove {
                0% { background-position: 0% 0%; }
                100% { background-position: 300% 0%; }
            }
        `;
        document.head.appendChild(style);

        // GSAP reveal sequence (reveal gateway card & stagger diagnostics)
        const tl = gsap.timeline({ delay: 0.4 });
        tl.to(this._magWrap, { opacity: 1, scale: 1, duration: 1.0, ease: 'back.out(1.1)' });
        
        const diagRows = this._magWrap.querySelectorAll('.diag-line');
        tl.fromTo(diagRows, 
            { opacity: 0, x: -10 },
            { opacity: 1, x: 0, duration: 0.4, stagger: 0.15, ease: 'power2.out' },
            '-=0.4'
        );
    }


    // ─── Event Listeners ──────────────────────────────────────────────────────
    addEventListeners() {
        window.addEventListener('pointermove', this.onPointerMove.bind(this));
        window.addEventListener('click',       this.onClick.bind(this));
        window.forceOpenLocker = () => this.openLocker();
    }

    onPointerMove(event) {
        if (this.isOpen) return;

        this._mouse.x = event.clientX;
        this._mouse.y = event.clientY;

        this.pointer.x =  (event.clientX / window.innerWidth)  * 2 - 1;
        this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this._checkIntersection();
        this._magneticEffect(event);
    }

    _magneticEffect(event) {
        if (!this._magWrap) return;
        const rect = this._magWrap.getBoundingClientRect();
        const cx = rect.left + rect.width  / 2;
        const cy = rect.top  + rect.height / 2;
        const dx = event.clientX - cx;
        const dy = event.clientY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 150;

        if (dist < maxDist) {
            this.isHovering = true;
            const strength = (1 - dist / maxDist) * 18;
            this._magnetX = dx * strength / maxDist;
            this._magnetY = dy * strength / maxDist;
            document.body.style.cursor = 'pointer';

            gsap.to(this._btn, {
                boxShadow: '0 0 35px rgba(0,204,255,0.4), 0 0 70px rgba(136,68,255,0.2)',
                borderColor: 'rgba(0,204,255,0.7)',
                duration: 0.3,
            });
        } else {
            this.isHovering = false;
            this._magnetX = 0;
            this._magnetY = 0;
            document.body.style.cursor = 'default';

            gsap.to(this._btn, {
                boxShadow: '0 0 20px rgba(0,204,255,0.15), 0 0 40px rgba(136,68,255,0.08)',
                borderColor: 'rgba(0,204,255,0.35)',
                duration: 0.5,
            });
        }

        gsap.to(this._magWrap, {
            x: this._magnetX, y: this._magnetY,
            duration: 0.5, ease: 'power3.out',
        });
    }

    _checkIntersection() {
        if (!this.hitMesh) return;
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hits = this.raycaster.intersectObjects([this.hitMesh]);

        // Slight Three.js scale feedback on the glow sphere
        if (hits.length > 0) {
            gsap.to(this.glowSphere.scale, { x: 1.15, y: 1.15, z: 1.15, duration: 0.3, overwrite: 'auto' });
        } else {
            gsap.to(this.glowSphere.scale, { x: 1.0,  y: 1.0,  z: 1.0,  duration: 0.5, overwrite: 'auto' });
        }
    }

    onClick(event) {
        if (this.isOpen) return;
        if (this.isHovering) {
            this._spawnRipple(event);
            setTimeout(() => this.openLocker(), 350);
        }
    }

    _spawnRipple(event) {
        if (!this._rippleContainer) return;
        const rect = this._btn.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const ripple = document.createElement('span');
        Object.assign(ripple.style, {
            position: 'absolute', borderRadius: '50%',
            background: 'rgba(0,204,255,0.4)',
            width: '0px', height: '0px',
            left: x + 'px', top: y + 'px',
            transform: 'translate(-50%,-50%)',
            pointerEvents: 'none',
        });
        this._rippleContainer.appendChild(ripple);
        gsap.to(ripple, {
            width: '280px', height: '280px', opacity: 0,
            duration: 0.6, ease: 'power2.out',
            onComplete: () => ripple.remove(),
        });
    }

    openLocker() {
        this.isOpen = true;
        document.body.style.cursor = 'default';

        // DOM gateway card exit - slide up slightly and fade
        gsap.timeline()
            .to(this._magWrap, { y: -30, scale: 0.95, opacity: 0, duration: 0.55, ease: 'power3.in' })
            .to(this._overlay, { opacity: 0, duration: 0.6, ease: 'power2.in',
                onComplete: () => { this._overlay.remove(); }
            }, '-=0.35');

        // Camera warp-speed FOV effect (expansion then snap-back)
        gsap.timeline()
            .to(this.camera, {
                fov: 85,
                duration: 0.7,
                ease: 'power3.in',
                onUpdate: () => this.camera.updateProjectionMatrix()
            })
            .to(this.camera, {
                fov: 45,
                duration: 0.9,
                ease: 'power2.out',
                onUpdate: () => this.camera.updateProjectionMatrix()
            });

        // Dissolve Three.js elements
        gsap.to([this.ring1.material, this.ring2.material, this.ring3.material], {
            opacity: 0, duration: 0.5, stagger: 0.08
        });

        // Scale down glow sphere (implode) instead of scaling up/turning orange
        gsap.to(this.glowSphere.scale, {
            x: 0.1, y: 0.1, z: 0.1,
            duration: 0.6,
            ease: 'power2.in',
            onComplete: () => {
                this.lockerGroup.visible = false;
                this.onSequenceComplete();
            }
        });
    }

    onSequenceComplete() {
        window.dispatchEvent(new CustomEvent('intro-complete'));
    }

    // ─── Per-frame update ─────────────────────────────────────────────────────
    update(time) {
        this._time = time;

        // Glow sphere shader time
        if (this.glowSphere?.material?.uniforms) {
            this.glowSphere.material.uniforms.uTime = { value: time };
        }

        // Rings orbit at different speeds
        if (this.ring1) this.ring1.rotation.z =  time * 0.25;
        if (this.ring2) this.ring2.rotation.z = -time * 0.18;
        if (this.ring3) this.ring3.rotation.z =  time * 0.12;

        // Gentle float of entire group
        this.lockerGroup.position.y = Math.sin(time * 0.7) * 0.08;
    }
}

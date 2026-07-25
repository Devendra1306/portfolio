// ─── Web Audio API Space Ambient Synthesizer ──────────────────────────────────
class SpaceAudio {
    constructor() {
        this.ctx = null;
        this.isPlaying = false;
        this.masterGain = null;
        this.oscillators = [];
        this.lfo = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized && this.ctx) {
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            return;
        }

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;

            this.ctx = new AudioContext();

            // Master Gain
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);

            // Filter for warm space cinematic drone
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(400, this.ctx.currentTime); // Deep, muffled frequency
            filter.Q.setValueAtTime(3, this.ctx.currentTime);
            
            // Sub filter for extreme lows
            const subFilter = this.ctx.createBiquadFilter();
            subFilter.type = 'lowpass';
            subFilter.frequency.setValueAtTime(80, this.ctx.currentTime);
            subFilter.Q.setValueAtTime(1, this.ctx.currentTime);
            
            filter.connect(this.masterGain);
            subFilter.connect(this.masterGain);

            // Cinematic Drone Frequencies (Deep C root: C2=65.41Hz, G2=98Hz, C3=130.81Hz, with subtle evolving high pads)
            // Adding a high ethereal pad (C5=523.25, G5=783.99)
            const freqs = [65.41, 98.00, 130.81, 523.25, 783.99];
            const types = ['sine', 'triangle', 'sawtooth', 'sine', 'sine'];
            const volumes = [0.15, 0.08, 0.03, 0.02, 0.015];

            this.oscillators = freqs.map((freq, index) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = types[index];
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

                // Deep detuning for vastness
                osc.detune.setValueAtTime((index - 2) * 8, this.ctx.currentTime);

                gain.gain.setValueAtTime(volumes[index], this.ctx.currentTime);
                osc.connect(gain);
                
                // Route lowest freq to subFilter, others to main filter
                if (index === 0) {
                    gain.connect(subFilter);
                } else {
                    gain.connect(filter);
                }
                
                osc.start();
                return osc;
            });

            // LFO 1: Slow breathing filter sweep (Vast space feeling)
            this.lfo = this.ctx.createOscillator();
            const lfoGain = this.ctx.createGain();
            this.lfo.type = 'sine';
            this.lfo.frequency.setValueAtTime(0.05, this.ctx.currentTime); // 0.05 Hz very slow
            lfoGain.gain.setValueAtTime(300, this.ctx.currentTime);

            this.lfo.connect(lfoGain);
            lfoGain.connect(filter.frequency);
            this.lfo.start();
            
            // LFO 2: Twinkling / subtle shimmer on higher pads
            const shimmerLfo = this.ctx.createOscillator();
            const shimmerGain = this.ctx.createGain();
            shimmerLfo.type = 'triangle';
            shimmerLfo.frequency.setValueAtTime(0.3, this.ctx.currentTime);
            shimmerGain.gain.setValueAtTime(15, this.ctx.currentTime);
            shimmerLfo.connect(shimmerGain);
            shimmerGain.connect(this.oscillators[3].detune); // Modulate high C
            shimmerLfo.start();
            this.oscillators.push(shimmerLfo); // keep track to stop if needed

            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio initialization error:', e);
        }
    }

    playUIBeep(freq = 880, duration = 0.1) {
        this.init();
        if (!this.ctx || !this.isPlaying) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.4, this.ctx.currentTime + duration);

            gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) { }
    }

    playLaunchWarpSound() {
        this.init();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        try {
            // Sci-fi warp sweep sound
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 1.2);

            gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.4);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 1.4);
        } catch (e) { }
    }

    toggle() {
        this.init();
        if (!this.ctx) return;

        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const toggleBtn = document.getElementById('sound-toggle');
        const textEl = toggleBtn ? toggleBtn.querySelector('.sound-text') : null;

        if (this.isPlaying) {
            // Fade out
            this.masterGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
            this.isPlaying = false;
            if (toggleBtn) toggleBtn.classList.add('sound-muted');
            if (textEl) textEl.textContent = 'SOUND OFF';
        } else {
            // Fade in
            this.masterGain.gain.linearRampToValueAtTime(0.25, this.ctx.currentTime + 0.3);
            this.isPlaying = true;
            if (toggleBtn) toggleBtn.classList.remove('sound-muted');
            if (textEl) textEl.textContent = 'SOUND ON';
            this.playUIBeep(880, 0.1);
        }
    }

    startAmbient() {
        this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        if (!this.isPlaying) {
            this.toggle();
        }
    }
}

const spaceAudio = new SpaceAudio();
export default spaceAudio;

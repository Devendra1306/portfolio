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

            // Filter for warm space ambient resonance
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, this.ctx.currentTime); // Crisp, audible frequency range
            filter.Q.setValueAtTime(2, this.ctx.currentTime);
            filter.connect(this.masterGain);

            // Space Ambient Chord (A minor 9th: A2=110Hz, E3=164.8Hz, A3=220Hz, C4=261.6Hz, E4=329.6Hz)
            const freqs = [110, 164.8, 220, 261.6, 329.6];
            const types = ['sine', 'triangle', 'sine', 'triangle', 'sine'];

            this.oscillators = freqs.map((freq, index) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = types[index];
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

                // Subtle detuning for lush stereo chorus effect
                osc.detune.setValueAtTime((index - 2) * 5, this.ctx.currentTime);

                gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
                osc.connect(gain);
                gain.connect(filter);
                osc.start();
                return osc;
            });

            // LFO for slow ambient filter pulsing (space atmosphere movement)
            this.lfo = this.ctx.createOscillator();
            const lfoGain = this.ctx.createGain();
            this.lfo.frequency.setValueAtTime(0.2, this.ctx.currentTime); // 0.2 Hz slow pulse
            lfoGain.gain.setValueAtTime(200, this.ctx.currentTime);

            this.lfo.connect(lfoGain);
            lfoGain.connect(filter.frequency);
            this.lfo.start();

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

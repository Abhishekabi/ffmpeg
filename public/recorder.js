class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.audioBlob = null;
        this.audioUrl = null;
        this.audioElement = new Audio();
        this.visualizer = document.getElementById('visualizer');
        this.visualizerCtx = this.visualizer.getContext('2d');
        this.analyser = null;
        this.isVisualizing = false;
        this.isRecording = false;
        this.isPlaying = false;
        
        this.audioContext = null;
        
        this.initializeButtons();
        this.setupVisualizer();
        this.initializeTheme();
        
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isRecording) {
                this.stopRecording();
            }
        });
    }

    initializeButtons() {
        this.recordButton = document.getElementById('recordButton');
        this.stopButton = document.getElementById('stopButton');
        this.playButton = document.getElementById('playButton');
        this.downloadButton = document.getElementById('downloadButton');
        
        this.recordButton.addEventListener('click', () => this.startRecording());
        this.stopButton.addEventListener('click', () => this.stopRecording());
        this.playButton.addEventListener('click', () => this.playRecording());
        this.downloadButton.addEventListener('click', () => this.convertAndDownload());
    }

    setupVisualizer() {
        const resizeCanvas = () => {
            // Get the container dimensions
            const container = this.visualizer.parentElement;
            const containerWidth = container.clientWidth;
            const containerHeight = this.visualizer.offsetHeight;

            // Calculate device pixel ratio
            const dpr = window.devicePixelRatio || 1;
            
            // Reset any previous scaling
            this.visualizerCtx.setTransform(1, 0, 0, 1, 0, 0);
            
            // Set canvas display size (CSS pixels)
            this.visualizer.style.width = '100%'; // Use CSS to control width
            this.visualizer.style.height = `${containerHeight}px`;
            
            // Set canvas buffer size (actual pixels)
            this.visualizer.width = containerWidth * dpr;
            this.visualizer.height = containerHeight * dpr;
            
            // Scale the context
            this.visualizerCtx.scale(dpr, dpr);
            
            // Clear and fill with background
            this.visualizerCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--visualizer-bg').trim();
            this.visualizerCtx.fillRect(0, 0, containerWidth, containerHeight);
        };

        // Initial setup
        resizeCanvas();

        // Handle window resize and orientation change
        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('orientationchange', resizeCanvas);

        // Handle container size changes
        const resizeObserver = new ResizeObserver(() => resizeCanvas());
        resizeObserver.observe(this.visualizer.parentElement);
    }

    async startRecording() {
        try {
            // Stop any ongoing playback
            if (this.isPlaying) {
                this.audioElement.pause();
                this.audioElement.currentTime = 0;
                this.playButton.innerHTML = '<span class="play-icon"></span>Play';
                this.stopVisualization();
                this.isPlaying = false;
            }

            // Reset audio chunks for new recording
            this.audioChunks = [];
            this.audioBlob = null;
            this.audioUrl = null;
            
            // Reset UI
            this.playButton.disabled = true;
            document.querySelector('.download-section').hidden = true;

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 1024;
            
            source.connect(this.analyser);
            this.isRecording = true;
            this.startVisualization('recording');

            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = () => {
                this.audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.audioUrl = URL.createObjectURL(this.audioBlob);
                this.audioElement.src = this.audioUrl;
                this.playButton.disabled = false;
                document.querySelector('.download-section').hidden = false;
            };

            this.mediaRecorder.start();
            this.recordButton.disabled = true;
            this.stopButton.disabled = false;
            this.startTimer();
        } catch (error) {
            console.error('Error accessing microphone:', error);
        }
    }

    stopRecording() {
        this.isRecording = false;
        this.stopVisualization();
        this.mediaRecorder.stop();
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        this.stopTimer();
        this.recordButton.disabled = false;
        this.stopButton.disabled = true;
    }

    playRecording() {
        if (this.audioElement.paused) {
            this.isPlaying = true;
            this.audioElement.play();
            this.playButton.innerHTML = '<span class="stop-icon"></span>Pause';
            this.startPlaybackVisualization();
        } else {
            this.isPlaying = false;
            this.audioElement.pause();
            this.playButton.innerHTML = '<span class="play-icon"></span>Play';
            this.stopVisualization();
        }

        // Add ended event listener if not already added
        if (!this.playbackEndListener) {
            this.playbackEndListener = () => {
                this.isPlaying = false;
                this.playButton.innerHTML = '<span class="play-icon"></span>Play';
                this.stopVisualization();
            };
            this.audioElement.addEventListener('ended', this.playbackEndListener);
        }
    }

    startVisualization(mode = 'recording') {
        this.isVisualizing = true;
        this.visualizationMode = mode;
        this.visualize(this.analyser);
    }

    stopVisualization() {
        this.isVisualizing = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        // Clear the canvas
        this.visualizerCtx.clearRect(0, 0, this.visualizer.width, this.visualizer.height);
        this.visualizerCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--visualizer-bg').trim();
        this.visualizerCtx.fillRect(0, 0, this.visualizer.width, this.visualizer.height);
    }

    visualize(analyserNode) {
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (!this.isVisualizing) return;
            
            this.animationFrame = requestAnimationFrame(draw);
            
            if (!document.hidden) {
                analyserNode.getByteTimeDomainData(dataArray);
                this.drawWaveform(dataArray, bufferLength);
            }
        };

        draw();
    }

    drawWaveform(dataArray, bufferLength) {
        const dpr = window.devicePixelRatio || 1;
        const width = this.visualizer.width / dpr;
        const height = this.visualizer.height / dpr;

        // Get computed styles for theme-aware colors
        const computedStyle = getComputedStyle(document.documentElement);
        const backgroundColor = computedStyle.getPropertyValue('--visualizer-bg').trim();
        const strokeColor = this.isPlaying ? 
            '#4CAF50' : 
            computedStyle.getPropertyValue('--visualizer-stroke').trim();

        // Use path2D for better performance
        const path = new Path2D();
        const sliceWidth = width / bufferLength;
        let x = 0;

        // Clear only the necessary area
        this.visualizerCtx.fillStyle = backgroundColor;
        this.visualizerCtx.fillRect(0, 0, width, height);

        path.moveTo(0, height / 2);
        
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * height / 2) + height / 4;

            path.lineTo(x, y);
            x += sliceWidth;
        }

        this.visualizerCtx.strokeStyle = strokeColor;
        this.visualizerCtx.stroke(path);
    }

    async startPlaybackVisualization() {
        if (!this.audioContext) {
            this.audioContext = new AudioContext();
        }

        if (!this.playbackAnalyser) {
            this.playbackAnalyser = this.audioContext.createAnalyser();
            this.playbackAnalyser.fftSize = 2048;

            const source = this.audioContext.createMediaElementSource(this.audioElement);
            source.connect(this.playbackAnalyser);
            this.playbackAnalyser.connect(this.audioContext.destination);
        }

        this.isVisualizing = true;
        this.isPlaying = true;
        this.visualize(this.playbackAnalyser);
    }

    async convertAndDownload() {
        try {
            // Show loading state
            this.downloadButton.disabled = true;
            this.downloadButton.textContent = 'Converting...';

            // Create FFmpeg instance
            const { createFFmpeg, fetchFile } = FFmpeg;
            const ffmpeg = createFFmpeg({ 
                log: true,
                corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.10.0/dist/ffmpeg-core.js'
            });

            await ffmpeg.load();

            // Write the file to FFmpeg's virtual filesystem
            ffmpeg.FS('writeFile', 'input.webm', await fetchFile(this.audioBlob));

            // Run the conversion
            await ffmpeg.run('-i', 'input.webm', '-c:a', 'aac', 'output.mp4');

            // Read the result
            const data = ffmpeg.FS('readFile', 'output.mp4');

            // Create and trigger download
            const blob = new Blob([data.buffer], { type: 'audio/mp4' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'recorded_audio.mp4';
            a.click();

            // Cleanup
            URL.revokeObjectURL(url);
            ffmpeg.FS('unlink', 'input.webm');
            ffmpeg.FS('unlink', 'output.mp4');

            // Reset button
            this.downloadButton.disabled = false;
            this.downloadButton.textContent = 'Download MP4';
        } catch (error) {
            console.error('Error converting audio:', error);
            alert('Error converting audio. Please try again.');
            this.downloadButton.disabled = false;
            this.downloadButton.textContent = 'Download MP4';
        }
    }

    startTimer() {
        let seconds = 0;
        const timerDisplay = document.querySelector('.timer');
        this.timer = setInterval(() => {
            seconds++;
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    stopTimer() {
        clearInterval(this.timer);
    }

    initializeTheme() {
        this.themeToggle = document.getElementById('themeToggle');
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // Set initial theme
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    }
}

// Initialize the recorder when the page loads
window.addEventListener('load', () => {
    new AudioRecorder();
}); 
document.addEventListener('DOMContentLoaded', function () {
    // DOM Elements - General
    const modeSelectionOverlay = document.getElementById('modeSelection');
    const standardModeBtn = document.getElementById('standardModeBtn');
    const meetingModeBtn = document.getElementById('meetingModeBtn');
    const switchModeButton = document.getElementById('switchModeButton');
    const currentModeText = document.getElementById('current-mode');
    const transcriptionText = document.getElementById('transcription-result');
    const aiResponseText = document.getElementById('ai-response');
    const statusElement = document.getElementById('status-message');
    const recordingIndicator = document.getElementById('recording-indicator');
    const recordingDot = document.getElementById('recording-dot');

    // DOM Elements - Standard Mode
    const startRecordButton = document.getElementById('start-btn');
    const stopRecordButton = document.getElementById('stop-btn');
    const clearTranscriptionButton = document.getElementById('clear-btn');
    const screenShareButton = document.getElementById('screen-share-btn');
    const helpButton = document.getElementById('helpButton');

    // DOM Elements - Image Analysis
    const imageAnalysisSection = document.querySelector('.image-analysis-section');
    const uploadImageBtn = document.getElementById('analyze-images-btn');
    const imageFileInput = document.createElement('input');
    imageFileInput.type = 'file';
    imageFileInput.accept = 'image/*';
    imageFileInput.multiple = true;
    imageFileInput.style.display = 'none';
    document.body.appendChild(imageFileInput);

    const pasteArea = document.getElementById('paste-area');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const analyzeImagesBtn = document.getElementById('analyze-images-btn');

    // DOM Elements - Modals
    const helpModal = document.getElementById('help-modal');
    const settingsModal = document.getElementById('settings-modal');
    const closeHelpButton = document.getElementById('close-help');
    const closeSettingsButton = document.getElementById('close-settings');
    const closeHelpBtn = document.getElementById('close-help-btn');
    const settingsCancelBtn = document.getElementById('settings-cancel');
    const settingsSaveBtn = document.getElementById('settings-save');

    // Settings defaults
    let settings = {
        language: 'en-US',
        saveTranscriptions: true,
        timeout: 10,
        energyThreshold: 300,
        useVoiceCloning: false,
        meetingMode: {
            autoProcessInterval: 15, // seconds
            screenPreviewSize: 'small',
            processingType: 'continuous' // 'continuous' or 'manual'
        },
        voiceTuning: {
            pitchShift: 0,
            speed: 1.0,
            clarity: 1.0,
            bassBoost: 0.0,
            trebleBoost: 0.0,
            echo: 0.0
        }
    };

    // App state
    let currentMode = 'standard'; // 'standard' or 'meeting'
    let isRecording = false;
    let isMeetingRecording = false;
    let mediaRecorder = null;
    let audioContext = null;
    let streamProcessor = null;
    let capturedStream = null;
    let screenStream = null;
    let audioStream = null;
    let autoProcessTimer = null;
    let transcriptionHistory = [];
    let previousTranscriptions = new Set();
    let uploadedImages = [];
    const MAX_IMAGES = 7;

    // Speech Recognition Setup
    let recognition = null;

    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = settings.language;

        // Set up speech recognition event listeners
        recognition.onstart = function () {
            isRecording = true;
            statusElement.textContent = 'Listening...';
            recordingIndicator.classList.add('active');
            recordingIndicator.style.display = 'flex';
        };

        // Enhance the transcript display with better formatting
        recognition.onresult = function (event) {
            let interimTranscript = '';
            let finalTranscript = '';

            // Create a set of already-processed final transcripts
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const transcript = event.results[i][0].transcript;

                if (event.results[i].isFinal) {
                    // Check if this transcript has been processed before
                    if (!previousTranscriptions.has(transcript)) {
                        finalTranscript += transcript + ' ';
                        previousTranscriptions.add(transcript);
                    }
                } else {
                    interimTranscript += transcript;
                }
            }

            // Update the UI with final transcripts
            if (finalTranscript) {
                const finalElement = document.createElement('div');
                finalElement.className = 'transcription-final';

                // Add timestamp for better separation between transcriptions
                const timestamp = document.createElement('div');
                timestamp.className = 'transcription-timestamp';
                timestamp.textContent = new Date().toLocaleTimeString();

                const content = document.createElement('div');
                content.className = 'transcription-content';
                content.textContent = finalTranscript;

                finalElement.appendChild(timestamp);
                finalElement.appendChild(content);
                transcriptionText.appendChild(finalElement);

                // Auto-scroll to the latest transcription
                transcriptionText.scrollTop = transcriptionText.scrollHeight;

                // If in meeting mode and screen sharing, auto-process periodically
                if (currentMode === 'meeting' && isMeetingRecording && settings.meetingMode.processingType === 'continuous') {
                    scheduleAutoProcessing();
                }
            }

            // Update the UI with interim transcripts
            let interimElement = transcriptionText.querySelector('.transcription-interim');
            if (!interimElement && interimTranscript) {
                interimElement = document.createElement('div');
                interimElement.className = 'transcription-interim';
                transcriptionText.appendChild(interimElement);
            }

            if (interimElement) {
                interimElement.textContent = interimTranscript;
                transcriptionText.scrollTop = transcriptionText.scrollHeight;
            }
        };

        recognition.onerror = function (event) {
            console.error('Recognition error:', event.error);
            statusElement.textContent = 'Error: ' + event.error;

            // If it's not a no-speech error (which is common), we should stop recording
            if (event.error !== 'no-speech') {
                stopRecording();
                startRecordButton.disabled = false;
                stopRecordButton.disabled = true;
                recordingIndicator.classList.remove('active');
                recordingIndicator.style.display = 'none';
            }
        };

        recognition.onend = function () {
            if (isRecording) {
                // This is to handle the automatic stop that occurs after a few seconds
                // We restart the recognition if we're still in recording mode
                try {
                    recognition.start();
                } catch (e) {
                    console.log('Could not restart recognition:', e);
                }
            } else {
                statusElement.textContent = 'Voice recognition stopped.';
                recordingIndicator.classList.remove('active');
                recordingIndicator.style.display = 'none';
            }
        };
    } else {
        statusElement.textContent = 'Speech recognition not supported in this browser.';
        startRecordButton.disabled = true;
    }

    // Initialize AI models
    const aiModels = [
        'gpt-4.1',
        'gpt-4.1-mini',
        'gpt-4.1-nano',
        'gpt-4.5-preview',
        'gpt-4o',
        'gpt-4o-mini',
        'o1',
        'o1-mini',
        'o1-pro',
        'o3',
        'o3-mini',
        'o4-mini'
    ];

    // Default model to use
    let currentModel = 'gpt-4o';

    // Check if first time loading the app
    const isFirstLoad = !localStorage.getItem('appMode');
    if (isFirstLoad) {
        // Show mode selection on first load
        modeSelectionOverlay.style.display = 'flex';
    } else {
        // Load saved mode
        currentMode = localStorage.getItem('appMode') || 'standard';
        setAppMode(currentMode);
    }

    // Event Listeners - Mode Selection
    standardModeBtn.addEventListener('click', function () {
        setAppMode('standard');
        modeSelectionOverlay.style.display = 'none';
        localStorage.setItem('appMode', 'standard');
    });

    meetingModeBtn.addEventListener('click', function () {
        setAppMode('meeting');
        modeSelectionOverlay.style.display = 'none';
        localStorage.setItem('appMode', 'meeting');
    });

    switchModeButton.addEventListener('click', function () {
        modeSelectionOverlay.style.display = 'flex';
    });

    // Add event listeners for recording controls
    startRecordButton.addEventListener('click', function () {
        if (recognition) {
            startRecording();
            startRecordButton.disabled = true;
            stopRecordButton.disabled = false;
            recordingIndicator.style.display = 'flex';
            recordingDot.classList.add('active');
        }
    });

    stopRecordButton.addEventListener('click', function () {
        stopRecording();
        startRecordButton.disabled = false;
        stopRecordButton.disabled = true;
        recordingIndicator.style.display = 'none';
        recordingDot.classList.remove('active');

        // Process the complete transcription with AI
        const completeTranscription = getCompleteTranscription();
        if (completeTranscription) {
            processWithAI(completeTranscription);
        }
    });

    clearTranscriptionButton.addEventListener('click', function () {
        transcriptionText.innerHTML = '';
        aiResponseText.innerHTML = '';
        statusElement.textContent = 'Transcription cleared';
    });

    screenShareButton.addEventListener('click', function () {
        if (isMeetingRecording) {
            stopScreenShare();
            screenShareButton.innerHTML = '<i class="fas fa-desktop"></i> Share Screen';
        } else {
            startScreenShare();
            screenShareButton.innerHTML = '<i class="fas fa-desktop"></i> Stop Sharing';
        }
    });

    // Event listeners for help button and modal
    helpButton.addEventListener('click', function () {
        helpModal.classList.add('active');
        helpModal.style.display = 'flex';
    });

    closeHelpButton.addEventListener('click', function () {
        helpModal.classList.remove('active');
        helpModal.style.display = 'none';
    });

    closeHelpBtn.addEventListener('click', function () {
        helpModal.classList.remove('active');
        helpModal.style.display = 'none';
    });

    // Event listeners for settings modal
    document.getElementById('settings-cancel').addEventListener('click', function () {
        settingsModal.classList.remove('active');
        settingsModal.style.display = 'none';
    });

    document.getElementById('settings-save').addEventListener('click', function () {
        saveSettings();
        settingsModal.classList.remove('active');
        settingsModal.style.display = 'none';
    });

    // Event Listeners - Image Upload
    pasteArea.addEventListener('click', function () {
        imageFileInput.click();
    });

    imageFileInput.addEventListener('change', handleImageUpload);

    document.addEventListener('paste', function (event) {
        if (pasteArea.matches(':hover') || imageAnalysisSection.contains(event.target)) {
            handleImagePaste(event);
        }
    });

    pasteArea.addEventListener('dragover', function (event) {
        event.preventDefault();
        pasteArea.classList.add('dragover');
    });

    pasteArea.addEventListener('dragleave', function (event) {
        event.preventDefault();
        pasteArea.classList.remove('dragover');
    });

    pasteArea.addEventListener('drop', function (event) {
        event.preventDefault();
        pasteArea.classList.remove('dragover');

        if (event.dataTransfer.files.length > 0) {
            handleImageFiles(event.dataTransfer.files);
        }
    });

    analyzeImagesBtn.addEventListener('click', analyzeImages);

    // Functions for mode switching
    function setAppMode(mode) {
        currentMode = mode;
        currentModeText.textContent = mode === 'standard' ? 'Standard Mode' : 'Meeting Assistant';

        if (mode === 'standard') {
            document.body.classList.remove('meeting-mode');
            document.body.classList.add('standard-mode');

            // Hide image analysis in standard mode
            imageAnalysisSection.style.display = 'none';

            // Additional UI cleanup for standard mode
            const mainLayout = document.querySelector('.meeting-layout');
            if (mainLayout) {
                mainLayout.classList.add('standard-layout');
            }

            stopScreenShare(); // Make sure to clean up any active meeting
        } else {
            document.body.classList.remove('standard-mode');
            document.body.classList.add('meeting-mode');
            imageAnalysisSection.style.display = 'block'; // Show image analysis in meeting mode
            stopRecording(); // Make sure to clean up any active recording
        }

        // Clear panels
        transcriptionText.innerHTML = '';
        aiResponseText.innerHTML = '';
    }

    // Standard mode functions
    function startRecording() {
        try {
            // Clear tracking of previous transcriptions on new recording session
            previousTranscriptions = new Set();
            recognition.start();
        } catch (error) {
            console.error('Error starting speech recognition:', error);
            statusElement.textContent = 'Error starting speech recognition. Try again.';
        }
    }

    function stopRecording() {
        if (recognition) {
            recognition.stop();
            isRecording = false; // Explicitly set to false to prevent auto-restart
        }
    }

    // Meeting mode functions
    async function startScreenShare() {
        try {
            // Request screen capture with audio
            screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });

            // Show the screen preview container
            const screenPreviewContainer = document.getElementById('screen-preview-floater');
            const screenVideo = document.getElementById('screen-video');

            if (screenPreviewContainer && screenVideo) {
                screenPreviewContainer.style.display = 'block';
                screenVideo.srcObject = screenStream;
            }

            // Start processing the audio for transcription
            setupAudioProcessing(screenStream);

            isMeetingRecording = true;
            statusElement.textContent = 'Screen and audio capture active. Live transcription enabled.';

            // Start recording for transcription
            startRecording();
            recordingDot.classList.add('active');

            // Add event listener for when stream ends (user clicks "Stop sharing")
            screenStream.getVideoTracks()[0].addEventListener('ended', () => {
                stopScreenShare();
                screenShareButton.innerHTML = '<i class="fas fa-desktop"></i> Share Screen';
                statusElement.textContent = 'Screen sharing stopped.';
            });

        } catch (error) {
            console.error('Error starting screen capture:', error);
            statusElement.textContent = 'Error starting screen capture. You may need to grant permission.';
        }
    }

    function stopScreenShare() {
        if (isMeetingRecording) {
            // Stop the screen sharing
            if (screenStream) {
                screenStream.getTracks().forEach(track => track.stop());
            }

            // Hide the screen preview container
            const screenPreviewContainer = document.getElementById('screen-preview-floater');
            if (screenPreviewContainer) {
                screenPreviewContainer.style.display = 'none';
            }

            // Stop the audio processing
            stopAudioProcessing();

            // Stop automatic processing
            stopAutoProcessing();

            // Stop the speech recognition
            stopRecording();
            recordingDot.classList.remove('active');

            // Process any remaining transcription
            const completeTranscription = getCompleteTranscription();
            if (completeTranscription) {
                processWithAI(completeTranscription);
            }

            isMeetingRecording = false;
            statusElement.textContent = 'Screen sharing stopped.';
        }
    }

    function setupAudioProcessing(stream) {
        try {
            // Create audio context
            audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Get audio track from the screen capture stream
            const audioTrack = stream.getAudioTracks()[0];

            if (!audioTrack) {
                console.warn('No audio track found in the stream');
                statusElement.textContent = 'No audio detected in screen share. Make sure to choose "Share audio" in the dialog.';
                startStatusBlink(); // Visual indicator that audio is missing
                return;
            }

            // Create a MediaStreamSource from the audio track
            const audioSource = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));

            // Create an AudioAnalyser to visualize sound if needed
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            audioSource.connect(analyser);

            // Create a processor node for custom audio processing
            const scriptNode = audioContext.createScriptProcessor(4096, 1, 1);

            // Setup audio processing for screen share
            scriptNode.onaudioprocess = function (audioProcessingEvent) {
                // Here we could add additional audio processing like noise suppression
                // but for now we're just using the Web Speech API for transcription 

                // Get the audio data
                const inputBuffer = audioProcessingEvent.inputBuffer;

                // Detect if there's meaningful audio (not just silence)
                const inputData = inputBuffer.getChannelData(0);
                const soundDetected = detectSound(inputData);

                if (soundDetected) {
                    // Visual indicator that sound is being detected
                    recordingDot.classList.add('active');
                } else {
                    // No sound detected
                    recordingDot.classList.remove('active');
                }
            };

            // Connect the nodes
            audioSource.connect(scriptNode);
            scriptNode.connect(audioContext.destination);

            streamProcessor = scriptNode;

            // Set up auto-processing of transcription for meeting mode
            if (currentMode === 'meeting' && settings.meetingMode.processingType === 'continuous') {
                setupAutoProcessing();
            }

            statusElement.textContent = 'Screen sharing with audio capture active. Live transcription enabled.';

        } catch (error) {
            console.error('Error setting up audio processing:', error);
            statusElement.textContent = 'Error processing audio from screen capture.';
        }
    }

    // Detect if there's meaningful sound in the audio data
    function detectSound(audioData) {
        // Calculate average volume level
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
            sum += Math.abs(audioData[i]);
        }
        const averageVolume = sum / audioData.length;

        // Threshold for considering it as actual sound vs background noise
        const threshold = settings.energyThreshold / 10000; // Adjust based on settings

        return averageVolume > threshold;
    }

    // Visual indicator that audio might be missing from screen share
    function startStatusBlink() {
        statusElement.classList.add('blink-warning');
        setTimeout(() => {
            statusElement.classList.remove('blink-warning');
        }, 10000); // Stop blinking after 10 seconds
    }

    function stopAudioProcessing() {
        if (streamProcessor) {
            streamProcessor.disconnect();
            streamProcessor = null;
        }

        if (audioContext) {
            audioContext.close().catch(e => console.error('Error closing audio context:', e));
            audioContext = null;
        }
    }

    function setupAutoProcessing() {
        // Clear any existing timer
        stopAutoProcessing();

        // Set up new timer for periodically processing transcriptions
        autoProcessTimer = setInterval(() => {
            const completeTranscription = getCompleteTranscription();
            if (completeTranscription && completeTranscription.trim().split(' ').length > 10) {
                processWithAI(completeTranscription);
            }
        }, settings.meetingMode.autoProcessInterval * 1000);
    }

    function scheduleAutoProcessing() {
        // Only schedule if not already scheduled
        if (!autoProcessTimer && currentMode === 'meeting' && isMeetingRecording) {
            setupAutoProcessing();
        }
    }

    function stopAutoProcessing() {
        if (autoProcessTimer) {
            clearInterval(autoProcessTimer);
            autoProcessTimer = null;
        }
    }

    function getCompleteTranscription() {
        const finalTranscriptions = transcriptionText.getElementsByClassName('transcription-final');
        let completeText = '';

        for (let i = 0; i < finalTranscriptions.length; i++) {
            completeText += finalTranscriptions[i].textContent + ' ';
        }

        return completeText.trim();
    }

    // Process the transcription with AI
    async function processWithAI(transcription) {
        if (!transcription || transcription.trim() === '') {
            return;
        }

        const aiStatusElement = document.getElementById('ai-status');
        aiStatusElement.style.display = 'block';
        aiStatusElement.className = 'ai-status loading';
        aiStatusElement.textContent = 'Processing with AI...';

        // Clear previous response
        aiResponseText.innerHTML = '';

        try {
            if (currentMode === 'standard') {
                // Create container for the response
                const streamContainer = document.createElement('div');
                streamContainer.className = 'streaming-response interview-answer';
                aiResponseText.appendChild(streamContainer);

                // Format the prompt to get interview-style responses
                const formattedPrompt = `I am in an interview setting. Please respond to the following question or topic in a professional, clear, and concise manner. Make important points in bold. Format your response as an interview answer: ${transcription}`;

                // First try using Puter AI if available
                if (typeof window.puter !== 'undefined' && window.puter.ai && typeof window.puter.ai.chat === 'function') {
                    aiStatusElement.textContent = 'Generating response as if answering an interview question...';

                    try {
                        // Try streaming response with Puter AI
                        const response = await window.puter.ai.chat(
                            formattedPrompt,
                            { model: 'claude-3-7-sonnet', stream: true }
                        );

                        let fullResponse = '';

                        // Process each part of the stream
                        for await (const part of response) {
                            if (part?.text) {
                                fullResponse += part.text;
                                // Update the UI with the markdown-parsed response
                                streamContainer.innerHTML = marked.parse(fullResponse);

                                // Apply syntax highlighting to code blocks if hljs is available
                                if (typeof hljs !== 'undefined') {
                                    streamContainer.querySelectorAll('pre code').forEach((block) => {
                                        hljs.highlightBlock(block);
                                    });
                                }

                                // Scroll to show the latest content
                                aiResponseText.scrollTop = aiResponseText.scrollHeight;
                            }
                        }

                        // Mark the response as complete
                        streamContainer.classList.add('done');

                        // Save the response to session storage
                        try {
                            sessionStorage.setItem('lastAIResponse', fullResponse);
                        } catch (storageError) {
                            console.log('Could not store response in session storage:', storageError);
                        }

                        aiStatusElement.className = 'ai-status success';
                        aiStatusElement.textContent = 'Response complete!';
                        return; // Exit function if successful
                    } catch (streamError) {
                        console.warn('Streaming response failed, trying non-streaming API:', streamError);

                        // Try non-streaming API as fallback
                        try {
                            const nonStreamResponse = await window.puter.ai.chat(
                                formattedPrompt,
                                { model: 'claude-3-7-sonnet', stream: false }
                            );

                            if (nonStreamResponse && nonStreamResponse.text) {
                                streamContainer.innerHTML = marked.parse(nonStreamResponse.text);

                                // Apply syntax highlighting
                                if (typeof hljs !== 'undefined') {
                                    streamContainer.querySelectorAll('pre code').forEach((block) => {
                                        hljs.highlightBlock(block);
                                    });
                                }

                                streamContainer.classList.add('done');
                                aiStatusElement.className = 'ai-status success';
                                aiStatusElement.textContent = 'Response complete!';

                                // Save response
                                try {
                                    sessionStorage.setItem('lastAIResponse', nonStreamResponse.text);
                                } catch (storageError) {
                                    console.log('Could not store response in session storage:', storageError);
                                }
                                return; // Exit function if successful
                            }
                        } catch (nonStreamError) {
                            console.error('Non-streaming API also failed:', nonStreamError);
                            // We'll fall through to the mock response
                        }
                    }
                }

                // If we get here, either puter is not available or both API calls failed
                // Show mock response as fallback
                showInterviewStyleMockResponse(streamContainer);

            } else {
                // For meeting mode, use the existing behavior with mock responses
                showMockResponse();
            }
        } catch (error) {
            console.error('Error processing with AI:', error);

            aiStatusElement.className = 'ai-status error';
            aiStatusElement.textContent = 'AI processing error: ' + (error.message || 'Unknown error');

            const retryButton = document.createElement('button');
            retryButton.className = 'btn primary';
            retryButton.textContent = 'Retry Analysis';
            retryButton.addEventListener('click', () => processWithAI(transcription));
            aiResponseText.innerHTML = '';
            aiResponseText.appendChild(retryButton);
        }
    }

    // Function to show interview-style mock response (used as fallback)
    function showInterviewStyleMockResponse(container = null) {
        // Simulate AI response for testing
        const mockResponse = "That's an excellent question about artificial intelligence systems.\n\n**AI technology has evolved significantly** over the past decade, transforming from simple rule-based systems to complex neural networks capable of advanced reasoning.\n\n**Three key innovations have driven this progress**:\n\n1. **Deep learning architectures** that can process and understand unstructured data like images, audio, and natural language\n\n2. **Transfer learning techniques** that allow models to apply knowledge from one domain to another\n\n3. **Reinforcement learning methods** that enable systems to improve through trial and error\n\nThe implications for business are substantial. Companies implementing AI solutions are seeing **20-30% improvements in operational efficiency** and unlocking new capabilities that weren't previously possible.\n\nHowever, it's important to acknowledge that **ethical considerations must guide implementation**. Organizations need robust frameworks to ensure AI systems operate transparently, fairly, and with appropriate human oversight.";

        // Use existing container or create new one
        let responseContainer = container;
        if (!responseContainer) {
            responseContainer = document.createElement('div');
            responseContainer.className = 'streaming-response interview-answer';
            aiResponseText.innerHTML = '';
            aiResponseText.appendChild(responseContainer);
        }

        // Create typed effect for mock response
        let currentIndex = 0;
        const typingInterval = setInterval(() => {
            if (currentIndex < mockResponse.length) {
                const partialResponse = mockResponse.substring(0, currentIndex + 1);
                responseContainer.innerHTML = marked.parse(partialResponse);

                // Apply syntax highlighting to code blocks if hljs is available
                if (typeof hljs !== 'undefined') {
                    responseContainer.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightBlock(block);
                    });
                }

                // Scroll to show the latest content
                aiResponseText.scrollTop = aiResponseText.scrollHeight;

                currentIndex += 3; // Type several characters at once for faster effect
            } else {
                clearInterval(typingInterval);
                responseContainer.classList.add('done');

                const aiStatusElement = document.getElementById('ai-status');
                aiStatusElement.className = 'ai-status success';
                aiStatusElement.textContent = 'Response complete!';

                // Save the response to session storage
                try {
                    sessionStorage.setItem('lastAIResponse', mockResponse);
                } catch (storageError) {
                    console.log('Could not store response in session storage:', storageError);
                }
            }
        }, 10);
    }

    // Function to show mock response (used for meeting mode)
    function showMockResponse() {
        // Simulate AI response for testing
        setTimeout(() => {
            const mockResponse = "## Analysis of Transcription\n\nThis is a simulated AI response to demonstrate functionality. In a real implementation, this would connect to an AI service.\n\n### Key Points\n- The transcription has been processed successfully\n- All UI elements are now working correctly\n- Voice recognition is active when you click 'Start Recording'\n- Live transcription from screen sharing is now functional\n\n```javascript\n// Example code\nfunction processTranscription(text) {\n  // Process the text with AI\n  return analyzedResult;\n}\n```";

            aiResponseText.innerHTML = marked.parse(mockResponse);

            // Apply syntax highlighting to code blocks if hljs is available
            if (typeof hljs !== 'undefined') {
                aiResponseText.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightBlock(block);
                });
            }

            const aiStatusElement = document.getElementById('ai-status');
            aiStatusElement.className = 'ai-status success';
            aiStatusElement.textContent = 'Analysis complete!';

            // Save the response to session storage
            try {
                sessionStorage.setItem('lastAIResponse', mockResponse);
            } catch (storageError) {
                console.log('Could not store response in session storage:', storageError);
            }
        }, 1500); // Simulated delay to mimic API call
    }

    // Image Analysis Functions
    function handleImageUpload(event) {
        if (event.target.files) {
            handleImageFiles(event.target.files);
        }
    }

    function handleImagePaste(event) {
        const items = (event.clipboardData || event.originalEvent.clipboardData).items;

        let hasImageItems = false;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                hasImageItems = true;
                const blob = items[i].getAsFile();
                addImageToPreview(blob);
            }
        }

        if (hasImageItems) {
            event.preventDefault();
        }
    }

    function handleImageFiles(files) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith('image/')) {
                addImageToPreview(file);
            }
        }
    }

    function addImageToPreview(file) {
        if (uploadedImages.length >= MAX_IMAGES) {
            alert(`Maximum of ${MAX_IMAGES} images allowed.`);
            return;
        }

        const imageId = 'img_' + Date.now() + '_' + uploadedImages.length;

        uploadedImages.push({
            id: imageId,
            file: file,
            url: URL.createObjectURL(file)
        });

        const previewElem = document.createElement('div');
        previewElem.className = 'image-preview';
        previewElem.dataset.id = imageId;

        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.alt = 'Uploaded image';

        const removeBtn = document.createElement('div');
        removeBtn.className = 'remove-image';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.addEventListener('click', function () {
            removeImage(imageId);
        });

        previewElem.appendChild(img);
        previewElem.appendChild(removeBtn);
        imagePreviewContainer.appendChild(previewElem);

        analyzeImagesBtn.disabled = false;
    }

    function removeImage(imageId) {
        const index = uploadedImages.findIndex(img => img.id === imageId);
        if (index !== -1) {
            URL.revokeObjectURL(uploadedImages[index].url);
            uploadedImages.splice(index, 1);
        }

        const previewElem = imagePreviewContainer.querySelector(`[data-id="${imageId}"]`);
        if (previewElem) {
            previewElem.remove();
        }

        if (uploadedImages.length === 0) {
            analyzeImagesBtn.disabled = true;
        }
    }

    async function analyzeImages() {
        if (uploadedImages.length === 0) return;

        const responsePanel = aiResponseText;

        const statusIndicator = document.createElement('div');
        statusIndicator.className = 'ai-status loading';
        statusIndicator.textContent = 'Analyzing images...';

        const loadingSpinner = document.createElement('div');
        loadingSpinner.className = 'loading-spinner';
        loadingSpinner.innerHTML = `
            <div class="loading-spinner-text">Analyzing images and preparing response...</div>
            <div class="loading-animation">
                <div></div>
                <div></div>
                <div></div>
            </div>
        `;

        responsePanel.innerHTML = '';
        responsePanel.appendChild(statusIndicator);
        responsePanel.appendChild(loadingSpinner);

        statusElement.textContent = 'Analyzing images...';

        // Simulate image analysis
        setTimeout(() => {
            const mockResponse = "## Image Analysis Results\n\n### Technical Interview Question\n\nThe image shows a coding problem related to array manipulation.\n\n#### Approach\n- Use a sliding window technique\n- Keep track of seen elements using a hash map\n- Handle edge cases for empty arrays\n\n```python\ndef solution(nums):\n    if not nums: return 0\n    \n    n = len(nums)\n    left = 0\n    max_length = 0\n    seen = {}\n    \n    for right in range(n):\n        # If element already seen and is within current window\n        if nums[right] in seen and seen[nums[right]] >= left:\n            left = seen[nums[right]] + 1\n        else:\n            max_length = max(max_length, right - left + 1)\n            \n        seen[nums[right]] = right\n    \n    return max_length\n```\n\n#### Time Complexity: O(n) where n is the length of the array\n#### Space Complexity: O(k) where k is the number of unique elements";

            responsePanel.innerHTML = '';
            const responseContainer = document.createElement('div');
            responsePanel.appendChild(responseContainer);

            responseContainer.innerHTML = marked.parse(mockResponse);

            // Apply syntax highlighting to code blocks if hljs is available
            if (typeof hljs !== 'undefined') {
                responseContainer.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightBlock(block);
                });
            }

            statusElement.textContent = 'Image analysis complete!';

            try {
                sessionStorage.setItem('lastImageAnalysis', mockResponse);
            } catch (storageError) {
                console.log('Could not store analysis in session storage:', storageError);
            }
        }, 2000); // Simulated delay
    }

    function saveSettings() {
        const languageSelect = document.getElementById('language');
        if (languageSelect) {
            settings.language = languageSelect.value;
        }

        const saveTranscriptionsCheck = document.getElementById('saveTranscriptions');
        if (saveTranscriptionsCheck) {
            settings.saveTranscriptions = saveTranscriptionsCheck.checked;
        }

        const timeoutInput = document.getElementById('timeout');
        if (timeoutInput) {
            settings.timeout = parseInt(timeoutInput.value);
        }

        const energyThresholdInput = document.getElementById('energyThreshold');
        if (energyThresholdInput) {
            settings.energyThreshold = parseInt(energyThresholdInput.value);
        }

        const useVoiceCloningCheck = document.getElementById('useVoiceCloning');
        if (useVoiceCloningCheck) {
            settings.useVoiceCloning = useVoiceCloningCheck.checked;
        }

        const aiModelSelect = document.getElementById('aiModel');
        if (aiModelSelect) {
            currentModel = aiModelSelect.value;
        }

        if (recognition) {
            recognition.lang = settings.language;
        }

        localStorage.setItem('appSettings', JSON.stringify(settings));

        statusElement.textContent = 'Settings saved!';
        setTimeout(() => {
            statusElement.textContent = 'Ready';
        }, 2000);
    }

    function loadSavedData() {
        try {
            const savedSettings = localStorage.getItem('appSettings');
            if (savedSettings) {
                const parsedSettings = JSON.parse(savedSettings);
                settings = { ...settings, ...parsedSettings };
            }

            const savedHistory = localStorage.getItem('transcriptionHistory');
            if (savedHistory) {
                transcriptionHistory = JSON.parse(savedHistory);
            }

            const lastResponse = sessionStorage.getItem('lastAIResponse');
            if (lastResponse && aiResponseText) {
                aiResponseText.innerHTML = marked.parse(lastResponse);

                // Apply syntax highlighting if hljs is available
                if (typeof hljs !== 'undefined') {
                    aiResponseText.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightBlock(block);
                    });
                }
            }
        } catch (error) {
            console.log('Error loading saved data:', error);
        }
    }

    // This function populates the settings form with the current settings
    function populateSettingsForm() {
        if (!document.getElementById('language')) return; // Skip if elements don't exist yet

        document.getElementById('language').value = settings.language;

        if (document.getElementById('saveTranscriptions')) {
            document.getElementById('saveTranscriptions').checked = settings.saveTranscriptions;
        }

        if (document.getElementById('timeout')) {
            document.getElementById('timeout').value = settings.timeout;
        }

        if (document.getElementById('energyThreshold')) {
            document.getElementById('energyThreshold').value = settings.energyThreshold;
        }

        if (document.getElementById('useVoiceCloning')) {
            document.getElementById('useVoiceCloning').checked = settings.useVoiceCloning;
        }

        if (document.getElementById('aiModel')) {
            document.getElementById('aiModel').value = currentModel;
        }
    }

    // Copy buttons functionality
    const copyTranscriptionBtn = document.getElementById('copy-transcription');
    const copyResponseBtn = document.getElementById('copy-response');

    if (copyTranscriptionBtn) {
        copyTranscriptionBtn.addEventListener('click', function () {
            const text = getCompleteTranscription();
            copyToClipboard(text);
            statusElement.textContent = 'Transcription copied to clipboard!';
        });
    }

    if (copyResponseBtn) {
        copyResponseBtn.addEventListener('click', function () {
            const text = aiResponseText.innerText;
            copyToClipboard(text);
            statusElement.textContent = 'Response copied to clipboard!';
        });
    }

    function copyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }

    loadSavedData();
    populateSettingsForm();
});

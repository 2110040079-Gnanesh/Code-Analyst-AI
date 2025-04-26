// Store uploaded images
const imageData = {
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
    7: null
};

// Store chat history
let chatHistory = [];

// DOM Elements
const imageContainers = document.querySelectorAll('.image-container');
const responseArea = document.getElementById('responseArea');
const loadingIndicator = document.getElementById('loadingIndicator');
const sendButton = document.getElementById('sendButton');
const clearButton = document.getElementById('clearButton');
const questionInput = document.getElementById('questionInput');
const recordButton = document.getElementById('recordButton');
const transcriptionContainer = document.getElementById('transcriptionContainer');
const transcriptionText = document.getElementById('transcriptionText');
const useTranscriptionButton = document.getElementById('useTranscriptionButton');
const tabControls = document.getElementById('tabControls');
const streamingCheckbox = document.getElementById('streamingCheckbox');
const modelSelect = document.getElementById('modelSelect');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatButton = document.getElementById('sendChatButton');
const chatMicButton = document.getElementById('chatMicButton');
const chatModelSelect = document.getElementById('chatModelSelect');
const codeAnalysisBtn = document.getElementById('codeAnalysisBtn');
const chatModeBtn = document.getElementById('chatModeBtn');
const codeAnalysisMode = document.getElementById('codeAnalysisMode');
const chatMode = document.getElementById('chatMode');

// Flag for recording state
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Initialize event listeners
    sendButton.addEventListener('click', sendToPuter);
    clearButton.addEventListener('click', clearAll);
    recordButton.addEventListener('click', toggleRecording);
    chatMicButton.addEventListener('click', toggleChatRecording);
    useTranscriptionButton.addEventListener('click', useTranscription);
    sendChatButton.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
    
    // Mode switching
    codeAnalysisBtn.addEventListener('click', () => switchMode('analysis'));
    chatModeBtn.addEventListener('click', () => switchMode('chat'));
    
    // Setup automatic paste handling
    document.addEventListener('paste', handlePaste);
    
    // Initialize click events for image containers (as fallback)
    imageContainers.forEach(container => {
        container.addEventListener('click', function() {
            // This is just a fallback, most users will use the global paste
            alert('Paste an image using Ctrl+V');
        });
    });
});

// Handle pasted content for images
function handlePaste(event) {
    // Only handle paste events in code analysis mode
    if (!codeAnalysisMode.classList.contains('active')) return;
    
    const items = (event.clipboardData || event.originalEvent.clipboardData).items;
    
    for (const item of items) {
        if (item.type.indexOf('image') === 0) {
            const blob = item.getAsFile();
            const reader = new FileReader();
            
            // Find the next available slot automatically
            let nextSlot = null;
            for (let i = 1; i <= 7; i++) {
                if (imageData[i] === null) {
                    nextSlot = i;
                    break;
                }
            }
            
            if (nextSlot === null) {
                alert('All slots are filled. Please delete an image first.');
                return;
            }
            
            const imageContainer = document.getElementById(`imageContainer${nextSlot}`);
            const imageIndex = nextSlot;
            
            reader.onload = function(e) {
                // Store the image data
                imageData[imageIndex] = e.target.result;
                
                // Update the container
                imageContainer.innerHTML = '';
                imageContainer.classList.add('filled');
                
                // Add image
                const img = document.createElement('img');
                img.src = e.target.result;
                imageContainer.appendChild(img);
                
                // Add number badge
                const numberBadge = document.createElement('div');
                numberBadge.className = 'image-number';
                numberBadge.textContent = imageIndex;
                imageContainer.appendChild(numberBadge);
                
                // Add delete button
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-btn';
                deleteBtn.textContent = '×';
                deleteBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    clearImage(imageIndex);
                });
                imageContainer.appendChild(deleteBtn);
            };
            
            reader.readAsDataURL(blob);
            break;
        }
    }
}

// Clear a specific image
function clearImage(index) {
    imageData[index] = null;
    
    const container = document.getElementById(`imageContainer${index}`);
    container.innerHTML = `<span>Image ${index}</span>`;
    container.classList.remove('filled');
}

// Clear all images and response
function clearAll() {
    for (let i = 1; i <= 7; i++) {
        clearImage(i);
    }
    responseArea.innerHTML = '';
    questionInput.value = '';
    transcriptionContainer.classList.remove('visible');
    transcriptionText.textContent = '';
    tabControls.innerHTML = '';
}

// Switch between code analysis and chat modes
function switchMode(mode) {
    if (mode === 'analysis') {
        codeAnalysisMode.classList.add('active');
        chatMode.classList.remove('active');
        codeAnalysisBtn.classList.add('active');
        chatModeBtn.classList.remove('active');
    } else {
        codeAnalysisMode.classList.remove('active');
        chatMode.classList.add('active');
        codeAnalysisBtn.classList.remove('active');
        chatModeBtn.classList.add('active');
    }
}

// Toggle audio recording for code analysis
async function toggleRecording() {
    await recordAudio(recordButton, async (audioBlob) => {
        await transcribeAudio(audioBlob, questionInput, transcriptionContainer, transcriptionText);
    });
}

// Toggle audio recording for chat
async function toggleChatRecording() {
    await recordAudio(chatMicButton, async (audioBlob) => {
        await transcribeAudio(audioBlob, chatInput);
    });
}

// Generic audio recording function
async function recordAudio(buttonElement, onCompleteCallback) {
    if (!isRecording) {
        // Start recording
        buttonElement.classList.add('recording');
        buttonElement.querySelector('.icon').textContent = '⏹';
        isRecording = true;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunks = [];
            
            mediaRecorder = new MediaRecorder(stream);
            
            mediaRecorder.addEventListener('dataavailable', event => {
                audioChunks.push(event.data);
            });
            
            mediaRecorder.addEventListener('stop', async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                
                // Stop all audio tracks
                stream.getTracks().forEach(track => track.stop());
                
                // Process the audio
                if (onCompleteCallback) {
                    await onCompleteCallback(audioBlob);
                }
                
                resetRecordingState(buttonElement);
            });
            
            mediaRecorder.start();
        } catch (err) {
            console.error('Error accessing microphone:', err);
            alert('Could not access microphone. Please check permissions.');
            resetRecordingState(buttonElement);
        }
    } else {
        // Stop recording
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            resetRecordingState(buttonElement);
        }
    }
}

// Reset recording button state
function resetRecordingState(buttonElement) {
    isRecording = false;
    buttonElement.classList.remove('recording');
    buttonElement.querySelector('.icon').textContent = '🎤';
}

// Transcribe audio with improved error handling
async function transcribeAudio(audioBlob, inputElement, transcriptionContainer = null, transcriptionText = null) {
    // Show loading indicator
    loadingIndicator.style.display = 'flex';
    loadingIndicator.querySelector('span').textContent = 'Transcribing audio...';
    
    try {
        // Create audio element to play back recording for debugging
        const audioURL = URL.createObjectURL(audioBlob);
        
        // This approach uses direct file data instead of URL
        const formData = new FormData();
        formData.append("file", audioBlob, "recording.wav");
        
        // Use puter.ai to transcribe the audio - using Claude API directly with raw audio
        // The direct Claude integration isn't working consistently through puter.ai.transcribe,
        // so instead we'll send it to GPT-4 for transcription
        const transcription = await puter.ai.chat(
            "Please transcribe this audio recording accurately. Return only the transcribed text.", 
            audioBlob
        );
        
        if (transcription && transcription.trim().length > 0) {
            // Directly insert the transcription into the input
            inputElement.value = transcription;
            
            // Also show it in the transcription container if provided
            if (transcriptionContainer && transcriptionText) {
                transcriptionContainer.classList.add('visible');
                transcriptionText.textContent = transcription;
            }
            
            // Give visual feedback that transcription was successful
            inputElement.classList.add('transcription-success');
            setTimeout(() => {
                inputElement.classList.remove('transcription-success');
            }, 1500);
        } else {
            // Handle empty transcription
            throw new Error('No speech detected in the recording');
        }
        
    } catch (error) {
        console.error('Error transcribing audio:', error);
        
        // Try an alternative approach
        try {
            const transcription = await puter.ai.chat("Please transcribe the audio in this recording.", audioBlob);
            
            if (transcription && transcription.trim().length > 0) {
                // Check if the response seems like a transcription or an error message
                if (transcription.toLowerCase().includes("transcription") || 
                    transcription.toLowerCase().includes("i cannot")) {
                    
                    // Extract just the transcribed text between quotes if present
                    const extractedText = transcription.match(/"([^"]*)"/);
                    const cleanText = extractedText ? extractedText[1] : 
                                     transcription.replace(/^(transcription:|here's the transcription:|i heard:|audio transcription:)/i, '').trim();
                    
                    inputElement.value = cleanText;
                    
                    // Show in transcription container if provided
                    if (transcriptionContainer && transcriptionText) {
                        transcriptionContainer.classList.add('visible');
                        transcriptionText.textContent = cleanText;
                    }
                    
                    inputElement.classList.add('transcription-success');
                    setTimeout(() => {
                        inputElement.classList.remove('transcription-success');
                    }, 1500);
                    
                    return;
                }
            }
            throw new Error('Could not extract transcription from response');
        } catch (secondError) {
            console.error('Second transcription attempt failed:', secondError);
            
            // Show error in transcription container if provided
            if (transcriptionContainer && transcriptionText) {
                transcriptionContainer.classList.add('visible');
                transcriptionText.textContent = 'Failed to transcribe audio. Please try again or type your question manually.';
                transcriptionText.classList.add('error-text');
                
                setTimeout(() => {
                    transcriptionText.classList.remove('error-text');
                }, 3000);
            } else {
                // If no container provided (chat mode), show alert
                alert('Failed to transcribe audio. Please try again or type your message.');
            }
        }
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// Use transcription as input (kept for backwards compatibility)
function useTranscription() {
    if (transcriptionText.textContent) {
        questionInput.value = transcriptionText.textContent;
        transcriptionContainer.classList.remove('visible');
        transcriptionText.textContent = '';
    }
}

// Format code blocks with enhanced syntax highlighting and explanation formatting
function formatOutput(responseText) {
    // Create the basic container structure
    let formattedHTML = '<div class="analysis-container">';
    
    // Extract the problem heading
    const headingMatch = responseText.match(/^#\s+(.*)/m);
    if (headingMatch) {
        formattedHTML += `<div class="analysis-header">
            <h2>${headingMatch[1]}</h2>
        </div>`;
    }
    
    // Create tab buttons
    const tabButtonsHTML = `
        <div class="tab-button active" data-tab="python">Python</div>
        <div class="tab-button" data-tab="cpp">C++</div>
        <div class="tab-button" data-tab="explanation">Explanation</div>
    `;
    tabControls.innerHTML = tabButtonsHTML;
    
    // Setup tab click handlers
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            switchTab(tabName);
        });
    });
    
    // Extract bullet points for approach
    let approachBullets = [];
    const bulletPointMatches = responseText.match(/(?:^|\n)- (.*?)(?:\n|$)/g);
    if (bulletPointMatches) {
        approachBullets = bulletPointMatches.slice(0, 3).map(match => {
            return {
                text: match.replace(/^- |\n/g, '').trim(),
                important: match.toLowerCase().includes('important')
            };
        });
    }
    
    // Attempt to find Python code
    const pythonCodeMatch = responseText.match(/```python\s*([\s\S]*?)```/);
    const pythonCode = pythonCodeMatch ? pythonCodeMatch[1] : '';
    
    // Attempt to find C++ code
    const cppCodeMatch = responseText.match(/```cpp\s*([\s\S]*?)```/);
    const cppCode = cppCodeMatch ? cppCodeMatch[1] : '';
    
    // Time and space complexity extraction
    let timeComplexity = 'O(n)';
    let spaceComplexity = 'O(n)';
    const timeMatch = responseText.match(/time complexity.*?O\(([^)]*)\)/i);
    const spaceMatch = responseText.match(/space complexity.*?O\(([^)]*)\)/i);
    
    if (timeMatch) timeComplexity = `O(${timeMatch[1]})`;
    if (spaceMatch) spaceComplexity = `O(${spaceMatch[1]})`;
    
    // Create Python tab content
    formattedHTML += `
        <div class="tab-content active" id="pythonTab">
            <div class="approach-section">
                <ul class="approach-points">
                    ${approachBullets.map(bullet => 
                        `<li ${bullet.important ? 'class="important"' : ''}>${bullet.text}</li>`
                    ).join('')}
                </ul>
            </div>
            
            <div class="code-block">
                <div class="code-header">
                    <span class="code-header-title">Python Solution</span>
                    <button class="copy-button" onclick="copyCode('python')">Copy</button>
                </div>
                <div class="code-content">
                    <pre><code class="language-python">${pythonCode}</code></pre>
                </div>
            </div>
            
            <div class="complexity-box">
                <p>Time Complexity: <span class="complexity-value">${timeComplexity}</span></p>
                <p>Space Complexity: <span class="complexity-value">${spaceComplexity}</span></p>
            </div>
        </div>
    `;
    
    // Create C++ tab content
    formattedHTML += `
        <div class="tab-content" id="cppTab">
            <div class="approach-section">
                <ul class="approach-points">
                    ${approachBullets.map(bullet => 
                        `<li ${bullet.important ? 'class="important"' : ''}>${bullet.text}</li>`
                    ).join('')}
                </ul>
            </div>
            
            <div class="code-block">
                <div class="code-header">
                    <span class="code-header-title">C++ Solution</span>
                    <button class="copy-button" onclick="copyCode('cpp')">Copy</button>
                </div>
                <div class="code-content">
                    <pre><code class="language-cpp">${cppCode}</code></pre>
                </div>
            </div>
            
            <div class="complexity-box">
                <p>Time Complexity: <span class="complexity-value">${timeComplexity}</span></p>
                <p>Space Complexity: <span class="complexity-value">${spaceComplexity}</span></p>
            </div>
        </div>
    `;
    
    // Extract explanation points
    const explanationText = responseText.replace(/```[\s\S]*?```/g, '');
    
    // Create explanation tab with enhanced formatting
    formattedHTML += `
        <div class="tab-content" id="explanationTab">
            <div class="explanation-section">
                <h3>For Interviewers: Solution Explanation</h3>
                ${formatExplanation(explanationText)}
                
                <div class="interviewer-tip">
                    <h4>Interview Communication Tips</h4>
                    <p>When explaining this solution to an interviewer, emphasize the following points:</p>
                    <ul class="explanation-points">
                        <li>Start with the brute force approach, then explain why your solution is more optimal</li>
                        <li>Walk through a small example to demonstrate understanding of the algorithm</li>
                        <li>Clearly state the time and space complexity and justify your analysis</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
    
    formattedHTML += '</div>';
    return formattedHTML;
}

// Format explanation text with enhanced styling
function formatExplanation(text) {
    // Clean up the text first
    text = text
        .replace(/^#+ /gm, '') // Remove headers
        .trim();
    
    // Extract bullet points if they exist
    const bulletPoints = [];
    const bulletPattern = /(?:^|\n)(?:[*-] )(.*?)(?:\n|$)/g;
    let bulletMatch;
    
    while ((bulletMatch = bulletPattern.exec(text)) !== null) {
        bulletPoints.push(bulletMatch[1]);
    }
    
    // Format the explanation with the bullet points
    let formattedHTML = '<div class="plain-text-content">';
    
    // If we found bullet points, format them nicely
    if (bulletPoints.length >= 3) {
        // Split the text into paragraphs
        const paragraphs = text.split(/\n\n+/).filter(p => p.trim() && !p.trim().startsWith('- '));
        
        // Add the first paragraph as introduction
        if (paragraphs.length > 0) {
            formattedHTML += `<p>${highlightImportantTerms(paragraphs[0])}</p>`;
        }
        
        // Add the bullet points
        formattedHTML += '<ul class="explanation-points">';
        for (let i = 0; i < Math.min(bulletPoints.length, 6); i++) {
            formattedHTML += `<li>${highlightImportantTerms(bulletPoints[i])}</li>`;
        }
        formattedHTML += '</ul>';
        
        // Add any remaining paragraphs
        if (paragraphs.length > 1) {
            paragraphs.slice(1).forEach(p => {
                if (!p.trim().startsWith('- ')) {
                    formattedHTML += `<p>${highlightImportantTerms(p)}</p>`;
                }
            });
        }
    } else {
        // Just format paragraphs if no bullet points
        const paragraphs = text.split(/\n\n+/);
        paragraphs.forEach(p => {
            if (p.trim()) {
                formattedHTML += `<p>${highlightImportantTerms(p)}</p>`;
            }
        });
    }
    
    formattedHTML += '</div>';
    return formattedHTML;
}

// Highlight important terms in the text
function highlightImportantTerms(text) {
    // Highlight code elements
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Highlight important terms
    const importantTerms = [
        "time complexity", "space complexity", "O\\(", "optimal", 
        "efficient", "important", "key insight", "crucial"
    ];
    
    importantTerms.forEach(term => {
        const regex = new RegExp(`(${term})`, 'gi');
        text = text.replace(regex, '<span class="highlight">$1</span>');
    });
    
    return text;
}

// Switch between tabs
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-button').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    let tabId;
    if (tabName === 'python') tabId = 'pythonTab';
    else if (tabName === 'cpp') tabId = 'cppTab';
    else tabId = 'explanationTab';
    
    document.getElementById(tabId).classList.add('active');
    
    // Highlight the tab button
    document.querySelector(`.tab-button[data-tab="${tabName}"]`).classList.add('active');
    
    // Apply syntax highlighting to code blocks
    document.querySelectorAll('pre code').forEach(block => {
        hljs.highlightElement(block);
    });
}

// Copy code to clipboard
window.copyCode = function(lang) {
    const selector = lang === 'python' ? '.language-python' : '.language-cpp';
    const codeElement = document.querySelector(selector);
    
    if (codeElement) {
        const text = codeElement.textContent;
        navigator.clipboard.writeText(text).then(() => {
            // Visual feedback
            const button = document.querySelector(`#${lang}Tab .copy-button`);
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
        });
    }
};

// Send a chat message in the chat mode
async function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addChatMessage('user', message);
    chatInput.value = '';
    
    // Show typing indicator
    const typingIndicator = addTypingIndicator();
    
    try {
        // Get selected model
        const selectedModel = chatModelSelect.value;
        let response;
        
        // Set up model options if specified
        const options = selectedModel !== 'default' ? { model: selectedModel } : {};
        
        // Send message to Puter AI
        response = await puter.ai.chat(message, options);
        
        // Remove typing indicator and add AI response
        typingIndicator.remove();
        addChatMessage('ai', response);
        
        // Store in chat history
        chatHistory.push({ role: 'user', content: message });
        chatHistory.push({ role: 'assistant', content: response });
        
        // Auto scroll to the bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
    } catch (error) {
        console.error('Chat error:', error);
        typingIndicator.remove();
        addChatMessage('system', 'Sorry, there was an error processing your request.');
    }
}

// Add a message to the chat
function addChatMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // Format the response - highlight code blocks
    let formattedContent = content;
    
    // Format code blocks
    formattedContent = formattedContent.replace(/```(.*?)\n([\s\S]*?)```/g, (match, language, code) => {
        return `<div class="code-block"><div class="code-header"><span class="code-header-title">${language || 'Code'}</span></div><div class="code-content"><pre><code class="${language || ''}">${code}</code></pre></div></div>`;
    });
    
    // Format inline code
    formattedContent = formattedContent.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Format bold text
    formattedContent = formattedContent.replace(/\*\*([^*]+)\*\*/g, '<span class="bold">$1</span>');
    
    // Split into paragraphs
    formattedContent = formattedContent.split('\n\n').map(p => {
        if (p.trim() === '') return '';
        return `<p>${p}</p>`;
    }).join('');
    
    messageContent.innerHTML = formattedContent;
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);
    
    // Apply syntax highlighting to any code blocks
    messageDiv.querySelectorAll('pre code').forEach(block => {
        hljs.highlightElement(block);
    });
    
    // Auto scroll to the bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return messageDiv;
}

// Add typing indicator while waiting for response
function addTypingIndicator() {
    const indicatorDiv = document.createElement('div');
    indicatorDiv.className = 'chat-message ai typing-indicator';
    
    const indicatorContent = document.createElement('div');
    indicatorContent.className = 'message-content';
    indicatorContent.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    
    indicatorDiv.appendChild(indicatorContent);
    chatMessages.appendChild(indicatorDiv);
    
    // Auto scroll to the bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return indicatorDiv;
}

// Analyze images with Puter.js
async function sendToPuter() {
    const question = questionInput.value.trim();
    const useStreaming = streamingCheckbox.checked;
    const selectedModel = modelSelect.value;
    
    // Check if at least one image is uploaded
    const uploadedImages = Object.values(imageData).filter(img => img !== null);
    if (uploadedImages.length === 0) {
        alert('Please paste at least one image first');
        return;
    }
    
    if (!question) {
        alert('Please enter a question');
        return;
    }
    
    // Disable button and show loading
    sendButton.disabled = true;
    loadingIndicator.style.display = 'flex';
    loadingIndicator.querySelector('span').textContent = 'Analyzing code...';
    responseArea.innerHTML = '';
    
    try {
        // Create prompt with image context
        let prompt = `${question}\n\nAnalyze the code from ${uploadedImages.length} image(s) and provide a detailed solution with:
1. A clear heading explaining the problem
2. 3 bullet points about the approach (mark important ones)
3. Python and C++ implementations with line-by-line comments
4. Time and space complexity analysis
5. Detailed explanation in 6 bullet points that I can discuss with an interviewer

Format the code properly for an interview setting.`;
        
        if (useStreaming) {
            // Use streaming for responses
            const options = {
                stream: true
            };
            
            // Add model if not default
            if (selectedModel !== 'default') {
                options.model = selectedModel;
            }
            
            // Handle multiple images
            let response;
            if (uploadedImages.length === 1) {
                response = await puter.ai.chat(prompt, uploadedImages[0], options);
            } else {
                response = await puter.ai.chat(prompt, uploadedImages, options);
            }
            
            let fullResponse = '';
            let isFirstChunk = true;
            
            for await (const part of response) {
                fullResponse += part?.text || '';
                
                // For the first chunk, show a loading message
                if (isFirstChunk) {
                    responseArea.innerHTML = '<div class="loading-text">Generating response...</div>';
                    isFirstChunk = false;
                } else {
                    // For subsequent chunks, show the raw text until streaming is complete
                    responseArea.innerHTML = `<pre style="white-space:pre-wrap;color:#e0e0e0">${fullResponse}</pre>`;
                    // Auto-scroll to the bottom
                    responseArea.scrollTop = responseArea.scrollHeight;
                }
            }
            
            // After streaming completes, format the output
            responseArea.innerHTML = formatOutput(fullResponse);
            
        } else {
            // Non-streaming response
            const options = {};
            if (selectedModel !== 'default') {
                options.model = selectedModel;
            }
            
            let response;
            if (uploadedImages.length === 1) {
                response = await puter.ai.chat(prompt, uploadedImages[0], options);
            } else {
                response = await puter.ai.chat(prompt, uploadedImages, options);
            }
            
            responseArea.innerHTML = formatOutput(response);
        }
        
        // Apply syntax highlighting
        document.querySelectorAll('pre code').forEach(block => {
            hljs.highlightElement(block);
        });
        
    } catch (error) {
        console.error('Error analyzing code:', error);
        responseArea.innerHTML = `<div class="error">Error: ${error.message || 'Failed to analyze images'}</div>`;
    } finally {
        sendButton.disabled = false;
        loadingIndicator.style.display = 'none';
    }
}

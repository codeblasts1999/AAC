document.addEventListener('DOMContentLoaded', () => {
    const output = document.getElementById('output-field');
    const keyboard = document.getElementById('keyboard');
    
    // Shift toggle tracking state
    let isShiftActive = false;

    // Standard structural definitions for every row of keys
    const keyboardLayout = [
        // Row 1: Numbers & Standard Symbols
        [['1', '!'], ['2', '@'], ['3', '#'], ['4', '$'], ['5', '%'], ['6', '^'], ['7', '&'], ['8', '*'], ['9', '('], ['0', ')'], ['-', '_'], ['=', '+']],
        // Row 2: Top Letters & Brackets
        [['q', 'Q'], ['w', 'W'], ['e', 'E'], ['r', 'R'], ['t', 'T'], ['y', 'Y'], ['u', 'U'], ['i', 'I'], ['o', 'O'], ['p', 'P'], ['[', '{'], [']', '}']],
        // Row 3: Middle Letters & Punctuation
        [['a', 'A'], ['s', 'S'], ['d', 'D'], ['f', 'F'], ['g', 'G'], ['h', 'H'], ['j', 'J'], ['k', 'K'], ['l', 'L'], [';', ':'], ["'", '"'], ['\\', '|']],
        // Row 4: Bottom Letters & Punctuation
        [['z', 'Z'], ['x', 'X'], ['c', 'C'], ['v', 'V'], ['b', 'B'], ['n', 'N'], ['m', 'M'], [',', '<'], ['.', '>'], ['/', '?']],
        // Row 5: Action Modifiers & Layout controls
        [['Shift', 'Shift', 'shift-key'], [' ', ' ', 'space-key'], ['⌫', '⌫', 'backspace-key']]
    ];

    // Main Keyboard Render Function
    function renderKeyboard() {
        keyboard.innerHTML = ''; 

        keyboardLayout.forEach(row => {
            const rowContainer = document.createElement('div');
            rowContainer.className = 'keyboard-row';

            row.forEach(keyConfig => {
                const [normalChar, shiftedChar, customClass] = keyConfig;
                const button = document.createElement('button');
                button.className = 'key';
                
                // Set appropriate display text based on active Shift state
                if (customClass) {
                    button.classList.add(customClass);
                    button.textContent = normalChar;
                    if (customClass === 'shift-key' && isShiftActive) {
                        button.classList.add('active');
                    }
                } else {
                    button.textContent = isShiftActive ? shiftedChar : normalChar;
                }

                // Prevent losing focus on textarea wrapper element when keys are tapped
                button.onmousedown = (e) => e.preventDefault();

                button.onclick = () => {
                    const startPos = output.selectionStart;
                    const endPos = output.selectionEnd;
                    const currentText = output.value;

                    if (customClass === 'shift-key') {
                        isShiftActive = !isShiftActive;
                        renderKeyboard(); 
                        return;
                    } 
                    
                    if (customClass === 'backspace-key') {
                        if (startPos === endPos) {
                            if (startPos > 0) {
                                output.value = currentText.substring(0, startPos - 1) + currentText.substring(endPos);
                                output.setSelectionRange(startPos - 1, startPos - 1);
                            }
                        } else {
                            output.value = currentText.substring(0, startPos) + currentText.substring(endPos);
                            output.setSelectionRange(startPos, startPos);
                        }
                    } else {
                        const charToInsert = isShiftActive ? shiftedChar : normalChar;
                        output.value = currentText.substring(0, startPos) + charToInsert + currentText.substring(endPos);
                        output.setSelectionRange(startPos + 1, startPos + 1);

                        if (isShiftActive) {
                            isShiftActive = false;
                            renderKeyboard();
                        }
                    }
                    output.focus();
                };

                rowContainer.appendChild(button);
            });

            keyboard.appendChild(rowContainer);
        });
    }

    // --- Speech Synthesizer Flow Controllers ---
    const speakText = (msg) => {
        if (!msg.trim()) return;
        const utterance = new SpeechSynthesisUtterance(msg);
        window.speechSynthesis.speak(utterance);
    };

    const setOutputAndSpeak = (msg) => {
        output.value = msg;
        speakText(msg);
        output.focus();
    };

    // Controller Bindings
    document.getElementById('emergency-btn').onclick = () => setOutputAndSpeak("Emergency! I need help immediately.");
    document.getElementById('hello-btn').onclick = () => setOutputAndSpeak("Hello.");
    document.getElementById('morn-btn').onclick = () => setOutputAndSpeak("Good morning.");
    document.getElementById('help-btn').onclick = () => setOutputAndSpeak("I need help.");
    document.getElementById('where-btn').onclick = () => setOutputAndSpeak("Where is it?");
    document.getElementById('finish-btn').onclick = () => setOutputAndSpeak("I'm finished with my task.");
    
    document.getElementById('speak-btn').onclick = () => speakText(output.value);
    document.getElementById('clear-btn').onclick = () => { output.value = ''; output.focus(); };

    // --- Pure Client-Side AI Chat Logic ---
    const aiBtn = document.getElementById('ai-btn');
    const aiModal = document.getElementById('ai-modal');
    const closeAiBtn = document.getElementById('close-ai-btn');
    const sendAiBtn = document.getElementById('send-ai-btn');
    const aiInput = document.getElementById('ai-input');
    const chatHistory = document.getElementById('chat-history');

    // Replace YOUR_GROQ_API_KEY with your actual Groq key for local testing
    const GROQ_API_KEY = "YOUR_GROQ_API_KEY"; 

    aiBtn.onclick = () => {
        const currentAacText = output.value.trim();
        if (currentAacText) {
            aiInput.value = currentAacText;
        }
        aiModal.classList.remove('hidden');
        aiInput.focus();
    };

    closeAiBtn.onclick = () => aiModal.classList.add('hidden');

    const handleAiSend = async () => {
        const question = aiInput.value.trim();
        if (!question) return;

        chatHistory.innerHTML += `<div class="chat-message you"><strong>You:</strong> ${question}</div>`;
        aiInput.value = '';

        const loadingId = 'loading-' + Date.now();
        chatHistory.innerHTML += `<div id="${loadingId}" class="chat-message ai"><em>Thinking about the best decision...</em></div>`;
        chatHistory.scrollTop = chatHistory.scrollHeight;

        try {
            // Direct API fetch call replacing the Flask backend route connection
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: question
                })
            });

            const data = await response.json();
            const loadingElement = document.getElementById(loadingId);
            if (loadingElement) loadingElement.remove();

            if (data.reply) {
                const reply = data.reply;
                chatHistory.innerHTML += `<div class="chat-message ai"><strong>AI:</strong> ${reply}</div>`;
            } else if (data.error) {
                chatHistory.innerHTML += `<div class="chat-message ai" style="color:red;">Error: ${data.error}</div>`;
            }
        } catch (error) {
            const loadingElement = document.getElementById(loadingId);
            if (loadingElement) loadingElement.remove();
            chatHistory.innerHTML += `<div class="chat-message ai" style="color:red;">Error: Connection failure.</div>`;
        }
        chatHistory.scrollTop = chatHistory.scrollHeight;
    };

    sendAiBtn.onclick = handleAiSend;
    aiInput.onkeypress = (e) => { if (e.key === 'Enter') handleAiSend(); };

    // Initialize Keyboard on mount
    renderKeyboard();
});

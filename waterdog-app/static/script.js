document.addEventListener('DOMContentLoaded', () => {
    const aiInput = document.getElementById('ai-input');
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

    // Main Keyboard Render Function — types into the AI chat input
    function renderKeyboard() {
        keyboard.innerHTML = '';

        keyboardLayout.forEach(row => {
            const rowContainer = document.createElement('div');
            rowContainer.className = 'keyboard-row';

            row.forEach(keyConfig => {
                const [normalChar, shiftedChar, customClass] = keyConfig;
                const button = document.createElement('button');
                button.className = 'key';

                if (customClass) {
                    button.classList.add(customClass);
                    button.textContent = normalChar;
                    if (customClass === 'shift-key' && isShiftActive) {
                        button.classList.add('active');
                    }
                } else {
                    button.textContent = isShiftActive ? shiftedChar : normalChar;
                }

                // Prevent losing focus on ai-input when keys are tapped
                button.onmousedown = (e) => e.preventDefault();

                button.onclick = () => {
                    const startPos = aiInput.selectionStart;
                    const endPos = aiInput.selectionEnd;
                    const currentText = aiInput.value;

                    if (customClass === 'shift-key') {
                        isShiftActive = !isShiftActive;
                        renderKeyboard();
                        return;
                    }

                    if (customClass === 'backspace-key') {
                        if (startPos === endPos) {
                            if (startPos > 0) {
                                aiInput.value = currentText.substring(0, startPos - 1) + currentText.substring(endPos);
                                aiInput.setSelectionRange(startPos - 1, startPos - 1);
                            }
                        } else {
                            aiInput.value = currentText.substring(0, startPos) + currentText.substring(endPos);
                            aiInput.setSelectionRange(startPos, startPos);
                        }
                    } else {
                        const charToInsert = isShiftActive ? shiftedChar : normalChar;
                        aiInput.value = currentText.substring(0, startPos) + charToInsert + currentText.substring(endPos);
                        aiInput.setSelectionRange(startPos + 1, startPos + 1);

                        if (isShiftActive) {
                            isShiftActive = false;
                            renderKeyboard();
                        }
                    }
                    aiInput.focus();
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

    const insertIntoAiInput = (text) => {
        const startPos = aiInput.selectionStart;
        const endPos = aiInput.selectionEnd;
        const current = aiInput.value;
        aiInput.value = current.substring(0, startPos) + text + current.substring(endPos);
        aiInput.setSelectionRange(startPos + text.length, startPos + text.length);
        aiInput.focus();
        speakText(text);
    };

    // Controller Bindings
    document.getElementById('emergency-btn').onclick = () => insertIntoAiInput("Emergency! I need help immediately.");
    document.getElementById('hello-btn').onclick = () => insertIntoAiInput("Hello.");
    document.getElementById('morn-btn').onclick = () => insertIntoAiInput("Good morning.");
    document.getElementById('help-btn').onclick = () => insertIntoAiInput("I need help.");
    document.getElementById('where-btn').onclick = () => insertIntoAiInput("Where is it?");
    document.getElementById('finish-btn').onclick = () => insertIntoAiInput("I'm finished with my task.");

    document.getElementById('speak-btn').onclick = () => speakText(aiInput.value);
    document.getElementById('clear-btn').onclick = () => { aiInput.value = ''; aiInput.focus(); };

    document.getElementById('ai-btn').onclick = () => aiInput.focus();

    // Toggle AI panel between left and right
    const aiPanel = document.getElementById('ai-panel');
    const togglePanelBtn = document.getElementById('toggle-panel-btn');

    togglePanelBtn.onclick = () => {
        aiPanel.classList.toggle('panel-right');
        const isRight = aiPanel.classList.contains('panel-right');
        togglePanelBtn.textContent = isRight ? '←' : '→';
        togglePanelBtn.title = isRight ? 'Move panel to left' : 'Move panel to right';
    };

    // --- AI Chat Logic ---
    const sendAiBtn = document.getElementById('send-ai-btn');
    const chatHistory = document.getElementById('chat-history');

    const handleAiSend = async () => {
        const question = aiInput.value.trim();
        if (!question) return;

        chatHistory.innerHTML += `<div class="chat-message you"><strong>You:</strong> ${question}</div>`;
        aiInput.value = '';

        const loadingId = 'loading-' + Date.now();
        chatHistory.innerHTML += `<div id="${loadingId}" class="chat-message ai"><em>Thinking about the best decision...</em></div>`;
        chatHistory.scrollTop = chatHistory.scrollHeight;

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: question })
            });

            const data = await response.json();
            const loadingElement = document.getElementById(loadingId);
            if (loadingElement) loadingElement.remove();

            if (data.reply) {
                const lines = data.reply.trimEnd().split('\n');
                const lastLine = lines[lines.length - 1].trim();
                const confidenceMatch = lastLine.match(/^Confidence:\s*(\d+)%$/i);
                let reply, confidenceHTML = '';
                if (confidenceMatch) {
                    reply = lines.slice(0, -1).join('\n').trimEnd();
                    confidenceHTML = `<div class="ai-confidence">Confidence: ${confidenceMatch[1]}%</div>`;
                } else {
                    reply = data.reply;
                }
                chatHistory.innerHTML += `<div class="chat-message ai"><strong>AI:</strong> ${reply}${confidenceHTML}</div>`;
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

    // Disclaimer modal — dismiss on acknowledge
    const disclaimerModal = document.getElementById('disclaimer-modal');
    document.getElementById('disclaimer-ok-btn').onclick = () => {
        disclaimerModal.classList.add('hidden');
    };

    // Initialize Keyboard on mount
    renderKeyboard();
});

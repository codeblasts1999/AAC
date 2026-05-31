document.addEventListener('DOMContentLoaded', () => {
    const output = document.getElementById('output-field');
    const aiInput = document.getElementById('ai-input');
    const whoAreYou = document.getElementById('who-are-you');
    const keyboard = document.getElementById('keyboard');

    // Keyboard types into whichever input is currently focused
    let activeInput = output;
    output.addEventListener('focus', () => { activeInput = output; });
    aiInput.addEventListener('focus', () => { activeInput = aiInput; });
    whoAreYou.addEventListener('focus', () => { activeInput = whoAreYou; });

    // Persist "Who are you?" across page loads
    whoAreYou.value = localStorage.getItem('userContext') || '';
    whoAreYou.addEventListener('input', () => {
        localStorage.setItem('userContext', whoAreYou.value);
    });

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

                // Preserve focus on the active input when keys are tapped
                button.onmousedown = (e) => e.preventDefault();

                button.onclick = () => {
                    const startPos = activeInput.selectionStart;
                    const endPos = activeInput.selectionEnd;
                    const currentText = activeInput.value;

                    if (customClass === 'shift-key') {
                        isShiftActive = !isShiftActive;
                        renderKeyboard();
                        return;
                    }

                    if (customClass === 'backspace-key') {
                        if (startPos === endPos) {
                            if (startPos > 0) {
                                activeInput.value = currentText.substring(0, startPos - 1) + currentText.substring(endPos);
                                activeInput.setSelectionRange(startPos - 1, startPos - 1);
                            }
                        } else {
                            activeInput.value = currentText.substring(0, startPos) + currentText.substring(endPos);
                            activeInput.setSelectionRange(startPos, startPos);
                        }
                    } else {
                        const charToInsert = isShiftActive ? shiftedChar : normalChar;
                        activeInput.value = currentText.substring(0, startPos) + charToInsert + currentText.substring(endPos);
                        activeInput.setSelectionRange(startPos + 1, startPos + 1);

                        if (isShiftActive) {
                            isShiftActive = false;
                            renderKeyboard();
                        }
                    }
                    activeInput.focus();
                    // Keep localStorage in sync if the user typed into who-are-you via keyboard
                    if (activeInput === whoAreYou) {
                        localStorage.setItem('userContext', whoAreYou.value);
                    }
                };

                rowContainer.appendChild(button);
            });

            keyboard.appendChild(rowContainer);
        });
    }

    // --- Speech Synthesizer Flow Controllers ---
    const speakBtn = document.getElementById('speak-btn');

    // speechSynthesis.pause() is broken in Chrome — workaround: cancel and
    // resume by restarting a new utterance from the last tracked word boundary.
    let ttsGeneration = 0;

    const tts = {
        activeBtn: null,
        paused: false,
        fullMsg: '',
        charOffset: 0,
        getCharOffset: () => 0,
        resetBtn(btn) {
            if (!btn) return;
            btn.textContent = btn === speakBtn ? '📢 Speak' : '🔊';
        },
        setPlaying(btn) {
            if (this.activeBtn && this.activeBtn !== btn) this.resetBtn(this.activeBtn);
            this.activeBtn = btn;
            this.paused = false;
            if (btn) btn.textContent = btn === speakBtn ? '⏸ Pause' : '⏸';
        },
        setPaused() {
            this.paused = true;
            if (this.activeBtn) {
                this.activeBtn.textContent = this.activeBtn === speakBtn ? '▶ Resume' : '▶';
            }
        },
        clear() {
            this.resetBtn(this.activeBtn);
            this.activeBtn = null;
            this.paused = false;
            this.charOffset = 0;
            this.getCharOffset = () => 0;
        }
    };

    const startUtterance = (text, btn, startOffset) => {
        const myGen = ++ttsGeneration;
        const utterance = new SpeechSynthesisUtterance(text);
        let lastBoundary = 0;

        utterance.onboundary = (e) => { lastBoundary = e.charIndex; };
        utterance.onend = () => { if (ttsGeneration === myGen) tts.clear(); };
        utterance.onerror = () => { if (ttsGeneration === myGen) tts.clear(); };

        tts.getCharOffset = () => startOffset + lastBoundary;
        window.speechSynthesis.speak(utterance);
    };

    const speakText = (msg, btn = null) => {
        if (!msg || !msg.trim()) return;

        if (btn && tts.activeBtn === btn) {
            if (!tts.paused) {
                // Pause: record position, invalidate current utterance, cancel
                tts.charOffset = tts.getCharOffset();
                ttsGeneration++;
                tts.setPaused();
                window.speechSynthesis.cancel();
            } else {
                // Resume: restart from saved position
                tts.paused = false;
                tts.setPlaying(btn);
                startUtterance(tts.fullMsg.substring(tts.charOffset), btn, tts.charOffset);
            }
            return;
        }

        // New speech — invalidate previous utterance and start fresh
        ttsGeneration++;
        tts.setPlaying(btn);
        tts.fullMsg = msg;
        tts.charOffset = 0;
        window.speechSynthesis.cancel();
        startUtterance(msg, btn, 0);
    };

    const setOutputAndSpeak = (text) => {
        output.value = text;
        speakText(text, speakBtn);
        output.focus();
    };

    // Macro buttons set the output field and speak aloud
    document.getElementById('emergency-btn').onclick = () => setOutputAndSpeak("Emergency! I need help immediately.");
    document.getElementById('hello-btn').onclick = () => setOutputAndSpeak("Hello.");
    document.getElementById('morn-btn').onclick = () => setOutputAndSpeak("Good morning.");
    document.getElementById('help-btn').onclick = () => setOutputAndSpeak("I need help.");
    document.getElementById('where-btn').onclick = () => setOutputAndSpeak("Where is it?");
    document.getElementById('finish-btn').onclick = () => setOutputAndSpeak("I'm finished with my task.");

    speakBtn.onclick = () => speakText(output.value, speakBtn);
    document.getElementById('clear-btn').onclick = () => { output.value = ''; output.focus(); };

    // AI Chat button — pre-fills AI input with current output text then focuses it
    document.getElementById('ai-btn').onclick = () => {
        const current = output.value.trim();
        if (current) aiInput.value = current;
        aiInput.focus();
    };

    // Toggle AI panel between left and right
    const aiPanel = document.getElementById('ai-panel');
    const togglePanelBtn = document.getElementById('toggle-panel-btn');

    togglePanelBtn.onclick = () => {
        aiPanel.classList.toggle('panel-right');
        const isRight = aiPanel.classList.contains('panel-right');
        togglePanelBtn.textContent = isRight ? '←' : '→';
        togglePanelBtn.title = isRight ? 'Move panel to left' : 'Move panel to right';
    };

    // Hide / Show AI panel
    const showAiBtn = document.getElementById('show-ai-btn');
    document.getElementById('hide-ai-btn').onclick = () => {
        aiPanel.classList.add('panel-hidden');
        showAiBtn.style.display = 'block';
    };
    showAiBtn.onclick = () => {
        aiPanel.classList.remove('panel-hidden');
        showAiBtn.style.display = 'none';
    };

    // --- AI Chat Logic ---
    const sendAiBtn = document.getElementById('send-ai-btn');
    const chatHistory = document.getElementById('chat-history');

    // Tracks whether the next send is a clarification of a prior message
    let clarificationContext = null; // { originalQuestion, type: 'corroborate' | 'elaborate' }

    const setClarificationMode = (originalQuestion, type, previousAiText = null) => {
        clarificationContext = { originalQuestion, type, previousAiText };
        aiInput.placeholder = type === 'corroborate' ? 'Type what you actually meant…' : 'Add more context…';
        aiInput.classList.add('clarifying');
        aiInput.value = '';
        aiInput.focus();
    };

    const clearClarificationMode = () => {
        clarificationContext = null;
        aiInput.placeholder = 'Ask your question...';
        aiInput.classList.remove('clarifying');
    };

    const confidenceStyle = (pct) => {
        const hue = Math.round((pct / 100) * 120);
        const sat = Math.round(70 + (1 - pct / 100) * 30);
        const color = `hsl(${hue}, ${sat}%, 32%)`;
        const bg = `hsl(${hue}, ${sat}%, 95%)`;
        const border = `hsl(${hue}, ${sat}%, 55%)`;
        const weight = pct < 40 ? 'bold' : 'normal';
        const borderWidth = pct < 30 ? '2px' : '1px';
        return `color:${color};background:${bg};border:${borderWidth} solid ${border};font-weight:${weight};`;
    };

    const createAiMessageElement = (question, replyText, pct) => {
        const div = document.createElement('div');
        div.className = 'chat-message ai';

        const text = document.createElement('div');
        text.innerHTML = `<strong>AI:</strong> ${replyText}`;
        div.appendChild(text);

        if (pct !== null) {
            const badge = document.createElement('div');
            badge.className = 'ai-confidence';
            badge.setAttribute('style', confidenceStyle(pct));
            badge.textContent = `Confidence: ${pct}%`;
            div.appendChild(badge);
        }

        const actions = document.createElement('div');
        actions.className = 'ai-actions';

        const speakAiBtn = document.createElement('button');
        speakAiBtn.className = 'ai-action-btn speak-ai-btn';
        speakAiBtn.textContent = '🔊';
        speakAiBtn.title = 'Read aloud';
        speakAiBtn.onclick = () => speakText(replyText, speakAiBtn);

        const rejectBtn = document.createElement('button');
        rejectBtn.className = 'ai-action-btn reject-btn';
        rejectBtn.textContent = 'Reject';
        rejectBtn.onclick = () => div.remove();

        const retryBtn = document.createElement('button');
        retryBtn.className = 'ai-action-btn retry-btn';
        retryBtn.textContent = 'Retry';
        retryBtn.onclick = () => fetchAiReply(question, false, div);

        actions.append(speakAiBtn, rejectBtn, retryBtn);
        div.appendChild(actions);
        return div;
    };

    const createUserMessageElement = (question) => {
        const div = document.createElement('div');
        div.className = 'chat-message you';

        const text = document.createElement('div');
        text.innerHTML = `<strong>You:</strong> ${question}`;
        div.appendChild(text);

        const actions = document.createElement('div');
        actions.className = 'ai-actions';

        const resendBtn = document.createElement('button');
        resendBtn.className = 'ai-action-btn resend-btn';
        resendBtn.textContent = 'Resend';
        resendBtn.onclick = () => fetchAiReply(question, true, null);

        const notIntentBtn = document.createElement('button');
        notIntentBtn.className = 'ai-action-btn not-intent-btn';
        notIntentBtn.textContent = 'Not my intent';
        notIntentBtn.onclick = () => {
            const existing = div.querySelector('.clarification-panel');
            if (existing) { existing.remove(); return; }

            // Find the actual AI response that followed this message so we can
            // include it in the frame — without it the AI has no real context.
            let previousAiText = null;
            let sibling = div.nextElementSibling;
            while (sibling) {
                if (sibling.classList.contains('ai')) {
                    const textNode = sibling.querySelector('div:first-child');
                    if (textNode) {
                        previousAiText = textNode.innerText.replace(/^AI:\s*/, '').trim();
                    }
                    break;
                }
                sibling = sibling.nextElementSibling;
            }

            const panel = document.createElement('div');
            panel.className = 'clarification-panel';

            const corroborateBtn = document.createElement('button');
            corroborateBtn.className = 'ai-action-btn corroborate-btn';
            corroborateBtn.textContent = 'Corroborate';
            corroborateBtn.onclick = () => { panel.remove(); setClarificationMode(question, 'corroborate', previousAiText); };

            const elaborateBtn = document.createElement('button');
            elaborateBtn.className = 'ai-action-btn elaborate-btn';
            elaborateBtn.textContent = 'Elaborate';
            elaborateBtn.onclick = () => { panel.remove(); setClarificationMode(question, 'elaborate', previousAiText); };

            panel.append(corroborateBtn, elaborateBtn);
            div.appendChild(panel);
        };

        actions.append(resendBtn, notIntentBtn);
        div.appendChild(actions);
        return div;
    };

    const fetchAiReply = async (question, appendUserMessage, replaceElement) => {
        if (appendUserMessage) {
            chatHistory.appendChild(createUserMessageElement(question));
        }

        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'chat-message ai';
        loadingDiv.innerHTML = '<em>Thinking, then running a safety check…</em>';

        if (replaceElement) {
            replaceElement.replaceWith(loadingDiv);
        } else {
            chatHistory.appendChild(loadingDiv);
        }
        chatHistory.scrollTop = chatHistory.scrollHeight;

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: question, user_context: whoAreYou.value.trim() || null })
            });
            const data = await response.json();

            if (data.reply) {
                const lines = data.reply.trimEnd().split('\n');
                const lastLine = lines[lines.length - 1].trim();
                const confidenceMatch = lastLine.match(/^Confidence:\s*(\d+)%$/i);
                let replyText, pct = null;
                if (confidenceMatch) {
                    replyText = lines.slice(0, -1).join('\n').trimEnd();
                    pct = Math.max(0, parseInt(confidenceMatch[1]) - 10);
                } else {
                    replyText = data.reply;
                }
                loadingDiv.replaceWith(createAiMessageElement(question, replyText, pct));
            } else if (data.error) {
                loadingDiv.innerHTML = `<span style="color:red;">Error: ${data.error}</span>`;
            }
        } catch {
            loadingDiv.innerHTML = `<span style="color:red;">Error: Connection failure.</span>`;
        }
        chatHistory.scrollTop = chatHistory.scrollHeight;
    };

    const handleAiSend = () => {
        const text = aiInput.value.trim();
        if (!text) return;
        aiInput.value = '';

        if (clarificationContext) {
            const { originalQuestion, type, previousAiText } = clarificationContext;
            clearClarificationMode();
            const aiContext = previousAiText
                ? `The AI responded: "${previousAiText}". `
                : '';
            const framed = type === 'corroborate'
                ? `My previous message was: "${originalQuestion}". ${aiContext}What I actually meant was: ${text}`
                : `My previous message was: "${originalQuestion}". ${aiContext}To add more context: ${text}`;
            fetchAiReply(framed, true, null);
        } else {
            clearClarificationMode();
            fetchAiReply(text, true, null);
        }
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

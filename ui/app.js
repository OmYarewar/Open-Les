// Initialize Icons
lucide.createIcons();

// State
let currentSessionId = 'session_' + Date.now();
let isGenerating = false;
let globalConfigs = []; // Store to reference models

// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const btnNewChat = document.getElementById('btn-new-chat');

// API Config logic
const configSwitcher = document.getElementById('config-switcher');
const btnAddConfig = document.getElementById('btn-add-config');
const addConfigModal = document.getElementById('add-config-modal');
const btnCloseAddConfig = document.getElementById('btn-close-add-config');
const btnSaveNewConfig = document.getElementById('btn-save-new-config');
const btnStopChat = document.getElementById('btn-stop-chat');
const btnSendChat = document.getElementById('btn-send-chat');
const aiStatusIndicator = document.getElementById('ai-status-indicator');
const aiStatusText = document.getElementById('ai-status-text');

async function loadConfigs() {
    try {
        const res = await fetch('/api/configs');
        const data = await res.json();

        globalConfigs = data.configs;

        configSwitcher.innerHTML = '';
        data.configs.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.label;
            configSwitcher.appendChild(opt);
        });

        if (data.active_config_id) {
            configSwitcher.value = data.active_config_id;
            updateModelDropdown(data.active_config_id);
        }
    } catch (e) {
        console.error("Failed to load configs:", e);
    }
}

const modelSwitcher = document.getElementById('model-switcher');

function updateModelDropdown(configId) {
    const config = globalConfigs.find(c => c.id === configId);
    modelSwitcher.innerHTML = '';
    if (config && config.models) {
        const models = config.models.split(',').map(m => m.trim()).filter(m => m);
        models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            modelSwitcher.appendChild(opt);
        });
    } else {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No models defined';
        modelSwitcher.appendChild(opt);
    }
}

configSwitcher.addEventListener('change', async (e) => {
    await fetch('/api/configs/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            config_id: e.target.value,
            session_id: currentSessionId
        })
    });
    updateModelDropdown(e.target.value);
    // After switching config, we trigger the model change to sync backend
    if (modelSwitcher.value) {
        modelSwitcher.dispatchEvent(new Event('change'));
    }
});

modelSwitcher.addEventListener('change', async (e) => {
    if (e.target.value) {
        await fetch(`/api/sessions/${currentSessionId}/model`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model_id: e.target.value
            })
        });
    }
});

btnAddConfig.addEventListener('click', () => {
    addConfigModal.classList.remove('hidden');
    addConfigModal.classList.add('flex');
});

btnCloseAddConfig.addEventListener('click', () => {
    addConfigModal.classList.add('hidden');
    addConfigModal.classList.remove('flex');
});

btnSaveNewConfig.addEventListener('click', async () => {
    const label = document.getElementById('new-config-label').value || 'New Config';
    const apiKey = document.getElementById('new-config-api-key').value;
    const baseUrl = document.getElementById('new-config-base-url').value;
    const model = document.getElementById('new-config-model').value;

    if (!apiKey) {
        alert("API Key is required");
        return;
    }

    btnSaveNewConfig.textContent = 'Saving...';

    const res = await fetch('/api/configs/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, api_key: apiKey, base_url: baseUrl, models: model })
    });

    const data = await res.json();

    if (data.status === 'ok') {
        await loadConfigs();
        configSwitcher.value = data.id; // select the newly created config
        // Also tell server to switch to it
        configSwitcher.dispatchEvent(new Event('change'));

        btnCloseAddConfig.click();

        // Reset inputs
        document.getElementById('new-config-label').value = '';
        document.getElementById('new-config-api-key').value = '';
    }

    btnSaveNewConfig.textContent = 'Save Configuration';
});

btnStopChat.addEventListener('click', async () => {
    if (isGenerating) {
        await fetch('/api/chat/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: currentSessionId })
        });
        aiStatusText.textContent = "Stopping...";
    }
});

// Load configs on startup
loadConfigs();

// Throttled scroll to bottom
let scrollTicking = false;
function scrollToBottom() {
    if (!scrollTicking) {
        window.requestAnimationFrame(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
            scrollTicking = false;
        });
        scrollTicking = true;
    }
}

// Settings & File Upload Elements
const settingsModal = document.getElementById('settings-modal');
const btnSettings = document.getElementById('btn-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const btnUploadSkill = document.getElementById('btn-upload-skill');
const fileUploadSkill = document.getElementById('file-upload-skill');
const btnThemeToggle = document.getElementById('btn-theme-toggle');
const iconTheme = document.getElementById('icon-theme');

const inputBaseUrl = document.getElementById('config-base-url');
const inputApiKey = document.getElementById('config-api-key');
const inputModel = document.getElementById('config-model');
const inputSystemPrompt = document.getElementById('config-system-prompt');

// Theme Toggle Logic
if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
        const html = document.documentElement;
        if (html.classList.contains('dark')) {
            html.classList.remove('dark');
            iconTheme.setAttribute('data-lucide', 'sun');
            localStorage.setItem('theme', 'light');
        } else {
            html.classList.add('dark');
            iconTheme.setAttribute('data-lucide', 'moon');
            localStorage.setItem('theme', 'dark');
        }
        lucide.createIcons({ root: btnThemeToggle });
    });

    // Load saved theme
    if (localStorage.getItem('theme') === 'light') {
        document.documentElement.classList.remove('dark');
        if(iconTheme) iconTheme.setAttribute('data-lucide', 'sun');
    }
}

// Auto-resize textarea
chatInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Chat form submission
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
    }
});

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isGenerating) return;

    const message = chatInput.value.trim();
    if (!message) return;

    // Reset input
    chatInput.value = '';
    chatInput.style.height = 'auto';
    
    // Add User message UI
    appendMessage('user', message);
    
    // Create assistant message container
    const assistantMsgId = 'msg_' + Date.now();
    appendMessage('assistant', '', assistantMsgId);
    
    isGenerating = true;
    chatInput.disabled = true;
    btnSendChat.classList.add('hidden');
    btnStopChat.classList.remove('hidden');
    aiStatusIndicator.classList.remove('hidden');
    aiStatusIndicator.classList.add('flex');
    aiStatusText.textContent = "Thinking...";

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: currentSessionId,
                message: message
            })
        });

        if (!response.ok) throw new Error('Network response was not ok');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        let assistantContent = "";
        let msgEl = document.getElementById(assistantMsgId + '-content');

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6);
                    if (!dataStr) continue;
                    try {
                        const data = JSON.parse(dataStr);
                        
                        if (data.role === 'assistant') {
                            if (data.content) {
                                assistantContent = data.content; // Use exact latest content rather than appending chunks
                                msgEl.innerHTML = DOMPurify.sanitize(marked.parse(assistantContent));
                            }
                            if (data.tool_calls) {
                                let toolHTML = '<details class="mt-2 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 text-xs font-mono">';
                                toolHTML += '<summary class="p-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 text-indigo-500 dark:text-indigo-400 select-none">Executing Tools (' + data.tool_calls.length + ')</summary>';
                                toolHTML += '<div class="p-2 border-t border-slate-700 space-y-1">';
                                data.tool_calls.forEach(tc => {
                                    toolHTML += `<div><span class="text-slate-500 dark:text-slate-500">${tc.function.name}</span></div>`;
                                });
                                toolHTML += '</div></details>';
                                if(!msgEl.innerHTML.includes('Executing Tools')) {
                                    msgEl.innerHTML += DOMPurify.sanitize(toolHTML, {ADD_TAGS: ['details', 'summary']});
                                }
                            }
                        } else if (data.role === 'tool') {
                            const details = document.createElement('details');
                            details.className = 'mt-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 text-xs font-mono';

                            const summary = document.createElement('summary');
                            summary.className = 'p-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-600 dark:text-slate-400 select-none';
                            summary.textContent = 'Tool Output: ' + (data.name || 'Unknown');

                            const toolContent = document.createElement('div');
                            toolContent.className = 'p-2 border-t border-slate-800 text-slate-600 dark:text-slate-400 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap';
                            toolContent.textContent = data.content;

                            details.appendChild(summary);
                            details.appendChild(toolContent);
                            msgEl.appendChild(details);
                        }

                        scrollToBottom();

                    } catch(e) {
                        console.error('Error parsing JSON from stream:', e, dataStr);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Chat error:', error);
        appendMessage('assistant', 'Error: ' + error.message);
    } finally {
        isGenerating = false;
        chatInput.disabled = false;
        btnSendChat.classList.remove('hidden');
        btnStopChat.classList.add('hidden');
        aiStatusIndicator.classList.add('hidden');
        aiStatusIndicator.classList.remove('flex');
        chatInput.focus();
    }
});

function appendMessage(role, content, id = null) {
    if (chatMessages.querySelector('.opacity-50')) {
        chatMessages.innerHTML = ''; // Clear empty state
    }

    const wrapper = document.createElement('div');
    wrapper.className = `flex gap-4 ${role === 'user' ? 'justify-end' : 'justify-start'} max-w-4xl mx-auto w-full animate-fade-in-up`;
    
    const innerId = id ? `id="${id}-content"` : '';
    
    let avatar = '';
    let msgClass = '';

    if (role === 'user') {
        msgClass = 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm';
        wrapper.innerHTML = `
            <div class="flex-1"></div>
            <div class="max-w-[80%] ${msgClass} p-4 shadow-sm">
                <div class="prose prose-invert max-w-none text-sm">${DOMPurify.sanitize(marked.parse(content || ' '))}</div>
            </div>
            <div class="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
                <i data-lucide="user" class="w-4 h-4 text-white"></i>
            </div>
        `;
    } else {
        msgClass = 'bg-white dark:bg-dark-panel border border-slate-200 dark:border-dark-border text-slate-800 dark:text-slate-200 rounded-2xl rounded-tl-sm';
        wrapper.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 border border-slate-600">
                <i data-lucide="bot" class="w-4 h-4 text-slate-600 dark:text-slate-300"></i>
            </div>
            <div class="max-w-[80%] ${msgClass} p-4 shadow-sm w-full">
                <div ${innerId} class="prose prose-invert max-w-none text-sm">${content ? DOMPurify.sanitize(marked.parse(content)) : '<span class="animate-pulse flex items-center h-4"><span class="w-2 h-2 bg-slate-500 rounded-full mr-1"></span><span class="w-2 h-2 bg-slate-500 rounded-full mr-1"></span><span class="w-2 h-2 bg-slate-500 rounded-full"></span></span>'}</div>
            </div>
            <div class="flex-1"></div>
        `;
    }
    
    chatMessages.appendChild(wrapper);
    // Optimize performance: Only scan the new wrapper for icons instead of the whole document (prevents O(N^2) lag)
    lucide.createIcons({ root: wrapper });
    scrollToBottom();
}

btnNewChat.addEventListener('click', () => {
    currentSessionId = 'session_' + Date.now();
    chatMessages.innerHTML = `
        <div class="flex justify-center items-center h-full text-slate-500 dark:text-slate-500">
            <div class="text-center">
                <i data-lucide="bot" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
                <p>New Session Started.</p>
            </div>
        </div>
    `;
    // Optimize performance: Only scan the chatMessages container for icons instead of the whole document
    lucide.createIcons({ root: chatMessages });
});

// Skill Upload Logic
if (btnUploadSkill && fileUploadSkill) {
    btnUploadSkill.addEventListener('click', () => {
        fileUploadSkill.click();
    });

    fileUploadSkill.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.zip')) {
            alert('Please select a .zip file.');
            fileUploadSkill.value = '';
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        const originalHTML = btnUploadSkill.innerHTML;
        btnUploadSkill.innerHTML = '<span class="animate-pulse flex items-center h-4"><span class="w-1.5 h-1.5 bg-slate-300 rounded-full mr-1"></span><span class="w-1.5 h-1.5 bg-slate-300 rounded-full mr-1"></span><span class="w-1.5 h-1.5 bg-slate-300 rounded-full"></span></span>';

        try {
            const res = await fetch('/api/skills/upload', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                alert('Skill uploaded successfully!\n\n' + data.message);
            } else {
                alert('Error uploading skill: ' + (data.detail || data.message || 'Unknown error'));
            }
        } catch (err) {
            alert('Upload failed: ' + err.message);
        } finally {
            btnUploadSkill.innerHTML = originalHTML;
            fileUploadSkill.value = ''; // Reset input
        }
    });
}

// Settings Logic
btnSettings.addEventListener('click', async () => {
    const res = await fetch('/api/config');
    const config = await res.json();
    
    document.getElementById('config-base-url').value = config.base_url;
    document.getElementById('config-api-key').value = config.api_key;
    document.getElementById('config-model').value = config.models || '';
    document.getElementById('config-system-prompt').value = config.system_prompt;
    document.getElementById('config-workspace-dir').value = config.workspace_dir;
    document.getElementById('config-mcp-str').value = config.mcp_config_str;
    document.getElementById('config-skills-str').value = config.skills_config_str;
    
    document.getElementById('settings-modal').classList.remove('hidden');
    document.getElementById('settings-modal').classList.add('flex');
});

btnCloseSettings.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
    settingsModal.classList.remove('flex');
});

btnSaveSettings.addEventListener('click', async () => {
    const btnSaveSettings = document.getElementById('btn-save-settings');
    btnSaveSettings.textContent = 'Saving...';
    await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            base_url: document.getElementById('config-base-url').value,
            api_key: document.getElementById('config-api-key').value,
            models: document.getElementById('config-model').value,
            system_prompt: document.getElementById('config-system-prompt').value,
            workspace_dir: document.getElementById('config-workspace-dir').value,
            mcp_config_str: document.getElementById('config-mcp-str').value,
            skills_config_str: document.getElementById('config-skills-str').value
        })
    });
    btnSaveSettings.textContent = 'Saved!';
    setTimeout(() => {
        btnSaveSettings.textContent = 'Save Configurations';
        document.getElementById('btn-close-settings').click();
    }, 1000);
});


// Session Management
const sessionList = document.getElementById('session-list');

async function loadSessions() {
    try {
        const res = await fetch('/api/sessions');
        const data = await res.json();

        sessionList.innerHTML = '';
        data.sessions.forEach(session => {
            const btn = document.createElement('button');
            btn.className = `w-full text-left p-2 rounded hover:bg-slate-700 transition-colors truncate text-sm ${session.id === currentSessionId ? 'bg-slate-700 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-200'}`;
            btn.innerHTML = `<i data-lucide="message-square" class="w-4 h-4 inline-block mr-2 opacity-70"></i> ${session.title}`;
            btn.onclick = () => loadSession(session.id);
            sessionList.appendChild(btn);
        });
        lucide.createIcons({ root: sessionList });
    } catch (e) {
        console.error("Failed to load sessions:", e);
    }
}

async function loadSession(sessionId) {
    currentSessionId = sessionId;
    chatMessages.innerHTML = ''; // Clear current messages

    try {
        const res = await fetch(`/api/sessions/${sessionId}`);
        const data = await res.json();

        if (data.config_id) {
            configSwitcher.value = data.config_id;
            updateModelDropdown(data.config_id);
        } else {
            updateModelDropdown(configSwitcher.value);
        }

        if (data.model_id) {
            modelSwitcher.value = data.model_id;
        }

        if (data.history && data.history.length > 0) {
            // Skip the system prompt which is typically first
            const displayHistory = data.history.filter(msg => msg.role !== 'system');

            displayHistory.forEach(msg => {
                if (msg.role === 'user' || msg.role === 'assistant') {
                    // For assistant messages with tool calls, we don't have the clean stream chunking,
                    // so we append directly.
                    appendMessage(msg.role, msg.content || '');

                    if (msg.role === 'assistant' && msg.tool_calls) {
                         // Find the last added assistant message to append tool details
                         const lastMsgContent = chatMessages.lastElementChild.querySelector('.prose');
                         if(lastMsgContent) {
                             let toolHTML = '<details class="mt-2 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 text-xs font-mono">';
                             toolHTML += '<summary class="p-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 text-indigo-500 dark:text-indigo-400 select-none">Executing Tools (' + msg.tool_calls.length + ')</summary>';
                             toolHTML += '<div class="p-2 border-t border-slate-700 space-y-1">';
                             msg.tool_calls.forEach(tc => {
                                 toolHTML += `<div><span class="text-slate-500 dark:text-slate-500">${tc.function.name}</span></div>`;
                             });
                             toolHTML += '</div></details>';
                             lastMsgContent.innerHTML += DOMPurify.sanitize(toolHTML, {ADD_TAGS: ['details', 'summary']});
                         }
                    }
                } else if (msg.role === 'tool') {
                     const lastMsgContent = chatMessages.lastElementChild.querySelector('.prose');
                     if(lastMsgContent) {
                         const details = document.createElement('details');
                         details.className = 'mt-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 text-xs font-mono';

                         const summary = document.createElement('summary');
                         summary.className = 'p-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-600 dark:text-slate-400 select-none';
                         summary.textContent = 'Tool Output: ' + (msg.name || 'Unknown');

                         const toolContent = document.createElement('div');
                         toolContent.className = 'p-2 border-t border-slate-800 text-slate-600 dark:text-slate-400 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap';
                         toolContent.textContent = msg.content;

                         details.appendChild(summary);
                         details.appendChild(toolContent);
                         lastMsgContent.appendChild(details);
                     }
                }
            });
        } else {
             chatMessages.innerHTML = `
                <div class="flex justify-center items-center h-full text-slate-500 dark:text-slate-500">
                    <div class="text-center">
                        <i data-lucide="bot" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
                        <p>Empty Session.</p>
                    </div>
                </div>
            `;
            lucide.createIcons({ root: chatMessages });
        }

        loadSessions(); // Update active state in sidebar
        scrollToBottom();
    } catch (e) {
        console.error("Failed to load session history:", e);
    }
}

// Hook btnNewChat to refresh sidebar
const originalNewChat = btnNewChat.onclick;
btnNewChat.addEventListener('click', () => {
    loadSessions(); // Will highlight the new session once added
});

// Load sessions on startup
loadSessions();


// New UI Elements
const btnSudo = document.getElementById('btn-sudo');
const sudoModal = document.getElementById('sudo-modal');
const btnCloseSudo = document.getElementById('btn-close-sudo');
const btnSaveSudo = document.getElementById('btn-save-sudo');
const inputSudoPassword = document.getElementById('input-sudo-password');

const inputWorkspaceDir = document.getElementById('config-workspace-dir');
const inputMcpStr = document.getElementById('config-mcp-str');
const inputSkillsStr = document.getElementById('config-skills-str');
const settingsTabBtns = document.querySelectorAll('.settings-tab-btn');
const settingsTabs = document.querySelectorAll('.settings-tab');

// Tab Switching Logic
settingsTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active styling from all buttons
        settingsTabBtns.forEach(b => {
            b.classList.remove('bg-indigo-600', 'text-white');
            b.classList.add('hover:bg-slate-700', 'text-slate-600 dark:text-slate-400');
        });
        // Add active styling to clicked button
        btn.classList.add('bg-indigo-600', 'text-white');
        btn.classList.remove('hover:bg-slate-700', 'text-slate-600 dark:text-slate-400');

        // Hide all tabs
        settingsTabs.forEach(tab => tab.classList.add('hidden'));
        settingsTabs.forEach(tab => tab.classList.remove('block'));

        // Show target tab
        const targetId = btn.getAttribute('data-target');
        const targetTab = document.getElementById(targetId);
        if (targetTab) {
            targetTab.classList.remove('hidden');
            targetTab.classList.add('block');
        }
    });
});

// Sudo Modal Logic
btnSudo.addEventListener('click', () => {
    sudoModal.classList.remove('hidden');
    sudoModal.classList.add('flex');
});

btnCloseSudo.addEventListener('click', () => {
    sudoModal.classList.add('hidden');
    sudoModal.classList.remove('flex');
});

btnSaveSudo.addEventListener('click', async () => {
    btnSaveSudo.textContent = 'Saving...';
    await fetch('/api/sudo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sudo_password: inputSudoPassword.value
        })
    });
    btnSaveSudo.textContent = 'Granted!';
    // Optional: Visual feedback on the header button
    btnSudo.classList.remove('bg-red-600/20', 'text-red-400');
    btnSudo.classList.add('bg-green-600/20', 'text-green-400');
    btnSudo.innerHTML = '<i data-lucide="shield-check"></i> Rooted';
    lucide.createIcons({ root: btnSudo });

    setTimeout(() => {
        btnSaveSudo.textContent = 'Grant Sudo Access';
        btnCloseSudo.click();
    }, 1000);
});


import { getModelConfigs, getActiveModelConfig, setActiveModelId } from '../modelConfig';
import { getChatStateManager } from '../stateManager';
import { isActiveProviderConfigured, getActiveProviderType, getActiveProvider } from '../../webSearchProvider';
import { TOOL_NAMES } from '../tools/toolTypes';

export interface ChatSettingsOptions {
    onModeChange?: (mode: 'lock' | 'default' | 'explore') => void;
    onClose?: () => void;
}

export function showChatSettings(doc: Document, anchor: HTMLElement, options: ChatSettingsOptions = {}): void {
    Zotero.debug("[seerai] showChatSettings called");
    // Remove existing if open (check body scope)
    const existing = doc.getElementById('chat-settings-popover-portal');
    if (existing) {
        Zotero.debug("[seerai] Removing existing settings popover");
        existing.remove();
        return;
    }

    const rect = anchor.getBoundingClientRect();
    const win = doc.defaultView as Window;

    const container = doc.createElement('div');
    container.id = 'chat-settings-popover-portal';
    Object.assign(container.style, {
        position: 'fixed',
        // Position above the anchor (sidebar footer usually)
        bottom: `${win.innerHeight - rect.top + 8}px`,
        left: `${rect.left}px`,
        width: '240px',
        backgroundColor: 'var(--background-primary, #fff)',
        border: '1px solid var(--border-primary, #d1d1d1)',
        borderRadius: '8px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        // Removed overflow:hidden to allow dropdowns to potentially exceed if we change strategy later, 
        // but kept structure. 
        fontSize: '13px',
        color: 'var(--text-primary, #000)',
        zIndex: '200000', // Extreme high z-index
        pointerEvents: 'auto'
    });

    // Header
    const header = doc.createElement('div');
    Object.assign(header.style, {
        padding: '8px 10px',
        borderBottom: '1px solid var(--border-primary)',
        backgroundColor: 'var(--background-secondary, #f5f5f5)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontWeight: '600',
        fontSize: '12px'
    });
    header.innerHTML = '<span>Configuration</span>';
    container.appendChild(header);

    const body = doc.createElement('div');
    Object.assign(body.style, {
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px', // Reduce gap for compactness
        maxHeight: '350px',
        overflowY: 'auto'
    });

    // --- 1. Model Selection (Custom dropdown to avoid XUL <select> issues) ---
    const modelSection = doc.createElement('div');
    modelSection.style.position = 'relative';

    const modelLabel = doc.createElement('div');
    modelLabel.innerText = 'AI Model';
    modelLabel.style.marginBottom = '4px';
    modelLabel.style.fontSize = '11px';
    modelLabel.style.color = 'var(--text-secondary, #666)';
    modelSection.appendChild(modelLabel);

    const configs = getModelConfigs();
    const activeConfig = getActiveModelConfig();

    // Custom dropdown button
    const modelButton = doc.createElement('div');
    Object.assign(modelButton.style, {
        width: '100%',
        padding: '6px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        border: '1px solid var(--border-primary)',
        backgroundColor: 'var(--background-secondary, #f5f5f5)',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxSizing: 'border-box'
    });
    modelButton.innerText = activeConfig?.name || (configs.length === 0 ? 'Default' : configs[0]?.name || 'Select Model');

    // Dropdown arrow
    const arrow = doc.createElement('span');
    arrow.innerText = '▼';
    arrow.style.fontSize = '8px';
    arrow.style.marginLeft = '8px';
    modelButton.appendChild(arrow);

    // Dropdown options container
    const optionsContainer = doc.createElement('div');
    Object.assign(optionsContainer.style, {
        position: 'absolute',
        top: '100%',
        left: '0',
        right: '0',
        backgroundColor: 'var(--background-primary, #fff)',
        border: '1px solid var(--border-primary)',
        borderRadius: '4px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
        zIndex: '10005',
        display: 'none',
        maxHeight: '150px',
        overflowY: 'auto'
    });

    // Populate options
    if (configs.length === 0) {
        const optEl = doc.createElement('div');
        Object.assign(optEl.style, {
            padding: '8px 10px',
            fontSize: '12px',
            color: 'var(--text-secondary)'
        });
        optEl.innerText = 'No models configured';
        optionsContainer.appendChild(optEl);
    } else {
        configs.forEach(cfg => {
            const optEl = doc.createElement('div');
            Object.assign(optEl.style, {
                padding: '8px 10px',
                fontSize: '12px',
                cursor: 'pointer',
                backgroundColor: (activeConfig && cfg.id === activeConfig.id) ? 'var(--background-secondary)' : 'transparent',
                fontWeight: (activeConfig && cfg.id === activeConfig.id) ? '600' : 'normal'
            });
            optEl.innerText = cfg.name;

            optEl.addEventListener('mouseenter', () => {
                optEl.style.backgroundColor = 'var(--background-tertiary, #e0e0e0)';
            });
            optEl.addEventListener('mouseleave', () => {
                optEl.style.backgroundColor = (activeConfig && cfg.id === activeConfig.id) ? 'var(--background-secondary)' : 'transparent';
            });

            optEl.addEventListener('click', (e) => {
                e.stopPropagation();
                setActiveModelId(cfg.id);
                modelButton.childNodes[0].textContent = cfg.name;
                optionsContainer.style.display = 'none';
                Zotero.debug(`[seerai] Model changed to ${cfg.id} (${cfg.name})`);
            });

            optionsContainer.appendChild(optEl);
        });
    }

    // Toggle dropdown
    modelButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        Zotero.debug("[seerai] Model button clicked");
        const isVisible = optionsContainer.style.display === 'block';
        optionsContainer.style.display = isVisible ? 'none' : 'block';
    });

    modelSection.appendChild(modelButton);
    modelSection.appendChild(optionsContainer);
    body.appendChild(modelSection);

    // --- 2. Context Mode ---
    const stateManager = getChatStateManager();
    const currentMode = stateManager.getOptions().selectionMode;

    const modeSection = doc.createElement('div');
    const modeLabel = doc.createElement('div');
    modeLabel.innerText = 'Context Mode';
    modeLabel.style.marginBottom = '4px';
    modeLabel.style.fontSize = '11px';
    modeLabel.style.color = 'var(--text-secondary, #666)';
    modeSection.appendChild(modeLabel);

    const modeContainer = doc.createElement('div');
    Object.assign(modeContainer.style, {
        display: 'flex',
        backgroundColor: 'var(--background-secondary)',
        borderRadius: '4px',
        padding: '2px',
        border: '1px solid var(--border-primary)'
    });

    const modes = [
        { value: 'lock', label: '🔒', title: 'Lock: Manual only' },
        { value: 'default', label: '📌', title: 'Focus: Single item' },
        { value: 'explore', label: '📚', title: 'Explore: Additive' }
    ];

    modes.forEach(m => {
        const btn = doc.createElement('div');
        Object.assign(btn.style, {
            flex: '1',
            textAlign: 'center',
            padding: '4px 2px',
            fontSize: '12px',
            cursor: 'pointer',
            borderRadius: '3px',
            transition: 'background 0.2s'
        });
        btn.innerText = m.label;
        btn.title = m.title;

        if (m.value === currentMode) {
            btn.style.backgroundColor = 'var(--background-primary)';
            btn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
            btn.style.fontWeight = '600';
        } else {
            btn.style.color = 'var(--text-secondary)';
        }

        btn.addEventListener('click', () => {
            // Update UI visually
            Array.from(modeContainer.children).forEach((child: any) => {
                child.style.backgroundColor = 'transparent';
                child.style.boxShadow = 'none';
                child.style.fontWeight = 'normal';
                child.style.color = 'var(--text-secondary)';
            });
            btn.style.backgroundColor = 'var(--background-primary)';
            btn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
            btn.style.fontWeight = '600';
            btn.style.color = 'var(--text-primary)';

            stateManager.setOptions({ selectionMode: m.value as any });
            // Persist selection mode to preferences
            Zotero.Prefs.set("extensions.seerai.selectionMode", m.value);
            Zotero.debug(`[seerai] Selection mode changed to: ${m.value}`);
            options.onModeChange?.(m.value as any);
        });

        modeContainer.appendChild(btn);
    });
    modeSection.appendChild(modeContainer);
    body.appendChild(modeSection);

    // --- 3. Web Search ---
    if (isActiveProviderConfigured()) {
        const webSection = doc.createElement('div');
        const webHeader = doc.createElement('div');
        Object.assign(webHeader.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '4px'
        });

        const webLabel = doc.createElement('div');
        webLabel.innerText = 'Web Search';
        webLabel.style.fontSize = '11px';
        webLabel.style.color = 'var(--text-secondary, #666)';

        // Toggle Switch
        const toggleWrapper = doc.createElement('div');
        Object.assign(toggleWrapper.style, {
            position: 'relative',
            width: '28px',
            height: '16px',
            backgroundColor: stateManager.getOptions().webSearchEnabled ? '#4cd964' : '#e5e5ea',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'background 0.2s'
        });

        const toggleKnob = doc.createElement('div');
        Object.assign(toggleKnob.style, {
            position: 'absolute',
            top: '2px',
            left: stateManager.getOptions().webSearchEnabled ? '14px' : '2px',
            width: '12px',
            height: '12px',
            backgroundColor: '#fff',
            borderRadius: '50%',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
            transition: 'left 0.2s'
        });

        const helperContainer = doc.createElement('div');
        helperContainer.style.width = '28px';
        helperContainer.style.height = '16px';
        helperContainer.appendChild(toggleWrapper);
        toggleWrapper.appendChild(toggleKnob);

        // Limit container forward decl
        const limitContainer = doc.createElement('div');

        helperContainer.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent closing
            const current = stateManager.getOptions().webSearchEnabled;
            const newState = !current;
            stateManager.setOptions({ webSearchEnabled: newState });

            // Update UI
            toggleWrapper.style.backgroundColor = newState ? '#4cd964' : '#e5e5ea';
            toggleKnob.style.left = newState ? '14px' : '2px';
            limitContainer.style.display = newState ? 'flex' : 'none';
        });

        webHeader.appendChild(webLabel);
        webHeader.appendChild(helperContainer);
        webSection.appendChild(webHeader);

        // Limit & Concurrent Inputs
        Object.assign(limitContainer.style, {
            display: stateManager.getOptions().webSearchEnabled ? 'flex' : 'none',
            justifyContent: 'flex-start', // Left align
            gap: '12px',
            alignItems: 'center',
            fontSize: '11px',
            marginTop: '2px',
            paddingLeft: '4px'
        });

        limitContainer.innerHTML = '<span>Results:</span>';
        const prefPrefix = 'extensions.seerai';

        const limitInput = doc.createElement('input');
        limitInput.type = 'number';
        limitInput.min = '1';
        limitInput.max = '10';
        const currentLimit = getActiveProvider().getSearchLimit();
        limitInput.value = String(currentLimit);

        Object.assign(limitInput.style, {
            width: '40px',
            padding: '2px',
            fontSize: '11px',
            border: '1px solid var(--border-primary)',
            borderRadius: '4px',
            textAlign: 'center'
        });

        limitInput.addEventListener('change', () => {
            const val = parseInt(limitInput.value);
            if (val >= 1 && val <= 20) {
                const providerType = getActiveProviderType();
                if (providerType === 'tavily') {
                    Zotero.Prefs.set(`${prefPrefix}.tavilySearchLimit`, val);
                } else {
                    Zotero.Prefs.set(`${prefPrefix}.firecrawlSearchLimit`, val);
                }
            }
        });
        limitInput.addEventListener('click', (e) => e.stopPropagation());

        limitContainer.appendChild(limitInput);

        webSection.appendChild(limitContainer);
        body.appendChild(webSection);
    }

    // --- 4. Agent Config (Max Iterations & Auto-OCR) ---
    const configSection = doc.createElement('div');
    configSection.style.marginTop = '8px';
    configSection.style.borderTop = '1px solid var(--border-primary)';
    configSection.style.paddingTop = '8px';
    configSection.style.display = 'flex';
    configSection.style.flexDirection = 'column';
    configSection.style.gap = '8px';

    // Header
    const configHeader = doc.createElement('div');
    configHeader.innerText = 'Agent Settings';
    configHeader.style.marginBottom = '2px';
    configHeader.style.fontSize = '11px';
    configHeader.style.color = 'var(--text-secondary, #666)';
    configSection.appendChild(configHeader);

    // Max Iterations Row
    const iterRow = doc.createElement('div');
    Object.assign(iterRow.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '11px'
    });

    const iterLabel = doc.createElement('span');
    iterLabel.innerText = 'Max Iterations:';

    const iterInput = doc.createElement('input');
    iterInput.type = 'number';
    iterInput.min = '1';
    iterInput.max = '50';
    const currentMaxIter = Zotero.Prefs.get("extensions.seerai.agentMaxIterations") || 10;
    iterInput.value = String(currentMaxIter);
    Object.assign(iterInput.style, {
        width: '40px',
        padding: '2px',
        fontSize: '11px',
        border: '1px solid var(--border-primary)',
        borderRadius: '4px',
        textAlign: 'center'
    });

    iterInput.addEventListener('change', () => {
        let val = parseInt(iterInput.value);
        if (val < 1) val = 1;
        if (val > 50) val = 50;
        iterInput.value = String(val);
        Zotero.Prefs.set("extensions.seerai.agentMaxIterations", val);
        Zotero.debug(`[seerai] Max iterations set to ${val}`);
    });
    iterInput.addEventListener('click', (e) => e.stopPropagation());

    iterRow.appendChild(iterLabel);
    iterRow.appendChild(iterInput);
    configSection.appendChild(iterRow);

    // Auto-OCR Row
    const ocrRow = doc.createElement('div');
    Object.assign(ocrRow.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '11px'
    });

    const ocrLabel = doc.createElement('span');
    ocrLabel.innerText = 'Auto-OCR Papers:';

    // Toggle Switch for OCR
    const ocrToggleWrapper = doc.createElement('div');
    const isOcrEnabled = Zotero.Prefs.get("extensions.seerai.agentAutoOcr") || false;

    Object.assign(ocrToggleWrapper.style, {
        position: 'relative',
        width: '28px',
        height: '16px',
        backgroundColor: isOcrEnabled ? '#4cd964' : '#e5e5ea',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'background 0.2s'
    });

    const ocrToggleKnob = doc.createElement('div');
    Object.assign(ocrToggleKnob.style, {
        position: 'absolute',
        top: '2px',
        left: isOcrEnabled ? '14px' : '2px',
        width: '12px',
        height: '12px',
        backgroundColor: '#fff',
        borderRadius: '50%',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        transition: 'left 0.2s'
    });

    ocrToggleWrapper.appendChild(ocrToggleKnob);

    ocrToggleWrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        const current = Zotero.Prefs.get("extensions.seerai.agentAutoOcr") || false;
        const newState = !current;
        Zotero.Prefs.set("extensions.seerai.agentAutoOcr", newState);

        // Update UI
        ocrToggleWrapper.style.backgroundColor = newState ? '#4cd964' : '#e5e5ea';
        ocrToggleKnob.style.left = newState ? '14px' : '2px';
        Zotero.debug(`[seerai] Auto-OCR set to ${newState}`);
    });

    ocrRow.appendChild(ocrLabel);
    ocrRow.appendChild(ocrToggleWrapper);
    configSection.appendChild(ocrRow);

    body.appendChild(configSection);

    // --- 5. Tool Permissions ---
    const permSection = doc.createElement('div');
    permSection.style.marginTop = '8px';
    permSection.style.borderTop = '1px solid var(--border-primary)';
    permSection.style.paddingTop = '8px';

    // Collapsible Header
    const permHeader = doc.createElement('div');
    Object.assign(permHeader.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer',
        fontSize: '11px',
        color: 'var(--text-secondary, #666)',
        userSelect: 'none'
    });

    const permLabel = doc.createElement('div');
    permLabel.innerText = 'Tool Permissions';
    const permIcon = doc.createElement('span');
    permIcon.innerText = '▶'; // Collapsed state
    permIcon.style.fontSize = '8px';
    permIcon.style.transition = 'transform 0.2s';

    permHeader.appendChild(permLabel);
    permHeader.appendChild(permIcon);
    permSection.appendChild(permHeader);

    // List Container (Hidden by default)
    const permList = doc.createElement('div');
    Object.assign(permList.style, {
        display: 'none',
        flexDirection: 'column',
        gap: '2px', // Compact
        marginTop: '6px',
        maxHeight: '200px',
        overflowY: 'auto',
        fontSize: '11px',
        border: '1px solid var(--border-secondary, #eee)',
        borderRadius: '4px',
        padding: '2px'
    });

    // Toggle behavior
    permHeader.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = permList.style.display === 'none';
        permList.style.display = isHidden ? 'flex' : 'none';
        permIcon.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
    });

    // Tool List Logic
    const toolDisplayNames: Record<string, string> = {
        [TOOL_NAMES.SEARCH_LIBRARY]: "Search Library",
        [TOOL_NAMES.GET_ITEM_METADATA]: "Get Metadata",
        [TOOL_NAMES.READ_ITEM_CONTENT]: "Read Content",
        [TOOL_NAMES.SEARCH_EXTERNAL]: "Search External",
        [TOOL_NAMES.IMPORT_PAPER]: "Import Paper",
        [TOOL_NAMES.GENERATE_ITEM_TAGS]: "Generate Tags",
        [TOOL_NAMES.CONTEXT]: "Conversation Context",
        [TOOL_NAMES.COLLECTION]: "Zotero Collections",
        [TOOL_NAMES.TABLE]: "Analysis Tables",
        [TOOL_NAMES.NOTE]: "Zotero Notes",
        [TOOL_NAMES.RELATED_PAPERS]: "Related Papers",
        [TOOL_NAMES.WEB]: "Web Tools",
    };

    // --- BULK ACTIONS ---
    const bulkContainer = doc.createElement('div');
    Object.assign(bulkContainer.style, {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '6px',
        padding: '0 2px'
    });

    const createBulkBtn = (label: string, mode: string, title: string) => {
        const btn = doc.createElement('div');
        Object.assign(btn.style, {
            fontSize: '10px',
            padding: '2px 6px',
            borderRadius: '3px',
            cursor: 'pointer',
            backgroundColor: 'var(--background-secondary)',
            border: '1px solid var(--border-primary)',
            color: 'var(--text-primary)'
        });
        btn.innerText = label;
        btn.title = title;

        btn.onmouseover = () => btn.style.backgroundColor = 'var(--background-tertiary)';
        btn.onmouseout = () => btn.style.backgroundColor = 'var(--background-secondary)';

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const allTools = Object.values(TOOL_NAMES);
            const perms: Record<string, string> = {};
            allTools.forEach(t => perms[t] = mode);
            Zotero.Prefs.set("extensions.seerai.tool_permissions", JSON.stringify(perms));
            // Update UI
            renderToolList(perms);
            Zotero.debug(`[seerai] Bulk set all tools to: ${mode}`);
        });

        return btn;
    };

    bulkContainer.appendChild(createBulkBtn("✅ All", "allow", "Allow All Tools"));
    bulkContainer.appendChild(createBulkBtn("❓ All", "ask", "Ask for All Tools"));
    bulkContainer.appendChild(createBulkBtn("⛔ All", "deny", "Disable All Tools"));
    permList.appendChild(bulkContainer);

    const toolsContainer = doc.createElement('div');
    toolsContainer.style.display = 'flex';
    toolsContainer.style.flexDirection = 'column';
    permList.appendChild(toolsContainer);

    const renderToolList = (currentPerms: Record<string, string>) => {
        toolsContainer.innerHTML = ''; // Clear existing
        const allTools = Object.values(TOOL_NAMES);

        allTools.forEach(toolKey => {
            const row = doc.createElement('div');
            Object.assign(row.style, {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '2px 4px',
                borderRadius: '2px',
            });

            // Hover effect
            row.onmouseover = () => { row.style.background = "var(--fill-quinary, rgba(0,0,0,0.02))"; };
            row.onmouseout = () => { row.style.background = "transparent"; };

            const nameLabel = doc.createElement('span');
            nameLabel.innerText = toolDisplayNames[toolKey] || toolKey;
            nameLabel.title = toolKey; // Tooltip full name
            nameLabel.style.overflow = "hidden";
            nameLabel.style.textOverflow = "ellipsis";
            nameLabel.style.whiteSpace = "nowrap";
            nameLabel.style.flex = "1";

            // Status Button
            const statusBtn = doc.createElement('div');
            const perm = currentPerms[toolKey] || 'allow';

            const updateStatusIcon = (p: string) => {
                if (p === 'allow') {
                    statusBtn.innerText = '✅';
                    statusBtn.title = "Allowed";
                    statusBtn.style.opacity = '1';
                } else if (p === 'ask') {
                    statusBtn.innerText = '❓';
                    statusBtn.title = "Ask Me";
                    statusBtn.style.opacity = '0.8';
                } else {
                    statusBtn.innerText = '⛔';
                    statusBtn.title = "Disabled";
                    statusBtn.style.opacity = '0.6';
                }
            };

            updateStatusIcon(perm);
            statusBtn.style.cursor = 'pointer';
            statusBtn.style.fontSize = '12px';
            statusBtn.style.width = '20px';
            statusBtn.style.textAlign = 'center';

            // Cycle Click Handler
            statusBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Refresh perms to ensure we have latest state if modified elsewhere
                const freshPermsStr = Zotero.Prefs.get("extensions.seerai.tool_permissions") as string;
                let freshPerms: Record<string, string> = {};
                try { freshPerms = JSON.parse(freshPermsStr || "{}"); } catch (e) { }

                const curr = freshPerms[toolKey] || 'allow';
                let next = 'allow';
                if (curr === 'allow') next = 'ask';
                else if (curr === 'ask') next = 'deny';
                else next = 'allow';

                freshPerms[toolKey] = next;
                Zotero.Prefs.set("extensions.seerai.tool_permissions", JSON.stringify(freshPerms));

                updateStatusIcon(next);
                Zotero.debug(`[seerai] Tool permission changed: ${toolKey} -> ${next}`);
            });

            row.appendChild(nameLabel);
            row.appendChild(statusBtn);
            toolsContainer.appendChild(row);
        });
    };

    const currentPermsStr = Zotero.Prefs.get("extensions.seerai.tool_permissions") as string;
    let currentPerms: Record<string, string> = {};
    try {
        currentPerms = JSON.parse(currentPermsStr || "{}");
    } catch (e) { }
    renderToolList(currentPerms);

    permSection.appendChild(permList);
    body.appendChild(permSection);

    container.appendChild(body);
    const mountPoint = doc.body || doc.documentElement;
    if (mountPoint) {
        mountPoint.appendChild(container);
    }

    // Close on mousedown outside
    const closeHandler = (e: MouseEvent) => {
        // If click is not inside the container AND not on the anchor button
        if (!container.contains(e.target as Node) && !anchor.contains(e.target as Node)) {
            Zotero.debug("[seerai] Click outside detected, closing settings");
            container.remove();
            doc.removeEventListener('mousedown', closeHandler);
        }
    };

    // Defer to avoid immediate close
    setTimeout(() => doc.addEventListener('mousedown', closeHandler), 0);
}

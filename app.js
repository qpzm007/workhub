

const URGENCY_MAP = {
    'urgent_important':          { label: '긴급.중요', bg: '#0f172a', text: 'white',      icon: '🔴', desc: 'Do it now' },
    'not_urgent_important':      { label: '중요.여유', bg: '#1d4ed8', text: 'white',      icon: '🔵', desc: 'Schedule it' },
    'urgent_not_important':      { label: '긴급.위임', bg: '#e0f2fe', text: 'slate-800',  icon: '🩵', desc: 'Delegate it' },
    'not_urgent_not_important':  { label: '여유.위임', bg: '#ffffff', text: 'slate-800', icon: '⬜', desc: 'Eliminate it' }
};

// --- Editor.js Setup & Expand Panel ---
let editorInstance = null;
const edjsParser = typeof editorjsHTML !== 'undefined' ? editorjsHTML({
    taskLink: function(block) {
        return `<a href="#" style="display:block; padding:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; text-decoration:none; color:#1e293b; font-weight:bold;">🔗 [${block.data.status}] ${block.data.title}</a>`;
    }
}) : null;

document.addEventListener("DOMContentLoaded", () => {
    // Expand Panel Logic
    const btnExpand = document.getElementById("btn-expand-task-detail");
    const panel = document.getElementById("task-detail-panel");
    if (btnExpand && panel) {
        btnExpand.addEventListener("click", (e) => {
            e.stopPropagation();
            panel.classList.toggle("panel-expanded");
            const metadataGrid = document.getElementById("task-detail-metadata-grid");
            
            if (panel.classList.contains("panel-expanded")) {
                panel.classList.remove("sm:w-[450px]", "sm:w-[500px]", "border-l");
                panel.classList.add("sm:w-full", "fixed", "inset-0", "z-[60]", "sm:max-w-none");
                btnExpand.innerHTML = '<i class="fa-solid fa-compress text-lg"></i>';
                
                // 구글 독스처럼 세로 높이를 대폭 확장
                const editorContainer = document.getElementById("task-detail-editor").parentElement;
                editorContainer.classList.remove("min-h-[300px]");
                editorContainer.classList.add("min-h-[75vh]");
            } else {
                panel.classList.add("sm:w-[500px]", "border-l");
                panel.classList.remove("sm:w-full", "inset-0", "z-[60]", "sm:max-w-none");
                btnExpand.innerHTML = '<i class="fa-solid fa-expand text-lg"></i>';
                
                // 원래 높이로 복귀
                const editorContainer = document.getElementById("task-detail-editor").parentElement;
                editorContainer.classList.remove("min-h-[75vh]");
                editorContainer.classList.add("min-h-[300px]");
            }
        });
    }

    // Google Docs Copy Logic
    const btnCopyDocs = document.getElementById("btn-copy-docs");
    if (btnCopyDocs) {
        btnCopyDocs.addEventListener("click", async () => {
            if (!editorInstance || !edjsParser) return;
            try {
                const outputData = await editorInstance.save();
                const htmlArray = edjsParser.parse(outputData);
                const htmlContent = htmlArray.join('\\n');
                
                const blob = new Blob([htmlContent], { type: 'text/html' });
                const data = [new ClipboardItem({ 'text/html': blob })];
                
                navigator.clipboard.write(data).then(() => {
                    showToast("구글 독스용 서식이 복사되었습니다. (Ctrl+V)", "success");
                });
            } catch(e) {
                console.error("Copy failed", e);
                showToast("복사 실패.", "error");
            }
        });
    }
});

function initEditor(initialData) {
    if (editorInstance) {
        try {
            editorInstance.destroy();
        } catch(e) { console.error(e); }
        editorInstance = null;
    }
    
    // Parse legacy HTML strings to a simple block if needed
    let parsedData = {};
    if (typeof initialData === 'string' && initialData.trim() !== '') {
        try {
            parsedData = JSON.parse(initialData);
        } catch (e) {
            // Fallback for legacy raw text/HTML
            if (initialData === "[object Object]") {
                parsedData = {};
            } else {
                parsedData = {
                    blocks: [{ type: "paragraph", data: { text: initialData } }]
                };
            }
        }
    } else if (typeof initialData === 'object' && initialData !== null) {
        parsedData = initialData;
    }

    editorInstance = new EditorJS({
        holder: 'task-detail-editor',
        placeholder: '노션처럼 자유롭게 작성하세요... (/ 입력 시 명령어)',
        data: parsedData,
        onChange: () => {
            if (typeof window.triggerAutoSave === 'function') {
                window.triggerAutoSave();
            }
        },
        tools: {
            header: typeof Header !== 'undefined' ? Header : null,
            list: typeof EditorjsList !== 'undefined' ? EditorjsList : (typeof List !== 'undefined' ? List : null),
            checklist: typeof Checklist !== 'undefined' ? Checklist : null,
            marker: typeof Marker !== 'undefined' ? Marker : null,
            delimiter: typeof Delimiter !== 'undefined' ? Delimiter : null,
            taskLink: typeof TaskLinker !== 'undefined' ? TaskLinker : null, // Custom plugin
            image: typeof ImageTool !== 'undefined' ? {
                class: ImageTool,
                config: {
                    uploader: {
                        uploadByFile(file) {
                            return new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.readAsDataURL(file);
                                reader.onload = () => {
                                    fetch('/api/images/upload', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ filename: file.name || 'image.png', base64: reader.result })
                                    })
                                    .then(res => res.json())
                                    .then(res => {
                                        if(res.success) {
                                            resolve({ success: 1, file: { url: res.file.url } });
                                        } else {
                                            reject('Upload failed');
                                        }
                                    }).catch(reject);
                                };
                                reader.onerror = error => reject(error);
                            });
                        }
                    }
                }
            } : null
    }
    });

    // Network View State
    state.isNetworkView = false;
    state.networkAssignee = null;
    state.networkMembers = [];
}
// ----------------------------------------



// WorkHub Application Engine - Full Stack File System Integration & Department Routing

let kanbanSearchQuery = "";

// === 이벤트 위임: 좌측 메뉴 클릭을 document에서 처리 (DOMContentLoaded 내부 에러에 독립적) ===
document.addEventListener("click", function(e) {
    const btn = e.target.closest(".nav-btn, .mobile-nav-btn");
    if (btn) {
        e.preventDefault();
        const view = btn.getAttribute("data-view");
        if (view && typeof window.switchView === "function") {
            window.switchView(view);
        }
    }
    const folderBtn = e.target.closest(".folder-nav-btn");
    if (folderBtn) {
        e.preventDefault();
        const folderName = folderBtn.getAttribute("data-folder");
        if (folderName && typeof window.switchView === "function") {
            if (window._workHubState) window._workHubState.currentExplorerPath = folderName;
            window.switchView("folders", folderName);
        }
    }
});

document.addEventListener("DOMContentLoaded", () => {
try {
    console.log('[WorkHub] DOMContentLoaded 시작');
    // Settings Logic added dynamically
    const saveBtn = document.getElementById('btn-save-settings');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const apiKey = document.getElementById('setting-api-key').value;
            const syncPath = document.getElementById('setting-sync-path').value;
            const aiContext = document.getElementById('setting-ai-context').value;
            
            const dbPathTasks = document.getElementById('setting-db-tasks').value;
            const dbPathWorkCards = document.getElementById('setting-db-workcards').value;
            
            const customNames = {
                dashboard: document.getElementById('setting-name-dashboard').value,
                search: document.getElementById('setting-name-search').value,
                vendors: document.getElementById('setting-name-vendors').value,
                components: document.getElementById('setting-name-components').value,
                orders: document.getElementById('setting-name-orders').value,
                allTasks: document.getElementById('setting-name-all-tasks').value
            };
            
            fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: apiKey,
                    desktopSyncPath: syncPath,
                    aiContext: aiContext,
                    customNames: customNames,
                    dbPathTasks: dbPathTasks,
                    dbPathWorkCards: dbPathWorkCards
                })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    updateSettingsStatus(apiKey, syncPath, dbPathTasks, dbPathWorkCards);
                    updateCustomNamesUI(customNames);
                    loadedCustomNames = customNames; // update local cached copy
                    const alertBox = document.createElement('div');
                    alertBox.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg z-50';
                    alertBox.textContent = '설정이 성공적으로 저장되었습니다!';
                    document.body.appendChild(alertBox);
                    setTimeout(() => alertBox.remove(), 3000);
                    
                    // Reload folders and files from the new path
                    if (typeof loadStateFromServer === 'function') {
                        loadStateFromServer();
                    }
                } else {
                    alert('설정 저장 실패: ' + (data.message || '알 수 없는 오류'));
                }
            })
            .catch(e => {
                console.error(e);
                alert('서버 오류로 설정을 저장하지 못했습니다.');
            });
        });
    }

    const clearApiBtn = document.getElementById('btn-clear-api-key');
    if (clearApiBtn) {
        clearApiBtn.addEventListener('click', () => {
            document.getElementById('setting-api-key').value = '';
            if (saveBtn) saveBtn.click();
        });
    }

    const clearSyncBtn = document.getElementById('btn-clear-sync-path');
    if (clearSyncBtn) {
        clearSyncBtn.addEventListener('click', () => {
            document.getElementById('setting-sync-path').value = '';
            if (saveBtn) saveBtn.click();
        });
    }

    const clearAiContextBtn = document.getElementById('btn-clear-ai-context');
    if (clearAiContextBtn) {
        clearAiContextBtn.addEventListener('click', () => {
            document.getElementById('setting-ai-context').value = '';
            if (saveBtn) saveBtn.click();
        });
    }

    const clearDbTasksBtn = document.getElementById('btn-clear-db-tasks');
    if (clearDbTasksBtn) {
        clearDbTasksBtn.addEventListener('click', () => {
            document.getElementById('setting-db-tasks').value = '';
            if (saveBtn) saveBtn.click();
        });
    }

    const clearDbWorkCardsBtn = document.getElementById('btn-clear-db-workcards');
    if (clearDbWorkCardsBtn) {
        clearDbWorkCardsBtn.addEventListener('click', () => {
            document.getElementById('setting-db-workcards').value = '';
            if (saveBtn) saveBtn.click();
        });
    }

    function updateSettingsStatus(apiKey, syncPath, dbPathTasks, dbPathWorkCards) {
        const apiStatus = document.getElementById('status-api-key');
        const syncStatus = document.getElementById('status-sync-path');
        const tasksDbStatus = document.getElementById('status-db-tasks');
        const workcardsDbStatus = document.getElementById('status-db-workcards');
        
        if (apiStatus) {
            if (apiKey && apiKey.trim() !== '') {
                apiStatus.textContent = '등록됨';
                apiStatus.className = 'text-xs font-bold px-2 py-1 rounded bg-green-50 text-green-600';
            } else {
                apiStatus.textContent = '비워있음';
                apiStatus.className = 'text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-500';
            }
        }
        
        if (syncStatus) {
            if (syncPath && syncPath.trim() !== '') {
                syncStatus.textContent = '등록됨';
                syncStatus.className = 'text-xs font-bold px-2 py-1 rounded bg-green-50 text-green-600';
            } else {
                syncStatus.textContent = '비워있음';
                syncStatus.className = 'text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-500';
            }
        }

        if (tasksDbStatus) {
            if (dbPathTasks && dbPathTasks.trim() !== '') {
                tasksDbStatus.textContent = '개별 설정됨';
                tasksDbStatus.className = 'text-xs font-bold px-2 py-1 rounded bg-rose-50 text-rose-600';
            } else {
                tasksDbStatus.textContent = '기본값 (로컬)';
                tasksDbStatus.className = 'text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-500';
            }
        }

        if (workcardsDbStatus) {
            if (dbPathWorkCards && dbPathWorkCards.trim() !== '') {
                workcardsDbStatus.textContent = '개별 설정됨';
                workcardsDbStatus.className = 'text-xs font-bold px-2 py-1 rounded bg-rose-50 text-rose-600';
            } else {
                workcardsDbStatus.textContent = '기본값 (로컬)';
                workcardsDbStatus.className = 'text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-500';
            }
        }
    }

    function updateCustomNamesUI(customNames) {
        if (!customNames) return;
        
        const views = {
            'dashboard': customNames.dashboard || '대시보드',
            'search': customNames.search || '통합 검색 (Everything)',
            'vendors': customNames.vendors || '명함첩 (WorkCard)',
            'components': customNames.components || '공유 자료실 (양식/도면)',
            'orders': customNames.orders || '프로젝트 & 업무 관리',
            'all-tasks': customNames.allTasks || '전체 업무 리스트'
        };

        // 1. Update Desktop Sidebar Labels
        document.querySelectorAll('#sidebar .nav-btn').forEach(btn => {
            const view = btn.getAttribute('data-view');
            if (view && views[view]) {
                const span = btn.querySelector('span');
                if (span) span.textContent = views[view];
            }
        });

        // 2. Update Mobile Sidebar Labels
        document.querySelectorAll('#mobile-sidebar .mobile-nav-btn').forEach(btn => {
            const view = btn.getAttribute('data-view');
            if (view && views[view]) {
                const span = btn.querySelector('span');
                if (span) span.textContent = views[view];
            }
        });

        // 3. Update Dashboard Stats Card Labels
        const vendorCardLabel = document.querySelector('#stat-vendors-count')?.previousElementSibling;
        if (vendorCardLabel) vendorCardLabel.textContent = views['vendors'];

        const componentCardLabel = document.querySelector('#stat-components-count')?.previousElementSibling;
        if (componentCardLabel) componentCardLabel.textContent = views['components'];

        const orderCardLabel = document.querySelector('#stat-orders-value')?.previousElementSibling;
        if (orderCardLabel) orderCardLabel.textContent = views['orders'];
        
        // 4. Update page main headers
        const vendorsHeader = document.querySelector('#view-vendors h1');
        if (vendorsHeader) vendorsHeader.textContent = views['vendors'];
        
        const componentsHeader = document.querySelector('#view-components h1');
        if (componentsHeader) componentsHeader.textContent = views['components'];
        
        const ordersHeader = document.querySelector('#view-orders h1');
        if (ordersHeader) ordersHeader.textContent = views['orders'];
        
        const allTasksHeader = document.querySelector('#view-all-tasks h1');
        if (allTasksHeader) allTasksHeader.textContent = views['all-tasks'];
        // 5. Update Search Filter Dropdown Options
        const filterOptVendors = document.getElementById('filter-opt-vendors');
        if (filterOptVendors) filterOptVendors.textContent = views['vendors'];
        
        const filterOptComponents = document.getElementById('filter-opt-components');
        if (filterOptComponents) filterOptComponents.textContent = views['components'];
        
        const filterOptOrders = document.getElementById('filter-opt-orders');
        if (filterOptOrders) filterOptOrders.textContent = views['orders'];
    }

    let loadedAiContext = '';
    let loadedCustomNames = {};

    // Initialize settings values on load
    fetch('/api/settings')
        .then(r => r.json())
        .then(data => {
            const currentApi = data.apiKey || '';
            const currentSync = data.desktopSyncPath || '';
            state.apiKey = currentApi;
            state.syncPath = currentSync;
            const currentAiContext = data.aiContext || '';
            const currentCustomNames = data.customNames || {};
            const currentDbPathTasks = data.dbPathTasks || '';
            const currentDbPathWorkCards = data.dbPathWorkCards || '';
            
            loadedAiContext = currentAiContext;
            loadedCustomNames = currentCustomNames;
            
            const apiInput = document.getElementById('setting-api-key');
            const syncInput = document.getElementById('setting-sync-path');
            const aiContextInput = document.getElementById('setting-ai-context');
            
            const nameDashboardInput = document.getElementById('setting-name-dashboard');
            const nameSearchInput = document.getElementById('setting-name-search');
            const nameVendorsInput = document.getElementById('setting-name-vendors');
            const nameComponentsInput = document.getElementById('setting-name-components');
            const nameOrdersInput = document.getElementById('setting-name-orders');
            const nameAllTasksInput = document.getElementById('setting-name-all-tasks');
            
            const dbTasksInput = document.getElementById('setting-db-tasks');
            const dbWorkCardsInput = document.getElementById('setting-db-workcards');
            
            if (apiInput) apiInput.value = currentApi;
            if (syncInput) syncInput.value = currentSync;
            if (aiContextInput) aiContextInput.value = currentAiContext;
            
            if (nameDashboardInput) nameDashboardInput.value = currentCustomNames.dashboard || '';
            if (nameSearchInput) nameSearchInput.value = currentCustomNames.search || '';
            if (nameVendorsInput) nameVendorsInput.value = currentCustomNames.vendors || '';
            if (nameComponentsInput) nameComponentsInput.value = currentCustomNames.components || '';
            if (nameOrdersInput) nameOrdersInput.value = currentCustomNames.orders || '';
            if (nameAllTasksInput) nameAllTasksInput.value = currentCustomNames.allTasks || '';
            
            if (dbTasksInput) dbTasksInput.value = currentDbPathTasks;
            if (dbWorkCardsInput) dbWorkCardsInput.value = currentDbPathWorkCards;
            
            state.networkMembers = data.networkMembers || [];
            if (typeof updateNetworkMembersDropdown === "function") updateNetworkMembersDropdown();
            
            updateSettingsStatus(currentApi, currentSync, currentDbPathTasks, currentDbPathWorkCards);
            updateCustomNamesUI(currentCustomNames);

            // If the folder sync path is not set, open the Welcome wizard
            if (currentSync === '' && !sessionStorage.getItem('ws_wizard_shown')) {
                const wsSyncInput = document.getElementById('ws-sync-path');
                if (wsSyncInput) wsSyncInput.value = currentSync;
                
                openModal('modal-welcome-setup');
            }
        })
        .catch(e => console.error(e));

    // -------------------------------------------------------------
    // UPDATE SYSTEM UI LOGIC
    // -------------------------------------------------------------
    let _updateCheckData = null; // 마지막 업데이트 확인 결과 캐시

    // 현재 버전 표시
    fetch('/api/update/version')
        .then(r => r.json())
        .then(vInfo => {
            const el = document.getElementById('update-local-version');
            if (el) el.textContent = `v${vInfo.version}`;
        })
        .catch(() => {});

    function showUpdatePanel(panelId) {
        ['update-up-to-date','update-available-panel','update-error-panel'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        const target = document.getElementById(panelId);
        if (target) target.classList.remove('hidden');
        const result = document.getElementById('update-result-panel');
        if (result) result.classList.remove('hidden');
    }

    // 업데이트 확인 버튼
    const btnCheckUpdate = document.getElementById('btn-check-update');
    if (btnCheckUpdate) {
        btnCheckUpdate.addEventListener('click', async () => {
            btnCheckUpdate.disabled = true;
            btnCheckUpdate.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 확인 중...';
            document.getElementById('update-result-panel')?.classList.add('hidden');
            try {
                const res = await fetch('/api/update/check');
                const data = await res.json();
                _updateCheckData = data;

                if (data.updateAvailable) {
                    showUpdatePanel('update-available-panel');
                    const remoteText = document.getElementById('update-remote-version-text');
                    if (remoteText) remoteText.textContent = `현재: v${data.localVersion} → 새 버전: v${data.remoteVersion} (${data.publishedAt ? new Date(data.publishedAt).toLocaleDateString('ko-KR') : ''})`;
                    // 릴리즈 노트
                    if (data.releaseNotes && data.releaseNotes.trim()) {
                        const notesBox = document.getElementById('update-release-notes-box');
                        const notesText = document.getElementById('update-release-notes-text');
                        if (notesBox) notesBox.classList.remove('hidden');
                        if (notesText) notesText.textContent = data.releaseNotes;
                    }
                } else if (data.message) {
                    showUpdatePanel('update-error-panel');
                    const errEl = document.getElementById('update-error-text');
                    if (errEl) errEl.textContent = data.message;
                } else {
                    showUpdatePanel('update-up-to-date');
                }
            } catch (e) {
                showUpdatePanel('update-error-panel');
                const errEl = document.getElementById('update-error-text');
                if (errEl) errEl.textContent = '서버 연결 실패: ' + e.message;
            } finally {
                btnCheckUpdate.disabled = false;
                btnCheckUpdate.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> 새 버전 확인';
            }
        });
    }

    // 업데이트 실행 버튼
    const btnDoUpdate = document.getElementById('btn-do-update');
    if (btnDoUpdate) {
        btnDoUpdate.addEventListener('click', async () => {
            if (!_updateCheckData || !_updateCheckData.downloadUrl) return;
            if (!confirm(`v${_updateCheckData.remoteVersion}으로 업데이트하시겠습니까?\n\n현재 파일은 자동으로 백업됩니다.\n업데이트 후 프로그램을 재시작해야 합니다.`)) return;

            const progressPanel = document.getElementById('update-progress-panel');
            const progressText = document.getElementById('update-progress-text');
            document.getElementById('update-result-panel')?.classList.add('hidden');
            if (progressPanel) progressPanel.classList.remove('hidden');
            if (progressText) progressText.textContent = 'GitHub에서 다운로드 중...';
            btnDoUpdate.disabled = true;
            btnCheckUpdate.disabled = true;

            try {
                if (progressText) progressText.textContent = '파일 교체 중... (수십 초 소요될 수 있습니다)';
                const res = await fetch('/api/update/apply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        downloadUrl: _updateCheckData.downloadUrl,
                        remoteVersion: _updateCheckData.remoteVersion,
                        remoteTag: _updateCheckData.remoteTag
                    })
                });
                const data = await res.json();
                if (progressPanel) progressPanel.classList.add('hidden');

                if (data.success) {
                    const el = document.getElementById('update-local-version');
                    if (el) el.textContent = `v${_updateCheckData.remoteVersion}`;
                    showToast('✅ ' + data.message, 'success');
                    showUpdatePanel('update-up-to-date');
                    document.getElementById('update-up-to-date').querySelector('span').textContent = data.message;
                } else {
                    showToast('❌ ' + data.message, 'error');
                    showUpdatePanel('update-error-panel');
                    document.getElementById('update-error-text').textContent = data.message;
                }
            } catch (e) {
                if (progressPanel) progressPanel.classList.add('hidden');
                showToast('❌ 업데이트 실패: ' + e.message, 'error');
            } finally {
                btnDoUpdate.disabled = false;
                btnCheckUpdate.disabled = false;
            }
        });
    }

    // 백업 목록 불러오기
    const btnLoadBackups = document.getElementById('btn-load-backups');
    if (btnLoadBackups) {
        btnLoadBackups.addEventListener('click', async () => {
            const backupList = document.getElementById('backup-list');
            const backupEmpty = document.getElementById('backup-empty');
            btnLoadBackups.disabled = true;
            btnLoadBackups.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 로딩 중...';
            try {
                const res = await fetch('/api/update/backups');
                const backups = await res.json();
                if (backupList) {
                    backupList.classList.remove('hidden');
                    backupList.innerHTML = '';
                    if (!Array.isArray(backups) || backups.length === 0) {
                        if (backupEmpty) backupEmpty.classList.remove('hidden');
                    } else {
                        if (backupEmpty) backupEmpty.classList.add('hidden');
                        backups.forEach(b => {
                            const item = document.createElement('div');
                            item.className = 'flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl';
                            const dateStr = b.createdAt ? new Date(b.createdAt).toLocaleString('ko-KR') : '';
                            item.innerHTML = `
                                <div>
                                    <p class="text-sm font-semibold text-slate-700">v${b.version}</p>
                                    <p class="text-xs text-slate-400">${dateStr} · ${b.name}</p>
                                </div>
                                <button class="btn-rollback px-4 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 font-bold rounded-lg text-xs transition-colors border border-orange-200" data-backup="${b.name}" data-version="${b.version}">
                                    <i class="fa-solid fa-rotate-left mr-1"></i> 롤백
                                </button>`;
                            backupList.appendChild(item);
                        });

                        // 롤백 버튼 이벤트
                        backupList.querySelectorAll('.btn-rollback').forEach(btn => {
                            btn.addEventListener('click', async () => {
                                const bName = btn.dataset.backup;
                                const bVer = btn.dataset.version;
                                if (!confirm(`v${bVer} 버전으로 롤백하시겠습니까?\n\n현재 파일이 해당 버전으로 교체됩니다.\n롤백 후 프로그램을 재시작해야 합니다.`)) return;
                                btn.disabled = true;
                                btn.textContent = '롤백 중...';
                                try {
                                    const r = await fetch('/api/update/rollback', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ backupName: bName })
                                    });
                                    const d = await r.json();
                                    if (d.success) {
                                        showToast('✅ ' + d.message, 'success');
                                        const el = document.getElementById('update-local-version');
                                        if (el) el.textContent = `v${bVer}`;
                                    } else {
                                        showToast('❌ ' + d.message, 'error');
                                        btn.disabled = false;
                                        btn.innerHTML = '<i class="fa-solid fa-rotate-left mr-1"></i> 롤백';
                                    }
                                } catch(e) {
                                    showToast('❌ 롤백 실패: ' + e.message, 'error');
                                    btn.disabled = false;
                                }
                            });
                        });
                    }
                }
            } catch(e) {
                showToast('백업 목록 로드 실패: ' + e.message, 'error');
            } finally {
                btnLoadBackups.disabled = false;
                btnLoadBackups.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> 백업 목록 보기';
            }
        });
    }

    // -------------------------------------------------------------
    // 1. STATE & API DATA MANAGEMENT
    // -------------------------------------------------------------

    let state = {
        files: [],
        folders: [],      // Dynamic directories list for search
        vendors: [],      // Partners (Vendors/Customers)
        components: [],   // Shared Assets
        orders: [],       // Tasks
        recurringTasks: [], // Recurring Tasks
        activeView: localStorage.getItem("workhub_activeView") || "dashboard",
        activeFolder: localStorage.getItem("workhub_activeFolder") || null,
        currentExplorerPath: localStorage.getItem("workhub_currentExplorerPath") || "", // Relative path under DESKTOP_ROOT
        topLevelFolders: [],     // Dynamic folders from root
        searchQuery: "",
        activeDept: "all",  // Current filtered department
        activeTaskIdForFiles: null,
        userFolderSchema: null
    };
    window._workHubState = state; // 외부 이벤트 위임에서 접근 가능하도록 노출
    let isInitialLoad = true;

    const API_BASE = window.location.origin.startsWith("file") || window.location.origin.includes("null")
        ? "http://localhost:45678/api"
        : "/api";

    // PARA Method virtual folders
    const folderList = [
        "0_프로젝트",
        "1_영역",
        "2_자료",
        "3_보관소"
    ];

    // PARA folder metadata (icons, colors, descriptions)
    const PARA_FOLDER_META = {
        "0_프로젝트": {
            icon: "fa-solid fa-rocket",
            color: "text-blue-400",
            bgColor: "bg-blue-50",
            textColor: "text-blue-600",
            label: "프로젝트",
            desc: "진행 중인 업무 (기한 있음)"
        },
        "1_영역": {
            icon: "fa-solid fa-bullseye",
            color: "text-emerald-400",
            bgColor: "bg-emerald-50",
            textColor: "text-emerald-600",
            label: "영역",
            desc: "지속 관리 업무 (역할 기반)"
        },
        "2_자료": {
            icon: "fa-solid fa-book-open",
            color: "text-amber-400",
            bgColor: "bg-amber-50",
            textColor: "text-amber-600",
            label: "자료",
            desc: "참고 자료 데이터베이스"
        },
        "3_보관소": {
            icon: "fa-solid fa-box-archive",
            color: "text-slate-400",
            bgColor: "bg-slate-100",
            textColor: "text-slate-600",
            label: "보관소",
            desc: "완료·보관 (과거 기록)"
        }
    };

    // Fetch all data from Express API - Decoupled with Lazy Loading to optimize startup time
    async function loadStateFromServer(isPeriodic = false) {
        try {
            // 1. Load fast DB and directory structure first to render UI instantly
            const res = await Promise.all([
                fetch(`${API_BASE}/workcards`).then(r => r.ok ? r.json() : []).catch(() => []),
                fetch(`${API_BASE}/shared-assets`).then(r => r.ok ? r.json() : []).catch(() => []),
                fetch(`${API_BASE}/tasks`).then(r => r.ok ? r.json() : []).catch(() => []),
                fetch(`${API_BASE}/recurring-tasks`).then(r => r.ok ? r.json() : []).catch(() => []),
                fetch(`${API_BASE}/dir?path=`).then(r => r.ok ? r.json() : {children:[]}).catch(() => ({children:[]})),
                fetch(`${API_BASE}/schema`).then(r => r.ok ? r.json() : null).catch(() => null)
            ]);

            state.vendors = Array.isArray(res[0]) ? res[0] : [];
            state.components = Array.isArray(res[1]) ? res[1] : [];
            state.orders = Array.isArray(res[2]) ? res[2] : [];
            state.recurringTasks = Array.isArray(res[3]) ? res[3] : [];
            state.topLevelFolders = res[4] && res[4].folders ? res[4].folders : [];
            state.userFolderSchema = res[5] && Object.keys(res[5]).length > 0 && !res[5].error ? res[5] : null;

            // Render UI elements immediately (No block on files crawl)
            updateStats();
            renderSidebarFolders();
            
            const scrollEl = document.getElementById("content-area");
            const savedScroll1 = scrollEl ? scrollEl.scrollTop : 0;
            if (isInitialLoad) {
                isInitialLoad = false;
                switchView(state.activeView, state.activeFolder, state.currentExplorerPath);
            } else {
                // 백그라운드 동기화 시 마인드맵 초기화 방지 (skipMindmap=true)
                renderViewData(state.activeView, state.activeFolder, true);
            }
            if (scrollEl && savedScroll1 > 0) requestAnimationFrame(() => scrollEl.scrollTop = savedScroll1);

            // 2. Lazy load heavy files crawl in the background
            Promise.all([
                fetch(`${API_BASE}/files`).then(r => r.json()),
                fetch(`${API_BASE}/folders/all`).then(r => r.json())
            ]).then(([resFiles, resAllFolders]) => {
                state.files = resFiles;
                state.folders = resAllFolders || [];
                
                // Re-render currently active folder if necessary, wait no. just mindmap is enough because mindmap depends on all folders.
                
                // Refresh statistics and tables once filesystem data is ready
                updateStats();
                if (state.activeView === "dashboard" || state.activeView === "folders") {
                    const savedScroll2 = scrollEl ? scrollEl.scrollTop : 0;
                    renderViewData(state.activeView, state.activeFolder, true);
                    if (!isPeriodic && typeof currentViewMode !== 'undefined' && currentViewMode === 'mindmap' && window.renderMindmap) {
                        window.renderMindmap();
                    }
                    if (scrollEl && savedScroll2 > 0) requestAnimationFrame(() => scrollEl.scrollTop = savedScroll2);
                }
            }).catch(err => {
                console.error("[LAZY LOAD ERROR] Failed to fetch slow filesystem endpoints:", err);
            });

        } catch (err) {
            console.error("Failed to fetch state from backend, retrying in 3s...", err);
            // 첫 시도 실패 시 3초 후 자동 재시도, 재시도도 실패 시에만 LocalStorage Fallback 사용
            setTimeout(async () => {
                try {
                    const [resPartners, resAssets, resTasks, resRecurring, resDir] = await Promise.all([
                        fetch(`${API_BASE}/workcards`).then(r => r.ok ? r.json() : []).catch(() => []),
                        fetch(`${API_BASE}/shared-assets`).then(r => r.ok ? r.json() : []).catch(() => []),
                        fetch(`${API_BASE}/tasks`).then(r => r.ok ? r.json() : []).catch(() => []),
                        fetch(`${API_BASE}/recurring-tasks`).then(r => r.ok ? r.json() : []).catch(() => []),
                        fetch(`${API_BASE}/dir?path=`).then(r => r.ok ? r.json() : {folders:[]}).catch(() => ({folders:[]}))
                    ]);
                    state.vendors = resPartners;
                    state.components = resAssets;
                    state.orders = resTasks;
                    state.recurringTasks = resRecurring;
                    state.topLevelFolders = resDir.folders || [];
                    updateStats();
                    renderSidebarFolders();
                    if (isInitialLoad) {
                        isInitialLoad = false;
                        switchView(state.activeView, state.activeFolder, state.currentExplorerPath);
                    } else {
                        renderViewData(state.activeView, state.activeFolder, true);
                    }
                } catch (err2) {
                    console.error("Retry failed, using LocalStorage fallback:", err2);
                    initLocalStorageFallback();
                }
            }, 3000);
        }
    }

    function initLocalStorageFallback() {
        const storageKeys = {
            files: "workhub_files",
            vendors: "workhub_vendors",
            components: "workhub_components",
            orders: "workhub_orders",
            recurringTasks: "workhub_recurringTasks",
            version: "workhub_storage_version"
        };

        // Clear old mock data if version is not set to current version "1"
        if (localStorage.getItem(storageKeys.version) !== "1") {
            localStorage.removeItem(storageKeys.files);
            localStorage.removeItem(storageKeys.vendors);
            localStorage.removeItem(storageKeys.components);
            localStorage.removeItem(storageKeys.orders);
            localStorage.removeItem(storageKeys.recurringTasks);
            localStorage.setItem(storageKeys.version, "1");
        }

        if (!localStorage.getItem(storageKeys.files)) {
            localStorage.setItem(storageKeys.files, JSON.stringify([]));
        }
        if (!localStorage.getItem(storageKeys.vendors)) {
            localStorage.setItem(storageKeys.vendors, JSON.stringify([]));
        }
        if (!localStorage.getItem(storageKeys.components)) {
            localStorage.setItem(storageKeys.components, JSON.stringify([]));
        }
        if (!localStorage.getItem(storageKeys.orders)) {
            localStorage.setItem(storageKeys.orders, JSON.stringify([]));
        }
        if (!localStorage.getItem(storageKeys.recurringTasks)) {
            localStorage.setItem(storageKeys.recurringTasks, JSON.stringify([]));
        }

        state.files = JSON.parse(localStorage.getItem(storageKeys.files));
        state.vendors = JSON.parse(localStorage.getItem(storageKeys.vendors));
        state.components = JSON.parse(localStorage.getItem(storageKeys.components));
        state.orders = JSON.parse(localStorage.getItem(storageKeys.orders));
        state.recurringTasks = JSON.parse(localStorage.getItem(storageKeys.recurringTasks));
        state.topLevelFolders = [];
        state.folders = [];

        updateStats();
        renderSidebarFolders();
        if (isInitialLoad) {
            isInitialLoad = false;
            switchView(state.activeView, state.activeFolder, state.currentExplorerPath);
        } else {
            renderViewData(state.activeView, state.activeFolder);
        }
        showToast("오프라인 LocalStorage 버전으로 전환되었습니다.", "warning");
    }

    function getTaskStatusFolder(status) {
        if (status === "pending_approval") return "01_대기";
        if (status === "in_progress") return "02_진행";
        if (status === "completed") return "03_완료";
        return "01_대기";
    }

    // Save functions sending sync calls to backend
    window.syncData = async function syncData(key, payload) {
        window.syncData = syncData;
        state[key] = payload;
        try {
            let endpoint = key;
            if (key === 'vendors') endpoint = 'workcards';
            else if (key === 'components') endpoint = 'shared-assets';
            else if (key === 'orders') endpoint = 'tasks';
            else if (key === 'recurringTasks') endpoint = 'recurring-tasks';

            const url = `${API_BASE}/${endpoint}`;
            const bodyStr = JSON.stringify(payload);
            console.log(`[syncData] POST ${url} | items: ${Array.isArray(payload) ? payload.length : 'N/A'}`);
            if (key === 'orders') {
                const taskWithTimeline = Array.isArray(payload) ? payload.find(t => t.timeline && t.timeline.length > 0) : null;
                if (taskWithTimeline) {
                    console.log(`[syncData] Task with timeline found: ${taskWithTimeline.id}, entries: ${taskWithTimeline.timeline.length}`);
                } else {
                    console.warn(`[syncData] Warning: No task has timeline entries in this payload!`);
                }
            }

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: bodyStr
            });
            const data = await res.json();
            console.log(`[syncData] Response:`, data);
            
            if (data.success) {
                updateStats();
                return true;
            }
        } catch (err) {
            console.error(`[syncData] Failed to sync ${key} to backend:`, err);
            localStorage.setItem(`workhub_${key}`, JSON.stringify(payload));
            updateStats();
        }
        return false;
    }

    // -------------------------------------------------------------
    // 2. MODAL CONTROLLERS & TRANSITIONS
    // -------------------------------------------------------------
    const modalBackdrop = document.getElementById("modal-backdrop");
    const activeModals = new Set();

    function openModal(modalId) {
        modalBackdrop.classList.remove("hidden");
        modalBackdrop.classList.add("flex");
        
        const modal = document.getElementById(modalId);
        modal.classList.remove("hidden");
        modal.classList.add("block");
        
        activeModals.add(modalId);
        
        // Populate dropdowns
        if (modalId === "modal-component-form") {
            populateVendorSelect("c-vendor");
        } else if (modalId === "modal-order-form") {
            populateVendorSelect("o-vendor");
        } else if (modalId === "modal-file-upload-form") {
            populateFolderSelect("uf-folder");
        }
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add("hidden");
            modal.classList.remove("block");
            activeModals.delete(modalId);
        }
        
        if (activeModals.size === 0) {
            modalBackdrop.classList.add("hidden");
            modalBackdrop.classList.remove("flex");
        }
    }
    // Expose for use outside main DOMContentLoaded scope
    window.openModal = openModal;
    window.closeModal = closeModal;

    function closeAllModals() {
        activeModals.forEach(modalId => closeModal(modalId));
    }

    // Modal Close Button Bindings
    document.querySelectorAll(".modal-close-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            let parent = btn.closest("[id^='modal-']");
            if (parent && parent.id !== "modal-backdrop") {
                closeModal(parent.id);
            }
        });
    });

    modalBackdrop.addEventListener("click", (e) => {
        if (e.target === modalBackdrop) {
            closeAllModals();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeAllModals();
        }
    });

    // Welcome Setup Form submit
    const welcomeForm = document.getElementById('welcome-setup-form');
    if (welcomeForm) {
        welcomeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const apiKey = document.getElementById('ws-api-key').value;
            const syncPath = document.getElementById('ws-sync-path').value;
            
            fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: apiKey, desktopSyncPath: syncPath, aiContext: loadedAiContext || "" })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    sessionStorage.setItem('ws_wizard_shown', 'true');
                    closeModal('modal-welcome-setup');
                    showToast('성공적으로 설정되었습니다. 시스템을 시작합니다!', 'success');
                    
                    // Reload values and files
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                } else {
                    alert('설정 저장 실패: ' + (data.message || '오류'));
                }
            })
            .catch(e => {
                console.error(e);
                alert('서버 오류로 설정을 저장하지 못했습니다.');
            });
        });
    }

    // Welcome Setup Skip button
    const btnWsSkip = document.getElementById('btn-ws-skip');
    if (btnWsSkip) {
        btnWsSkip.addEventListener('click', () => {
            sessionStorage.setItem('ws_wizard_shown', 'true');
            closeModal('modal-welcome-setup');
            showToast('설정을 건너뛰었습니다. 환경설정 메뉴에서 언제든지 변경할 수 있습니다.', 'info');
        });
    }

    // Unified creation options route
    document.getElementById("add-opt-file").addEventListener("click", () => {
        closeModal("modal-add-unified");
        openModal("modal-file-upload-form");
    });
    document.getElementById("add-opt-vendor").addEventListener("click", () => {
        closeModal("modal-add-unified");
        document.getElementById("vendor-form").reset();
        document.getElementById("vendor-id-field").value = "";
        document.getElementById("vendor-modal-title").innerText = "신규 거래처 등록";
        openModal("modal-vendor-form");
    });
    document.getElementById("add-opt-component").addEventListener("click", () => {
        closeModal("modal-add-unified");
        document.getElementById("component-form").reset();
        openModal("modal-component-form");
    });
    document.getElementById("add-opt-order").addEventListener("click", () => {
        closeModal("modal-add-unified");
        document.getElementById("order-form").reset();
        document.getElementById("order-id-field").value = "";
        document.getElementById("order-modal-title").innerText = "신규 업무 카드 생성";
        openModal("modal-order-form");
    });

    // Helpers to populate selects
    function populateVendorSelect(selectId) {
        const select = document.getElementById(selectId);
        if (!select) return;
        select.innerHTML = "";
        
        // Add a default common vendor
        const defOpt = document.createElement("option");
        defOpt.value = "공통/내부";
        defOpt.textContent = "공통 / 내부 부서";
        select.appendChild(defOpt);

        state.vendors.forEach(v => {
            const opt = document.createElement("option");
            opt.value = v.name;
            opt.textContent = `${v.name} (${v.code}) [${v.type}]`;
            select.appendChild(opt);
        });
    }

    function populateFolderSelect(selectId) {
        const select = document.getElementById(selectId);
        if (!select) return;
        select.innerHTML = "";
        
        const foldersToUse = (state.topLevelFolders || []).map(f => f.name);

        foldersToUse.forEach(folder => {
            const opt = document.createElement("option");
            opt.value = folder;
            opt.textContent = folder;
            select.appendChild(opt);
        });

        if (state.currentExplorerPath && !foldersToUse.includes(state.currentExplorerPath)) {
            const opt = document.createElement("option");
            opt.value = state.currentExplorerPath;
            opt.textContent = state.currentExplorerPath;
            select.appendChild(opt);
            select.value = state.currentExplorerPath;
        }
    }

    // -------------------------------------------------------------
    // 3. TOAST SYSTEM
    // -------------------------------------------------------------
    const toastContainer = document.getElementById("toast-container");

    function showToast(message, type = "success") {
        const toast = document.createElement("div");
        toast.className = `toast flex items-center p-4 rounded-xl shadow-lg border max-w-sm text-sm bg-white pointer-events-auto`;
        
        let iconHtml = "";
        let borderClass = "";
        switch (type) {
            case "success":
                iconHtml = `<i class="fa-solid fa-circle-check text-emerald-500 text-lg mr-3"></i>`;
                borderClass = "border-emerald-100";
                break;
            case "error":
                iconHtml = `<i class="fa-solid fa-circle-exclamation text-red-500 text-lg mr-3"></i>`;
                borderClass = "border-red-100";
                break;
            case "info":
                iconHtml = `<i class="fa-solid fa-circle-info text-blue-500 text-lg mr-3"></i>`;
                borderClass = "border-blue-100";
                break;
            case "warning":
                iconHtml = `<i class="fa-solid fa-triangle-exclamation text-amber-500 text-lg mr-3"></i>`;
                borderClass = "border-amber-100";
                break;
        }

        toast.classList.add(borderClass);
        toast.innerHTML = `
            <div class="flex items-center">
                ${iconHtml}
                <span class="font-medium text-slate-700">${message}</span>
            </div>
            <button class="ml-auto pl-3 text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark"></i></button>
        `;

        toast.querySelector("button").addEventListener("click", () => removeToast(toast));
        toastContainer.appendChild(toast);

        setTimeout(() => removeToast(toast), 3500);
    }

    function removeToast(toast) {
        if (!toast.classList.contains("removing")) {
            toast.classList.add("removing");
            setTimeout(() => toast.remove(), 300);
        }
    }

    // -------------------------------------------------------------
    // 4. ROUTER / VIEW SWITCHING
    // -------------------------------------------------------------
    function switchView(viewName, folderName = null, targetPath = null) {
        const btnViewListEl = document.getElementById("btn-view-list");
        if (viewName !== "folders" && btnViewListEl) {
            btnViewListEl.click();
        }

        state.activeView = viewName;
        state.activeFolder = folderName;

        localStorage.setItem("workhub_activeView", viewName);
        localStorage.setItem("workhub_activeFolder", folderName || "");
        if (viewName !== "folders") {
            state.currentExplorerPath = "";
            localStorage.setItem("workhub_currentExplorerPath", "");
        } else if (targetPath) {
            state.currentExplorerPath = targetPath;
            localStorage.setItem("workhub_currentExplorerPath", targetPath);
        } else if (folderName) {
            state.currentExplorerPath = folderName;
            localStorage.setItem("workhub_currentExplorerPath", folderName);
        }

        document.querySelectorAll(".view-pane").forEach(view => view.classList.add("hidden"));
        const activePane = document.getElementById(`view-${viewName}`);
        if (activePane) activePane.classList.remove("hidden");

        // Update Nav Menu selections
        document.querySelectorAll(".nav-btn, .mobile-nav-btn").forEach(btn => {
            btn.classList.remove("nav-active");
            if (btn.getAttribute("data-view") === viewName && !folderName) {
                btn.classList.add("nav-active");
            }
        });

        // Folder selection in sidebar
        if (viewName === "folders" && folderName) {
            const topLevelFolder = state.currentExplorerPath.split('/')[0];
            document.querySelectorAll("[data-folder]").forEach(btn => {
                btn.classList.remove("nav-active");
                if (btn.getAttribute("data-folder") === topLevelFolder) {
                    btn.classList.add("nav-active");
                }
            });
        }

        const mainSearchInput = document.getElementById("searchInput");
        if (viewName !== "search") {
            mainSearchInput.value = "";
            state.searchQuery = "";
        }

        closeMobileSidebar();
        renderViewData(viewName, folderName);
    }
    // 전역으로 즉시 노출 (이벤트 위임 핸들러에서 클릭 시점에 바로 사용 가능)
    window.switchView = switchView;

    function renderViewData(viewName, folderName, skipMindmap = false) {
        switch (viewName) {
            case "dashboard": renderDashboard(); break;
            case "search": renderSearchHub(); break;
            case "vendors": renderVendorsList(); break;
            case "components": renderComponentsList(); break;
            case "orders": renderKanbanBoard(); break;
            case "all-tasks": renderAllTasksView(); break;
            case "folders": renderFolderView(folderName, skipMindmap); break;
            case "settings": /* settings 뷰는 별도 렌더링 불필요 (정적 HTML) */ break;
        }
    }

    document.querySelectorAll(".nav-btn, .mobile-nav-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            const view = btn.getAttribute("data-view");
            if (view) switchView(view);
        });
    });


    // -------------------------------------------------------------
    // 5. SIDEBAR VIRTUAL FOLDERS
    // -------------------------------------------------------------
    function renderSidebarFolders() {
        const desktopContainer = document.getElementById("sidebar-folders-container");
        const mobileContainer = document.getElementById("mobile-sidebar-folders-container");

        let foldersHtml = `
            <a href="#" data-folder="" class="folder-nav-btn flex items-center px-3 py-2 hover:bg-slate-800 rounded-lg group transition-colors text-slate-400 hover:text-white">
                <i class="fa-solid fa-hard-drive w-5 text-center mr-3 text-blue-500 group-hover:text-blue-400"></i>
                <span class="text-sm font-medium truncate text-blue-400 group-hover:text-blue-300">최상위 루트 폴더</span>
            </a>
        `;
        const foldersToRender = state.topLevelFolders || [];

        foldersToRender.forEach(folder => {
            const folderName = folder.name;
            const displayName = folderName;
            foldersHtml += `
                <a href="#" data-folder="${folderName}" class="folder-nav-btn flex items-center px-3 py-2 hover:bg-slate-800 rounded-lg group transition-colors text-slate-400 hover:text-white">
                    <i class="fa-regular fa-folder w-5 text-center mr-3 text-slate-500 group-hover:text-white"></i>
                    <span class="text-sm font-medium truncate">${displayName}</span>
                </a>
            `;
        });

        desktopContainer.innerHTML = foldersHtml;
        mobileContainer.innerHTML = foldersHtml;

        document.querySelectorAll(".folder-nav-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                const folderName = btn.getAttribute("data-folder");
                state.currentExplorerPath = folderName;
                switchView("folders", folderName);
            });
        });
    }

    // Root breadcrumb click handler
    document.addEventListener("click", (e) => {
        if (e.target.id === "folder-breadcrumb-root") {
            e.preventDefault();
            state.currentExplorerPath = "";
            state.activeFolder = "all";
            switchView("folders", "");
        }
    });

    // -------------------------------------------------------------
    // 6. DEPARTMENTS & PROFILE CONTROL (WOW FEATURE)
    // -------------------------------------------------------------
    // Removed old dept selector
    // Removed old mobile dept selector

    function handleDeptChange(value) {
        state.activeDept = value;
        
        // Sync selectors
        deptSelector.value = value;
        mobileDeptSelector.value = value;

        // Custom greeting
        const greeting = document.getElementById("dashboard-user-greeting");
        if (value === "all") {
            greeting.innerText = "부서별 통합 업무 현황";
        } else {
            const profileLabels = {
                "개발팀": "정개발 대리 (개발팀) 업무 공간",
                "영업팀": "김영업 과장 (영업팀) 업무 공간",
                "인사총무팀": "이인사 대리 (인사총무팀) 업무 공간",
                "구매팀": "한구매 팀장 (구매팀) 업무 공간"
            };
            greeting.innerText = profileLabels[value] || "내 업무 공간";
        }

        showToast(`작업 영역이 '${value === 'all' ? '회사 전체' : value}'(으)로 조정되었습니다.`, "info");
        
        updateStats();
        renderViewData(state.activeView, state.activeFolder);
    }

    // deptSelector.addEventListener("change", (e) => handleDeptChange(e.target.value));
    // mobileDeptSelector.addEventListener("change", (e) => handleDeptChange(e.target.value));

    // Helper to check if item is relevant to active department
    function isItemDeptRelevant(itemDept, itemFolder = "") {
        if (state.activeDept === "all") return true;
        
        // If department matches exactly
        if (itemDept === state.activeDept || itemDept === "공통") return true;

        // Otherwise filter files by folder correlation
        if (itemFolder) {
            const folderMappings = {
                "개발팀": ["00_수신함_Inbox", "01_기획_및_보고", "02_고객사_및_협력사", "04_공통_양식_템플릿", "05_업무_연관_파일_Task_Files", "09_아카이브_Archive"],
                "영업팀": ["00_수신함_Inbox", "01_기획_및_보고", "02_고객사_및_협력사", "03_계약_및_발주", "04_공통_양식_템플릿", "05_업무_연관_파일_Task_Files", "09_아카이브_Archive"],
                "인사총무팀": ["00_수신함_Inbox", "01_기획_및_보고", "04_공통_양식_템플릿", "05_업무_연관_파일_Task_Files", "09_아카이브_Archive"],
                "구매팀": ["00_수신함_Inbox", "02_고객사_및_협력사", "03_계약_및_발주", "04_공통_양식_템플릿", "05_업무_연관_파일_Task_Files", "09_아카이브_Archive"]
            };
            return folderMappings[state.activeDept]?.includes(itemFolder) || false;
        }

        return false;
    }

    // -------------------------------------------------------------
    // 7. DASHBOARD RENDERER & ACTIONS
    // -------------------------------------------------------------
    function renderDashboard() {
        const dateElement = document.getElementById("currentDate");
        const options = { year: "numeric", month: "long", day: "numeric", weekday: "long" };
        dateElement.textContent = new Date().toLocaleDateString("ko-KR", options);

        updateStats();

        // RENDER FOLDER SHORTCUTS
        const quickFoldersContainer = document.getElementById("quick-folders-grid");
        quickFoldersContainer.innerHTML = "";

        const folderThemes = {
            "0_프로젝트":  { bg: "bg-blue-50",    text: "text-blue-600" },
            "1_영역":     { bg: "bg-emerald-50", text: "text-emerald-600" },
            "2_자료":     { bg: "bg-amber-50",   text: "text-amber-600" },
            "3_보관소":    { bg: "bg-slate-100",  text: "text-slate-600" },
            // Legacy folders (dimmed)
            "00_수신함_Inbox":       { bg: "bg-blue-50",   text: "text-blue-400" },
            "01_기획_및_보고":     { bg: "bg-emerald-50", text: "text-emerald-400" },
            "02_고객사_및_협력사": { bg: "bg-amber-50",   text: "text-amber-400" },
            "03_계약_및_발주":   { bg: "bg-purple-50",  text: "text-purple-400" },
            "04_공통_양식_템플릿": { bg: "bg-rose-50",    text: "text-rose-400" },
            "09_아카이브_Archive":  { bg: "bg-slate-100",  text: "text-slate-500" }
        };

        const foldersToRender = (state.topLevelFolders || []).filter(f => f.name !== '05_업무_연관_파일_Task_Files');

        foldersToRender.forEach(folder => {
            const folderName = folder.name;
            const theme = folderThemes[folderName] || { bg: "bg-blue-50", text: "text-blue-600" };
            const folderFilesCount = state.files.filter(f => f.folder === folderName || f.relativePath.startsWith(folderName + "/")).length;
            const meta = PARA_FOLDER_META[folderName];
            const displayName = meta ? meta.label : folderName;
            const descText = meta ? `<p class="text-xs text-slate-400 mt-1">${meta.desc}</p>` : '';
            const iconHtml = meta ? `<i class="${meta.icon} text-xl ${meta.textColor}"></i>` : `<i class="fa-regular fa-folder text-xl ${theme.text}"></i>`;

            const card = document.createElement("div");
            card.className = "bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all cursor-pointer group relative flex flex-col justify-between h-36";
            card.innerHTML = `
                <div class="flex items-start justify-between">
                    <div class="w-10 h-10 rounded-lg ${theme.bg} flex items-center justify-center ${theme.text} group-hover:scale-110 transition-transform">
                        <i class="fa-solid fa-folder-open"></i>
                    </div>
                    <!-- Folder Actions -->
                    <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="btn-dashboard-folder-rename p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100" title="이름 변경">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="btn-dashboard-folder-delete p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100" title="삭제">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
                <div>
                    <h3 class="font-bold text-slate-800 text-sm truncate" title="${folderName}">${displayName}</h3>
                    <p class="text-xs text-slate-400 mt-1">파일 및 하위 폴더</p>
                </div>
            `;

            // Click card to open folder
            card.addEventListener("click", (e) => {
                if (e.target.closest("button")) return;
                state.currentExplorerPath = folderName;
                switchView("folders", folderName);
            });

            // Rename Folder
            card.querySelector(".btn-dashboard-folder-rename").addEventListener("click", (e) => {
                e.stopPropagation();
                openFolderRenameModal("", folderName);
            });

            // Delete Folder
            card.querySelector(".btn-dashboard-folder-delete").addEventListener("click", (e) => {
                e.stopPropagation();
                deleteFolderPrompt("", folderName);
            });

            quickFoldersContainer.appendChild(card);
        });

        // Create Folder Card Slot
        const createFolderCard = document.createElement("div");
        createFolderCard.className = "bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md border-dashed hover:border-blue-400 transition-colors cursor-pointer flex flex-col items-center justify-center text-slate-400 hover:text-blue-500 text-center h-36";
        createFolderCard.innerHTML = `
            <i class="fa-solid fa-folder-plus text-2xl mb-1.5"></i>
            <span class="text-xs font-semibold">새 메인 폴더 추가</span>
        `;
        createFolderCard.addEventListener("click", async () => {
            const folderName = prompt("바탕화면에 생성할 메인 폴더명을 입력하세요:");
            if (folderName) {
                const sanitized = folderName.trim().replace(/[^a-zA-Z0-9_\-가-힣]/g, "_");
                const foldersToCheck = (state.topLevelFolders || []).map(f => f.name);
                if (sanitized && !foldersToCheck.includes(sanitized)) {
                    try {
                        const res = await fetch(`${API_BASE}/folders/create`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ parentPath: "", folderName: sanitized })
                        });
                        const data = await res.json();
                        if (data.success) {
                            showToast(`바탕화면에 '${data.folderName}' 폴더가 생성되었습니다.`, "success");
                            loadStateFromServer();
                        } else {
                            showToast(data.error || "폴더 생성을 실패했습니다.", "error");
                        }
                    } catch (e) {
                        showToast("서버 통신에 실패했습니다.", "error");
                    }
                } else {
                    showToast("유효하지 않거나 이미 존재하는 폴더명입니다.", "error");
                }
            }
        });
        quickFoldersContainer.appendChild(createFolderCard);

        // RECENT FILES TABLE
        const recentBody = document.getElementById("recent-files-table-body");
        recentBody.innerHTML = "";
        
        let filteredFiles = state.files.filter(f => isItemDeptRelevant(state.activeDept, f.folder));
        const sortedFiles = [...filteredFiles].sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt)).slice(0, 5);

        if (sortedFiles.length === 0) {
            recentBody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-5 py-8 text-center text-slate-400 text-xs">최근에 수정된 부서 문서가 없습니다.</td>
                </tr>
            `;
        } else {
            sortedFiles.forEach(file => {
                const tr = document.createElement("tr");
                tr.className = "hover:bg-slate-50 transition-colors group cursor-pointer";
                tr.innerHTML = `
                    <td class="px-5 py-3 flex items-center max-w-[320px]">
                        ${getFileIcon(file.extension)}
                        <span class="font-semibold text-slate-700 truncate" title="${file.name}">${file.name}</span>
                    </td>
                    <td class="px-5 py-3 text-slate-500 text-xs">📁 ${file.folder}</td>
                    <td class="px-5 py-3 text-slate-400 text-xs">${getRelativeTime(file.modifiedAt)}</td>
                    <td class="px-5 py-3 text-center">
                        <button class="text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-slate-200/50" title="정보">
                            <i class="fa-solid fa-circle-info"></i>
                        </button>
                    </td>
                `;

                tr.addEventListener("click", () => openFileDetailModal(file.id));
                tr.querySelector("button").addEventListener("click", (e) => {
                    e.stopPropagation();
                    openFileDetailModal(file.id);
                });

                recentBody.appendChild(tr);
            });
        }

        // KANBAN SUMMARY CARD
        const kanbanSummaryContainer = document.getElementById("dashboard-kanban-summary-container");
        kanbanSummaryContainer.innerHTML = "";

        const deptTasks = state.orders.filter(t => t.status !== "completed" && isItemDeptRelevant(t.department));
        const activeTasks = deptTasks.slice(0, 3);

        if (activeTasks.length === 0) {
            kanbanSummaryContainer.innerHTML = `
                <div class="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                    <i class="fa-solid fa-clipboard-check text-3xl mb-2"></i>
                    <span class="text-xs">현재 진행중인 핵심 프로젝트가 없습니다.</span>
                </div>
            `;
        } else {
            activeTasks.forEach(task => {
                const isUrgent = task.folder === "urgent_important" && task.status !== "completed";
                const badgeTheme = task.status === "in_progress" 
                    ? "bg-amber-50 text-amber-700 border-amber-200" 
                    : "bg-blue-50 text-blue-700 border-blue-200";
                const statusLabel = task.status === "in_progress" ? "진행중" : "진행 대기";

                const urgInfo = URGENCY_MAP[task.folder] || URGENCY_MAP['not_urgent_not_important'];

                const card = document.createElement("div");
                card.className = `bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-all cursor-pointer hover:shadow-md ${isUrgent ? "ring-2 ring-red-500/20" : ""}`;
                card.innerHTML = `
                    <div class="flex justify-between items-start mb-2.5">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeTheme}">
                            ${statusLabel}
                        </span>
                        <span class="text-[10px] font-semibold ${isUrgent ? "text-red-500 font-bold animate-pulse" : "text-slate-400"}">
                            마감: ${task.deliveryDate} ${isUrgent && task.deliveryDate ? `(D-${getDaysUntil(task.deliveryDate)})` : ""}
                        </span>
                    </div>
                    <h3 class="text-sm font-bold text-slate-800 truncate" title="${task.title}">${task.title}</h3>
                    <div class="mt-3 flex items-center justify-between text-[11px] text-slate-400 select-none">
                        <span class="flex items-center"><i class="fa-solid fa-users mr-1 text-slate-300"></i> ${task.department} (${task.assignee})</span>
                        <span class="font-bold text-slate-700">${urgInfo.icon} ${urgInfo.label}</span>
                    </div>
                `;
                
                card.addEventListener("click", () => switchView("orders"));
                kanbanSummaryContainer.appendChild(card);
            });
        }

        document.getElementById("dashboard-view-all-files").onclick = () => switchView("folders", "0_프로젝트");
        document.getElementById("dashboard-go-kanban").onclick = () => switchView("orders");
    }

    function updateStats() {
        const filteredFiles = state.files;
        const filteredPartners = state.vendors;
        const filteredAssets = state.components;
        
        let filteredTasks = state.orders;
        
        filteredTasks = filteredTasks.filter(task => {
            // Department filter removed
            
            // Search filter
            if (kanbanSearchQuery) {
                const searchStr = `${task.title} ${task.description || ''} ${task.assignee || ''} ${task.department}`.toLowerCase();
                return searchStr.includes(kanbanSearchQuery);
            }
            
            // 3-day hide logic for completed tasks (if no search query)
            if (task.status === "completed") {
                if (!task.completedAt) {
                    task.completedAt = Date.now(); // Backfill
                }
                const daysSinceCompleted = (Date.now() - task.completedAt) / (1000 * 60 * 60 * 24);
                if (daysSinceCompleted > 3) {
                    return false; // Hide if older than 3 days
                }
            }
            
            return true;
        });


        document.getElementById("stat-files-count").innerText = filteredFiles.length;
        document.getElementById("stat-vendors-count").innerText = filteredPartners.length;
        document.getElementById("stat-components-count").innerText = filteredAssets.length;
        document.getElementById("stat-orders-value").innerText = filteredTasks.length;
    }

    // -------------------------------------------------------------
    // 8. FILE DETAIL MODAL & REAL FS OPERATIONS
    // -------------------------------------------------------------
    let currentViewingFileId = null;

    function openFileDetailModal(fileId) {
        try {
            let file = state.files.find(f => f.id === fileId);
            if (!file && state._explorerFiles) {
                file = state._explorerFiles.find(f => f.id === fileId);
            }
            if (!file) {
                console.error("File not found in state.files or explorerFiles", fileId);
                alert("File not found in state.files");
                return;
            }

            currentViewingFileId = fileId;

            document.getElementById("fd-name").innerText = file.name || '알 수 없음';
            const relPath = file.relativePath || `${file.folder || ''}/${file.name || ''}`;
            const displayFolderName = (relPath && relPath.includes('/')) ? relPath.substring(0, relPath.lastIndexOf('/')) : (file.folder || "");
            const cleanDisplayFolderName = displayFolderName || "루트";
            document.getElementById("fd-folder-badge").innerText = `📁 ${cleanDisplayFolderName}`;
            document.getElementById("fd-size").innerText = file.size || '0 KB';
            document.getElementById("fd-modified-at").innerText = file.modifiedAt || '알 수 없음';
            document.getElementById("fd-modified-by").innerText = file.modifiedBy || '시스템';
            const osPath = relPath.replace(/\//g, '\\');
            const rootPath = state.syncPath || "C:\\Users\\bspark231101\\Desktop\\구매업무";
            document.getElementById("fd-path").innerText = `${rootPath}\\${osPath}`.replace(/\\\\/g, '\\');
            
            const tagsContainer = document.getElementById("fd-tags");
            tagsContainer.innerHTML = "";
            (file.tags || []).forEach(tag => {
                const span = document.createElement("span");
                span.className = "px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-semibold rounded-md border border-blue-100";
                span.innerText = tag;
                tagsContainer.appendChild(span);
            });

            const iconContainer = document.getElementById("fd-icon-container");
            iconContainer.innerHTML = getFileIcon(file.extension);

            iconContainer.className = "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-4xl mb-3";
            let bgClass = "bg-slate-100";
            switch (file.extension) {
                case "xlsx": bgClass = "bg-green-50 text-green-600"; break;
                case "pdf": bgClass = "bg-red-50 text-red-600"; break;
                case "docx": bgClass = "bg-blue-50 text-blue-600"; break;
                case "hwp": bgClass = "bg-sky-50 text-sky-600"; break;
                case "png": case "jpg": bgClass = "bg-purple-50 text-purple-600"; break;
                case "dwg": bgClass = "bg-amber-50 text-amber-600"; break;
            }
            iconContainer.className += ` ${bgClass}`;


            openModal("modal-file-detail");
        } catch(e) {
            console.error("Error opening modal:", e);
            alert("Error opening modal: " + e.message);
        }
    }




    // Delete file on Disk
    document.getElementById("fd-btn-delete").addEventListener("click", async () => {
        if (!currentViewingFileId) return;
        const file = state.files.find(f => f.id === currentViewingFileId);
        if (file && confirm(`정말 바탕화면의 '${file.name}' 물리 파일을 삭제하시겠습니까? PC에서 영구 삭제됩니다.`)) {
            try {
                const fileDir = file.relativePath.includes('/') 
                    ? file.relativePath.substring(0, file.relativePath.lastIndexOf('/')) 
                    : file.folder;
                const res = await fetch(`${API_BASE}/files`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: file.name, folder: fileDir })
                });
                const data = await res.json();
                if (data.success) {
                    showToast("파일이 바탕화면 폴더에서 삭제되었습니다.", "success");
                    closeModal("modal-file-detail");
                    loadStateFromServer();
                } else {
                    showToast(data.error || "파일 삭제를 실패했습니다.", "error");
                }
            } catch (e) {
                // Fallback delete
                state.files = state.files.filter(f => f.id !== currentViewingFileId);
                localStorage.setItem("workhub_files", JSON.stringify(state.files));
                showToast("로컬 메모리에서 임시 삭제되었습니다.", "warning");
                closeModal("modal-file-detail");
                renderViewData(state.activeView, state.activeFolder);
            }
        }
    });

    // Download / Open file directly in Windows OS
    document.getElementById("fd-btn-download").addEventListener("click", async () => {
        if (!currentViewingFileId) return;
        const file = state.files.find(f => f.id === currentViewingFileId);
        if (file) {
            try {
                showToast(`바탕화면의 '${file.name}' 파일을 실행합니다...`, "info");
                
                const pathSep = file.relativePath.includes('\\') ? '\\' : '/';
                const fileDir = file.relativePath.includes(pathSep) 
                    ? file.relativePath.substring(0, file.relativePath.lastIndexOf(pathSep)) 
                    : file.folder;
                const res = await fetch(`${API_BASE}/files/open`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: file.name, folder: fileDir })
                });
                const data = await res.json();
                if (data.success) {
                    showToast("OS 기본 프로그램으로 파일이 열렸습니다.", "success");
                    closeModal("modal-file-detail");
                } else {
                    showToast(data.error || "파일 열기 실패", "error");
                }
            } catch (err) {
                console.error("OS Open failed:", err);
                showToast("서버 연결에 실패하여 파일을 열 수 없습니다.", "error");
            }
        }
    });

    function triggerDownloadFallback(file) {
        showToast(`가상 다운로드를 시작합니다: ${file.name}`, "info");
        const blob = new Blob([`WorkHub Local Data Sync for ${file.name}`], { type: "text/plain" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // -------------------------------------------------------------
    // 9. FILE CREATION ON DISK (UPLOAD FORM)
    // -------------------------------------------------------------
    const formUpload = document.getElementById("file-upload-form");
    formUpload.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const name = document.getElementById("uf-name").value.trim();
        const folder = document.getElementById("uf-folder").value;
        const contentInput = document.getElementById("uf-content").value.trim();
        const tagsInput = document.getElementById("uf-tags").value.trim();

        if (!name) return;

        const extension = name.split(".").pop().toLowerCase();
        const tags = tagsInput ? tagsInput.split(",").map(t => t.trim()) : [];
        tags.push(extension);

        const payload = {
            name: name,
            folder: folder,
            content: contentInput || `사내 공통 문서 정보 - ${name} 생성내용 요약.`,
            tags: tags
        };

        try {
            const res = await fetch(`${API_BASE}/files/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                showToast(`바탕화면에 '${name}' 파일이 실시간 생성되었습니다.`, "success");
                closeModal("modal-file-upload-form");
                formUpload.reset();
                loadStateFromServer();
            } else {
                showToast(data.error || "파일 생성 실패", "error");
            }
        } catch (e) {
            // Local fallback
            const newFile = {
                id: "file_" + Date.now(),
                name: name,
                extension: extension,
                folder: folder,
                size: "45 KB",
                modifiedAt: formatCurrentDateTime(),
                modifiedBy: "개발담당자 (JK)",
                tags: tags
            };
            state.files.push(newFile);
            localStorage.setItem("workhub_files", JSON.stringify(state.files));
            showToast("로컬 임시 파일이 추가되었습니다.", "warning");
            closeModal("modal-file-upload-form");
            formUpload.reset();
            renderViewData(state.activeView, state.activeFolder);
        }
    });

    // -------------------------------------------------------------
    // 10. VIRTUAL FOLDER VIEW RENDERER
    // -------------------------------------------------------------
    async function renderFolderView(folderName, skipMindmap = false) {
        const currentPath = state.currentExplorerPath || folderName || "";
        state.currentExplorerPath = currentPath;
        localStorage.setItem("workhub_currentExplorerPath", currentPath);

        // 1. Breadcrumbs
        renderBreadcrumbs(currentPath);


        const tableBody = document.getElementById("folder-files-table-body");
        const isSameFolder = (state._lastRenderedPath === currentPath);
        if (!isSameFolder) {
            tableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-slate-400">폴더 정보를 불러오는 중...</td></tr>`;
        }

        const scrollEl = document.getElementById("content-area");
        const prevScroll = scrollEl ? scrollEl.scrollTop : 0;

        try {
            const res = await fetch(`${API_BASE}/dir?path=${encodeURIComponent(currentPath)}`);
            const data = await res.json();
            
            if (data.error) {
                showToast(data.error, "error");
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="px-6 py-12 text-center text-slate-400">
                            <i class="fa-regular fa-folder-open text-3xl mb-3 block text-slate-300"></i>
                            <span class="text-sm">폴더를 열 수 없습니다: ${data.error}</span>
                        </td>
                    </tr>
                `;
                return;
            }

            // 2. Render Subfolders
            renderSubfoldersGrid(data.folders, currentPath);

            // Save files to state for fallback lookup when opening files
            state._explorerFiles = data.files || [];

            // 3. Render Files Table
            renderFilesTable(data.files, currentPath);
            state._lastRenderedPath = currentPath;
            
            // Restore scroll synchronously
            if (scrollEl && prevScroll > 0) scrollEl.scrollTop = prevScroll;

        } catch (err) {
            console.error("Failed to load directory details:", err);
            renderFolderViewFallback(folderName);
        }

        const btnFolderAddFile = document.getElementById("btn-folder-add-file");
        if (btnFolderAddFile) {
            btnFolderAddFile.onclick = () => {
                openModal("modal-file-upload-form");
                const select = document.getElementById("uf-folder");
                if (select) select.value = currentPath;
            };
        }
        
        if (!skipMindmap && window.renderMindmap) window.renderMindmap();
    }

    // Helper to render breadcrumbs
    function renderBreadcrumbs(currentPath) {
        const container = document.getElementById("folder-breadcrumbs");
        if (!container) return;
        container.innerHTML = "";

        // Add Root Link
        const rootLink = document.createElement("a");
        rootLink.href = "#";
        rootLink.className = "hover:text-blue-600 font-medium";
        rootLink.textContent = "루트";
        rootLink.onclick = (e) => {
            e.preventDefault();
            state.currentExplorerPath = "";
            switchView("folders", "");
        };
        container.appendChild(rootLink);

        const parts = currentPath.split('/').filter(Boolean);
        let accumulatedPath = "";

        parts.forEach((part, index) => {
            const divider = document.createElement("span");
            divider.textContent = " / ";
            divider.className = "text-slate-300";
            container.appendChild(divider);

            accumulatedPath += (index === 0 ? "" : "/") + part;
            const displayName = part;

            if (index === parts.length - 1) {
                const span = document.createElement("span");
                span.className = "font-semibold text-slate-800";
                span.textContent = displayName;
                container.appendChild(span);
            } else {
                const link = document.createElement("a");
                link.href = "#";
                link.className = "hover:text-blue-600";
                link.textContent = displayName;
                const targetPath = accumulatedPath;
                link.onclick = (e) => {
                    e.preventDefault();
                    state.currentExplorerPath = targetPath;
                    renderFolderView(state.activeFolder);
                };
                container.appendChild(link);
            }
        });
    }

    // Helper to render subfolders grid
    function renderSubfoldersGrid(folders, currentPath) {
        const section = document.getElementById("subfolders-section");
        const grid = document.getElementById("subfolders-list-grid");
        
        if (!section || !grid) return;
        grid.innerHTML = "";

        if (!folders || folders.length === 0) {
            section.classList.add("hidden");
            return;
        }

        section.classList.remove("hidden");

        folders.forEach(folder => {
            const displayName = folder.name;
            const card = document.createElement("div");
            card.className = "w-full bg-slate-50 p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-white hover:shadow-sm transition-all cursor-pointer group relative flex items-center justify-between";
            
            card.innerHTML = `
                <div class="flex items-center space-x-3 min-w-0 flex-1 pr-4">
                    <i class="fa-solid fa-folder text-blue-500 text-lg flex-shrink-0"></i>
                    <span class="text-sm font-semibold text-slate-700 break-words whitespace-normal leading-snug" title="${folder.name}">${displayName}</span>
                </div>
                <!-- Action Controls -->
                <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button class="btn-subfolder-rename p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100" title="이름 변경">
                        <i class="fa-solid fa-pen-to-square text-xs"></i>
                    </button>
                    <button class="btn-subfolder-delete p-1 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100" title="삭제">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                </div>
            `;

            // Click subfolder
            card.addEventListener("click", (e) => {
                if (e.target.closest("button")) return;
                state.currentExplorerPath = currentPath 
                    ? `${currentPath}/${folder.name}` 
                    : folder.name;
                renderFolderView(state.activeFolder);
            });

            // Rename Subfolder
            card.querySelector(".btn-subfolder-rename").addEventListener("click", (e) => {
                e.stopPropagation();
                openFolderRenameModal(currentPath, folder.name);
            });

            // Delete Subfolder
            card.querySelector(".btn-subfolder-delete").addEventListener("click", (e) => {
                e.stopPropagation();
                deleteFolderPrompt(currentPath, folder.name);
            });

            grid.appendChild(card);
        });
    }

    // Helper to render files table
    function renderFilesTable(files, currentPath) {
        const tableBody = document.getElementById("folder-files-table-body");
        tableBody.innerHTML = "";

        if (!files || files.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-12 text-center text-slate-400">
                        <i class="fa-regular fa-folder-open text-3xl mb-3 block text-slate-300"></i>
                        <span class="text-sm">이 폴더에 파일이 없습니다. 직접 생성하시거나 파일을 드롭해보세요.</span>
                    </td>
                </tr>
            `;
            return;
        }

        files.forEach(file => {
            const tr = document.createElement("tr");
            tr.className = "hover:bg-slate-50 transition-colors group cursor-pointer";
            tr.innerHTML = `
                <td class="px-6 py-4 flex items-center max-w-sm">
                    ${getFileIcon(file.extension)}
                    <span class="font-semibold text-slate-700 truncate" title="${file.name}">${file.name}</span>
                </td>
                <td class="px-6 py-4 text-slate-500 font-medium text-xs hide-in-mindmap">${file.size}</td>
                <td class="px-6 py-4 text-slate-500 text-xs hide-in-mindmap">${file.modifiedAt}</td>
                <td class="px-6 py-4 text-slate-500 text-xs hide-in-mindmap">시스템 자동 동기화</td>
                <td class="px-6 py-4 text-center">
                    <div class="flex items-center justify-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="btn-file-view text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-100" title="정보"><i class="fa-solid fa-circle-info"></i></button>
                        <button class="btn-file-del text-slate-400 hover:text-red-600 p-1 rounded hover:bg-slate-100" title="삭제"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </td>
            `;

            tr.addEventListener("click", (e) => {
                if (e.target.closest("button")) return;
                openFileDetailModal(file.id);
            });

            tr.querySelector(".btn-file-view").addEventListener("click", (e) => {
                e.stopPropagation();
                openFileDetailModal(file.id);
            });

            tr.querySelector(".btn-file-del").addEventListener("click", async (e) => {
                e.stopPropagation();
                if (confirm(`정말 바탕화면의 '${file.name}' 물리 파일을 삭제하시겠습니까?`)) {
                    try {
                        const res = await fetch(`${API_BASE}/files`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ filename: file.name, folder: currentPath })
                        });
                        const data = await res.json();
                        if (data.success) {
                            showToast("파일이 바탕화면 폴더에서 삭제되었습니다.", "success");
                            loadStateFromServer();
                        }
                    } catch (err) {
                        showToast("파일 삭제 실패", "error");
                    }
                }
            });

            tableBody.appendChild(tr);
        });
    }

    // Fallback if API fails
    function renderFolderViewFallback(folderName) {
        document.getElementById("folder-breadcrumb-active").innerText = folderName;

        const tableBody = document.getElementById("folder-files-table-body");
        tableBody.innerHTML = "";

        const folderFiles = state.files.filter(f => f.folder === folderName);
        renderFilesTable(folderFiles, folderName);

        const section = document.getElementById("subfolders-section");
        if (section) section.classList.add("hidden");
    }

    // Helper functions for folders management
    function openFolderRenameModal(parentPath, oldName) {
        document.getElementById("fr-parent-path").value = parentPath || "";
        document.getElementById("fr-old-name").value = oldName;
        document.getElementById("fr-new-name").value = oldName;
        openModal("modal-folder-rename");
    }

    async function deleteFolderPrompt(parentPath, folderName) {
        const fullDisplay = parentPath ? `${parentPath}/${folderName}` : folderName;
        if (confirm(`정말 바탕화면의 '${fullDisplay}' 폴더를 영구적으로 삭제하시겠습니까?\n폴더 내의 모든 하위 폴더와 파일이 영구 삭제됩니다.`)) {
            try {
                const res = await fetch(`${API_BASE}/folders`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ parentPath: parentPath || "", folderName })
                });
                const data = await res.json();
                if (data.success) {
                    showToast(`폴더 '${folderName}'가 삭제되었습니다.`, "success");
                    
                    if (state.currentExplorerPath === fullDisplay || state.currentExplorerPath.startsWith(fullDisplay + "/")) {
                        state.currentExplorerPath = parentPath;
                        if (parentPath) {
                            renderFolderView(state.activeFolder);
                        } else {
                            switchView("dashboard");
                        }
                    } else {
                        loadStateFromServer();
                    }
                } else {
                    showToast(data.error || "폴더 삭제 실패", "error");
                }
            } catch (err) {
                showToast("서버 통신에 실패했습니다.", "error");
            }
        }
    }

    // -------------------------------------------------------------
    // 11. PARTNERS (VENDORS/CUSTOMERS) DATABASE CRUD
    // -------------------------------------------------------------
    const vendorForm = document.getElementById("vendor-form");

    // WORKCARD CLIPBOARD PASTE LOGIC
    const pasteArea = document.getElementById("vendor-paste-area");
    const imgPreview = document.getElementById("vendor-image-preview");
    
    if (pasteArea) {
        pasteArea.addEventListener("paste", async (e) => {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            let imageFile = null;
            for (const item of items) {
                if (item.type.indexOf("image") === 0) {
                    imageFile = item.getAsFile();
                    break;
                }
            }
            if (!imageFile) return;

            e.preventDefault();
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;
                if (width > 800) {
                    height = Math.round((height * 800) / width);
                    width = 800;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                const base64 = canvas.toDataURL("image/jpeg", 0.7);
                imgPreview.src = base64;
                imgPreview.classList.remove("hidden");
                
                // AI Card Scan Processing (Gemini API)
                const statusText = pasteArea.querySelector("p.text-xs");
                if (statusText) statusText.innerText = "AI 명함 분석 중...";
                
                fetch('/api/ai/scan-card', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: base64 })
                })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        if (statusText) statusText.innerText = "명함 분석 완료!";
                        
                        const card = data.card || {};
                        if (card.name) document.getElementById("v-name").value = card.name;
                        if (card.company) document.getElementById("v-company").value = card.company;
                        if (card.position) document.getElementById("v-position").value = card.position;
                        if (card.mobile) document.getElementById("v-mobile").value = card.mobile;
                        if (card.phone) document.getElementById("v-phone").value = card.phone;
                        if (card.email) document.getElementById("v-email").value = card.email;
                        if (card.fax) document.getElementById("v-fax").value = card.fax;
                        if (card.address) document.getElementById("v-address").value = card.address;
                        if (card.website) document.getElementById("v-website").value = card.website;
                        if (card.sns) document.getElementById("v-sns").value = card.sns;
                        if (card.memo) {
                            const memoInput = document.getElementById("v-memo");
                            if (memoInput) memoInput.value = card.memo;
                        }
                    } else {
                        if (statusText) statusText.innerText = "분석 실패 (오류)";
                        showToast(data.error || "명함 분석에 실패했습니다.", "error");
                    }
                })
                .catch(err => {
                    if (statusText) statusText.innerText = "분석 실패 (서버 오류)";
                    console.error("AI OCR error:", err);
                    showToast("서버 통신에 실패했습니다.", "error");
                });
            };
            img.src = URL.createObjectURL(imageFile);
        });
    }

    
    vendorForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const id = document.getElementById("vendor-id-field").value;
        const name = document.getElementById("v-name").value.trim();
        const company = document.getElementById("v-company").value.trim();
        const position = document.getElementById("v-position").value.trim();
        const mobile = document.getElementById("v-mobile").value.trim();
        const phone = document.getElementById("v-phone").value.trim();
        const email = document.getElementById("v-email").value.trim();
        const fax = document.getElementById("v-fax").value.trim();
        const address = document.getElementById("v-address").value.trim();
        const website_url = document.getElementById("v-website").value.trim();
        const sns = document.getElementById("v-sns").value.trim();
        
        const relationship = document.getElementById("v-relationship").value;
        const rating = parseInt(document.getElementById("v-rating").value, 10);
        const tags = document.getElementById("v-tags").value.trim();
        const meet_location = document.getElementById("v-location").value.trim();
        const memo = document.getElementById("v-memo").value.trim();
        const is_shared = document.getElementById("v-shared").checked;

        let updatedPayload = [...state.vendors];

        const newOrUpdatedCard = {
            card_id: id || "card_" + Date.now(),
            user_id: "user_1", // Default user
            name, company, position, mobile, phone, email, fax, address, website_url, sns,
            relationship, rating, tags, meet_location, memo, is_shared,
            image_front_base64: document.getElementById('vendor-image-preview')?.src?.startsWith('data:image') ? document.getElementById('vendor-image-preview').src : '',
            image_back_base64: '',
            raw_ocr_text: document.getElementById("vendor-paste-area")?.getAttribute("data-raw-ocr") || ""
        };

        if (id) {
            const idx = updatedPayload.findIndex(v => v.card_id === id);
            if (idx > -1) {
                updatedPayload[idx] = { ...updatedPayload[idx], ...newOrUpdatedCard };
                showToast(`명함 '${name}' 정보가 수정되었습니다.`, "success");
            }
        } else {
            updatedPayload.push(newOrUpdatedCard);
            showToast(`신규 명함 '${name}'가 등록되었습니다.`, "success");
        }

        await syncData("vendors", updatedPayload);
        closeModal("modal-vendor-form");
        renderVendorsList();
    });

    
    
    function renderVendorsList() {
        const grid = document.getElementById("vendors-grid-container");
        if (!grid) return;
        grid.innerHTML = "";
        
        const searchQuery = document.getElementById("vendor-search-input").value.trim().toLowerCase();
        
        const filteredVendors = state.vendors.filter(v => {
            const name = v.name ? v.name.toLowerCase() : "";
            const company = v.company ? v.company.toLowerCase() : "";
            const tags = v.tags ? v.tags.toLowerCase() : "";
            return name.includes(searchQuery) || company.includes(searchQuery) || tags.includes(searchQuery);
        });

        if (filteredVendors.length === 0) {
            grid.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-20 bg-slate-50 border border-slate-200 border-dashed rounded-xl">
                <i class="fa-solid fa-address-card text-4xl text-slate-300 mb-3"></i>
                <p class="text-slate-500 font-medium">검색 결과가 없거나 등록된 명함이 없습니다.</p>
            </div>`;
            return;
        }

        filteredVendors.forEach(v => {
            const card = document.createElement("div");
            card.className = "bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all relative group h-full flex flex-col aspect-[90/50]";
            
            // Front Side
            card.innerHTML = `
                <div class="p-5 flex flex-col h-full absolute inset-0 bg-white transition-all duration-500 group-hover:opacity-0 group-hover:pointer-events-none z-10" style="backface-visibility: hidden;">
                    <div class="flex justify-between items-start mb-3">
                        <span class="px-2.5 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded uppercase tracking-wider">${v.relationship || 'PARTNER'}</span>
                        <div class="text-right">
                            <h3 class="text-lg font-bold text-slate-800 leading-tight">${v.name}</h3>
                            <p class="text-xs text-slate-400 mt-0.5">${v.company || ''} ${v.position ? ' | '+v.position : ''}</p>
                        </div>
                    </div>
                    ${v.image_front_base64 && v.image_front_base64.startsWith('data:image') ? `<div class="flex-grow flex items-center justify-center overflow-hidden rounded mb-3 bg-slate-50 border border-slate-100"><img src="${v.image_front_base64}" class="max-h-full object-contain"></div>` : `<div class="flex-grow"></div>`}
                    <div class="mt-auto space-y-1.5 text-xs text-slate-600">
                        <p class="flex items-center"><i class="fa-solid fa-mobile-screen-button w-4 text-slate-400"></i> &nbsp;${v.mobile || '-'}</p>
                        <p class="flex items-center truncate"><i class="fa-solid fa-envelope w-4 text-slate-400"></i> &nbsp;${v.email || '-'}</p>
                    </div>
                </div>
                
                <!-- Back Side (Hover) -->
                <div class="p-5 flex flex-col h-full absolute inset-0 bg-slate-800 text-white opacity-0 pointer-events-none transition-all duration-500 group-hover:opacity-100 group-hover:pointer-events-auto rotate-y-180 group-hover:rotate-y-0 z-20" style="transform: rotateY(-180deg); backface-visibility: hidden;">
                    <div class="flex justify-between items-start mb-3">
                        <h3 class="text-lg font-bold text-white leading-tight">${v.name} <span class="text-xs text-amber-400 ml-1">${'★'.repeat(v.rating || 3)}</span></h3>
                        <div class="flex gap-2">
                            <button class="btn-vendor-edit text-slate-300 hover:text-white transition-colors"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn-vendor-delete text-red-400 hover:text-red-300 transition-colors"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                    <div class="flex-grow text-xs text-slate-300 flex flex-col gap-2 overflow-hidden">
                        <p><strong class="text-slate-400">태그:</strong> ${v.tags || '-'}</p>
                        <p><strong class="text-slate-400">만남:</strong> ${v.meet_location || '-'}</p>
                        <p class="line-clamp-2"><strong class="text-slate-400">메모:</strong> ${v.memo || '-'}</p>
                    </div>
                    <div class="mt-auto text-xs text-slate-400 flex flex-col gap-1">
                        ${v.phone ? `<p><i class="fa-solid fa-phone w-4"></i> &nbsp;${v.phone}</p>` : ''}
                        <p><i class="fa-solid fa-building w-4"></i> &nbsp;${v.address || '-'}</p>
                    </div>
                </div>
            `;

            card.addEventListener('mouseenter', () => { 
                const front = card.querySelector('.z-10');
                const back = card.querySelector('.z-20');
                if(front) front.style.transform = 'rotateY(180deg)';
                if(back) back.style.transform = 'rotateY(0)';
            });
            card.addEventListener('mouseleave', () => { 
                const front = card.querySelector('.z-10');
                const back = card.querySelector('.z-20');
                if(front) front.style.transform = 'rotateY(0)';
                if(back) back.style.transform = 'rotateY(-180deg)';
            });
            
            card.querySelector(".btn-vendor-edit").addEventListener("click", () => {
                document.getElementById("vendor-id-field").value = v.card_id;
                document.getElementById("v-name").value = v.name || "";
                document.getElementById("v-company").value = v.company || "";
                document.getElementById("v-position").value = v.position || "";
                document.getElementById("v-mobile").value = v.mobile || "";
                document.getElementById("v-phone").value = v.phone || "";
                document.getElementById("v-email").value = v.email || "";
                document.getElementById("v-fax").value = v.fax || "";
                document.getElementById("v-address").value = v.address || "";
                document.getElementById("v-website").value = v.website_url || "";
                document.getElementById("v-sns").value = v.sns || "";
                
                document.getElementById("v-relationship").value = v.relationship || "고객사";
                document.getElementById("v-rating").value = v.rating || 3;
                document.getElementById("v-tags").value = v.tags || "";
                document.getElementById("v-location").value = v.meet_location || "";
                document.getElementById("v-memo").value = v.memo || "";
                document.getElementById("v-shared").checked = v.is_shared !== false;
                
                const imgPreview = document.getElementById("vendor-image-preview");
                if (v.image_front_base64 && v.image_front_base64.startsWith('data:image')) {
                    imgPreview.src = v.image_front_base64;
                    imgPreview.classList.remove("hidden");
                } else {
                    imgPreview.src = "";
                    imgPreview.classList.add("hidden");
                }
                
                document.getElementById("vendor-modal-title").innerText = "명함 정보 수정";
                openModal("modal-vendor-form");
            });

            card.querySelector(".btn-vendor-delete").addEventListener("click", async () => {
                if (!confirm(`'${v.name}' 명함을 삭제하시겠습니까?`)) return;
                const payload = state.vendors.filter(vendor => vendor.card_id !== v.card_id);
                await syncData("vendors", payload);
                showToast(`명함 '${v.name}'(이)가 삭제되었습니다.`, "error");
                renderVendorsList();
            });

            grid.appendChild(card);
        });
    }


    document.getElementById("vendor-search-input").addEventListener("input", renderVendorsList);
    document.getElementById("btn-add-vendor").addEventListener("click", () => {
        document.getElementById("vendor-form").reset();
        document.getElementById("vendor-id-field").value = "";
        document.getElementById("vendor-modal-title").innerText = "신규 거래처 등록";
        openModal("modal-vendor-form");
    });

    // -------------------------------------------------------------
    // 12. COMPONENTS / SHARED ASSETS LIBRARY VIEW
    // -------------------------------------------------------------
    const componentForm = document.getElementById("component-form");
    
    componentForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const name = document.getElementById("c-name").value.trim();
        const partNumber = document.getElementById("c-partNumber").value.trim();
        const drawingNumber = document.getElementById("c-drawingNumber").value.trim();
        const material = document.getElementById("c-material").value.trim();
        const ownerName = document.getElementById("c-ownerName").value.trim();
        const category = document.getElementById("c-category").value;
        const description = document.getElementById("c-desc").value.trim();

        const newAsset = {
            id: "asset_" + Date.now(),
            name, assetNumber: partNumber, drawingNumber, format: material, ownerName, category, status: "최종 승인", description
        };

        const payload = [...state.components, newAsset];
        await syncData("components", payload);

        closeModal("modal-component-form");
        componentForm.reset();

        showToast(`공유 자료 '${name}'가 자산실에 추가되었습니다.`, "success");
        renderComponentsList();
    });

    let activeComponentFilter = "all";

    function renderComponentsList() {
        const container = document.getElementById("components-grid-container");
        container.innerHTML = "";

        // Filter by category filter bar AND department switcher
        const filtered = state.components.filter(c => {
            const matchesCategory = activeComponentFilter === "all" || c.category === activeComponentFilter;
            
            // Map asset categories to department keys
            let assetDept = "공통";
            if (c.category === "개발/도면") assetDept = "개발팀";
            else if (c.category === "영업/제안서") assetDept = "영업팀";
            else if (c.category === "양식/템플릿") assetDept = "인사총무팀";
            else if (c.category === "경영/보고서") assetDept = "구매팀"; // Mapping reports to purchasing as fallback

            const matchesDept = isItemDeptRelevant(assetDept);
            return matchesCategory && matchesDept;
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="col-span-full bg-white p-12 text-center text-slate-400 border border-slate-200 rounded-xl shadow-sm">
                    <i class="fa-solid fa-folder-open text-3xl mb-3 block text-slate-300"></i>
                    현재 작업영역 및 카테고리에 등록된 공유 자료가 없습니다.
                </div>
            `;
        } else {
            filtered.forEach(c => {
                let badgeClass = "bg-blue-50 text-blue-700 border-blue-200";
                if (c.category === "개발/도면") badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                else if (c.category === "양식/템플릿") badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                else if (c.category === "영업/제안서") badgeClass = "bg-indigo-50 text-indigo-700 border-indigo-200";
                else if (c.category === "경영/보고서") badgeClass = "bg-rose-50 text-rose-700 border-rose-200";

                const card = document.createElement("div");
                card.className = "bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between premium-card cursor-pointer";
                card.innerHTML = `
                    <div>
                        <div class="flex justify-between items-start mb-2">
                            <span class="px-2 py-0.5 border text-[10px] font-bold rounded-md ${badgeClass}">${c.category}</span>
                            <span class="text-[10px] text-slate-400 font-bold font-mono">${c.assetNumber}</span>
                        </div>
                        <h3 class="font-bold text-slate-800 text-base mb-1.5 truncate" title="${c.name}">${c.name}</h3>
                        
                        <div class="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs text-slate-500 mb-3 border-t border-slate-100 pt-2.5 font-medium">
                            <p>📄 파일형식: <span class="text-slate-800 font-semibold font-mono uppercase">${c.format}</span></p>
                            <p>👥 소유부서: <span class="text-slate-800 font-semibold">${c.ownerName}</span></p>
                        </div>
                        <p class="text-xs text-slate-400 leading-normal line-clamp-2">${c.description || "상세 설명이 등록되어 있지 않습니다."}</p>
                    </div>
                    <div class="flex justify-end space-x-2 pt-3 border-t border-slate-100 mt-4">
                        <button class="btn-comp-del text-xs text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-50" title="자료 삭제"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                `;

                card.addEventListener("click", (e) => {
                    if (e.target.closest("button")) return;
                    showToast(`공유 자료 '${c.name}'의 상세 정보를 불러옵니다.`, "info");
                    
                    // Create simulated file matching asset specs to view details
                    const newMockFile = {
                        id: c.id,
                        name: `${c.assetNumber}_${c.name.replace(/\s+/g, "_")}.${c.format}`,
                        extension: c.format,
                        folder: c.category === "개발/도면" ? "02_부품_및_기술자료" : "04_공통_양식_템플릿",
                        relativePath: `${c.category === "개발/도면" ? "02_부품_및_기술자료" : "04_공통_양식_템플릿"}/${c.assetNumber}_${c.name.replace(/\s+/g, "_")}.${c.format}`,
                        size: "140 KB",
                        modifiedAt: "2026-06-04 10:00",
                        modifiedBy: c.ownerName,
                        tags: ["공유자료", c.category]
                    };
                    
                    if (!state.files.find(f => f.id === c.id)) {
                        state.files.push(newMockFile);
                    }
                    openFileDetailModal(c.id);
                });

                card.querySelector(".btn-comp-del").addEventListener("click", async (e) => {
                    e.stopPropagation();
                    if (confirm(`정말 공유자료 '${c.name}' 정보를 아카이브 해제하시겠습니까?`)) {
                        const payload = state.components.filter(item => item.id !== c.id);
                        await syncData("components", payload);
                        showToast("공유 자산이 아카이브 해제되었습니다.", "success");
                        renderComponentsList();
                    }
                });

                container.appendChild(card);
            });
        }
    }

    document.querySelectorAll("#component-status-filter-bar button").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#component-status-filter-bar button").forEach(b => {
                b.className = "px-3 py-1 bg-white hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 text-xs font-semibold";
            });
            btn.className = "px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold";
            activeComponentFilter = btn.getAttribute("data-status");
            renderComponentsList();
        });
    });

    document.getElementById("btn-add-component").addEventListener("click", () => {
        document.getElementById("component-form").reset();
        openModal("modal-component-form");
    });

    // -------------------------------------------------------------
    // 13. FILE UPLOADER (DRAG & DROP TO REAL DISK)
    // -------------------------------------------------------------
    const dropZone = document.getElementById("drop-zone");
    const fileUploader = document.getElementById("file-uploader");

    if (dropZone && fileUploader) {
        dropZone.addEventListener("click", () => fileUploader.click());

        dropZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropZone.classList.add("border-blue-500", "bg-blue-50/20");
        });

        ["dragleave", "drop"].forEach(event => {
            dropZone.addEventListener(event, () => {
                dropZone.classList.remove("border-blue-500", "bg-blue-50/20");
            });
        });

        dropZone.addEventListener("drop", (e) => {
            e.preventDefault();
            handleDroppedFiles(e.dataTransfer.files);
        });

        fileUploader.addEventListener("change", (e) => {
            handleDroppedFiles(e.target.files);
        });
    }

    async function handleDroppedFiles(fileList) {
        if (fileList.length === 0) return;
        
        let successCount = 0;
        for (let i = 0; i < fileList.length; i++) {
            const f = fileList[i];
            const ext = f.name.split(".").pop().toLowerCase();
            
            // PARA: default to 0_프로젝트
            let targetFolder = "0_프로젝트";
            if (ext === "hwp") targetFolder = "0_프로젝트";
            else if (ext === "xlsx" || ext === "xls") targetFolder = "2_자료";
            else if (ext === "dwg") targetFolder = "0_프로젝트";

            const payload = {
                name: f.name,
                folder: targetFolder,
                content: `이 파일은 바탕화면 연동 생성기로 드롭 업로드되었습니다. 파일 크기: ${f.size} Bytes.`,
                tags: [ext, "업로드"]
            };

            try {
                const res = await fetch(`${API_BASE}/files/upload`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) successCount++;
            } catch (err) {
                console.error("Failed to upload via API:", err);
            }
        }

        if (successCount > 0) {
            showToast(`${successCount}개 파일이 실제 바탕화면 폴더에 생성되었습니다!`, "success");
            loadStateFromServer();
        } else {
            showToast("파일 생성에 실패했습니다. 백엔드 서버를 점검해주세요.", "error");
        }
    }

    // -------------------------------------------------------------
    // 14. KANBAN BOARD DRAG & DROP & CRUD
    // -------------------------------------------------------------
    const orderForm = document.getElementById("order-form");
    
    orderForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const id = document.getElementById("order-id-field").value;
        const title = document.getElementById("o-title").value.trim();
        const department = document.getElementById("o-department").value;
        const assignee = document.getElementById("o-assignee").value.trim();
        const amount = parseInt(document.getElementById("o-amount").value, 10) || 0;
        const status = document.getElementById("o-status").value;
        const deliveryDate = document.getElementById("o-delivery").value || formatCurrentDate();
        const itemsCount = parseInt(document.getElementById("o-items").value, 10) || 1;
        const description = document.getElementById("o-desc").value.trim();
        const priority = document.getElementById("o-priority").value;
        const folder = priority; // Sync priority to folder

        let updatedTasks = [...state.orders];

        if (id) {
            const idx = updatedTasks.findIndex(o => o.id === id);
            if (idx > -1) {
                // Preserve existing fields (timeline, folder, activeSession, etc.) when editing via form
                const existing = updatedTasks[idx];
                updatedTasks[idx] = {
                    ...existing,
                    id, title, department, assignee, amount, status, deliveryDate, itemsCount, description, priority, folder
                };
                if (status === "completed") {
                    updatedTasks[idx].completedAt = Date.now();
                } else {
                    delete updatedTasks[idx].completedAt;
                }
                showToast(`업무 '${title}'가 저장되었습니다.`, "success");
            } else {
                // AI 등으로 미리 ID가 생성되었지만 아직 목록에 없는 신규 업무인 경우
                const newTask = {
                    id, title, department, assignee, amount, status, deliveryDate, itemsCount, description, priority, folder
                };
                if (status === "completed") newTask.completedAt = Date.now();
                updatedTasks.push(newTask);
                showToast(`신규 업무 '${title}'가 추가되었습니다.`, "success");
            }
        } else {
            const newTask = {
                id: "task_" + Date.now(),
                title, department, assignee, amount, status, deliveryDate, itemsCount, description, priority, folder
            };
            if (status === "completed") newTask.completedAt = Date.now();
            updatedTasks.push(newTask);
            showToast(`신규 업무 '${title}'가 추가되었습니다.`, "success");
        }

        await syncData("orders", updatedTasks);
        closeModal("modal-order-form");
        renderViewData(state.activeView, state.activeFolder);
    });


    
    window.openTaskDetailById = function(taskId) {
        const task = state.orders.find(o => o.id === taskId);
        if (task && typeof openTaskDetail === "function") {
            openTaskDetail(task);
        }
    };

    function updateNotifications() {
        const unreadDot = document.getElementById("unread-dot");
        const notifList = document.getElementById("notification-list");
        if (!unreadDot || !notifList) return;

        const urgentTasks = state.orders.filter(task => {
            return task.status !== "completed" && task.status !== "done" && getDaysUntil(task.deliveryDate) <= 3;
        });

        if (urgentTasks.length > 0) {
            unreadDot.classList.remove("hidden");
            unreadDot.classList.add("block");
            
            notifList.innerHTML = urgentTasks.map(task => {
                const days = getDaysUntil(task.deliveryDate);
                const dDay = days < 0 ? `마감 지남 (${Math.abs(days)}일)` : (days === 0 ? "D-Day" : `D-${days}`);
                const color = days < 0 ? "text-red-600 bg-red-50" : (days === 0 ? "text-orange-600 bg-orange-50" : "text-amber-600 bg-amber-50");
                return `
                    <div class="p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group" onclick="window.openTaskDetailById('${task.id}');">
                        <div class="flex justify-between items-start mb-1">
                            <h4 class="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-blue-600 transition-colors">${task.title}</h4>
                            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded ${color} whitespace-nowrap ml-2">${dDay}</span>
                        </div>
                        <p class="text-[10px] text-slate-500 line-clamp-1">${task.department} • 담당: ${task.assignee || '미지정'}</p>
                    </div>
                `;
            }).join('');
        } else {
            unreadDot.classList.add("hidden");
            unreadDot.classList.remove("block");
            
            notifList.innerHTML = `
                <div class="p-6 text-center text-slate-400">
                    <i class="fa-regular fa-bell-slash text-2xl mb-2 text-slate-300"></i>
                    <p class="text-xs">현재 마감이 임박한 업무가 없습니다.</p>
                </div>
            `;
        }
    }

    let kanbanParaFilter = 'all';
    let currentSelectedTask = null;

    window.renderKanbanBoard = function renderKanbanBoard() {
        window.renderKanbanBoard = renderKanbanBoard;
        const columns = {
            inbox: document.getElementById("col-inbox"),
            todo: document.getElementById("col-todo"),
            inprogress: document.getElementById("col-inprogress"),
            waiting: document.getElementById("col-waiting"),
            done: document.getElementById("col-done")
        };

        if (!columns.inbox) return;

        Object.keys(columns).forEach(key => {
            if(columns[key]) columns[key].innerHTML = "";
        });
        
        const counters = { inbox: 0, todo: 0, inprogress: 0, waiting: 0, done: 0 };

        updateNotifications();

        // 반복 업무 뱃지 갱신
        const badgeRecurringEl = document.getElementById('badge-recurring');
        if (badgeRecurringEl) {
            badgeRecurringEl.textContent = state.recurringTasks ? state.recurringTasks.length : 0;
        }

        let filteredTasks = state.orders;
        
        filteredTasks = filteredTasks.filter(task => {

            if (kanbanSearchQuery) {
                const searchStr = `${task.title} ${task.description || ''} ${task.folder || ''}`.toLowerCase();
                return searchStr.includes(kanbanSearchQuery);
            }
            
            if (task.status === "done" || task.status === "completed") {
                if (!task.completedAt) task.completedAt = Date.now();
                if ((Date.now() - task.completedAt) / (1000 * 60 * 60 * 24) > 3) return false;
            }
            
            return true;
        });



        filteredTasks.forEach(task => {
            let st = task.status;
            if(st === "pending_approval") st = "todo";
            if(st === "in_progress") st = "inprogress";
            if(st === "completed") st = "done";
            task.status = st;
            if(!task.folder || task.folder === 'none' || task.folder === 'projects' || task.folder === 'areas' || task.folder === 'resources' || task.folder === 'archives') {
                task.folder = "not_urgent_not_important"; // fallback for old data
            }

            const col = columns[task.status];
            if (!col) return;

            counters[task.status]++;

            const urgInfo = URGENCY_MAP[task.folder] || URGENCY_MAP['not_urgent_not_important'];

            const card = document.createElement("div");
            card.id = task.id;
            card.draggable = !state.isNetworkView;
            card.className = `kanban-card p-3 rounded-lg border border-slate-200 cursor-pointer hover:shadow-md transition-all active:cursor-grabbing group relative mb-3 shadow-sm`;
            card.style.backgroundColor = urgInfo.bg;
            card.style.color = urgInfo.text === 'white' ? '#ffffff' : '#1e293b';
            
            const titleColor = urgInfo.text === 'white' ? 'text-white' : 'text-slate-800';
            const subColor = urgInfo.text === 'white' ? 'opacity-80 text-white' : 'text-slate-500';

            let rtBadgeHtml = '';
            if (state.recurringTasks) {
                const rt = state.recurringTasks.find(r => r.title === task.title && r.isActive);
                if (rt || task.isRecurringInstance) {
                    const typeMap = { 'daily': '일반복', 'weekly': '주반복', 'monthly': '월반복', 'yearly': '연반복', 'adhoc': '수시반복' };
                    const label = rt ? (typeMap[rt.type] || '반복') : '반복';
                    rtBadgeHtml = `<span class="absolute top-2 right-2 inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm z-10"><i class="fa-solid fa-rotate"></i> ${label}</span>`;
                }
            }

            card.innerHTML = `
                <div class="flex justify-between items-start mb-1">
                    <span class="text-[10px] font-bold opacity-80">${urgInfo.icon} ${urgInfo.label}</span>
                </div>
                <h3 class="text-sm font-semibold leading-snug ${titleColor}">
                    ${rtBadgeHtml}
                    ${task.title}
                </h3>
                <div class="flex items-center justify-end mt-3 text-xs ${subColor}">
                    ${task.description ? `<i class="fa-solid fa-file-lines"></i>` : ''}
                </div>
            `;

            card.addEventListener("dragstart", (e) => {
                card.classList.add("dragging");
                e.dataTransfer.setData("text/plain", task.id);
            });
            card.addEventListener("dragend", () => card.classList.remove("dragging"));

            card.addEventListener("click", () => openTaskDetail(task));
            
            col.appendChild(card);
        });

        Object.keys(counters).forEach(key => {
            const badge = document.getElementById("badge-" + key);
            if (badge) badge.innerText = counters[key];
        });

        // Bind Drag over Columns safely without cloning
        if (!state.isNetworkView) {
            document.querySelectorAll(".kanban-column").forEach(column => {
                column.ondragover = (e) => {
                    e.preventDefault();
                    column.classList.add("drag-over");
                };

                column.ondragleave = () => {
                    column.classList.remove("drag-over");
                };

                column.ondrop = async (e) => {
                    e.preventDefault();
                    column.classList.remove("drag-over");
                
                const cardId = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("text");
                const targetStatus = column.getAttribute("data-status");
                
                const task = state.orders.find(o => o.id === cardId);
                if (task && task.status !== targetStatus) {
                    task.status = targetStatus;
                    if (targetStatus === "done") {
                        task.completedAt = Date.now();
                    } else {
                        delete task.completedAt;
                    }
                    
                    await syncData("orders", state.orders);
                    renderKanbanBoard();
                }
            };
        });
        }
    }

    // Timeline Tracker Logic
    let lastTaskOpenTime = 0;

    function renderTimeline(task) {
        const listEl = document.getElementById("fs-timeline-list");
        listEl.innerHTML = "";
        
        let html = "";

        // 1. Render Active Session if exists
        if (task.activeSession) {
            const dateObj = new Date(task.activeSession.startTime);
            const timeStr = dateObj.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
            
            // Links & Images for Active Session
            let attachmentsHtml = "";
            if (task.activeSession.links && task.activeSession.links.length > 0) {
                attachmentsHtml += `<div class="flex flex-wrap gap-2 mb-3">`;
                task.activeSession.links.forEach((lk, idx) => {
                    const isPath = lk.type === 'path' || /^[A-Za-z]:\\/i.test(lk.url || '');
                    const linkIcon = isPath ? 'fa-folder-open' : 'fa-link';
                    const linkAttr = isPath
                        ? `href="#" class="path-link" data-path="${(lk.url || '').replace(/"/g, '&quot;')}"`
                        : `href="${lk.url || '#'}" target="_blank"`;
                    attachmentsHtml += `
                        <div class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold border border-blue-200">
                            <a ${linkAttr} class="hover:underline cursor-pointer"><i class="fa-solid ${linkIcon}"></i> ${lk.title || lk.url}</a>
                            <button type="button" onclick="deleteTimelineResource('${task.id}', null, 'link', ${idx})" class="text-blue-400 hover:text-red-500 ml-1"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                    `;
                });
                attachmentsHtml += `</div>`;
            }
            if (task.activeSession.images && task.activeSession.images.length > 0) {
                attachmentsHtml += `<div class="flex flex-wrap gap-2 mb-3">`;
                task.activeSession.images.forEach((img, idx) => {
                    attachmentsHtml += `
                        <div class="relative block w-20 h-20 rounded-lg overflow-hidden border border-slate-200 hover:border-blue-500 transition-colors group">
                            <a href="${img.url}" target="_blank">
                                <img src="${img.url}" class="w-full h-full object-cover" alt="첨부 이미지">
                            </a>
                            <button type="button" onclick="deleteTimelineResource('${task.id}', null, 'image', ${idx})" class="absolute top-1 right-1 bg-white/80 hover:bg-red-100 text-slate-600 hover:text-red-500 rounded-full w-5 h-5 flex items-center justify-center backdrop-blur-sm shadow transition-colors">
                                <i class="fa-solid fa-xmark text-[10px]"></i>
                            </button>
                        </div>
                    `;
                });
                attachmentsHtml += `</div>`;
            }

            html += `
                <div class="relative pl-8 mb-6">
                    <!-- Node -->
                    <div class="absolute left-[3px] top-4 w-4 h-4 rounded-full bg-blue-500 shadow flex items-center justify-center transform -translate-x-1/2">
                    </div>
                    
                    <!-- Active Card -->
                    <div class="bg-blue-50/30 rounded-xl border border-blue-200 shadow-sm p-5 transition-shadow relative overflow-hidden">
                        <div class="flex items-center justify-between mb-4">
                            <h4 class="font-bold text-slate-800 text-lg flex items-center gap-2">
                                <span class="w-3 h-3 rounded-full bg-blue-500"></span>
                                ${task.activeSession.title}
                            </h4>
                            <div class="text-sm font-semibold text-blue-500 bg-blue-50 px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-blue-100">
                                <i class="fa-regular fa-clock"></i> 시작 시간: ${timeStr}
                            </div>
                        </div>
                        
                        <textarea id="active-session-content" class="w-full min-h-[160px] bg-white border border-slate-200 rounded-xl p-4 resize-y focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 text-sm mb-3 placeholder-slate-400" placeholder="업무 내용, 특이사항, 회의록 등을 자유롭게 작성하세요... (스크린샷 붙여넣기 가능)">${task.activeSession.content || ""}</textarea>
                        
                        ${attachmentsHtml}

                        <div class="flex items-center justify-between">
                            <div class="flex gap-2">
                                <button type="button" onclick="addTimelineLink('${task.id}')" class="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-sm text-slate-600 font-medium transition-colors flex items-center gap-2">
                                    <i class="fa-solid fa-link"></i> 링크 추가
                                </button>
                                <button type="button" onclick="addTimelineImage('${task.id}')" class="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-sm text-slate-600 font-medium transition-colors flex items-center gap-2">
                                    <i class="fa-regular fa-image"></i> 이미지/스크린샷 첨부
                                </button>
                            </div>
                            <button type="button" id="btn-save-active-session" class="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-bold transition-colors shadow-md flex items-center gap-2">
                                <i class="fa-solid fa-square text-xs"></i> 작업 종료 및 저장
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        // 2. Render Past Entries
        if (!task.timeline || task.timeline.length === 0) {
            if (!task.activeSession) {
                html += '<div class="text-sm text-slate-400 pl-8 py-4">아직 기록된 타임라인 내역이 없습니다.</div>';
            }
        } else {
            // Sort descending by timestamp
            const sorted = [...task.timeline].sort((a, b) => b.timestamp - a.timestamp);

            sorted.forEach(entry => {
                const dateObj = new Date(entry.timestamp);
                const dateStr = dateObj.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
                const timeStr = dateObj.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

                let linksHtmlNormal = "";
                let imagesHtmlNormal = "";
                let attachmentsHtmlEdit = "";
                if (entry.links && entry.links.length > 0) {
                    linksHtmlNormal += `<div class="flex flex-wrap gap-2 mt-3 mb-1">`;
                    attachmentsHtmlEdit += `<div class="flex flex-wrap gap-2 mt-3 mb-3">`;
                    entry.links.forEach((lk, idx) => {
                        const isPath = lk.type === 'path' || /^[A-Za-z]:\\/i.test(lk.url || '');
                        const linkIcon = isPath ? 'fa-folder-open' : 'fa-link';
                        const linkAttr = isPath
                            ? `href="#" class="path-link" data-path="${(lk.url || '').replace(/"/g, '&quot;')}"`
                            : `href="${lk.url || '#'}" target="_blank"`;
                        linksHtmlNormal += `
                            <a ${linkAttr} class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors border border-slate-200 cursor-pointer">
                                <i class="fa-solid ${linkIcon}"></i> ${lk.title || lk.url}
                            </a>
                        `;
                        attachmentsHtmlEdit += `
                            <div class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200">
                                <a ${linkAttr} class="hover:underline cursor-pointer"><i class="fa-solid ${linkIcon}"></i> ${lk.title || lk.url}</a>
                                <button type="button" onclick="deleteTimelineResource('${task.id}', '${entry.id}', 'link', ${idx})" class="text-slate-400 hover:text-red-500 ml-1"><i class="fa-solid fa-xmark"></i></button>
                            </div>
                        `;
                    });
                    linksHtmlNormal += `</div>`;
                    attachmentsHtmlEdit += `</div>`;
                }
                if (entry.images && entry.images.length > 0) {
                    imagesHtmlNormal += `<div class="flex flex-wrap gap-2">`;
                    attachmentsHtmlEdit += `<div class="flex flex-wrap gap-2 mt-3 mb-3">`;
                    entry.images.forEach((img, idx) => {
                        imagesHtmlNormal += `
                            <a href="${img.url}" target="_blank" class="block w-20 h-20 rounded-lg overflow-hidden border border-slate-200 hover:border-slate-400 transition-colors shadow-sm">
                                <img src="${img.url}" class="w-full h-full object-cover" alt="첨부 이미지">
                            </a>
                        `;
                        attachmentsHtmlEdit += `
                            <div class="relative block w-20 h-20 rounded-lg overflow-hidden border border-slate-200 group">
                                <a href="${img.url}" target="_blank">
                                    <img src="${img.url}" class="w-full h-full object-cover" alt="첨부 이미지">
                                </a>
                                <button type="button" onclick="deleteTimelineResource('${task.id}', '${entry.id}', 'image', ${idx})" class="absolute top-1 right-1 bg-white/80 hover:bg-red-100 text-slate-600 hover:text-red-500 rounded-full w-5 h-5 flex items-center justify-center backdrop-blur-sm shadow transition-colors">
                                    <i class="fa-solid fa-xmark text-[10px]"></i>
                                </button>
                            </div>
                        `;
                    });
                    imagesHtmlNormal += `</div>`;
                    attachmentsHtmlEdit += `</div>`;
                }

                if (window.activeTimelineEditId === entry.id) {
                    // Edit Mode
                    html += `
                        <div class="relative pl-8 mb-4">
                            <!-- Node -->
                            <div class="absolute left-[3px] top-4 w-4 h-4 rounded-full border-2 border-blue-500 bg-white shadow flex items-center justify-center transform -translate-x-1/2">
                                <div class="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                            </div>
                            
                            <!-- Edit Card -->
                            <div class="bg-blue-50/50 rounded-xl border border-blue-200 shadow-sm p-4">
                                <input type="text" id="edit-title-${entry.id}" class="w-full font-bold text-slate-800 text-base bg-white border border-slate-200 rounded-lg px-3 py-2 mb-3 focus:ring-2 focus:ring-blue-500 outline-none" value="${entry.title || ''}">
                                <textarea id="edit-content-${entry.id}" class="w-full min-h-[160px] bg-white border border-slate-200 rounded-lg p-3 text-sm text-slate-700 leading-relaxed mb-3 focus:ring-2 focus:ring-blue-500 outline-none resize-y placeholder-slate-400" placeholder="내용을 입력하세요...">${entry.content || ''}</textarea>
                                ${attachmentsHtmlEdit}
                                <div class="flex items-center justify-between mt-3">
                                    <div class="flex gap-2">
                                        <button type="button" onclick="addTimelineLink('${task.id}', '${entry.id}')" class="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs text-slate-600 font-medium transition-colors flex items-center gap-1.5">
                                            <i class="fa-solid fa-link"></i> 링크 추가
                                        </button>
                                        <button type="button" onclick="addTimelineImage('${task.id}', '${entry.id}')" class="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs text-slate-600 font-medium transition-colors flex items-center gap-1.5">
                                            <i class="fa-regular fa-image"></i> 이미지 첨부
                                        </button>
                                    </div>
                                    <div class="flex gap-2">
                                        <button onclick="cancelEditTimelineEntry('${task.id}', '${entry.id}')" class="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-bold transition-colors">취소</button>
                                        <button onclick="saveEditTimelineEntry('${task.id}', '${entry.id}')" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors shadow-sm">저장</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    // Normal Mode
                    let retroHtml = "";
                    if (window.activeRetroEditId === entry.id) {
                        retroHtml = `
                            <div class="mt-4 pt-4 border-t border-slate-100">
                                <div class="bg-emerald-50/50 rounded-lg border border-emerald-100 p-4">
                                    <h5 class="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2"><i class="fa-solid fa-book-open"></i> 회고 작성</h5>
                                    
                                    <div class="mb-3">
                                        <label class="block text-xs font-bold text-emerald-700 mb-1">💡 해결 과정</label>
                                        <textarea id="retro-solution-${entry.id}" class="w-full bg-white border border-emerald-200 rounded-md p-2 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none resize-y min-h-[60px]" placeholder="문제를 어떻게 해결했나요?">${entry.retrospective?.solution || ''}</textarea>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="block text-xs font-bold text-emerald-700 mb-1">🚧 어려웠던 점</label>
                                        <textarea id="retro-difficulty-${entry.id}" class="w-full bg-white border border-emerald-200 rounded-md p-2 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none resize-y min-h-[60px]" placeholder="진행 과정에서 마주친 장애물이나 아쉬운 점은 무엇인가요?">${entry.retrospective?.difficulty || ''}</textarea>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="block text-xs font-bold text-emerald-700 mb-1">🚀 개선 방안</label>
                                        <textarea id="retro-improvement-${entry.id}" class="w-full bg-white border border-emerald-200 rounded-md p-2 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none resize-y min-h-[60px]" placeholder="다음번 유사한 업무 시 어떻게 다르게 접근할 것인가요?">${entry.retrospective?.improvement || ''}</textarea>
                                    </div>
                                    
                                    <div class="flex justify-end gap-2 mt-4">
                                        <button onclick="cancelRetroEdit('${task.id}', '${entry.id}')" class="px-3 py-1.5 bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-700 rounded-md text-xs font-bold transition-colors">취소</button>
                                        <button onclick="saveRetroEdit('${task.id}', '${entry.id}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold transition-colors shadow-sm">저장</button>
                                    </div>
                                </div>
                            </div>
                        `;
                    } else if (entry.retrospective && (entry.retrospective.solution || entry.retrospective.difficulty || entry.retrospective.improvement)) {
                        let sectionsHtml = "";
                        if (entry.retrospective.solution && entry.retrospective.solution.trim() !== '') {
                            sectionsHtml += `
                                    <div class="mb-2 last:mb-0">
                                        <div class="text-xs font-bold text-emerald-700 mb-1"><i class="fa-solid fa-lightbulb"></i> 해결 과정</div>
                                        <div class="text-slate-700 whitespace-pre-wrap pl-1">${entry.retrospective.solution}</div>
                                    </div>`;
                        }
                        if (entry.retrospective.difficulty && entry.retrospective.difficulty.trim() !== '') {
                            sectionsHtml += `
                                    <div class="mb-2 last:mb-0">
                                        <div class="text-xs font-bold text-emerald-700 mb-1"><i class="fa-solid fa-triangle-exclamation"></i> 어려웠던 점</div>
                                        <div class="text-slate-700 whitespace-pre-wrap pl-1">${entry.retrospective.difficulty}</div>
                                    </div>`;
                        }
                        if (entry.retrospective.improvement && entry.retrospective.improvement.trim() !== '') {
                            sectionsHtml += `
                                    <div class="mb-2 last:mb-0">
                                        <div class="text-xs font-bold text-emerald-700 mb-1"><i class="fa-solid fa-rocket"></i> 개선 방안</div>
                                        <div class="text-slate-700 whitespace-pre-wrap pl-1">${entry.retrospective.improvement}</div>
                                    </div>`;
                        }
                        if (sectionsHtml) {
                            retroHtml = `
                                <div class="mt-3 pt-3 border-t border-slate-100">
                                    <div class="bg-slate-50 border-l-4 border-emerald-400 rounded-r-lg p-3 text-sm">
                                        ${sectionsHtml}
                                    </div>
                                </div>
                            `;
                        }
                    }

                    html += `
                        <div class="relative pl-8 mb-4">
                            <!-- Node -->
                            <div class="absolute left-[3px] top-4 w-4 h-4 rounded-full border-2 border-blue-500 bg-white shadow flex items-center justify-center transform -translate-x-1/2">
                                <div class="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                            </div>
                            
                            <!-- Card -->
                            <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-shadow group relative">
                                <div class="flex justify-between items-start gap-4">
                                    <!-- Left Content -->
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center justify-between mb-2 pr-4">
                                            <h4 class="font-bold text-slate-800 text-base truncate" title="${entry.title || '업무 기록'}">${entry.title || "업무 기록"}</h4>
                                        </div>
                                        <div class="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-1.5">
                                            <i class="fa-regular fa-calendar-days"></i> ${dateStr} · ${timeStr}
                                        </div>
                                        ${entry.content ? `<div class="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 leading-relaxed border border-slate-100 whitespace-pre-wrap mb-3">${entry.content}</div>` : ''}
                                        ${linksHtmlNormal}
                                    </div>
                                    
                                    <!-- Right Area (Images & Actions) -->
                                    <div class="flex items-center gap-3 flex-shrink-0 ml-4">
                                        ${imagesHtmlNormal ? `<div class="flex-shrink-0">${imagesHtmlNormal}</div>` : ''}
                                        <div class="h-7 flex items-center">
                                            <div class="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                                <button onclick="openRetroEdit('${task.id}', '${entry.id}')" class="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="${entry.retrospective ? '회고 수정' : '회고 작성'}">
                                                    <i class="fa-solid fa-book-open text-xs"></i>
                                                </button>
                                                <button onclick="editTimelineEntry('${task.id}', '${entry.id}')" class="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="수정">
                                                    <i class="fa-solid fa-pen text-xs"></i>
                                                </button>
                                                <button onclick="deleteTimelineEntry('${task.id}', '${entry.id}')" class="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:border-red-500 hover:text-red-600 hover:bg-red-50 transition-colors" title="삭제">
                                                    <i class="fa-solid fa-trash-can text-xs"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                ${retroHtml}
                            </div>
                        </div>
                    `;
                }
            });
        }
        
        listEl.innerHTML = html;

        // Bind Save event for active session
        const btnSave = document.getElementById("btn-save-active-session");
        if (btnSave) {
            btnSave.onclick = async () => {
                const contentVal = document.getElementById("active-session-content").value;
                if (!currentSelectedTask.timeline) {
                    currentSelectedTask.timeline = [];
                }
                currentSelectedTask.timeline.push({
                    id: 'tl-' + Date.now(),
                    title: currentSelectedTask.activeSession.title,
                    content: contentVal,
                    timestamp: Date.now(),
                    startTime: currentSelectedTask.activeSession.startTime,
                    links: currentSelectedTask.activeSession.links || [],
                    images: currentSelectedTask.activeSession.images || []
                });
                delete currentSelectedTask.activeSession;
                await syncData("orders", state.orders);
                renderTimeline(currentSelectedTask);
                renderTimelineResources(currentSelectedTask);
                renderKanbanBoard();
            };
        }

        // Handle Paste and Input in active session content
        const txtArea = document.getElementById("active-session-content");
        if (txtArea) {
            txtArea.addEventListener("input", (e) => {
                if (task.activeSession) {
                    task.activeSession.content = e.target.value;
                }
            });
            txtArea.addEventListener("paste", async (e) => {
                const items = (e.clipboardData || e.originalEvent.clipboardData).items;
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (item.kind === 'file' && item.type.startsWith('image/')) {
                        const blob = item.getAsFile();
                        const fileExt = item.type.split('/')[1] || 'png';
                        const fileName = `screenshot_${Date.now()}.${fileExt}`;
                        const file = new File([blob], fileName, { type: item.type });
                        
                        await uploadTimelineImage(currentSelectedTask.id, file);
                    }
                }
            });
            // Auto focus if it's new
            if (task.activeSession && !task.activeSession.content) {
                txtArea.focus();
            }
        }

        // Bind input sync and paste event listener for edit fields in past entries
        if (task.timeline) {
            task.timeline.forEach(entry => {
                const editArea = document.getElementById(`edit-content-${entry.id}`);
                if (editArea) {
                    editArea.addEventListener("input", (e) => {
                        entry.content = e.target.value;
                    });
                    editArea.addEventListener("paste", async (e) => {
                        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
                        for (let i = 0; i < items.length; i++) {
                            const item = items[i];
                            if (item.kind === 'file' && item.type.startsWith('image/')) {
                                const blob = item.getAsFile();
                                const fileExt = item.type.split('/')[1] || 'png';
                                const fileName = `screenshot_${Date.now()}.${fileExt}`;
                                const file = new File([blob], fileName, { type: item.type });
                                
                                await uploadTimelineImage(currentSelectedTask.id, file, entry.id);
                            }
                        }
                    });
                }
                const editTitle = document.getElementById(`edit-title-${entry.id}`);
                if (editTitle) {
                    editTitle.addEventListener("input", (e) => {
                        entry.title = e.target.value;
                    });
                }
            });
        }
    }

    async function uploadTimelineImage(taskId, file, entryId = null) {
        const task = state.orders.find(t => t.id === taskId);
        if (!task) return;
        
        let targetSession = null;
        if (entryId && entryId !== "null" && entryId !== "undefined") {
            targetSession = task.timeline && task.timeline.find(e => e.id === entryId);
        } else {
            targetSession = task.activeSession;
        }
        if (!targetSession) return;
        
        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });
            
            const res = await fetch(`${API_BASE}/files/uploadImage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    taskId: taskId,
                    filename: file.name || "image.png",
                    base64: base64
                })
            });
            if (!res.ok) throw new Error("Upload failed");
            const result = await res.json();
            
            if (!targetSession.images) {
                targetSession.images = [];
            }
            targetSession.images.push({
                url: result.url,
                name: file.name
            });
            
            await syncData("orders", state.orders);
            if (currentSelectedTask && currentSelectedTask.id === taskId) {
                renderTimeline(currentSelectedTask);
                renderTimelineResources(currentSelectedTask);
            }
        } catch (err) {
            console.error("Failed to upload image:", err);
            alert("이미지 업로드에 실패했습니다. (백엔드 서버 확인 필요)");
        }
    }

    // Attach timeline image via hidden input
    window.addTimelineImage = (taskId, entryId = null) => {
        const uploader = document.getElementById("timeline-image-uploader");
        if (uploader) {
            // Remove previous listeners
            const newUploader = uploader.cloneNode(true);
            uploader.parentNode.replaceChild(newUploader, uploader);
            
            newUploader.addEventListener("change", async (e) => {
                const file = e.target.files[0];
                if (file) {
                    await uploadTimelineImage(taskId, file, entryId);
                }
                newUploader.value = ""; // reset
            });
            newUploader.click();
        }
    };

    window.addTimelineLink = async (taskId, entryId = null) => {
        const task = state.orders.find(t => t.id === taskId);
        if (!task) return;
        
        let targetSession = null;
        if (entryId) {
            targetSession = task.timeline && task.timeline.find(e => e.id === entryId);
        } else {
            targetSession = task.activeSession;
        }
        if (!targetSession) return;

        // Remove existing modal if any
        document.getElementById('tl-link-modal')?.remove();

        const modalEl = document.createElement('div');
        modalEl.id = 'tl-link-modal';
        modalEl.className = 'fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm';
        modalEl.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
                <div class="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
                    <h3 class="font-bold text-slate-800 flex items-center gap-2">
                        <i class="fa-solid fa-link text-blue-500"></i> 링크 추가
                    </h3>
                    <button onclick="document.getElementById('tl-link-modal').remove()" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <!-- Tab Bar -->
                <div class="flex border-b border-slate-200 bg-white flex-shrink-0">
                    <button id="tl-tab-browse" onclick="tlSwitchTab('browse')" class="px-5 py-3 text-sm font-semibold border-b-2 border-blue-500 text-blue-600">
                        <i class="fa-solid fa-folder-open mr-1.5"></i>폴더 탐색
                    </button>
                    <button id="tl-tab-url" onclick="tlSwitchTab('url')" class="px-5 py-3 text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-700">
                        <i class="fa-solid fa-globe mr-1.5"></i>URL 직접 입력
                    </button>
                </div>

                <!-- Browse Tab -->
                <div id="tl-pane-browse" class="flex flex-col flex-1 overflow-hidden">
                    <!-- Search + Path Bar -->
                    <div class="p-3 border-b border-slate-100 bg-slate-50 flex-shrink-0">
                        <div class="flex gap-2 mb-2">
                            <div class="relative flex-1">
                                <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                <input type="text" id="tl-link-search" placeholder="파일/폴더 검색..." 
                                    class="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400"
                                    oninput="tlFilterItems(this.value)">
                            </div>
                            <button onclick="tlNavigate(null)" class="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50" title="최상위 폴더로">
                                <i class="fa-solid fa-house"></i>
                            </button>
                        </div>
                        <div id="tl-current-path" class="text-xs text-slate-500 truncate font-mono bg-white border border-slate-100 rounded px-2 py-1"></div>
                    </div>
                    <!-- File List -->
                    <div id="tl-file-list" class="flex-1 overflow-y-auto p-2 min-h-0">
                        <div class="text-center text-slate-400 py-8 text-sm">폴더를 불러오는 중...</div>
                    </div>
                </div>

                <!-- URL Tab -->
                <div id="tl-pane-url" class="hidden p-6 space-y-4 flex-1">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1.5">링크 주소 (URL) *</label>
                        <input type="text" id="tl-url-input" class="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="https://... 또는 로컬 경로 C:\\...">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1.5">링크 제목 (선택)</label>
                        <input type="text" id="tl-url-title" class="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="표시될 이름을 입력하세요">
                    </div>
                    <button id="btn-tl-url-save" class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm">
                        링크 추가하기
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);

        // Tab switch
        window.tlSwitchTab = (tab) => {
            document.getElementById('tl-pane-browse').classList.toggle('hidden', tab !== 'browse');
            document.getElementById('tl-pane-url').classList.toggle('hidden', tab !== 'url');
            document.getElementById('tl-tab-browse').className = `px-5 py-3 text-sm font-semibold border-b-2 ${tab === 'browse' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`;
            document.getElementById('tl-tab-url').className = `px-5 py-3 text-sm font-semibold border-b-2 ${tab === 'url' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`;
        };

        // State for file browser
        let tlDirData = { currentPath: '', parent: null, folders: [], files: [] };
        let tlSelectedPath = null;

        const renderFileList = (data, filterText = '') => {
            tlDirData = data;
            const listEl = document.getElementById('tl-file-list');
            const pathEl = document.getElementById('tl-current-path');
            if (!listEl) return;
            pathEl.textContent = data.currentPath || '(최상위)';

            let html = '';
            const filter = filterText.trim().toLowerCase();
            const isSearch = !!filter;

            // Back / Parent button (only show when not searching)
            if (!isSearch && data.parent) {
                html += `<div class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 cursor-pointer text-slate-600 transition-colors" onclick="tlNavigate('${data.parent.replace(/\\/g, '\\\\')}')">
                    <i class="fa-solid fa-arrow-left text-slate-400 w-4"></i>
                    <span class="text-sm font-medium">← 상위 폴더</span>
                </div>`;
            }

            let filteredFolders = [];
            let filteredFiles = [];

            if (isSearch) {
                // Global search from state.folders and state.files
                const matchedFolders = (state.folders || []).filter(f => f.name.toLowerCase().includes(filter) || f.relativePath.toLowerCase().includes(filter));
                const matchedFiles = (state.files || []).filter(f => f.name.toLowerCase().includes(filter) || f.relativePath.toLowerCase().includes(filter));

                filteredFolders = matchedFolders.map(f => {
                    const fullPath = state.syncPath ? (state.syncPath + '/' + f.relativePath).replace(/\//g, '\\') : f.relativePath;
                    return { name: f.name, path: fullPath, relativePath: f.relativePath };
                });

                filteredFiles = matchedFiles.map(f => {
                    const fullPath = state.syncPath ? (state.syncPath + '/' + f.relativePath).replace(/\//g, '\\') : f.relativePath;
                    return { name: f.name, path: fullPath, relativePath: f.relativePath };
                });
            } else {
                // Local directory listing
                filteredFolders = data.folders || [];
                filteredFiles = data.files || [];
            }

            if (filteredFolders.length === 0 && filteredFiles.length === 0) {
                if (isSearch) {
                    html += '<div class="text-center text-slate-400 py-10 text-sm">검색 결과가 없습니다.</div>';
                } else {
                    html += '<div class="text-center text-slate-400 py-10 text-sm">이 폴더에 항목이 없습니다.</div>';
                }
            }

            filteredFolders.forEach(folder => {
                const p = folder.path.replace(/\\/g, '\\\\');
                html += `
                    <div class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 cursor-pointer group transition-colors" ondblclick="tlNavigate('${p}')" onclick="tlSelect('${p}', '${folder.name.replace(/'/g, "\\'")}', true)">
                        <i class="fa-solid fa-folder text-amber-400 w-4 text-center flex-shrink-0"></i>
                        <div class="flex-1 min-w-0 flex flex-col">
                            <span class="text-sm text-slate-700 font-medium truncate">${folder.name}</span>
                            ${isSearch ? `<span class="text-[10px] text-slate-400 truncate">${folder.relativePath || ''}</span>` : ''}
                        </div>
                        <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button class="px-2 py-0.5 bg-blue-600 text-white text-xs rounded font-semibold" onclick="event.stopPropagation(); tlAddLink('${p}', '${folder.name.replace(/'/g, "\\'")}')">추가</button>
                            <button class="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 text-xs rounded font-semibold" onclick="event.stopPropagation(); tlNavigate('${p}')">열기</button>
                        </div>
                    </div>`;
            });

            filteredFiles.forEach(file => {
                const p = file.path.replace(/\\/g, '\\\\');
                const ext = file.name.split('.').pop().toLowerCase();
                const icon = ['pdf'].includes(ext) ? 'fa-file-pdf text-red-500' :
                    ['xlsx','xls'].includes(ext) ? 'fa-file-excel text-green-600' :
                    ['docx','doc','hwp'].includes(ext) ? 'fa-file-word text-blue-600' :
                    ['png','jpg','jpeg','gif','webp'].includes(ext) ? 'fa-file-image text-purple-500' :
                    'fa-file text-slate-400';
                html += `
                    <div class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 cursor-pointer group transition-colors" onclick="tlSelect('${p}', '${file.name.replace(/'/g, "\\'")}', false)">
                        <i class="fa-solid ${icon} w-4 text-center text-sm flex-shrink-0"></i>
                        <div class="flex-1 min-w-0 flex flex-col">
                            <span class="text-sm text-slate-700 truncate">${file.name}</span>
                            ${isSearch ? `<span class="text-[10px] text-slate-400 truncate">${file.relativePath || ''}</span>` : ''}
                        </div>
                        <button class="px-2 py-0.5 bg-blue-600 text-white text-xs rounded font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onclick="event.stopPropagation(); tlAddLink('${p}', '${file.name.replace(/'/g, "\\'")}')">추가</button>
                    </div>`;
            });

            listEl.innerHTML = html;
        };

        window.tlNavigate = async (absPath) => {
            const listEl = document.getElementById('tl-file-list');
            if (listEl) listEl.innerHTML = '<div class="text-center text-slate-400 py-8"><i class="fa-solid fa-spinner fa-spin"></i> 로딩 중...</div>';
            try {
                const url = absPath ? `/api/dir-abs?path=${encodeURIComponent(absPath)}` : '/api/dir-abs';
                const res = await fetch(url);
                const data = await res.json();
                renderFileList(data, document.getElementById('tl-link-search')?.value || '');
            } catch(e) {
                if (listEl) listEl.innerHTML = '<div class="text-center text-red-400 py-8 text-sm">폴더를 불러올 수 없습니다.</div>';
            }
        };

        window.tlFilterItems = (val) => {
            renderFileList(tlDirData, val);
        };

        window.tlSelect = (path, name, isFolder) => {
            tlSelectedPath = path;
            document.querySelectorAll('#tl-file-list > div').forEach(el => el.classList.remove('ring-2', 'ring-blue-400', 'bg-blue-50'));
        };

        window.tlAddLink = async (absPath, name) => {
            if (!targetSession.links) targetSession.links = [];
            targetSession.links.push({ url: absPath, title: name, type: 'path' });
            document.getElementById('tl-link-modal')?.remove();
            await syncData("orders", state.orders);
            if (currentSelectedTask && currentSelectedTask.id === taskId) {
                renderTimeline(currentSelectedTask);
                renderTimelineResources(currentSelectedTask);
            }
        };

        // URL tab save button
        document.getElementById('btn-tl-url-save').onclick = async () => {
            let url = document.getElementById('tl-url-input').value.trim();
            const title = document.getElementById('tl-url-title').value.trim() || url;
            if (!url) { alert('링크 주소를 입력해주세요.'); return; }
            if (!/^https?:\/\//i.test(url) && !/^[A-Za-z]:\\/i.test(url)) {
                url = 'http://' + url;
            }
            if (!targetSession.links) targetSession.links = [];
            targetSession.links.push({ url, title, type: /^https?:\/\//i.test(url) ? 'web' : 'path' });
            document.getElementById('tl-link-modal')?.remove();
            await syncData("orders", state.orders);
            if (currentSelectedTask && currentSelectedTask.id === taskId) {
                renderTimeline(currentSelectedTask);
                renderTimelineResources(currentSelectedTask);
            }
        };

        // Load initial directory
        tlNavigate(null);
    };


    window.deleteTimelineResource = async (taskId, entryId, type, index) => {
        if (!confirm("해당 자료를 삭제하시겠습니까?")) return;
        const task = state.orders.find(t => t.id === taskId);
        if (!task) return;
        
        let targetSession = null;
        if (entryId && entryId !== "null" && entryId !== "undefined") {
            targetSession = task.timeline && task.timeline.find(e => e.id === entryId);
        } else {
            targetSession = task.activeSession;
        }
        if (!targetSession) return;
        
        if (type === 'link' && targetSession.links) {
            targetSession.links.splice(index, 1);
        } else if (type === 'image' && targetSession.images) {
            targetSession.images.splice(index, 1);
        }
        
        await syncData("orders", state.orders);
        if (currentSelectedTask && currentSelectedTask.id === taskId) {
            renderTimeline(currentSelectedTask);
            renderTimelineResources(currentSelectedTask);
        }
    };

    function renderTimelineResources(task) {
        const listEl = document.getElementById("fs-timeline-resources-list");
        if (!listEl) return;
        
        let allLinks = [];
        let allImages = [];
        
        // Collect from all past timeline entries
        if (task.timeline) {
            task.timeline.forEach(entry => {
                if (entry.links) allLinks.push(...entry.links);
                if (entry.images) allImages.push(...entry.images);
            });
        }
        // Collect from active session
        if (task.activeSession) {
            if (task.activeSession.links) allLinks.push(...task.activeSession.links);
            if (task.activeSession.images) allImages.push(...task.activeSession.images);
        }
        
        if (allLinks.length === 0 && allImages.length === 0) {
            listEl.innerHTML = '<div class="text-xs text-slate-400 text-center py-4">첨부된 자료가 없습니다.</div>';
            return;
        }
        
        let html = "";
        
        if (allLinks.length > 0) {
            html += `<h5 class="text-xs font-bold text-slate-500 uppercase mb-2"><i class="fa-solid fa-link"></i> 링크 (${allLinks.length})</h5>`;
            html += `<div class="space-y-2 mb-4">`;
            allLinks.forEach(lk => {
                const isPath = lk.type === 'path' || /^[A-Za-z]:\\/i.test(lk.url || '');
                const linkIcon = isPath ? 'fa-folder-open' : 'fa-arrow-up-right-from-square';
                const linkAttr = isPath
                    ? `href="#" class="path-link" data-path="${(lk.url || '').replace(/"/g, '&quot;')}"`
                    : `href="${lk.url || '#'}" target="_blank"`;
                html += `
                    <a ${linkAttr} class="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-2 hover:bg-slate-50 transition-colors group cursor-pointer">
                        <div class="truncate text-sm text-blue-600 font-semibold group-hover:underline w-full"><i class="fa-solid ${linkIcon} text-[10px] mr-1 text-slate-400"></i> ${lk.title || lk.url}</div>
                    </a>
                `;
            });
            html += `</div>`;
        }
        
        if (allImages.length > 0) {
            html += `<h5 class="text-xs font-bold text-slate-500 uppercase mb-2"><i class="fa-regular fa-image"></i> 이미지 (${allImages.length})</h5>`;
            html += `<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">`;
            allImages.forEach(img => {
                html += `
                    <a href="${img.url}" target="_blank" class="block aspect-square rounded-lg overflow-hidden border border-slate-200 hover:border-blue-500 transition-colors shadow-sm relative group">
                        <img src="${img.url}" class="w-full h-full object-cover" alt="첨부 이미지">
                        <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">크게 보기</div>
                    </a>
                `;
            });
            html += `</div>`;
        }
        
        listEl.innerHTML = html;
    }

    // Global Handlers for Edit/Delete
    window.deleteTimelineEntry = async (taskId, entryId) => {
        if (!confirm("이 기록을 삭제하시겠습니까?")) return;
        const task = state.orders.find(t => t.id === taskId);
        if (task && task.timeline) {
            task.timeline = task.timeline.filter(e => e.id !== entryId);
            await syncData("orders", state.orders);
            if (currentSelectedTask && currentSelectedTask.id === taskId) {
                renderTimeline(currentSelectedTask);
            }
        }
    };

    window.activeTimelineEditId = null;
    window.activeRetroEditId = null;

    window.openRetroEdit = (taskId, entryId) => {
        window.activeRetroEditId = entryId;
        if (currentSelectedTask && currentSelectedTask.id === taskId) {
            renderTimeline(currentSelectedTask);
        }
    };

    window.cancelRetroEdit = (taskId, entryId) => {
        window.activeRetroEditId = null;
        if (currentSelectedTask && currentSelectedTask.id === taskId) {
            renderTimeline(currentSelectedTask);
        }
    };

    window.saveRetroEdit = async (taskId, entryId) => {
        const task = state.orders.find(t => t.id === taskId);
        if (task && task.timeline) {
            const entry = task.timeline.find(e => e.id === entryId);
            if (entry) {
                const solutionInput = document.getElementById(`retro-solution-${entryId}`);
                const difficultyInput = document.getElementById(`retro-difficulty-${entryId}`);
                const improvementInput = document.getElementById(`retro-improvement-${entryId}`);
                
                if (!entry.retrospective) {
                    entry.retrospective = {};
                }
                
                if (solutionInput) entry.retrospective.solution = solutionInput.value;
                if (difficultyInput) entry.retrospective.difficulty = difficultyInput.value;
                if (improvementInput) entry.retrospective.improvement = improvementInput.value;
                
                await syncData("orders", state.orders);
            }
        }
        window.activeRetroEditId = null;
        if (currentSelectedTask && currentSelectedTask.id === taskId) {
            renderTimeline(currentSelectedTask);
        }
    };

    window.editTimelineEntry = (taskId, entryId) => {
        window.activeTimelineEditId = entryId;
        const task = state.orders.find(t => t.id === taskId);
        if (task && currentSelectedTask && currentSelectedTask.id === taskId) {
            renderTimeline(currentSelectedTask);
        }
    };

    window.cancelEditTimelineEntry = (taskId, entryId) => {
        window.activeTimelineEditId = null;
        if (currentSelectedTask && currentSelectedTask.id === taskId) {
            renderTimeline(currentSelectedTask);
        }
    };

    window.saveEditTimelineEntry = async (taskId, entryId) => {
        const task = state.orders.find(t => t.id === taskId);
        if (task && task.timeline) {
            const entry = task.timeline.find(e => e.id === entryId);
            if (entry) {
                const titleInput = document.getElementById(`edit-title-${entryId}`);
                const contentInput = document.getElementById(`edit-content-${entryId}`);
                if (titleInput && contentInput) {
                    entry.title = titleInput.value.trim() || "업무 기록";
                    entry.content = contentInput.value;
                    await syncData("orders", state.orders);
                }
            }
        }
        window.activeTimelineEditId = null;
        if (currentSelectedTask && currentSelectedTask.id === taskId) {
            renderTimeline(currentSelectedTask);
        }
    };

    function openTaskDetail(task) {
        lastTaskOpenTime = Date.now();
        try {
            const modal = document.getElementById("task-fullscreen-modal");
            const content = document.getElementById("task-fullscreen-content");
            if (currentSelectedTask && currentSelectedTask.id === task.id && !modal.classList.contains("hidden")) {
                return;
            }
            currentSelectedTask = task;
            
            if (!currentSelectedTask.timeline) {
                currentSelectedTask.timeline = [];
            }
            
            document.getElementById("task-detail-id").value = task.id;
            document.getElementById("task-detail-title").value = task.title || "";
            document.getElementById("task-detail-status").value = task.status || "inbox";
            const tf = document.getElementById("task-detail-folder");
            tf.value = task.folder || "not_urgent_not_important";
            const urgInfo = URGENCY_MAP[tf.value] || URGENCY_MAP['not_urgent_not_important'];
            const preview = document.getElementById("urgency-preview");
            if (preview) preview.style.backgroundColor = urgInfo.bg;
            document.getElementById("task-detail-assignee").value = task.assignee || "";
            document.getElementById("task-detail-delivery").value = task.deliveryDate || "";
            
            document.getElementById("fs-timeline-input").value = "";
            
            renderTimeline(currentSelectedTask);
            renderTimelineResources(currentSelectedTask);

            // --- Added for File Attachment UI ---
            state.activeTaskIdForFiles = task.id;
            if (!state.isNetworkView) renderTaskFilesList(task.id);
            else {
                document.getElementById("task-files-list").innerHTML = "<li class='text-xs text-slate-400'>네트워크 업무에서는 파일 조회가 비활성화됩니다.</li>";
            }
            // --- Update Recurring Task Button ---
            const btnMakeRecurring = document.getElementById("btn-fs-task-make-recurring");
            if (btnMakeRecurring) {
                const existingRt = (state.recurringTasks || []).find(rt => rt.title === task.title);
                if (existingRt) {
                    btnMakeRecurring.innerHTML = '<i class="fa-solid fa-check mr-1"></i>반복 업무 설정됨';
                    btnMakeRecurring.className = 'px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-bold border border-green-200 shadow-sm transition-colors';
                } else {
                    btnMakeRecurring.innerHTML = '<i class="fa-solid fa-rotate mr-1"></i>반복 업무로 등록';
                    btnMakeRecurring.className = 'px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-sm font-bold border border-indigo-200 shadow-sm transition-colors';
                }
            }
            // ------------------------------------

            // ------------------------------------
            
            // Disable Inputs if Network View
            const inputsToDisable = [
                "task-detail-title", "task-detail-status", "task-detail-folder", 
                "task-detail-assignee", "task-detail-delivery", "fs-timeline-input",
                "btn-fs-task-save", "btn-fs-add-timeline"
            ];
            inputsToDisable.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.disabled = state.isNetworkView;
                    if (state.isNetworkView) el.classList.add("opacity-60", "cursor-not-allowed");
                    else el.classList.remove("opacity-60", "cursor-not-allowed");
                }
            });
            
            // Folder Button Logic
            if (!state.isNetworkView) checkAndUpdateFolderButton(task.id);
            else {
                const btn = document.getElementById("btn-fs-task-folder-create");
                if (btn) btn.classList.add("hidden");
            }

            modal.classList.remove("hidden");
            // small delay for transition
            setTimeout(() => {
                modal.classList.remove("opacity-0");
                content.classList.remove("scale-95");
                content.classList.add("scale-100");
            }, 10);
        } catch(e) {
            console.error("openTaskDetail Error:", e);
            alert("카드 열기 오류: " + e.message);
        }
    }
    window.openTaskDetail = openTaskDetail; // EXPOSE TO WINDOW FOR PLUGINS

    async function checkAndUpdateFolderButton(taskId) {
        const btn = document.getElementById("btn-fs-task-folder-create");
        if (!btn) return;
        btn.classList.add("hidden");
        try {
            const res = await fetch(`${API_BASE}/tasks/${taskId}/folder`);
            const info = await res.json();
            btn.classList.remove("hidden");
            if (info.exists) {
                btn.innerHTML = `<i class="fa-solid fa-folder-open mr-1"></i>폴더 열기`;
                btn.className = "px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-bold shadow hover:bg-slate-300 transition-colors";
                btn.onclick = async () => {
                    await fetch(`${API_BASE}/files/open-path`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ absolutePath: info.path })
                    });
                };
            } else {
                btn.innerHTML = `<i class="fa-solid fa-folder-plus mr-1"></i>폴더 생성`;
                btn.className = "px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-bold shadow hover:bg-teal-600 transition-colors";
                btn.onclick = async () => {
                    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i>생성 중...`;
                    await fetch(`${API_BASE}/tasks/${taskId}/folder?create=true`);
                    checkAndUpdateFolderButton(taskId);
                };
            }
        } catch(e) {
            console.error("Folder check error:", e);
        }
    }

    // Timeline Add button logic
    document.getElementById("btn-fs-add-timeline").addEventListener("click", async () => {
        if (!currentSelectedTask) return;
        const inputEl = document.getElementById("fs-timeline-input");
        const val = inputEl.value.trim();
        if (!val) {
            alert("기록할 업무명을 입력해주세요.");
            return;
        }

        // Create active session instead of pushing directly
        currentSelectedTask.activeSession = {
            title: val,
            content: "",
            startTime: Date.now()
        };

        // clear input
        inputEl.value = "";
        
        await syncData("orders", state.orders);
        renderTimeline(currentSelectedTask);
        renderKanbanBoard();
    });

    // Handle enter key in timeline input
    document.getElementById("fs-timeline-input").addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            document.getElementById("btn-fs-add-timeline").click();
        }
    });
    window.openTaskDetail = openTaskDetail; // EXPOSE TO WINDOW FOR PLUGINS

    function closeTaskDetail() {
        if (currentSelectedTask) {
            // Save title and metadata on close
            currentSelectedTask.title = document.getElementById("task-detail-title").value;
            currentSelectedTask.status = document.getElementById("task-detail-status").value;
            currentSelectedTask.folder = document.getElementById("task-detail-folder").value;
            currentSelectedTask.assignee = document.getElementById("task-detail-assignee").value;
            currentSelectedTask.deliveryDate = document.getElementById("task-detail-delivery").value;
            
            syncData("orders", state.orders);
            renderKanbanBoard();
        }

        currentSelectedTask = null;

        const modal = document.getElementById("task-fullscreen-modal");
        const content = document.getElementById("task-fullscreen-content");
        modal.classList.add("opacity-0");
        content.classList.remove("scale-100");
        content.classList.add("scale-95");
        
        setTimeout(() => {
            modal.classList.add("hidden");
        }, 300);
    }

    // Close handlers for the new UI
    document.getElementById("btn-close-fs-task").addEventListener("click", closeTaskDetail);
    document.getElementById("btn-fs-task-save").addEventListener("click", closeTaskDetail);
    document.getElementById("btn-task-delete").addEventListener("click", async () => {
        if (!currentSelectedTask) return;
        if (confirm("이 작업을 삭제하시겠습니까?")) {
            const taskId = currentSelectedTask.id;
            try {
                const res = await fetch(`${API_BASE}/tasks/${taskId}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) {
                    state.orders = state.orders.filter(o => o.id !== taskId);
                    renderKanbanBoard();
                    closeTaskDetail();
                } else {
                    alert("삭제에 실패했습니다: " + (data.error || "서버 오류"));
                }
            } catch (err) {
                console.error("Failed to delete task:", err);
                // Fallback: remove from local state only
                state.orders = state.orders.filter(o => o.id !== taskId);
                renderKanbanBoard();
                closeTaskDetail();
            }
        }
    });

    // Close panel when clicking outside
    document.getElementById("task-fullscreen-modal").addEventListener("mousedown", (e) => {
        const content = document.getElementById("task-fullscreen-content");
        if (!content.contains(e.target)) {
            closeTaskDetail();
        }
    });


    const btnNotifications = document.getElementById("btn-notifications");
    const notifDropdown = document.getElementById("notification-dropdown");
    if (btnNotifications && notifDropdown) {
        btnNotifications.addEventListener("click", (e) => {
            e.stopPropagation();
            notifDropdown.classList.toggle("hidden");
        });
        document.addEventListener("click", (e) => {
            if (!notifDropdown.contains(e.target) && !btnNotifications.contains(e.target)) {
                notifDropdown.classList.add("hidden");
            }
        });
    }

    const btnAddOrder = document.getElementById("btn-add-order");
    if (btnAddOrder) {
        btnAddOrder.addEventListener("click", () => {

        document.getElementById("order-form").reset();
        document.getElementById("order-id-field").value = "";
        document.getElementById("order-modal-title").innerText = "신규 업무 카드 생성";
        
        // Reset AI input
        const aiInput = document.getElementById("ai-task-input");
        if (aiInput) aiInput.value = "";

        state.activeTaskIdForFiles = null;
        document.getElementById("task-files-container").classList.add("hidden");

        if (state.activeDept && state.activeDept !== "all") {
            const deptSelect = document.getElementById("o-department");
            const options = Array.from(deptSelect.options).map(o => o.value);
            if (options.includes(state.activeDept)) {
                deptSelect.value = state.activeDept;
            }
        } else {
            document.getElementById("o-department").value = "공통";
        }

        openModal("modal-order-form");
        });
    }

    // AI 스마트 업무 등록 로직
    document.getElementById("btn-ai-summarize")?.addEventListener("click", async () => {
        const aiInput = document.getElementById("ai-task-input");
        const text = aiInput.value.trim();
        if (!text) {
            showToast("AI에 전달할 업무 내용을 입력해주세요.", "warning");
            return;
        }

        const btn = document.getElementById("btn-ai-summarize");
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> 분석 중...`;
        btn.disabled = true;

        try {
            const res = await fetch(`${API_BASE}/ai/summarize-task`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            if (!res.ok) throw new Error("API 요청 실패");

            const { data } = await res.json();
            
            if (data.title) document.getElementById("o-title").value = data.title;
            if (data.department) {
                const deptSelect = document.getElementById("o-department");
                const options = Array.from(deptSelect.options).map(o => o.value);
                if (options.includes(data.department)) {
                    deptSelect.value = data.department;
                }
            }
            if (data.assignee) document.getElementById("o-assignee").value = data.assignee;
            if (data.deliveryDate) document.getElementById("o-delivery").value = data.deliveryDate;
            if (data.priority) {
                const priSelect = document.getElementById("o-priority");
                const options = Array.from(priSelect.options).map(o => o.value);
                const match = options.find(o => o.includes(data.priority));
                if (match) priSelect.value = match;
            }
            if (data.description) document.getElementById("o-desc").value = data.description;
            
            // Generate a temporary ID so files can be attached immediately
            if (!document.getElementById("order-id-field").value) {
                const newId = "task_" + Date.now();
                document.getElementById("order-id-field").value = newId;
                state.activeTaskIdForFiles = newId;
            }

            showToast("AI가 내용을 성공적으로 분석하여 채웠습니다.", "success");
            
            document.getElementById("task-files-container").classList.remove("hidden");

        } catch (err) {
            console.error("AI Error:", err);
            showToast("AI 분석 중 오류가 발생했습니다.", "error");
        } finally {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    });

    // 기존 자료 연동 (파일 픽커)
    document.getElementById("btn-task-link-existing")?.addEventListener("click", () => {
        openModal("modal-file-picker");
        const searchInput = document.getElementById("picker-search-input");
        if (searchInput) searchInput.value = "";
        renderFilePickerTree();
    });

    document.getElementById("picker-search-input")?.addEventListener("input", (e) => {
        renderFilePickerTree(e.target.value);
    });

    function renderFilePickerTree(searchTerm = "") {
        const tree = document.getElementById("picker-tree");
        tree.innerHTML = "";
        
        const term = searchTerm.toLowerCase().trim();
        const filteredFolders = term ? state.folders.filter(f => f.relativePath.toLowerCase().includes(term)) : state.folders;
        const filteredFiles = term ? state.files.filter(f => f.name.toLowerCase().includes(term) || f.relativePath.toLowerCase().includes(term)) : state.files;
        
        filteredFolders.forEach(folder => {
            const li = document.createElement("li");
            li.className = "flex items-center p-2 hover:bg-blue-50 rounded cursor-pointer group";
            li.innerHTML = `
                <i class="fa-solid fa-folder text-blue-400 mr-2"></i>
                <span class="flex-1">${folder.relativePath}</span>
                <input type="radio" name="picker-item" value="folder|${folder.relativePath}" class="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer">
            `;
            li.addEventListener("click", (e) => {
                if(e.target.tagName !== "INPUT") {
                    li.querySelector("input").checked = true;
                }
            });
            tree.appendChild(li);
        });

        filteredFiles.forEach(file => {
            const li = document.createElement("li");
            li.className = "flex items-center p-2 hover:bg-blue-50 rounded cursor-pointer group ml-4 border-l-2 border-slate-200 pl-2";
            li.innerHTML = `
                ${getFileIcon(file.extension)}
                <span class="flex-1 ml-2 text-slate-600 truncate">${file.name}</span>
                <input type="radio" name="picker-item" value="file|${file.id}" class="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer">
            `;
            li.addEventListener("click", (e) => {
                if(e.target.tagName !== "INPUT") {
                    li.querySelector("input").checked = true;
                }
            });
            tree.appendChild(li);
        });
    }

    document.getElementById("btn-picker-confirm")?.addEventListener("click", async () => {
        const selected = document.querySelector('input[name="picker-item"]:checked');
        if (!selected) {
            showToast("연동할 폴더나 파일을 선택해주세요.", "warning");
            return;
        }
        
        const taskId = state.activeTaskIdForFiles;
        if (!taskId) {
            showToast("먼저 업무를 저장하거나 AI로 분석을 완료해주세요.", "warning");
            return;
        }

        const [type, val] = selected.value.split('|');
        let itemName = "";
        let iconHtml = "";

        if (type === "folder") {
            itemName = val.split('/').pop() || val;
            iconHtml = `<i class="fa-solid fa-folder text-blue-500 text-lg mr-3"></i>`;
        } else {
            const file = state.files.find(f => f.id === val);
            if (file) {
                itemName = file.name;
                iconHtml = getFileIcon(file.extension);
            }
        }

        // Persist link file via API
        const task = state.orders.find(o => o.id === taskId);
        const statusFolder = task ? getTaskStatusFolder(task.status) : "01_대기";
        const targetFolder = `TASK_FOLDER/${taskId}`;
        
        const payload = {
            name: `[연동]_${itemName}.txt`,
            folder: targetFolder,
            content: `[WorkHub 내부 연동 링크]\n유형: ${type}\n원본 경로: ${val}\n이 파일은 시스템 내 다른 위치의 폴더/파일로 연결되는 바로가기 역할을 합니다.`,
            tags: ["링크", "업무파일", taskId]
        };

        try {
            const res = await fetch(`${API_BASE}/files/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                showToast(`'${itemName}' 연동이 완료되었습니다.`, "success");
                renderTaskFilesList(taskId);
                loadStateFromServer();
            } else {
                showToast(data.error || "연동 처리에 실패했습니다.", "error");
            }
        } catch (err) {
            showToast("서버 통신 오류로 연동에 실패했습니다.", "error");
        }

        closeModal("modal-file-picker");
    });

    // -------------------------------------------------------------
    // 15. INTEGRATED EVERYTHING SEARCH SYSTEM
    // -------------------------------------------------------------
    const mainSearch = document.getElementById("searchInput");
    const innerSearch = document.getElementById("searchHubInput");
    const categorySelector = document.getElementById("search-filter-category");

    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "k") {
            e.preventDefault();
            mainSearch.focus();
        }
    });

    mainSearch.addEventListener("input", (e) => {
        const q = e.target.value;
        state.searchQuery = q;
        innerSearch.value = q;
        
        if (state.activeView !== "search") switchView("search");
        else renderSearchHub();
    });

    innerSearch.addEventListener("input", (e) => {
        state.searchQuery = e.target.value;
        mainSearch.value = e.target.value;
        renderSearchHub();
    });

    categorySelector.addEventListener("change", renderSearchHub);

    function renderSearchHub() {
        const q = state.searchQuery.trim().toLowerCase();
        const category = categorySelector.value;
        const root = document.getElementById("search-results-root");
        root.innerHTML = "";

        if (!q) {
            root.innerHTML = `
                <div class="text-center py-20 text-slate-400 bg-white border border-slate-200 rounded-xl shadow-sm select-none">
                    <i class="fa-solid fa-magnifying-glass text-5xl mb-4 text-slate-300"></i>
                    <h3 class="font-bold text-slate-700 mb-1">통합 업무 검색기</h3>
                    <p class="text-xs">바탕화면의 실시간 실제 파일과 사내 공유 자료, 연락처 등을 일괄 매칭합니다.</p>
                </div>
            `;
            return;
        }

        let matchedFiles = [];
        let matchedFolders = [];
        let matchedWorkcards = [];
        let matchedComponents = [];
        let matchedOrders = [];

        // Apply active department filter to search results as well!
        if (category === "all" || category === "files") {
            matchedFiles = state.files.filter(f => 
                isItemDeptRelevant(state.activeDept, f.folder) &&
                (f.name.toLowerCase().includes(q) || f.tags.some(tag => tag.toLowerCase().includes(q)))
            );
            matchedFolders = state.folders.filter(f => 
                isItemDeptRelevant(state.activeDept, f.relativePath.split('/')[0]) &&
                f.name.toLowerCase().includes(q)
            );
        }
        // 명함첩(WorkCard) 검색 - work_card_ledger 필드 기반
        if (category === "all" || category === "vendors") {
            matchedWorkcards = state.vendors.filter(v => {
                const name = (v.name || '').toLowerCase();
                const company = (v.company || '').toLowerCase();
                const position = (v.position || '').toLowerCase();
                const mobile = (v.mobile || '').toLowerCase();
                const phone = (v.phone || '').toLowerCase();
                const email = (v.email || '').toLowerCase();
                const memo = (v.memo || '').toLowerCase();
                const tags = (v.tags || '').toLowerCase();
                return name.includes(q) || company.includes(q) || position.includes(q)
                    || mobile.includes(q) || phone.includes(q) || email.includes(q)
                    || memo.includes(q) || tags.includes(q);
            });
        }
        if (category === "all" || category === "components") {
            matchedComponents = state.components.filter(c => {
                let assetDept = c.category === "개발/도면" ? "개발팀" : c.category === "영업/제안서" ? "영업팀" : c.category === "양식/템플릿" ? "인사총무팀" : "구매팀";
                return isItemDeptRelevant(assetDept) &&
                       ((c.name||'').toLowerCase().includes(q) || (c.assetNumber||'').toLowerCase().includes(q) || (c.description||'').toLowerCase().includes(q));
            });
        }
        // 업무관리 검색 - 부서 없는 업무도 포함
        if (category === "all" || category === "orders") {
            matchedOrders = state.orders.filter(o => {
                const title = (o.title || '').toLowerCase();
                const assignee = (o.assignee || '').toLowerCase();
                const description = (o.description || '').toLowerCase();
                const dept = (o.department || '').toLowerCase();
                return (title.includes(q) || assignee.includes(q) || description.includes(q) || dept.includes(q));
            });
        }

        const totalResults = matchedFiles.length + matchedFolders.length + matchedWorkcards.length + matchedComponents.length + matchedOrders.length;

        const sumHeader = document.createElement("div");
        sumHeader.className = "text-sm text-slate-500 font-semibold mb-2";
        sumHeader.innerHTML = `총 <span class="text-blue-600 font-bold">${totalResults}</span>건의 매칭 결과가 발견되었습니다.`;
        root.appendChild(sumHeader);

        if (totalResults === 0) {
            root.innerHTML += `
                <div class="text-center py-16 text-slate-400 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <i class="fa-regular fa-face-frown text-4xl mb-3 block text-slate-300"></i>
                    검색어 <strong class="text-slate-700">"${q}"</strong>와 일치하는 검색 항목이 존재하지 않습니다.
                </div>
            `;
            return;
        }

        if (matchedFiles.length > 0) {
            renderSearchSection(root, "바탕화면 파일 데이터", matchedFiles, (file) => {
                const item = document.createElement("div");
                item.className = "flex justify-between items-center p-3.5 bg-slate-50 hover:bg-blue-50/20 border border-slate-200 rounded-xl cursor-pointer hover:border-blue-300 transition-colors";
                item.innerHTML = `
                    <div class="flex items-center max-w-lg">
                        ${getFileIcon(file.extension)}
                        <div>
                            <h4 class="font-bold text-slate-800 text-sm truncate max-w-sm">${highlightText(file.name, q)}</h4>
                            <p class="text-[10px] text-slate-400 font-medium mt-0.5">📂 폴더: ${file.folder} | 용량: ${file.size}</p>
                        </div>
                    </div>
                    <span class="text-xs text-blue-600 font-semibold hover:underline">열기</span>
                `;
                item.addEventListener("click", () => openFileDetailModal(file.id));
                return item;
            });
        }

        if (matchedFolders.length > 0) {
            renderSearchSection(root, "바탕화면 폴더 데이터", matchedFolders, (folder) => {
                const item = document.createElement("div");
                item.className = "flex justify-between items-center p-3.5 bg-slate-50 hover:bg-blue-50/20 border border-slate-200 rounded-xl cursor-pointer hover:border-blue-300 transition-colors";
                item.innerHTML = `
                    <div class="flex items-center max-w-lg">
                        <i class="fa-solid fa-folder text-blue-500 text-lg mr-3 select-none flex-shrink-0"></i>
                        <div>
                            <h4 class="font-bold text-slate-800 text-sm truncate max-w-sm">${highlightText(folder.name, q)}</h4>
                            <p class="text-[10px] text-slate-400 font-medium mt-0.5">📂 경로: ${(state.syncPath || "C:\\Users\\bspark231101\\Desktop\\구매업무")}\\${folder.relativePath.replace(/\//g, '\\')}</p>
                        </div>
                    </div>
                    <span class="text-xs text-blue-600 font-semibold hover:underline">이동</span>
                `;
                item.addEventListener("click", () => {
                    state.activeFolder = folder.relativePath.split('/')[0];
                    switchView("folders", state.activeFolder, folder.relativePath);
                });
                return item;
            });
        }

        if (matchedWorkcards.length > 0) {
            const vendorsLabel = loadedCustomNames?.vendors || '명함첩 (WorkCard)';
            renderSearchSection(root, vendorsLabel, matchedWorkcards, (card) => {
                const item = document.createElement("div");
                item.className = "p-3.5 bg-slate-50 hover:bg-emerald-50/20 border border-slate-200 rounded-xl cursor-pointer hover:border-emerald-300 transition-colors";
                item.innerHTML = `
                    <div class="flex justify-between items-start mb-1.5">
                        <h4 class="font-bold text-slate-800 text-sm">${highlightText(card.name || '', q)} <span class="text-xs text-slate-400 font-medium">${card.position ? '[' + card.position + ']' : ''}</span></h4>
                        <span class="text-xs text-emerald-600 font-semibold">명함 열기</span>
                    </div>
                    <p class="text-[10px] text-slate-500 font-medium leading-relaxed">
                        ${card.company ? '🏢 ' + highlightText(card.company, q) : ''}
                        ${card.mobile ? ' | 📱 ' + highlightText(card.mobile, q) : ''}
                        ${card.email ? ' | ✉️ ' + highlightText(card.email, q) : ''}
                    </p>
                `;
                item.addEventListener("click", () => switchView("vendors"));
                return item;
            });
        }

        if (matchedComponents.length > 0) {
            const componentsLabel = loadedCustomNames?.components || '공유 자료실 (양식/도면)';
            renderSearchSection(root, componentsLabel, matchedComponents, (comp) => {
                const item = document.createElement("div");
                item.className = "p-3.5 bg-slate-50 hover:bg-amber-50/20 border border-slate-200 rounded-xl cursor-pointer hover:border-amber-300 transition-colors";
                item.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-bold text-slate-800 text-sm">${highlightText(comp.name, q)}</h4>
                            <p class="text-[10px] text-slate-400 font-medium mt-0.5">식별코드: ${highlightText(comp.assetNumber||'', q)} | 범주: ${comp.category||''}</p>
                        </div>
                        <span class="text-[10px] bg-slate-200/80 px-2 py-0.5 rounded font-bold text-slate-600">${comp.ownerName||''}</span>
                    </div>
                `;
                item.addEventListener("click", () => switchView("components"));
                return item;
            });
        }

        if (matchedOrders.length > 0) {
            const ordersLabel = loadedCustomNames?.orders || '프로젝트 & 업무 관리';
            renderSearchSection(root, ordersLabel, matchedOrders, (task) => {
                const item = document.createElement("div");
                item.className = "p-3.5 bg-slate-50 hover:bg-purple-50/20 border border-slate-200 rounded-xl cursor-pointer hover:border-purple-300 transition-colors";
                item.innerHTML = `
                    <div class="flex justify-between items-center">
                        <div>
                            <h4 class="font-bold text-slate-800 text-sm">${highlightText(task.title||'', q)}</h4>
                            <p class="text-[10px] text-slate-400 font-medium mt-0.5">담당자: ${task.assignee||'-'} | 마감: ${task.deliveryDate||'-'} | 우선순위: ${task.priority||'-'}</p>
                        </div>
                        <span class="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold border border-purple-200">${task.status === "in_progress" ? "진행중" : task.status === "completed" ? "완료됨" : "진행 대기"}</span>
                    </div>
                `;
                item.addEventListener("click", () => switchView("orders"));
                return item;
            });
        }
    }

    function renderSearchSection(root, title, list, elementCreator) {
        const sec = document.createElement("div");
        sec.className = "space-y-2.5 mt-4";
        sec.innerHTML = `<h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 border-l-4 border-slate-300 pl-2 select-none">${title} (${list.length})</h3>`;
        
        const listContainer = document.createElement("div");
        listContainer.className = "grid grid-cols-1 md:grid-cols-2 gap-3";
        
        list.forEach(item => listContainer.appendChild(elementCreator(item)));
        sec.appendChild(listContainer);
        root.appendChild(sec);
    }

    function highlightText(text, q) {
        if (!text) return "";
        const idx = text.toLowerCase().indexOf(q);
        if (idx === -1) return text;
        
        const originalPart = text.substring(idx, idx + q.length);
        return text.substring(0, idx) + 
               `<span class="search-highlight font-bold text-slate-900">${originalPart}</span>` + 
               highlightText(text.substring(idx + q.length), q);
    }

    // -------------------------------------------------------------
    // 16. MOBILE SIDEBAR DRAWER CONTROLS
    // -------------------------------------------------------------
    const openMobileBtn = document.getElementById("open-mobile-menu");
    const closeMobileBtn = document.getElementById("close-mobile-menu");
    const mobileSidebar = document.getElementById("mobile-sidebar");
    const mobileBackdrop = document.getElementById("mobile-sidebar-backdrop");

    openMobileBtn.addEventListener("click", () => {
        mobileBackdrop.classList.remove("hidden");
        void mobileSidebar.offsetWidth;
        mobileSidebar.classList.remove("-translate-x-full");
    });

    closeMobileBtn.addEventListener("click", closeMobileSidebar);
    mobileBackdrop.addEventListener("click", closeMobileSidebar);

    function closeMobileSidebar() {
        mobileSidebar.classList.add("-translate-x-full");
        setTimeout(() => mobileBackdrop.classList.add("hidden"), 200);
    }

    // -------------------------------------------------------------
    // 17. FILESYSTEM LIVE RE-SYNC BUTTON
    // -------------------------------------------------------------
    const syncBtn = document.getElementById("btn-sync-filesystem");
    syncBtn.addEventListener("click", () => {
        loadStateFromServer();
        showToast("바탕화면 실제 폴더와 동기화가 성공적으로 완료되었습니다.", "success");
    });

    // -------------------------------------------------------------
    // 18. GENERAL UTILITY FUNCTIONS
    // -------------------------------------------------------------
    function getFileIcon(ext) {
        switch (ext) {
            case "xlsx": case "xls":
                return `<i class="fa-solid fa-file-excel text-green-600 text-lg mr-3 select-none flex-shrink-0"></i>`;
            case "pdf":
                return `<i class="fa-solid fa-file-pdf text-red-500 text-lg mr-3 select-none flex-shrink-0"></i>`;
            case "docx": case "doc":
                return `<i class="fa-solid fa-file-word text-blue-600 text-lg mr-3 select-none flex-shrink-0"></i>`;
            case "hwp":
                return `<i class="fa-solid fa-file-signature text-sky-500 text-lg mr-3 select-none flex-shrink-0"></i>`;
            case "png": case "jpg": case "jpeg":
                return `<i class="fa-solid fa-file-image text-purple-500 text-lg mr-3 select-none flex-shrink-0"></i>`;
            case "zip": case "rar":
                return `<i class="fa-solid fa-file-zipper text-yellow-600 text-lg mr-3 select-none flex-shrink-0"></i>`;
            case "dwg":
                return `<i class="fa-solid fa-compass-drafting text-amber-500 text-lg mr-3 select-none flex-shrink-0"></i>`;
            default:
                return `<i class="fa-solid fa-file-lines text-slate-400 text-lg mr-3 select-none flex-shrink-0"></i>`;
        }
    }

    function formatCurrency(num) {
        return "₩ " + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    function formatCurrentDate() {
        const today = new Date();
        const yyyy = today.getFullYear();
        let mm = today.getMonth() + 1;
        let dd = today.getDate();
        if (mm < 10) mm = '0' + mm;
        if (dd < 10) dd = '0' + dd;
        return `${yyyy}-${mm}-${dd}`;
    }

    function formatCurrentDateTime() {
        const today = new Date();
        const yyyy = today.getFullYear();
        let mm = today.getMonth() + 1;
        let dd = today.getDate();
        let hh = today.getHours();
        let min = today.getMinutes();
        
        if (mm < 10) mm = '0' + mm;
        if (dd < 10) dd = '0' + dd;
        if (hh < 10) hh = '0' + hh;
        if (min < 10) min = '0' + min;

        return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    }

    function getRelativeTime(dateTimeStr) {
        const date = new Date(dateTimeStr.replace(/-/g, "/"));
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return "방금 전";
        if (diffMins < 60) return `${diffMins}분 전`;
        if (diffHours < 24) return `${diffHours}시간 전`;
        if (diffDays === 1) return "어제";
        if (diffDays < 7) return `${diffDays}일 전`;
        
        return dateTimeStr.split(" ")[0];
    }

    function getDaysUntil(dateStr) {
        const target = new Date(dateStr);
        const today = new Date();
        target.setHours(0,0,0,0);
        today.setHours(0,0,0,0);
        
        const diffTime = target - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    const dbAddBtn = document.getElementById("btn-add-unified-dashboard");
    if (dbAddBtn) dbAddBtn.onclick = () => openModal("modal-add-unified");

    // Folder Rename Form Submit
    const folderRenameForm = document.getElementById("folder-rename-form");
    if (folderRenameForm) {
        folderRenameForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const parentPath = document.getElementById("fr-parent-path").value;
            const oldName = document.getElementById("fr-old-name").value;
            const newName = document.getElementById("fr-new-name").value.trim();

            if (!newName || oldName === newName) {
                closeModal("modal-folder-rename");
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/folders/rename`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ parentPath, oldName, newName })
                });
                const data = await res.json();
                if (data.success) {
                    showToast(`폴더명이 '${data.newName}'(으)로 변경되었습니다.`, "success");
                    closeModal("modal-folder-rename");

                    const oldFullPath = parentPath ? `${parentPath}/${oldName}` : oldName;
                    const newFullPath = parentPath ? `${parentPath}/${data.newName}` : data.newName;
                    
                    if (state.currentExplorerPath === oldFullPath) {
                        state.currentExplorerPath = newFullPath;
                        state.activeFolder = newFullPath.split('/')[0];
                    } else if (state.currentExplorerPath.startsWith(oldFullPath + "/")) {
                        state.currentExplorerPath = state.currentExplorerPath.replace(oldFullPath + "/", newFullPath + "/");
                        state.activeFolder = state.currentExplorerPath.split('/')[0];
                    }

                    loadStateFromServer();
                } else {
                    showToast(data.error || "폴더명 변경 실패", "error");
                }
            } catch (err) {
                showToast("서버 통신에 실패했습니다.", "error");
            }
        });
    }

    // -------------------------------------------------------------
    // USER DEFINED SCHEMA & FILE RENAME DIALOG LOGIC
    // -------------------------------------------------------------

    // 1. PARA AI Generate Modal Logic
    const btnParaAiGenerate = document.getElementById("btn-para-ai-generate");
    const paraAiGenerateForm = document.getElementById("para-ai-generate-form");
    const paraAiLoading = document.getElementById("para-ai-loading");
    const paraAiPreview = document.getElementById("para-ai-preview");
    const btnParaGenerateSubmit = document.getElementById("btn-para-generate-submit");

    if (btnParaAiGenerate) {
        btnParaAiGenerate.addEventListener("click", () => {
            if (!state.syncPath) {
                showToast("환경설정에서 로컬 폴더 경로(바탕화면 실시간 폴더)를 먼저 지정해주세요.", "warning");
                return;
            }
            const apiKey = state.apiKey || localStorage.getItem('workhub_gemini_api_key');
            if (!apiKey) {
                showToast("환경설정에서 Gemini API Key를 먼저 입력해주세요.", "warning");
                return;
            }
            
            document.getElementById("para-job-style").value = "";
            paraAiLoading.classList.add("hidden");
            paraAiLoading.classList.remove("flex");
            paraAiPreview.classList.add("hidden");
            btnParaGenerateSubmit.disabled = false;
            openModal("modal-para-ai-generate");
        });
    }

    if (paraAiGenerateForm) {
        paraAiGenerateForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            const jobStyle = document.getElementById("para-job-style").value.trim();
            if (!jobStyle) return;

            paraAiLoading.classList.remove("hidden");
            paraAiLoading.classList.add("flex");
            paraAiPreview.classList.add("hidden");
            btnParaGenerateSubmit.disabled = true;

            try {
                const apiKey = state.apiKey || localStorage.getItem('workhub_gemini_api_key');
                const res = await fetch(`${API_BASE}/para/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey, jobStyle })
                });
                
                const data = await res.json();
                if (data.success) {
                    paraAiPreview.classList.remove("hidden");
                    paraAiPreview.querySelector("div").textContent = data.aiResponse.join("\n");
                    showToast(`PARA 폴더 구조가 성공적으로 생성되었습니다. (${data.createdFolders.length}개)`, "success");
                    loadStateFromServer(); // Refresh folder tree
                    
                    // Close modal after showing preview for a bit
                    setTimeout(() => closeModal("modal-para-ai-generate"), 3000);
                } else {
                    showToast(data.error || "폴더 생성 실패", "error");
                }
            } catch (err) {
                showToast("서버 통신에 실패했습니다.", "error");
            } finally {
                paraAiLoading.classList.remove("flex");
                paraAiLoading.classList.add("hidden");
                btnParaGenerateSubmit.disabled = false;
            }
        });
    }


    // 2. Manual File Rename Dialog Logic
    const btnRenameTrigger = document.getElementById("fd-btn-rename-trigger");
    const btnRename = document.getElementById("fd-btn-rename");
    const fileRenameForm = document.getElementById("file-rename-form");

    if (btnRenameTrigger) {
        btnRenameTrigger.addEventListener("click", (e) => {
            e.stopPropagation();
            if (currentViewingFileId) {
                closeModal("modal-file-detail");
                openFileRenameModal(currentViewingFileId);
            }
        });
    }

    if (btnRename) {
        btnRename.addEventListener("click", () => {
            if (currentViewingFileId) {
                closeModal("modal-file-detail");
                openFileRenameModal(currentViewingFileId);
            }
        });
    }

    function incrementVersion(vStr) {
        const match = vStr.match(/^v(\d+)_(\d+)$/);
        if (!match) return "v1_1";
        let major = parseInt(match[1]);
        let minor = parseInt(match[2]);
        minor++;
        return `v${major}_${minor}`;
    }

    function openFileRenameModal(fileId) {
        let file = state.files.find(f => f.id === fileId);
        if (!file && state._explorerFiles) {
            file = state._explorerFiles.find(f => f.id === fileId);
        }
        if (!file) {
            showToast("파일을 찾을 수 없습니다.", "error");
            return;
        }

        const relPath = file.relativePath || `${file.folder || ''}/${file.name || ''}`;
        const parentPath = relPath.includes('/') ? relPath.substring(0, relPath.lastIndexOf('/')) : "";
        
        document.getElementById("fn-parent-path").value = parentPath;
        document.getElementById("fn-old-name").value = file.name;
        document.getElementById("fn-ext").value = file.extension;

        // 기존 파일명 요소를 파싱하여 입력 폼 분배
        const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        
        let parsedDate = new Date().toISOString().substring(0, 10).replace(/-/g, '');
        let parsedDeptProject = "";
        let parsedDetail = baseName;
        let parsedVersion = "v1_0";

        try {
            const versionMatch = baseName.match(/_(v\d+_\d+)$/);
            if (versionMatch) {
                const versionPart = versionMatch[1];
                const remain1 = baseName.substring(0, baseName.length - versionPart.length - 1);
                
                const firstUnderscoreIdx = remain1.indexOf('_');
                if (firstUnderscoreIdx !== -1) {
                    const datePart = remain1.substring(0, firstUnderscoreIdx);
                    const remain2 = remain1.substring(firstUnderscoreIdx + 1);
                    
                    const nextUnderscoreIdx = remain2.indexOf('_');
                    if (nextUnderscoreIdx !== -1) {
                        parsedDate = datePart;
                        parsedDeptProject = remain2.substring(0, nextUnderscoreIdx);
                        parsedDetail = remain2.substring(nextUnderscoreIdx + 1);
                        parsedVersion = versionPart;
                    }
                }
            }
        } catch (e) {
            console.warn("기존 파일명 파싱 실패, 기본값 사용:", e);
        }

        document.getElementById("fn-date").value = parsedDate;
        document.getElementById("fn-version").value = parsedVersion;
        document.getElementById("fn-dept-project").value = parsedDeptProject.replace(/ /g, '-');
        document.getElementById("fn-detail").value = parsedDetail.replace(/ /g, '-');

        // 실시간 미리보기 바인딩
        const inputs = ["fn-date", "fn-version", "fn-dept-project", "fn-detail"];
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.oninput = () => {
                    if (id === "fn-detail" || id === "fn-dept-project") {
                        el.value = el.value.replace(/ /g, '-').replace(/[\\/:*?"<>|]/g, '');
                    } else if (id === "fn-version") {
                        el.value = el.value.replace(/\./g, '_').replace(/[\\/:*?"<>|]/g, '');
                    } else if (id === "fn-date") {
                        el.value = el.value.replace(/\D/g, '');
                    }
                    updateFileRenamePreview();
                };
            }
        });

        // 버전업 단추 클릭 바인딩
        const btnVerUp = document.getElementById("btn-version-up");
        if (btnVerUp) {
            btnVerUp.onclick = () => {
                const currentVer = document.getElementById("fn-version").value.trim();
                const nextVer = incrementVersion(currentVer);
                document.getElementById("fn-version").value = nextVer;
                updateFileRenamePreview();
            };
        }

        updateFileRenamePreview();
        openModal("modal-file-rename");
    }

    function updateFileRenamePreview() {
        const date = document.getElementById("fn-date").value.trim();
        const deptProject = document.getElementById("fn-dept-project").value.trim();
        const detail = document.getElementById("fn-detail").value.trim();
        const version = document.getElementById("fn-version").value.trim();
        const ext = document.getElementById("fn-ext").value.trim();

        const previewEl = document.getElementById("fn-preview");
        if (date && deptProject && detail && version) {
            previewEl.innerText = `${date}_${deptProject}_${detail}_${version}.${ext}`;
            previewEl.classList.remove("text-slate-400");
            previewEl.classList.add("text-slate-800");
        } else {
            previewEl.innerText = "필수 항목들을 채워주시면 완성형 파일명이 조합됩니다.";
            previewEl.classList.add("text-slate-400");
            previewEl.classList.remove("text-slate-800");
        }
    }

    if (fileRenameForm) {
        fileRenameForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const parentPath = document.getElementById("fn-parent-path").value;
            const oldName = document.getElementById("fn-old-name").value;
            const newName = document.getElementById("fn-preview").innerText.trim();

            if (!newName || oldName === newName) {
                closeModal("modal-file-rename");
                return;
            }

            async function performRename(nameToRequest) {
                try {
                    const res = await fetch(`${API_BASE}/files/rename`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ parentPath, oldName, newName: nameToRequest })
                    });
                    const data = await res.json();
                    if (res.ok && data.success) {
                        showToast(`파일명이 '${data.newName}'(으)로 변경되었습니다.`, "success");
                        closeModal("modal-file-rename");
                        loadStateFromServer();
                    } else if (res.status === 409) {
                        // 중복 오류 시 버전업 자동 컨펌 유도
                        const currentVersion = document.getElementById("fn-version").value.trim();
                        const nextVersion = incrementVersion(currentVersion);
                        
                        if (confirm(`동일한 파일명이 이미 존재합니다.\n버전을 '${nextVersion}'(으)로 한 단계 높여서 새로 저장하시겠습니까?`)) {
                            document.getElementById("fn-version").value = nextVersion;
                            updateFileRenamePreview();
                            const nextNewName = document.getElementById("fn-preview").innerText.trim();
                            await performRename(nextNewName);
                        }
                    } else {
                        showToast(data.error || "파일명 변경 실패", "error");
                    }
                } catch (err) {
                    showToast("서버 통신에 실패했습니다.", "error");
                }
            }

            await performRename(newName);
        });
    }


    // Create Subfolder Button
    const btnAddSubfolder = document.getElementById("btn-folder-add-subfolder");
    if (btnAddSubfolder) {
        btnAddSubfolder.addEventListener("click", async () => {
            const folderName = prompt("새 하위 폴더의 이름을 입력하세요:");
            if (!folderName) return;

            const parentPath = state.currentExplorerPath || state.activeFolder;
            try {
                const res = await fetch(`${API_BASE}/folders/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ parentPath, folderName })
                });
                const data = await res.json();
                if (data.success) {
                    showToast(`하위 폴더 '${data.folderName}'가 생성되었습니다.`, "success");
                    loadStateFromServer();
                } else {
                    showToast(data.error || "폴더 생성 실패", "error");
                }
            } catch (err) {
                showToast("서버 통신에 실패했습니다.", "error");
            }
        });
    }

    // Open Folder in Windows Explorer Button
    const btnOpenFolderInExplorer = document.getElementById("btn-open-folder-in-explorer");
    if (btnOpenFolderInExplorer) {
        btnOpenFolderInExplorer.addEventListener("click", async () => {
            const currentPath = state.currentExplorerPath || state.activeFolder || '';
            try {
                const res = await fetch(`${API_BASE}/open-folder`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: currentPath })
                });
                const data = await res.json();
                if (!data.success) showToast(data.error || "폴더를 열 수 없습니다.", "error");
            } catch (err) {
                showToast("서버 통신에 실패했습니다.", "error");
            }
        });
    }

    // AI Smart Folder Organize Logic
    const btnAiOrganize = document.getElementById("btn-folder-ai-organize");
    if (btnAiOrganize) {
        btnAiOrganize.addEventListener("click", () => {
            document.getElementById("ai-organize-prompt").value = "";
            openModal("modal-ai-organize");
        });
    }

    const btnSubmitAiOrganize = document.getElementById("btn-submit-ai-organize");
    if (btnSubmitAiOrganize) {
        btnSubmitAiOrganize.addEventListener("click", async () => {
            const promptText = document.getElementById("ai-organize-prompt").value.trim();
            if (!promptText) {
                showToast("AI에게 지시할 내용을 입력해주세요.", "warning");
                return;
            }

            let targetPath = state.currentExplorerPath;
            if (targetPath === null || targetPath === undefined || targetPath === false) {
                targetPath = state.activeFolder;
            }
            if (targetPath === null || targetPath === undefined || targetPath === false) {
                showToast("현재 선택된 폴더가 없습니다.", "error");
                return;
            }

            const originalHtml = btnSubmitAiOrganize.innerHTML;
            btnSubmitAiOrganize.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> 분석 및 이동 중...`;
            btnSubmitAiOrganize.disabled = true;
            
            closeModal("modal-ai-organize");

            const overlay = document.getElementById("global-loading-overlay");
            const timerEl = document.getElementById("global-loading-timer");
            if (overlay && timerEl) {
                overlay.classList.remove("hidden");
                overlay.classList.add("flex");
                timerEl.innerText = "00:00";
            }

            let seconds = 0;
            const timerInterval = setInterval(() => {
                seconds++;
                const m = String(Math.floor(seconds / 60)).padStart(2, '0');
                const s = String(seconds % 60).padStart(2, '0');
                if (timerEl) timerEl.innerText = `${m}:${s}`;
            }, 1000);

            try {
                const res = await fetch(`${API_BASE}/ai/fs-agent`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetPath, promptText })
                });
                const data = await res.json();
                
                if (data.success) {
                    if (data.executedCount > 0) {
                        showToast(`성공적으로 ${data.executedCount}개의 파일/폴더 작업(생성, 이동 등)이 완료되었습니다!`, "success");
                        loadStateFromServer(); // refresh folder view
                    } else if (data.message) {
                        showToast(data.message, "info");
                    } else {
                        showToast("AI가 분석 결과 수행할 작업이 없다고 판단했습니다.", "info");
                    }
                } else {
                    showToast(data.error || "AI 파일/폴더 비서 실행 중 오류가 발생했습니다.", "error");
                }
            } catch (err) {
                console.error(err);
                showToast("서버 통신에 실패했습니다.", "error");
            } finally {
                clearInterval(timerInterval);
                if (overlay) {
                    overlay.classList.add("hidden");
                    overlay.classList.remove("flex");
                }
                btnSubmitAiOrganize.innerHTML = originalHtml;
                btnSubmitAiOrganize.disabled = false;
            }
        });
    }

    // -------------------------------------------------------------
    // 19. APP STARTUP
    // -------------------------------------------------------------
    // -------------------------------------------------------------
    // KANBAN TASK ASSOCIATED FILES MANAGEMENT
    // -------------------------------------------------------------
    async function renderTaskFilesList(taskId) {
        const listContainer = document.getElementById("task-files-list");
        if (!listContainer) return;
        listContainer.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">연관 파일을 로딩 중...</p>`;

        const task = state.orders.find(o => o.id === taskId);
        const statusFolder = task ? getTaskStatusFolder(task.status) : "01_대기";
        const targetFolder = `TASK_FOLDER/${taskId}`;

        try {
            const res = await fetch(`${API_BASE}/dir?path=${encodeURIComponent(targetFolder)}`);
            const data = await res.json();
            
            if (data.error) {
                listContainer.innerHTML = `
                    <div class="text-center py-4 text-slate-400 text-xs">
                        <i class="fa-regular fa-folder-open text-lg mb-1 block"></i>
                        연관된 파일이 없습니다. 파일을 추가해보세요.
                    </div>
                `;
                return;
            }

            const files = data.files || [];
            if (files.length === 0) {
                listContainer.innerHTML = `
                    <div class="text-center py-4 text-slate-400 text-xs">
                        <i class="fa-regular fa-folder-open text-lg mb-1 block"></i>
                        연관된 파일이 없습니다. 파일을 추가해보세요.
                    </div>
                `;
                return;
            }

            listContainer.innerHTML = "";
            files.forEach(file => {
                const item = document.createElement("div");
                item.className = "flex items-center justify-between p-2 hover:bg-slate-50 border border-slate-100 rounded-lg text-xs transition-colors group";
                
                let displayName = file.name;
                let displayIcon = getFileIcon(file.extension);
                
                if (file.name.startsWith('[연동]_')) {
                    displayName = file.name.replace('.txt', '');
                    displayIcon = `<i class="fa-solid fa-link text-blue-500 text-lg mr-3"></i>`;
                }

                item.innerHTML = `
                    <div class="flex items-center truncate max-w-[70%] cursor-pointer btn-task-file-open" title="${file.name}">
                        ${displayIcon}
                        <span class="font-medium text-slate-700 truncate">${displayName}</span>
                    </div>
                    <div class="flex items-center space-x-1">
                        <button type="button" class="btn-task-file-open text-slate-400 hover:text-blue-600 p-1.5 rounded hover:bg-slate-100 transition-colors" title="바로 열기">
                            <i class="fa-solid fa-external-link"></i>
                        </button>
                        <button type="button" class="btn-task-file-delete text-slate-400 hover:text-red-500 p-1.5 rounded hover:bg-slate-100 transition-colors" title="삭제">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                `;

                // Open Handler
                const openBtns = item.querySelectorAll(".btn-task-file-open");
                openBtns.forEach(btn => {
                    btn.onclick = async (e) => {
                        e.stopPropagation();
                        showToast(`연관 파일 '${file.name}'을 실행합니다...`, "info");
                        try {
                            const openRes = await fetch(`${API_BASE}/files/open`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ filename: file.name, folder: targetFolder })
                            });
                            const openData = await openRes.json();
                            if (openData.success) {
                                showToast("OS 기본 프로그램으로 파일이 열렸습니다.", "success");
                            } else {
                                showToast(openData.error || "파일 열기 실패", "error");
                            }
                        } catch (err) {
                            showToast("서버 통신에 실패했습니다.", "error");
                        }
                    };
                });

                // Delete Handler
                item.querySelector(".btn-task-file-delete").onclick = async (e) => {
                    e.stopPropagation();
                    if (confirm(`정말 바탕화면의 '${file.name}' 연관 파일을 삭제하시겠습니까?`)) {
                        try {
                            const delRes = await fetch(`${API_BASE}/files`, {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ filename: file.name, folder: targetFolder })
                            });
                            const delData = await delRes.json();
                            if (delData.success) {
                                showToast("파일이 정상적으로 삭제되었습니다.", "success");
                                renderTaskFilesList(taskId);
                                loadStateFromServer();
                            } else {
                                showToast(delData.error || "파일 삭제 실패", "error");
                            }
                        } catch (err) {
                            showToast("서버 통신에 실패했습니다.", "error");
                        }
                    }
                };

                listContainer.appendChild(item);
            });

        } catch (err) {
            console.error("Error loading task files:", err);
            listContainer.innerHTML = `<p class="text-xs text-red-500 text-center py-4">연관 파일을 불러올 수 없습니다.</p>`;
        }
    }

    const taskDropzone = document.getElementById("task-dropzone");
    const taskFileUploader = document.getElementById("task-file-uploader");
    const btnTaskAddFile = document.getElementById("btn-task-add-file");

    if (taskDropzone) {
        taskDropzone.addEventListener("click", () => taskFileUploader.click());

        taskDropzone.addEventListener("dragover", (e) => {
            e.preventDefault();
            taskDropzone.classList.add("border-purple-400", "bg-purple-50/20");
        });

        ["dragleave", "drop"].forEach(event => {
            taskDropzone.addEventListener(event, () => {
                taskDropzone.classList.remove("border-purple-400", "bg-purple-50/20");
            });
        });

        taskDropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            if (state.activeTaskIdForFiles) {
                handleTaskDroppedFiles(e.dataTransfer.files, state.activeTaskIdForFiles);
            }
        });
    }

    if (taskFileUploader) {
        taskFileUploader.addEventListener("change", (e) => {
            if (state.activeTaskIdForFiles) {
                handleTaskDroppedFiles(e.target.files, state.activeTaskIdForFiles);
            }
        });
    }

    async function handleTaskDroppedFiles(fileList, taskId) {
        if (fileList.length === 0 || !taskId) return;
        
        let successCount = 0;
        const task = state.orders.find(o => o.id === taskId);
        const statusFolder = task ? getTaskStatusFolder(task.status) : "01_대기";
        const targetFolder = `TASK_FOLDER/${taskId}`;

        for (let i = 0; i < fileList.length; i++) {
            const f = fileList[i];
            const ext = f.name.split(".").pop().toLowerCase();
            
            const payload = {
                name: f.name,
                folder: targetFolder,
                content: `이 파일은 업무 카드(${taskId}) 연관 파일 업로더를 통해 업로드되었습니다. 크기: ${f.size} Bytes.`,
                tags: [ext, "업무파일", taskId]
            };

            try {
                const res = await fetch(`${API_BASE}/files/upload`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) successCount++;
            } catch (err) {
                console.error("Failed to upload task file via API:", err);
            }
        }

        if (successCount > 0) {
            showToast(`${successCount}개의 연관 파일이 바탕화면 업무 폴더에 연동 생성되었습니다.`, "success");
            renderTaskFilesList(taskId);
            loadStateFromServer();
        } else {
            showToast("파일 연동에 실패했습니다. 백엔드 서버 상태를 점검해주세요.", "error");
        }
    }

    if (btnTaskAddFile) {
        btnTaskAddFile.addEventListener("click", async () => {
            const taskId = state.activeTaskIdForFiles;
            if (!taskId) return;

            const filename = prompt("이 업무에 연동할 파일명을 입력하세요 (예: 회의록.docx, 계약서.xlsx, 보고서.hwp):");
            if (!filename) return;

            const sanitized = filename.trim();
            const ext = sanitized.split(".").pop().toLowerCase();
            
            if (sanitized) {
                const task = state.orders.find(o => o.id === taskId);
                const statusFolder = task ? getTaskStatusFolder(task.status) : "01_대기";
                const targetFolder = `TASK_FOLDER/${taskId}`;
                const payload = {
                    name: sanitized,
                    folder: targetFolder,
                    content: `업무 연관 문서 표준 템플릿 - ${sanitized}`,
                    tags: [ext, "업무파일", taskId]
                };

                try {
                    const res = await fetch(`${API_BASE}/files/upload`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await res.json();
                    if (data.success) {
                        showToast(`바탕화면에 '${sanitized}' 연관 파일이 생성되었습니다.`, "success");
                        renderTaskFilesList(taskId);
                        loadStateFromServer();
                    } else {
                        showToast(data.error || "파일 생성에 실패했습니다.", "error");
                    }
                } catch (err) {
                    showToast("서버 통신에 실패했습니다.", "error");
                }
            }
        });
    }

    loadStateFromServer();

    // Background Auto-sync every 10 seconds to detect real Desktop folder changes
    // Disabled while a task detail modal is open to prevent overwriting user input or timeline modifications.
    setInterval(() => {
        if (activeModals.size === 0 && !currentSelectedTask) {
            loadStateFromServer(true);
        }
    }, 10000);

    // AI Kanban Event Listeners
    document.getElementById("btn-close-task-detail")?.addEventListener("click", closeTaskDetail);

    // Redundant btn-task-delete listener removed to prevent double-confirm and database sync conflicts.
    // Task deletion is correctly handled at the top level via DELETE /api/tasks/:id API.

    let autoSaveTimeout = null;
    window.triggerAutoSave = function() {
        if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            if (currentSelectedTask) {
                const btnSave = document.getElementById("btn-task-save");
                if (btnSave) {
                    const originalText = btnSave.innerHTML;
                    btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 저장 중...';
                    saveCurrentTask(true).then(() => {
                        btnSave.innerHTML = '<i class="fa-solid fa-check text-green-500"></i> 자동 저장됨';
                        setTimeout(() => { btnSave.innerHTML = originalText; }, 2000);
                    });
                } else {
                    saveCurrentTask(true);
                }
            }
        }, 1000);
    };

    async function saveCurrentTask(silent = false) {
        if (!currentSelectedTask) return;
        
        const task = state.orders.find(o => o.id === currentSelectedTask.id);
        if (task) {
            task.title = document.getElementById("task-detail-title").value;
            task.status = document.getElementById("task-detail-status").value;
            task.folder = document.getElementById("task-detail-folder").value;
            task.assignee = document.getElementById("task-detail-assignee").value;
            task.deliveryDate = document.getElementById("task-detail-delivery").value;
            if(editorInstance) { 
                const d = await editorInstance.save();
                task.description = JSON.stringify(d);
            }
            
            await syncData("orders", state.orders);
            renderKanbanBoard();
            if (!silent) {
                showToast("변경사항이 저장되었습니다.", "success");
            }
        }
    }

    document.getElementById("btn-task-save")?.addEventListener("click", () => {
        saveCurrentTask(false);
    });

    // Auto-save listeners
    document.addEventListener("click", async (e) => {
        const pathLink = e.target.closest(".path-link");
        if (pathLink) {
            e.preventDefault();
            const absPath = pathLink.getAttribute("data-path");
            if (absPath) {
                console.log("[PATH LINK CLICKED]", absPath);
                try {
                    const res = await fetch(`${API_BASE}/files/open-path`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ absolutePath: absPath })
                    });
                    if (res.status === 404) {
                        alert("파일을 찾을 수 없습니다 (완전히 삭제되었거나 검색 범위를 벗어났습니다).");
                        return;
                    }
                    const data = await res.json();
                    if (!data.success) {
                        alert("폴더/파일을 열 수 없습니다: " + (data.error || "서버 오류"));
                        return;
                    }

                    if (data.newPath && data.newPath !== absPath) {
                        // Update the DB if we are inside a task context
                        if (window.currentSelectedTask) {
                            const replaceLinkUrl = (links) => {
                                if(!links) return false;
                                let changed = false;
                                links.forEach(lk => {
                                    if(lk.url === absPath) {
                                        lk.url = data.newPath;
                                        changed = true;
                                    }
                                });
                                return changed;
                            };

                            let updated = false;
                            if (window.currentSelectedTask.timeline) {
                                window.currentSelectedTask.timeline.forEach(entry => {
                                    if(replaceLinkUrl(entry.links)) updated = true;
                                });
                            }
                            if (window.currentSelectedTask.activeSession) {
                                if(replaceLinkUrl(window.currentSelectedTask.activeSession.links)) updated = true;
                            }
                            
                            // Also replace in EditorJS content if present
                            if (window.currentSelectedTask.description && window.currentSelectedTask.description.includes(absPath)) {
                                window.currentSelectedTask.description = window.currentSelectedTask.description.replace(new RegExp(absPath.replace(/\\/g, '\\\\'), 'g'), data.newPath);
                                updated = true;
                            }

                            if (updated) {
                                // Sync to DB
                                const idx = state.orders.findIndex(o => o.id === window.currentSelectedTask.id);
                                if (idx > -1) {
                                    state.orders[idx] = window.currentSelectedTask;
                                    await syncData("orders", state.orders);
                                }
                                // Update DOM for the clicked link immediately
                                pathLink.setAttribute("data-path", data.newPath);
                                pathLink.innerText = pathLink.innerText.replace(absPath, data.newPath);
                                showToast("변경된 파일 경로가 자동으로 갱신되었습니다.", "info");
                            }
                        }
                    }
                } catch (err) {
                    console.error("Error opening path:", err);
                    alert("서버 연결에 실패했습니다.");
                }
            }
        }
    });

    document.getElementById("task-detail-title")?.addEventListener("input", window.triggerAutoSave);
    document.getElementById("task-detail-status")?.addEventListener("change", window.triggerAutoSave);
    document.getElementById("task-detail-assignee")?.addEventListener("input", window.triggerAutoSave);
    document.getElementById("task-detail-delivery")?.addEventListener("change", window.triggerAutoSave);

    document.getElementById("quick-capture-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const input = document.getElementById("quick-capture-input");
        const val = input.value.trim();
        if (!val) return;

        const newTask = {
            id: 'task_' + Date.now(),
            title: val,
            status: 'inbox',
            folder: 'not_urgent_not_important',
            description: '',
            department: '공통',
            assignee: '담당자 미정',
            priority: 'Normal',
            createdAt: Date.now()
        };

        state.orders.push(newTask);
        await syncData("orders", state.orders);
        input.value = "";
        renderKanbanBoard();
        showToast("수신함에 작업이 추가되었습니다.", "success");
    });

    document.getElementById("btn-ai-smart-capture")?.addEventListener("click", async () => {
        const input = document.getElementById("quick-capture-input");
        const val = input.value.trim();
        if (!val) return;

        const btn = document.getElementById("btn-ai-smart-capture");
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 분석 중...';
        btn.disabled = true;

        try {
            const res = await fetch(`${API_BASE}/ai/task-capture`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ promptText: val })
            });
            const result = await res.json();

            if (result.success && result.data) {
                const newTask = {
                    id: 'task_' + Date.now(),
                    title: result.data.title || val,
                    status: result.data.status || 'inbox',
                    folder: result.data.folder || 'none',
                    description: result.data.description || '',
                    department: '공통',
                    assignee: '담당자 미정',
                    priority: 'Normal',
                    createdAt: Date.now()
                };

                state.orders.push(newTask);
                await syncData("orders", state.orders);
                input.value = "";
                renderKanbanBoard();
                showToast("AI가 성공적으로 분석하여 자동 분류했습니다.", "success");
            } else {
                throw new Error("API parsing failed");
            }
        } catch (err) {
            console.error(err);
            showToast("AI 분석 중 오류가 발생했습니다.", "error");
        } finally {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    });

    document.getElementById("btn-task-elaborate")?.addEventListener("click", async () => {
        if (!currentSelectedTask) return;
        const btn = document.getElementById("btn-task-elaborate");
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 구체화 중...';
        btn.disabled = true;

        try {
            const title = document.getElementById("task-detail-title").value;
            const desc = editorInstance ? "진행 상황 요약 요청" : "";

            const res = await fetch(`${API_BASE}/ai/task-elaborate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: title, description: desc })
            });
            const result = await res.json();

            if (result.success && result.text) {
                const newDesc = desc ? `${desc}\n\n---\n\n### ✨ AI 어시스턴트 제안\n${result.text}` : `### ✨ AI 어시스턴트 제안\n${result.text}`;
                if(editorInstance) { editorInstance.blocks.insert('paragraph', { text: "<b>[AI 구체화 결과]</b><br>" + newDesc }); }
                showToast("AI가 내용을 구체화했습니다. 변경사항을 저장해주세요.", "success");
            } else {
                throw new Error("Elaborate failed");
            }
        } catch (err) {
            console.error(err);
            showToast("AI 내용 구체화 중 오류가 발생했습니다.", "error");
        } finally {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    });

    document.getElementById("task-detail-folder")?.addEventListener("change", (e) => {
        window.triggerAutoSave();
        const urgInfo = URGENCY_MAP[e.target.value] || URGENCY_MAP['not_urgent_not_important'];
        const preview = document.getElementById("urgency-preview");
        if (preview) {
            preview.style.backgroundColor = urgInfo.bg;
        }
    });

    // -------------------------------------------------------------
    // ALL TASKS TABLE VIEW LOGIC
    // -------------------------------------------------------------
    function renderAllTasksView() {
        const tbody = document.getElementById("all-tasks-tbody");
        if (!tbody) return;
        
        const query = document.getElementById("all-tasks-search")?.value.toLowerCase() || "";
        const filterStatus = document.getElementById("all-tasks-filter-status")?.value || "all";
        const filterAssignee = document.getElementById("all-tasks-filter-assignee")?.value || "all";
        const filterFolder = document.getElementById("all-tasks-filter-folder")?.value || "all";

        // Dynamically populate assignee dropdown if not populated
        const assigneeSelect = document.getElementById("all-tasks-filter-assignee");
        if (assigneeSelect && assigneeSelect.options.length <= 1) {
            const uniqueAssignees = [...new Set(state.orders.map(o => o.assignee).filter(Boolean))].sort();
            uniqueAssignees.forEach(assignee => {
                const opt = document.createElement("option");
                opt.value = assignee;
                opt.textContent = assignee;
                assigneeSelect.appendChild(opt);
            });
        }
        
        const tasksToRender = state.orders.filter(t => {
            if (filterStatus !== "all") {
                if (filterStatus === "completed" || filterStatus === "done") {
                    if (t.status !== "done" && t.status !== "completed") return false;
                } else if (filterStatus === "inprogress") {
                    if (t.status !== "inprogress" && t.status !== "in_progress") return false;
                } else if (t.status !== filterStatus) {
                    return false;
                }
            }
            if (filterAssignee !== "all" && t.assignee !== filterAssignee) return false;
            if (filterFolder !== "all") {
                if (filterFolder === "none") {
                    if (t.folder && t.folder !== "none") return false;
                } else if (t.folder !== filterFolder) {
                    return false;
                }
            }

            if (query) {
                return (t.title && t.title.toLowerCase().includes(query)) || 
                       (t.assignee && t.assignee.toLowerCase().includes(query)) ||
                       (t.description && t.description.toLowerCase().includes(query));
            }
            return true;
        }).sort((a, b) => {
            if (a.completedAt && b.completedAt) return b.completedAt - a.completedAt;
            if (a.completedAt) return 1;
            if (b.completedAt) return -1;
            return new Date(a.deliveryDate || 0) - new Date(b.deliveryDate || 0);
        });

        tbody.innerHTML = tasksToRender.map(task => {
            const statusLabels = {
                "inbox": "수신함", "todo": "실행 대기", "inprogress": "진행 중", 
                "waiting": "회신 대기", "done": "완료", "completed": "완료",
                "in_progress": "진행 중", "pending_approval": "결재 대기"
            };
            const statusColors = {
                "inbox": "bg-slate-100 text-slate-700", "todo": "bg-blue-100 text-blue-700",
                "inprogress": "bg-purple-100 text-purple-700", "in_progress": "bg-purple-100 text-purple-700",
                "waiting": "bg-amber-100 text-amber-700", "pending_approval": "bg-amber-100 text-amber-700",
                "done": "bg-emerald-100 text-emerald-700", "completed": "bg-emerald-100 text-emerald-700"
            };
            const folderLabels = {
                "none": "미분류",
                "0_프로젝트": "프로젝트",
                "1_영역":     "영역",
                "2_자료":     "자료",
                "3_보관소":    "보관소",
                "0_Projects":  "프로젝트",
                "1_Areas":     "영역",
                "2_Resources": "자료",
                "3_Archives":  "보관",
                // Legacy PARA keys fallback
                "projects": "Projects", "areas": "Areas",
                "resources": "Resources", "archives": "Archives"
            };

            const statusText = statusLabels[task.status] || task.status || "미지정";
            const statusClass = statusColors[task.status] || "bg-slate-100 text-slate-700";
            const folderText = folderLabels[task.folder] || task.folder || "미분류";

            const completedStr = task.completedAt ? new Date(task.completedAt).toLocaleString("ko-KR", { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' }) : "-";
            const deliveryStr = task.deliveryDate || "-";

            let plainDesc = task.description || "";
            if (plainDesc.trim().startsWith("{") && plainDesc.includes('"blocks"')) {
                try {
                    const parsed = JSON.parse(plainDesc);
                    if (parsed.blocks && Array.isArray(parsed.blocks)) {
                        plainDesc = parsed.blocks.map(b => b.data && b.data.text ? b.data.text : "").join(" ");
                    }
                } catch(e) { /* ignore parse error */ }
            }
            plainDesc = plainDesc.replace(/<[^>]*>?/gm, '').trim();
            if (!plainDesc) plainDesc = "내용 없음";
            const safeDescTooltip = plainDesc.replace(/"/g, '&quot;');

            return `
                <tr class="hover:bg-blue-50/50 transition-colors cursor-pointer group" onclick="openTaskDetailById('${task.id}')">
                    <td class="py-3 px-4 text-slate-800 w-1/3 max-w-xs">
                        <div class="font-medium flex items-center flex-wrap gap-1">
                            <span>${task.title || "(제목 없음)"}</span>
                            ${task.folder === "urgent_important" ? '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">긴급</span>' : ''}
                        </div>
                        <div class="text-xs text-slate-400 mt-1 truncate" title="${safeDescTooltip}">
                            ${plainDesc}
                        </div>
                    </td>
                    <td class="py-3 px-4">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${statusClass}">
                            ${statusText}
                        </span>
                    </td>
                    <td class="py-3 px-4 text-slate-600">${deliveryStr}</td>
                    <td class="py-3 px-4 text-slate-600 font-semibold">${completedStr}</td>
                    <td class="py-3 px-4 text-slate-600">${task.assignee || "-"}</td>
                    <td class="py-3 px-4">
                        <span class="inline-flex items-center px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-600 text-xs">
                            ${folderText}
                        </span>
                    </td>
                </tr>
            `;
        }).join("");
    }
    window.renderAllTasksView = renderAllTasksView;

    window.openTaskDetailById = function(id) {
        const task = state.orders.find(o => o.id === id);
        if (task) window.openTaskDetail(task);
    };

    document.getElementById("all-tasks-search")?.addEventListener("input", () => {
        if (state.activeView === "all-tasks") renderAllTasksView();
    });

    ["all-tasks-filter-status", "all-tasks-filter-assignee", "all-tasks-filter-folder"].forEach(id => {
        document.getElementById(id)?.addEventListener("change", () => {
            if (state.activeView === "all-tasks") renderAllTasksView();
        });
    });

    document.getElementById("btn-export-csv")?.addEventListener("click", () => {
        if (!state.orders || state.orders.length === 0) {
            showToast("다운로드할 데이터가 없습니다.", "warning");
            return;
        }
        
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
        csvContent += "업무명,상태,기한,완료일,담당자,분류,부서,우선순위,내용\n";
        
        state.orders.forEach(task => {
            const statusLabels = {
                "inbox": "수신함", "todo": "실행 대기", "inprogress": "진행 중", 
                "waiting": "회신 대기", "done": "완료", "completed": "완료",
                "in_progress": "진행 중", "pending_approval": "결재 대기"
            };
            const folderLabels = {
                "none": "미분류", "projects": "Projects", "areas": "Areas",
                "resources": "Resources", "archives": "Archives"
            };
            const statusText = statusLabels[task.status] || task.status || "미지정";
            const folderText = folderLabels[task.folder] || task.folder || "미분류";
            const completedStr = task.completedAt ? new Date(task.completedAt).toLocaleString("ko-KR", { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' }) : "";
            const deliveryStr = task.deliveryDate || "";

            let plainDesc = task.description || "";
            if (plainDesc.trim().startsWith("{") && plainDesc.includes('"blocks"')) {
                try {
                    const parsed = JSON.parse(plainDesc);
                    if (parsed.blocks && Array.isArray(parsed.blocks)) {
                        plainDesc = parsed.blocks.map(b => b.data && b.data.text ? b.data.text : "").join("\n");
                    }
                } catch(e) { /* ignore parse error */ }
            }
            plainDesc = plainDesc.replace(/<[^>]*>?/gm, '').trim();
            
            const row = [
                `"${(task.title || "").replace(/"/g, '""')}"`,
                `"${statusText}"`,
                `"${deliveryStr}"`,
                `"${completedStr}"`,
                `"${task.assignee || ""}"`,
                `"${folderText}"`,
                `"${task.department || ""}"`,
                `"${task.priority || ""}"`,
                `"${plainDesc.replace(/"/g, '""')}"`
            ];
            csvContent += row.join(",") + "\n";
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `업무전체리스트_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // --- MINDMAP & VIEW TOGGLE LOGIC ---
    const btnViewList = document.getElementById("btn-view-list");
    const btnViewMindmap = document.getElementById("btn-view-mindmap");
    const viewListContainer = document.getElementById("view-list-container");
    const viewMindmapContainer = document.getElementById("view-mindmap-container");
    const subfoldersSection = document.getElementById("subfolders-section");
    let currentViewMode = 'list';

    if (btnViewList && btnViewMindmap) {
        btnViewList.addEventListener('click', () => {
            currentViewMode = 'list';
            btnViewList.classList.add('bg-white', 'shadow-sm', 'text-blue-600');
            btnViewList.classList.remove('text-slate-500', 'hover:text-slate-800');
            btnViewMindmap.classList.remove('bg-white', 'shadow-sm', 'text-blue-600');
            btnViewMindmap.classList.add('text-slate-500', 'hover:text-slate-800');

            // Restore normal header layout
            const headerContainer = document.getElementById("folder-header-container");
            if (headerContainer) {
                headerContainer.classList.add('sm:flex-row', 'sm:items-center', 'sm:justify-between', 'sm:space-y-0');
            }

            // Restore normal split container & list wrapper layout
            const splitContainer = document.getElementById("folder-view-split-container");
            if (splitContainer) {
                splitContainer.classList.remove('mindmap-active');
            }
            const listWrapper = document.getElementById("folder-list-wrapper");
            if (listWrapper) {
                listWrapper.classList.remove('flex-shrink-0');
            }

            // Restore grid to default responsive columns
            const gridRestore = document.getElementById('subfolders-list-grid');
            if (gridRestore) {
                gridRestore.classList.remove('grid-cols-1');
                gridRestore.classList.add('grid-cols-2', 'md:grid-cols-4');
            }

            viewListContainer.classList.remove('hidden');
            if (document.getElementById("subfolders-list-grid").innerHTML.trim() !== "") {
                subfoldersSection.classList.remove('hidden');
            }
            viewMindmapContainer.classList.add('hidden');
            viewMindmapContainer.classList.remove('flex');
        });

        btnViewMindmap.addEventListener('click', () => {
            currentViewMode = 'mindmap';
            btnViewMindmap.classList.add('bg-white', 'shadow-sm', 'text-blue-600');
            btnViewMindmap.classList.remove('text-slate-500', 'hover:text-slate-800');
            btnViewList.classList.remove('bg-white', 'shadow-sm', 'text-blue-600');
            btnViewList.classList.add('text-slate-500', 'hover:text-slate-800');

            // Wrap header into two lines
            const headerContainer = document.getElementById("folder-header-container");
            if (headerContainer) {
                headerContainer.classList.remove('sm:flex-row', 'sm:items-center', 'sm:justify-between', 'sm:space-y-0');
            }

            // Apply split layout classes
            const splitContainer = document.getElementById("folder-view-split-container");
            if (splitContainer) {
                splitContainer.classList.add('mindmap-active');
            }
            
            const listWrapper = document.getElementById("folder-list-wrapper");
            if (listWrapper) {
                listWrapper.classList.add('flex-shrink-0');
            }

            // In mindmap split mode, collapse grid to 1 column so cards fill full width
            const grid = document.getElementById('subfolders-list-grid');
            if (grid) {
                grid.classList.remove('grid-cols-2', 'md:grid-cols-4');
                grid.classList.add('grid-cols-1');
            }

            viewListContainer.classList.remove('hidden');
            if (grid && grid.innerHTML.trim() !== "") {
                subfoldersSection.classList.remove('hidden');
            }
            
            viewMindmapContainer.classList.remove('hidden');
            viewMindmapContainer.classList.add('flex');
            
            renderMindmap();
        });

        const btnMmClose = document.getElementById("btn-mm-close");
        if (btnMmClose) {
            btnMmClose.addEventListener('click', () => {
                btnViewList.click();
            });
        }
    }

    // --- D3 MINDMAP LOGIC ---
    let mindmapSvg, mindmapG, mindmapZoom, mindmapRoot;
    let mindmapDx = 40, mindmapDy = 200;
    let lastExplorerPathForMindmap = null;

    function buildFolderTreeForMindmap() {
        const rootPath = state.currentExplorerPath || "";
        const rootName = rootPath === "" ? "Root" : rootPath.split('/').pop();
        const displayName = rootName;
        
        const root = { name: displayName, children: [], relativePath: rootPath, isRoot: true };
        const foldersMap = { [rootPath]: root };
        
        // 1. Build folder nodes
        const foldersList = state.folders || [];
        const sortedFolders = [...foldersList]
            .filter(f => rootPath === "" || f.relativePath === rootPath || f.relativePath.startsWith(rootPath + '/'))
            .sort((a, b) => a.relativePath.split('/').length - b.relativePath.split('/').length);

        sortedFolders.forEach(folder => {
            if (folder.relativePath === rootPath) return; // Skip the root itself
            
            const relativeToRoot = rootPath === "" ? folder.relativePath : folder.relativePath.substring(rootPath.length + 1);
            const pathParts = relativeToRoot.split('/');
            
            let currentPath = rootPath;
            let parentNode = root;

            pathParts.forEach((part, i) => {
                const pathSoFar = currentPath ? currentPath + '/' + part : part;
                
                if (!foldersMap[pathSoFar]) {
                    const newNode = { 
                        name: part, 
                        relativePath: pathSoFar, 
                        children: []
                    };
                    parentNode.children.push(newNode);
                    foldersMap[pathSoFar] = newNode;
                }
                
                parentNode = foldersMap[pathSoFar];
                currentPath = pathSoFar;
            });
        });

        // 2. Build file nodes under parent folders
        const filesList = state.files || [];
        filesList.forEach(file => {
            const fileFolder = file.folder || "";
            const isUnderRoot = (rootPath === "") || (fileFolder === rootPath) || fileFolder.startsWith(rootPath + '/');
            if (!isUnderRoot) return;

            const parentNode = (fileFolder === rootPath) ? root : foldersMap[fileFolder];
            if (parentNode) {
                const fileNode = {
                    id: file.id,
                    name: file.name,
                    relativePath: fileFolder ? `${fileFolder}/${file.name}` : file.name,
                    isFile: true,
                    extension: file.extension,
                    size: file.size
                };
                if (!parentNode.children) {
                    parentNode.children = [];
                }
                parentNode.children.push(fileNode);
            }
        });

        return root;
    }

    function getMindmapNodeStates() {
        const states = {};
        if (!mindmapRoot) return states;
        mindmapRoot.each(d => {
            if (d.data && d.data.relativePath) {
                const isCollapsed = !d.children && d._children ? true : false;
                states[d.data.relativePath] = isCollapsed;
            }
        });
        return states;
    }

    function applyNodeState(d, previousStates) {
        const path = d.data.relativePath;
        if (path && previousStates[path] !== undefined) {
            const isCollapsed = previousStates[path];
            if (isCollapsed && d.children) {
                d._children = d.children;
                d.children = null;
            } else if (!isCollapsed && d._children) {
                d.children = d._children;
                d._children = null;
            }
        } else {
            const depth = path ? path.split('/').length : 0;
            if (depth > 1 && d.children) {
                d._children = d.children;
                d.children = null;
            }
        }
        const childrenList = d.children || d._children;
        if (childrenList) {
            childrenList.forEach(child => applyNodeState(child, previousStates));
        }
    }

    window.renderMindmap = function() {
        if (currentViewMode !== 'mindmap') return;
        
        const container = document.getElementById("mindmap-svg-container");
        if (!container) return;
        
        const currentPath = state.currentExplorerPath || "";
        
        // Preserve previous zoom transform (only if browsing same path)
        let savedTransform = null;
        if (lastExplorerPathForMindmap === currentPath && mindmapSvg && mindmapSvg.node()) {
            try {
                savedTransform = d3.zoomTransform(mindmapSvg.node());
            } catch (e) {}
        }
        
        const previousStates = lastExplorerPathForMindmap === currentPath ? getMindmapNodeStates() : {};
        lastExplorerPathForMindmap = currentPath;
        
        container.innerHTML = "";
        
        const width = container.clientWidth;
        const height = container.clientHeight;

        mindmapZoom = d3.zoom()
            .scaleExtent([0.1, 3])
            .on("zoom", (e) => mindmapG.attr("transform", e.transform));

        mindmapSvg = d3.select("#mindmap-svg-container")
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .call(mindmapZoom)
            .on("dblclick.zoom", null);

        mindmapG = mindmapSvg.append("g");

        const treeData = buildFolderTreeForMindmap();
        mindmapRoot = d3.hierarchy(treeData);
        mindmapRoot.x0 = height / 2;
        mindmapRoot.y0 = 0;

        applyNodeState(mindmapRoot, previousStates);

        updateMindmap(mindmapRoot);
        
        // Restore zoom state if exists, otherwise fit to screen
        if (savedTransform) {
            mindmapSvg.call(mindmapZoom.transform, savedTransform);
        } else {
            setTimeout(() => fitMindmapToScreen(), 100);
        }
    };

    function collapseAll(d) {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(collapseAll);
            d.children = null;
        }
    }

    function expandAll(d) {
        if (d._children) {
            d.children = d._children;
            d._children = null;
        }
        if (d.children) {
            d.children.forEach(expandAll);
        }
    }

    function updateMindmap(source) {
        if (!mindmapG || !mindmapSvg) return;

        const tree = d3.tree().nodeSize([mindmapDx, mindmapDy]);
        const nodes = tree(mindmapRoot);
        
        const desc = mindmapRoot.descendants();
        const links = mindmapRoot.links();

        let left = mindmapRoot;
        let right = mindmapRoot;
        mindmapRoot.eachBefore(node => {
            if (node.x < left.x) left = node;
            if (node.x > right.x) right = node;
        });

        const transition = mindmapSvg.transition().duration(500);

        const node = mindmapG.selectAll("g.node")
            .data(desc, d => d.data.relativePath || "root");

        const nodeEnter = node.enter().append("g")
            .attr("class", "node")
            .attr("transform", d => `translate(${source.y0},${source.x0})`)
            .attr("fill-opacity", 0)
            .attr("stroke-opacity", 0)
            .style("cursor", "pointer")
            .on("click", (event, d) => {
                if (d.data.isFile) {
                    if (d.data.id && typeof openFileDetailModal === "function") {
                        openFileDetailModal(d.data.id);
                    }
                    return;
                }
                if (d.children) {
                    d._children = d.children;
                    d.children = null;
                } else {
                    d.children = d._children;
                    d._children = null;
                }
                updateMindmap(d);
            });

        nodeEnter.append("circle")
            .attr("r", d => d.data.isFile ? 4.5 : 6)
            .attr("fill", d => {
                if (d.data.isFile) return "#ffffff";
                if (d.data.isRoot) return "#3b82f6";
                if (d.data.relativePath.startsWith("0_")) return "#3b82f6";
                if (d.data.relativePath.startsWith("1_")) return "#10b981";
                if (d.data.relativePath.startsWith("2_")) return "#f59e0b";
                if (d.data.relativePath.startsWith("3_")) return "#64748b";
                return "#94a3b8";
            })
            .attr("stroke-width", d => d.data.isFile ? 1.5 : 2)
            .attr("stroke", d => {
                if (d.data.isFile) return "#8b5cf6";
                return d._children ? "#1e293b" : "white";
            });

        nodeEnter.append("text")
            .attr("dy", "0.31em")
            .attr("x", d => d._children ? -8 : 8)
            .attr("text-anchor", d => d._children ? "end" : "start")
            .text(d => d.data.isFile ? "📄 " + d.data.name : d.data.name)
            .attr("fill", d => d.data.isFile ? "#6b7280" : "#334155")
            .attr("font-size", "12px")
            .attr("font-weight", d => d.data.isRoot ? "bold" : "normal");

        const nodeUpdate = node.merge(nodeEnter).transition(transition)
            .attr("transform", d => `translate(${d.y},${d.x})`)
            .attr("fill-opacity", 1)
            .attr("stroke-opacity", 1);
            
        nodeUpdate.select("circle")
            .attr("stroke", d => d._children ? "#1e293b" : "white");

        nodeUpdate.select("text")
            .attr("x", d => d._children ? -8 : 8)
            .attr("text-anchor", d => d._children ? "end" : "start");

        const nodeExit = node.exit().transition(transition).remove()
            .attr("transform", d => `translate(${source.y},${source.x})`)
            .attr("fill-opacity", 0)
            .attr("stroke-opacity", 0);

        const link = mindmapG.selectAll("path.link")
            .data(links, d => d.target.data.relativePath);

        const linkEnter = link.enter().insert("path", "g")
            .attr("class", "link")
            .attr("fill", "none")
            .attr("stroke", "#cbd5e1")
            .attr("stroke-width", 1.5)
            .attr("d", d => {
                const o = {x: source.x0, y: source.y0};
                return diagonal({source: o, target: o});
            });

        link.merge(linkEnter).transition(transition)
            .attr("d", diagonal);

        link.exit().transition(transition).remove()
            .attr("d", d => {
                const o = {x: source.x, y: source.y};
                return diagonal({source: o, target: o});
            });

        desc.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    function diagonal(d) {
        return `M${d.target.y},${d.target.x}
                C${(d.source.y + d.target.y) / 2},${d.target.x}
                 ${(d.source.y + d.target.y) / 2},${d.source.x}
                 ${d.source.y},${d.source.x}`;
    }

    function fitMindmapToScreen() {
        if (!mindmapSvg || !mindmapG || !mindmapRoot) return;
        const container = document.getElementById("mindmap-svg-container");
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 500;
        
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        mindmapRoot.descendants().forEach(d => {
            // In D3 tree, d.x is vertical, d.y is horizontal
            if (d.x < minX) minX = d.x;
            if (d.x > maxX) maxX = d.x;
            if (d.y < minY) minY = d.y;
            if (d.y > maxY) maxY = d.y;
        });

        // If tree is collapsed to root
        if (minX === Infinity) {
            minX = 0; maxX = 0; minY = 0; maxY = 0;
        }

        // Add padding (extra right padding for text)
        minX -= 40; maxX += 40;
        minY -= 40; maxY += 150; 
        
        const fullWidth = maxY - minY || 1;
        const fullHeight = maxX - minX || 1;
        const scale = Math.min(width / fullWidth, height / fullHeight, 1.5) * 0.9;
        
        const midX = minY + fullWidth / 2;
        const midY = minX + fullHeight / 2;
        
        const transform = d3.zoomIdentity
            .translate(width / 2 - scale * midX, height / 2 - scale * midY)
            .scale(scale);
            
        mindmapSvg.transition().duration(750).call(mindmapZoom.transform, transform);
    }

    const btnExpandAll = document.getElementById("btn-mm-expand-all");
    const btnCollapseAll = document.getElementById("btn-mm-collapse-all");
    const btnZoomIn = document.getElementById("btn-mm-zoom-in");
    const btnZoomOut = document.getElementById("btn-mm-zoom-out");
    const btnFit = document.getElementById("btn-mm-fit");

    if (btnExpandAll) {
        btnExpandAll.addEventListener("click", () => {
            if (mindmapRoot) { expandAll(mindmapRoot); updateMindmap(mindmapRoot); }
        });
    }
    if (btnCollapseAll) {
        btnCollapseAll.addEventListener("click", () => {
            if (mindmapRoot && mindmapRoot.children) {
                mindmapRoot.children.forEach(collapseAll);
                updateMindmap(mindmapRoot);
                setTimeout(fitMindmapToScreen, 500);
            }
        });
    }
    if (btnZoomIn) {
        btnZoomIn.addEventListener("click", () => {
            if (mindmapSvg) mindmapSvg.transition().call(mindmapZoom.scaleBy, 1.3);
        });
    }
    if (btnZoomOut) {
        btnZoomOut.addEventListener("click", () => {
            if (mindmapSvg) mindmapSvg.transition().call(mindmapZoom.scaleBy, 0.7);
        });
    }
    if (btnFit) {
        btnFit.addEventListener("click", fitMindmapToScreen);
    }

} catch(err) {
    console.error('[WorkHub Critical Error] DOMContentLoaded 블록에서 오류 발생:', err);
    // 에러 발생 시 화면에 알림 표시
    const errDiv = document.createElement('div');
    errDiv.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#ef4444;color:white;padding:12px 24px;border-radius:8px;z-index:9999;font-family:monospace;font-size:13px;max-width:90vw;word-break:break-all;';
    errDiv.innerHTML = '<strong>[앱 오류]</strong> ' + err.message + '<br><small>' + (err.stack || '').split('\n')[1] + '</small>';
    document.body.appendChild(errDiv);
}
});

// --- Network Members & Selector Logic ---
window.updateNetworkMembersDropdown = function() {
    const selector = document.getElementById("network-task-selector");
    if (!selector) return;
    
    const currentValue = selector.value;
    selector.innerHTML = `
        <option value="local">내 업무 (Local)</option>
        <option value="network_all">부서 전체 공유 (Shared)</option>
    `;
    (state.networkMembers || []).forEach(member => {
        const opt = document.createElement("option");
        opt.value = `network_user:${member}`;
        opt.textContent = `${member} (Shared)`;
        selector.appendChild(opt);
    });
    
    if (Array.from(selector.options).some(o => o.value === currentValue)) {
        selector.value = currentValue;
    } else {
        selector.value = "local";
        state.isNetworkView = false;
        state.networkAssignee = null;
    }
};

document.getElementById("btn-add-network-member")?.addEventListener("click", async () => {
    const name = prompt("추가할 부서원 이름을 입력하세요 (예: 홍길동):");
    if (!name || name.trim() === '') return;
    const trimmed = name.trim();
    if ((state.networkMembers || []).includes(trimmed)) return;
    
    if (!state.networkMembers) state.networkMembers = [];
    state.networkMembers.push(trimmed);
    
    try {
        await fetch('/api/network_members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ members: state.networkMembers })
        });
        updateNetworkMembersDropdown();
        showToast("부서원이 추가되었습니다.", "success");
    } catch (e) {
        console.error("Failed to add network member:", e);
    }
});

document.getElementById("network-task-selector")?.addEventListener("change", async (e) => {
    const val = e.target.value;
    if (val === "local") {
        state.isNetworkView = false;
        state.networkAssignee = null;
    } else if (val === "network_all") {
        state.isNetworkView = true;
        state.networkAssignee = null;
    } else if (val.startsWith("network_user:")) {
        state.isNetworkView = true;
        state.networkAssignee = val.split(":")[1];
    }
    
    const qcInput = document.getElementById("quick-capture-input");
    const aiBtn = document.getElementById("btn-ai-smart-capture");
    if (qcInput) qcInput.disabled = state.isNetworkView;
    if (aiBtn) aiBtn.disabled = state.isNetworkView;
    
    try {
        let url = `${API_BASE}/tasks`;
        if (state.isNetworkView) {
            url += `?source=network`;
            if (state.networkAssignee) {
                url += `&assignee=${encodeURIComponent(state.networkAssignee)}`;
            }
        }
        const resTasks = await fetch(url).then(r => r.json());
        state.orders = resTasks;
        
        updateStats();
        if (typeof renderKanbanBoard === "function") renderKanbanBoard();
        if (typeof renderAllTasksView === "function") renderAllTasksView();
        
        showToast(state.isNetworkView ? "네트워크 업무를 불러왔습니다. (읽기 전용)" : "내 업무를 불러왔습니다.", "info");
    } catch (err) {
        console.error("Failed to fetch tasks for selector:", err);
        showToast("데이터를 불러오는데 실패했습니다.", "error");
    }
});

// -------------------------------------------------------------
// 12. AI CHAT (Gemini)
// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    const aiInput = document.getElementById("ai-chat-input");
    const aiSendBtn = document.getElementById("btn-ai-send");
    const aiHistory = document.getElementById("ai-chat-history");
    const aiLoading = document.getElementById("ai-chat-loading");
    const aiPlaceholder = document.getElementById("ai-chat-placeholder");
    
    let chatHistory = [];

    if(!aiInput || !aiSendBtn || !aiHistory) return;

    aiInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendAiMessage();
        }
    });

    aiSendBtn.addEventListener("click", sendAiMessage);

    aiInput.addEventListener("input", function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    async function sendAiMessage() {
        const text = aiInput.value.trim();
        if (!text) return;

        if(aiPlaceholder) aiPlaceholder.style.display = 'none';

        appendMessage("user", text);
        aiInput.value = "";
        aiInput.style.height = "auto";
        aiSendBtn.disabled = true;

        // Show typing indicator in chat history
        let loadingMsgDiv = document.createElement("div");
        loadingMsgDiv.className = "flex gap-4 w-full justify-start animate-fade-in";
        loadingMsgDiv.innerHTML = `
            <div class="flex-shrink-0 mt-1">
                <i class="fa-solid fa-sparkles text-indigo-300 text-xl animate-pulse"></i>
            </div>
            <div class="text-slate-500 text-[15px] flex items-center h-7 font-medium animate-pulse">답변을 생각하는 중입니다...</div>
        `;
        aiHistory.appendChild(loadingMsgDiv);
        aiHistory.scrollTop = aiHistory.scrollHeight;

        try {
            const scopeSelect = document.getElementById("ai-context-scope");
            const contextScope = scopeSelect ? scopeSelect.value : "tasks";
            
            const res = await fetch("/api/ai-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text, history: chatHistory, scope: contextScope })
            });
            const data = await res.json();
            
            loadingMsgDiv.remove();
            aiSendBtn.disabled = false;

            if (data.error) {
                appendMessage("system", "오류: " + data.error);
            } else {
                chatHistory.push({ role: "user", parts: text });
                chatHistory.push({ role: "model", parts: data.text });
                appendMessage("ai", data.text);
            }
        } catch (err) {
            loadingMsgDiv.remove();
            aiSendBtn.disabled = false;
            appendMessage("system", "네트워크 오류가 발생했습니다.");
        }
    }

    function appendMessage(role, text) {
        const msgDiv = document.createElement("div");
        msgDiv.className = "flex gap-4 w-full " + (role === "user" ? "justify-end" : "justify-start");
        
        if (role === "user") {
            let safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            msgDiv.innerHTML = `
                <div class="bg-[#f1f3f4] text-slate-800 rounded-3xl px-5 py-3 max-w-[85%] text-[15px] whitespace-pre-wrap">${safeText}</div>
            `;
        } else if (role === "system") {
             msgDiv.innerHTML = `
                <div class="bg-red-50 text-red-600 border border-red-100 rounded-[24px] px-6 py-3 max-w-[85%] text-[15px] mx-auto shadow-sm">${text}</div>
            `;
        } else {
            let contentHtml = window.marked ? marked.parse(text) : text.replace(/\n/g, '<br>');
            msgDiv.innerHTML = `
                <div class="flex-shrink-0 mt-1">
                    <i class="fa-solid fa-sparkles text-indigo-500 text-xl"></i>
                </div>
                <div class="text-slate-800 max-w-full text-[15px] leading-relaxed markdown-body w-full overflow-hidden">${contentHtml}</div>
            `;
        }
        
        aiHistory.appendChild(msgDiv);
        aiHistory.scrollTop = aiHistory.scrollHeight;
    }
// ===== END OF AI CHAT LISTENER =====
});

// =========================================================================
// RECURRING TASKS LOGIC
// (독립 블록 - window._workHubState / window.openModal 사용)
// =========================================================================

window.openRecurringTasksModal = function() {
    window.renderRecurringKanban();
    if (window.openModal) {
        window.openModal("modal-recurring-tasks");
    }
};

window.closeRecurringTasksModal = function() {
    if (window.closeModal) {
        window.closeModal("modal-recurring-tasks");
    }
};

window.renderRecurringKanban = function() {
    const state = window._workHubState;
    if (!state) return;
    const columns = ['daily', 'weekly', 'monthly', 'yearly', 'adhoc'];
    columns.forEach(col => {
        const el = document.getElementById(`col-rt-${col}`);
        if (el) el.innerHTML = '';
    });

    // Badge update
    const count = state.recurringTasks ? state.recurringTasks.length : 0;
    const badge1 = document.getElementById('badge-recurring');
    if (badge1) badge1.textContent = count;

    (state.recurringTasks || []).forEach(task => {
        const colEl = document.getElementById(`col-rt-${task.type}`);
        if (!colEl) return;

        let cycleText = "설정 없음";
        if (task.cycle) {
            if (task.type === 'daily') cycleText = `매일 ${task.cycle.time || ''}`;
            if (task.type === 'weekly') cycleText = `${(task.cycle.days || []).join(',')} ${task.cycle.time || ''}`;
            if (task.type === 'monthly') cycleText = `매월 ${task.cycle.date}일 ${task.cycle.time || ''}`;
            if (task.type === 'yearly') cycleText = `매년 ${task.cycle.month}월 ${task.cycle.date}일 ${task.cycle.time || ''}`;
            if (task.type === 'adhoc') cycleText = `특정일: ${task.cycle.date || ''} ${task.cycle.time || ''}`;
        }

        const html = `
            <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative group flex flex-col gap-2"
                 onclick="openRecurringTaskDetailModal('${task.id}')" draggable="true" ondragstart="dragRt(event, '${task.id}')">
                <div class="flex justify-between items-start">
                    <span class="font-bold text-sm text-slate-800 line-clamp-2">${task.title}</span>
                    ${!task.isActive ? '<span class="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold">완료</span>' : ''}
                </div>
                <div class="text-xs text-indigo-600 font-medium flex items-center gap-1">
                    <i class="fa-regular fa-clock"></i> ${cycleText}
                </div>
                ${task.endDate ? `<div class="text-[10px] text-slate-400">종료일: ${task.endDate}</div>` : ''}
            </div>
        `;
        colEl.insertAdjacentHTML('beforeend', html);
    });

    // Drag and drop setup
    columns.forEach(col => {
        const el = document.getElementById(`col-rt-${col}`);
        if (!el) return;
        el.ondragover = (e) => { e.preventDefault(); el.classList.add('bg-indigo-50/50', 'border-indigo-200'); };
        el.ondragleave = () => { el.classList.remove('bg-indigo-50/50', 'border-indigo-200'); };
        el.ondrop = (e) => {
            e.preventDefault();
            el.classList.remove('bg-indigo-50/50', 'border-indigo-200');
            const s = window._workHubState;
            const taskId = e.dataTransfer.getData("text");
            const task = (s.recurringTasks || []).find(t => t.id === taskId);
            if (task && task.type !== col) {
                task.type = col;
                task.cycle = { time: "09:00" };
                if (window.syncData) window.syncData('recurringTasks', s.recurringTasks);
                window.renderRecurringKanban();
            }
        };
    });
};

window.dragRt = function(ev, id) {
    ev.dataTransfer.setData("text", id);
};

window.handleNewRecurringTaskSubmit = function(e) {
    e.preventDefault();
    const state = window._workHubState;
    if (!state) return;
    const input = document.getElementById("new-recurring-task-input");
    const title = input.value.trim();
    if (!title) return;

    if (!state.recurringTasks) state.recurringTasks = [];
    const newTask = {
        id: 'rt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        title: title,
        type: 'daily',
        cycle: { time: '09:00' },
        endDate: '',
        isActive: true,
        lastGenerated: null
    };
    state.recurringTasks.push(newTask);
    if (window.syncData) window.syncData('recurringTasks', state.recurringTasks);
    input.value = "";
    window.renderRecurringKanban();
};

window.openRecurringTaskDetailModal = function(taskId) {
    const state = window._workHubState;
    if (!state) return;
    const task = (state.recurringTasks || []).find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('rt-detail-id').value = task.id;
    document.getElementById('rt-detail-title').value = task.title;
    document.getElementById('rt-detail-type').value = task.type;
    document.getElementById('rt-detail-enddate').value = task.endDate || '';

    ['daily', 'weekly', 'monthly', 'yearly', 'adhoc'].forEach(t => document.getElementById(`rt-setup-${t}`).classList.add('hidden'));
    document.getElementById(`rt-setup-${task.type}`).classList.remove('hidden');

    const c = task.cycle || {};
    if (task.type === 'daily') {
        document.getElementById('rt-time-daily').value = c.time || '09:00';
    } else if (task.type === 'weekly') {
        document.getElementById('rt-time-weekly').value = c.time || '09:00';
        const checkboxes = document.querySelectorAll('#rt-days-weekly input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = (c.days || []).includes(cb.value));
    } else if (task.type === 'monthly') {
        document.getElementById('rt-time-monthly').value = c.time || '09:00';
        document.getElementById('rt-date-monthly').value = c.date || 1;
    } else if (task.type === 'yearly') {
        document.getElementById('rt-time-yearly').value = c.time || '09:00';
        document.getElementById('rt-month-yearly').value = c.month || 1;
        document.getElementById('rt-date-yearly').value = c.date || 1;
    } else if (task.type === 'adhoc') {
        document.getElementById('rt-date-adhoc').value = c.date || '';
        document.getElementById('rt-time-adhoc').value = c.time || '09:00';
    }

    if (window.openModal) window.openModal("modal-recurring-task-detail");
};

window.closeRecurringTaskDetailModal = function() {
    if (window.closeModal) window.closeModal("modal-recurring-task-detail");
};

window.updateRtDetailCycleUI = function() {
    const type = document.getElementById('rt-detail-type').value;
    ['daily', 'weekly', 'monthly', 'yearly', 'adhoc'].forEach(t => document.getElementById(`rt-setup-${t}`).classList.add('hidden'));
    document.getElementById(`rt-setup-${type}`).classList.remove('hidden');
};

window.saveRecurringTaskDetail = function() {
    const state = window._workHubState;
    if (!state) return;
    const taskId = document.getElementById('rt-detail-id').value;
    const task = (state.recurringTasks || []).find(t => t.id === taskId);
    if (!task) return;

    task.title = document.getElementById('rt-detail-title').value;
    task.type = document.getElementById('rt-detail-type').value;
    task.endDate = document.getElementById('rt-detail-enddate').value;

    let c = {};
    if (task.type === 'daily') {
        c.time = document.getElementById('rt-time-daily').value;
    } else if (task.type === 'weekly') {
        c.time = document.getElementById('rt-time-weekly').value;
        const checks = document.querySelectorAll('#rt-days-weekly input[type="checkbox"]:checked');
        c.days = Array.from(checks).map(cb => cb.value);
    } else if (task.type === 'monthly') {
        c.time = document.getElementById('rt-time-monthly').value;
        c.date = document.getElementById('rt-date-monthly').value;
    } else if (task.type === 'yearly') {
        c.time = document.getElementById('rt-time-yearly').value;
        c.month = document.getElementById('rt-month-yearly').value;
        c.date = document.getElementById('rt-date-yearly').value;
    } else if (task.type === 'adhoc') {
        c.time = document.getElementById('rt-time-adhoc').value;
        c.date = document.getElementById('rt-date-adhoc').value;
    }
    task.cycle = c;

    if (window.syncData) window.syncData('recurringTasks', state.recurringTasks);
    window.closeRecurringTaskDetailModal();
    window.renderRecurringKanban();
    if (window.showToast) window.showToast("반복 업무가 저장되었습니다.", "success");
};

window.deleteRecurringTask = function() {
    if (!confirm("정말 이 반복 업무를 삭제하시겠습니까?")) return;
    const state = window._workHubState;
    if (!state) return;
    const taskId = document.getElementById('rt-detail-id').value;
    state.recurringTasks = (state.recurringTasks || []).filter(t => t.id !== taskId);
    if (window.syncData) window.syncData('recurringTasks', state.recurringTasks);
    window.closeRecurringTaskDetailModal();
    window.renderRecurringKanban();
};

// 자동 생성 백그라운드 체크 (1분마다)
setInterval(() => {
    const state = window._workHubState;
    if (!state || !state.recurringTasks || state.recurringTasks.length === 0) return;

    const now = new Date();
    const currentDateStr = now.toISOString().split('T')[0];
    const currentHourMin = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const currentDay = dayNames[now.getDay()];
    let hasChanges = false;
    let generatedCount = 0;

    state.recurringTasks.forEach(task => {
        if (!task.isActive) return;
        if (task.endDate && task.endDate < currentDateStr) {
            task.isActive = false;
            hasChanges = true;
            return;
        }
        const c = task.cycle || {};
        if (!c.time) return;

        let shouldGenerate = false;
        let currentSlotKey = null;

        if (task.type === 'daily') {
            currentSlotKey = currentDateStr;
            if (currentHourMin >= c.time) shouldGenerate = true;
        } else if (task.type === 'weekly') {
            if (c.days && c.days.includes(currentDay)) {
                currentSlotKey = currentDateStr;
                if (currentHourMin >= c.time) shouldGenerate = true;
            }
        } else if (task.type === 'monthly') {
            if (now.getDate() === parseInt(c.date)) {
                currentSlotKey = currentDateStr;
                if (currentHourMin >= c.time) shouldGenerate = true;
            }
        } else if (task.type === 'yearly') {
            if ((now.getMonth() + 1) === parseInt(c.month) && now.getDate() === parseInt(c.date)) {
                currentSlotKey = currentDateStr;
                if (currentHourMin >= c.time) shouldGenerate = true;
            }
        } else if (task.type === 'adhoc') {
            if (c.date === currentDateStr) {
                currentSlotKey = currentDateStr;
                if (currentHourMin >= c.time) {
                    shouldGenerate = true;
                    task.isActive = false;
                }
            }
        }

        if (shouldGenerate && currentSlotKey && task.lastGenerated !== currentSlotKey) {
            const existingOrder = state.orders.find(o => o.title === task.title);
            if (existingOrder) {
                existingOrder.status = 'inbox';
                if (existingOrder.completedAt) {
                    delete existingOrder.completedAt;
                }
                existingOrder.deliveryDate = currentDateStr;
            } else {
                const newOrder = {
                    id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    title: task.title,
                    status: 'inbox',
                    folder: 'not_urgent_not_important',
                    assignee: task.assignee || '담당자 미정',
                    description: task.description || '',
                    deliveryDate: currentDateStr,
                    timeline: [],
                    isRecurringInstance: true
                };
                state.orders.unshift(newOrder);
            }
            task.lastGenerated = currentSlotKey;
            hasChanges = true;
            generatedCount++;
        }
    });

    if (hasChanges) {
        if (window.syncData) window.syncData('recurringTasks', state.recurringTasks);
        if (window.syncData) window.syncData('orders', state.orders);
        if (window.renderKanbanBoard) window.renderKanbanBoard();
        if (generatedCount > 0 && window.showToast) {
            window.showToast(`반복 업무 ${generatedCount}건이 수신함에 자동 등록되었습니다.`, "success");
        }
    }
}, 60000);
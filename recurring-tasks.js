// =========================================================================
// recurring-tasks.js
// 반복 업무 관리 모듈 - 완전히 독립된 파일
// window._workHubState / window.openModal / window.closeModal 에 의존
// =========================================================================

window.openRecurringTasksModal = function() {
    window.renderRecurringKanban();
    if (window.openModal) window.openModal("modal-recurring-tasks");
};

window.closeRecurringTasksModal = function() {
    if (window.closeModal) window.closeModal("modal-recurring-tasks");
};

window.renderRecurringKanban = function() {
    const state = window._workHubState;
    if (!state) return;
    const columns = ['daily', 'weekly', 'monthly', 'yearly', 'adhoc'];
    columns.forEach(col => {
        const el = document.getElementById(`col-rt-${col}`);
        if (el) el.innerHTML = '';
    });

    const count = (state.recurringTasks || []).length;
    const badge = document.getElementById('badge-recurring');
    if (badge) badge.textContent = count;

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

        colEl.insertAdjacentHTML('beforeend', `
            <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col gap-2"
                 onclick="openRecurringTaskDetailModal('${task.id}')" draggable="true" ondragstart="dragRt(event,'${task.id}')">
                <div class="flex justify-between items-start">
                    <span class="font-bold text-sm text-slate-800 line-clamp-2">${task.title}</span>
                    ${!task.isActive ? '<span class="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold">완료</span>' : ''}
                </div>
                <div class="text-xs text-indigo-600 font-medium flex items-center gap-1">
                    <i class="fa-regular fa-clock"></i> ${cycleText}
                </div>
                ${task.endDate ? `<div class="text-[10px] text-slate-400">종료일: ${task.endDate}</div>` : ''}
            </div>
        `);
    });

    columns.forEach(col => {
        const el = document.getElementById(`col-rt-${col}`);
        if (!el) return;
        el.ondragover = (e) => { e.preventDefault(); el.classList.add('bg-indigo-50/50'); };
        el.ondragleave = () => { el.classList.remove('bg-indigo-50/50'); };
        el.ondrop = (e) => {
            e.preventDefault();
            el.classList.remove('bg-indigo-50/50');
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
    state.recurringTasks.push({
        id: 'rt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        title, type: 'daily', cycle: { time: '09:00' },
        endDate: '', isActive: true, lastGenerated: null
    });
    if (window.syncData) window.syncData('recurringTasks', state.recurringTasks);
    input.value = "";
    window.renderRecurringKanban();
};

window.openRecurringTaskDetailModal = function(taskId, defaultTitle = '') {
    const state = window._workHubState;
    if (!state) return;
    
    let task = { id: '', title: defaultTitle, type: 'daily', endDate: '', cycle: { time: '09:00' } };
    
    if (taskId) {
        const existing = (state.recurringTasks || []).find(t => t.id === taskId);
        if (existing) task = existing;
    }

    document.getElementById('rt-detail-id').value = task.id;
    document.getElementById('rt-detail-title').value = task.title;
    document.getElementById('rt-detail-type').value = task.type;
    document.getElementById('rt-detail-enddate').value = task.endDate || '';

    ['daily','weekly','monthly','yearly','adhoc'].forEach(t =>
        document.getElementById(`rt-setup-${t}`).classList.add('hidden'));
    document.getElementById(`rt-setup-${task.type}`).classList.remove('hidden');

    const c = task.cycle || {};
    if (task.type === 'daily') { document.getElementById('rt-time-daily').value = c.time || '09:00'; }
    else if (task.type === 'weekly') {
        document.getElementById('rt-time-weekly').value = c.time || '09:00';
        document.querySelectorAll('#rt-days-weekly input[type="checkbox"]')
            .forEach(cb => cb.checked = (c.days || []).includes(cb.value));
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
    ['daily','weekly','monthly','yearly','adhoc'].forEach(t =>
        document.getElementById(`rt-setup-${t}`).classList.add('hidden'));
    document.getElementById(`rt-setup-${type}`).classList.remove('hidden');
};

window.saveRecurringTaskDetail = function() {
    const state = window._workHubState;
    if (!state) return;
    const taskId = document.getElementById('rt-detail-id').value;
    
    let task = null;
    let isNew = false;
    
    if (taskId) {
        task = (state.recurringTasks || []).find(t => t.id === taskId);
    } else {
        isNew = true;
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        task = {
            id: 'rt_' + Date.now() + '_' + Math.random().toString(36).substr(2,5),
            isActive: true,
            lastGenerated: dateStr // Prevent immediate duplication for today
        };
        if (!state.recurringTasks) state.recurringTasks = [];
    }
    
    if (!task && !isNew) return;

    task.title = document.getElementById('rt-detail-title').value;
    task.type = document.getElementById('rt-detail-type').value;
    task.endDate = document.getElementById('rt-detail-enddate').value;

    let c = {};
    if (task.type === 'daily') { c.time = document.getElementById('rt-time-daily').value; }
    else if (task.type === 'weekly') {
        c.time = document.getElementById('rt-time-weekly').value;
        c.days = Array.from(document.querySelectorAll('#rt-days-weekly input:checked')).map(cb => cb.value);
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
    task.lastGenerated = null;
    
    if (isNew) {
        state.recurringTasks.push(task);
    }

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

// 자동 생성 (1분마다)
setInterval(() => {
    const state = window._workHubState;
    if (!state || !(state.recurringTasks || []).length) return;

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const hhmm = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
    const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const today = dayNames[now.getDay()];
    let changed = false, genCount = 0;

    state.recurringTasks.forEach(task => {
        if (!task.isActive) return;
        if (task.endDate && task.endDate < dateStr) { task.isActive = false; changed = true; return; }
        const c = task.cycle || {};
        if (!c.time) return;

        let generate = false, slot = null;
        if (task.type === 'daily') { slot = dateStr; if (hhmm >= c.time) generate = true; }
        else if (task.type === 'weekly' && c.days && c.days.includes(today)) { slot = dateStr; if (hhmm >= c.time) generate = true; }
        else if (task.type === 'monthly' && now.getDate() === parseInt(c.date)) { slot = dateStr; if (hhmm >= c.time) generate = true; }
        else if (task.type === 'yearly' && (now.getMonth()+1) === parseInt(c.month) && now.getDate() === parseInt(c.date)) { slot = dateStr; if (hhmm >= c.time) generate = true; }
        else if (task.type === 'adhoc' && c.date === dateStr) { slot = dateStr; if (hhmm >= c.time) { generate = true; task.isActive = false; } }

        if (generate && slot && task.lastGenerated !== slot) {
            const existingOrder = state.orders.find(o => o.title === task.title);
            if (existingOrder) {
                existingOrder.status = 'inbox';
                if (existingOrder.completedAt) {
                    delete existingOrder.completedAt;
                }
                existingOrder.deliveryDate = dateStr;
            } else {
                state.orders.unshift({
                    id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2,5),
                    title: task.title, status: 'inbox', folder: 'not_urgent_not_important',
                    assignee: task.assignee || '담당자 미정', description: task.description || '',
                    deliveryDate: dateStr, timeline: [], isRecurringInstance: true
                });
            }
            task.lastGenerated = slot;
            changed = true; genCount++;
        }
    });

    if (changed) {
        if (window.syncData) { window.syncData('recurringTasks', state.recurringTasks); window.syncData('orders', state.orders); }
        if (window.renderKanbanBoard) window.renderKanbanBoard();
        if (genCount > 0 && window.showToast) window.showToast(`반복 업무 ${genCount}건이 수신함에 자동 등록되었습니다.`, "success");
    }
}, 60000);

// Make Recurring Listener from Task Detail
document.addEventListener('DOMContentLoaded', () => {
    // Dynamic binding because the button might be loaded after DOM depending on modal logic
    // Actually the button is hardcoded in HTML so DOMContentLoaded is fine.
    const btnMakeRecurring = document.getElementById('btn-fs-task-make-recurring');
    if (btnMakeRecurring) {
        btnMakeRecurring.addEventListener('click', () => {
            const titleInput = document.getElementById('task-detail-title');
            let title = titleInput ? titleInput.value : '';
            const state = window._workHubState;
            const existingRt = (state && state.recurringTasks) ? state.recurringTasks.find(rt => rt.title === title) : null;
            if (existingRt) {
                window.openRecurringTaskDetailModal(existingRt.id, title);
            } else {
                window.openRecurringTaskDetailModal('', title);
            }
        });
    }
});

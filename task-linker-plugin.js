class TaskLinker {
    static get toolbox() {
        return {
            title: '업무 링크',
            icon: '<svg width="17" height="15" viewBox="0 0 336 276" xmlns="http://www.w3.org/2000/svg"><path d="M291 150V79c0-19-15-34-34-34H79c-19 0-34 15-34 34v42l67-44 81 72 56-29 42 30zm0 52l-43-30-56 30-81-67-66 39v23c0 19 15 34 34 34h178c17 0 31-13 34-29zM79 0h178c44 0 79 35 79 79v118c0 44-35 79-79 79H79c-44 0-79-35-79-79V79C0 35 35 0 79 0z"/></svg>'
        };
    }

    constructor({ data, api }) {
        this.api = api;
        this.data = data;
        this.wrapper = undefined;
    }

    render() {
        this.wrapper = document.createElement('div');
        this.wrapper.classList.add('task-linker-wrapper');
        
        if (this.data && this.data.taskId) {
            this._createLinkCard(this.data);
            return this.wrapper;
        }

        // Create search dropdown UI
        this.wrapper.innerHTML = `
            <div style="border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px; background: #fff;">
                <div style="font-size: 12px; font-weight: bold; color: #64748b; margin-bottom: 8px;">🔗 관계형 업무 연결</div>
                <select class="task-linker-select" style="width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; outline: none;">
                    <option value="">연결할 업무를 선택하세요...</option>
                </select>
            </div>
        `;

        const select = this.wrapper.querySelector('.task-linker-select');
        
        // Load tasks from global state (app.js should have populated this)
        if (window.state && window.state.orders) {
            window.state.orders.forEach(task => {
                const opt = document.createElement('option');
                opt.value = task.id;
                opt.text = `[${task.status}] ${task.title || '제목 없음'}`;
                select.appendChild(opt);
            });
        }

        select.addEventListener('change', (e) => {
            if (e.target.value) {
                const selectedTask = window.state.orders.find(t => t.id === e.target.value);
                this._createLinkCard({
                    taskId: selectedTask.id,
                    title: selectedTask.title,
                    status: selectedTask.status
                });
            }
        });

        return this.wrapper;
    }

    _createLinkCard(data) {
        this.data = data;
        this.wrapper.innerHTML = `
            <div class="task-link-card" onclick="window.openTaskDetailById('${data.taskId}')">
                <i class="fa-solid fa-link task-link-icon"></i>
                <div class="task-link-title">${data.title || '업무 이름 없음'}</div>
                <div class="task-link-status">${data.status}</div>
            </div>
        `;
    }

    save(blockContent) {
        return Object.assign({}, this.data);
    }
}

// Helper to open task detail from card click
window.openTaskDetailById = function(id) {
    if (window.state && window.state.orders) {
        const task = window.state.orders.find(t => t.id === id);
        if (task && typeof window.openTaskDetail === 'function') {
            window.openTaskDetail(task);
        }
    }
};

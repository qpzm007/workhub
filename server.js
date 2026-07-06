// WorkHub Express Backend Server - Nested Directory & Filesystem Integration
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

let db; // default db connection (for settings)
let dbTasks;
let dbWorkCards;

const app = express();
const PORT = 45678;

app.use(cors());
app.use(express.json());

// Request logger middleware
app.use((req, res, next) => {
    console.log(`[HTTP] ${new Date().toISOString()} ${req.method} ${req.url}`);
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
        console.log(`[HTTP BODY]`, req.body);
    }
    next();
});

// Serve static frontend files from this workspace (no-cache to always get latest code)
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});
app.use(express.static(__dirname));

// Serve editor images dynamically to respect DESKTOP_ROOT changes
app.get('/images/:filename', (req, res) => {
    const filePath = path.join(DESKTOP_ROOT, '05_업무_연관_파일_Task_Files', 'Editor_Images', req.params.filename);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Not Found');
    }
});

// Serve timeline screenshot images stored in task folders
app.get('/api/timeline-images/:taskId/:filename', (req, res) => {
    const { taskId, filename } = req.params;
    const taskFilesRoot = path.join(DESKTOP_ROOT || __dirname, '05_업무_연관_파일_Task_Files');
    for (const sub of Object.values(TASK_STATUS_FOLDERS)) {
        const imgPath = path.join(taskFilesRoot, sub, taskId, filename);
        if (fs.existsSync(imgPath)) {
            return res.sendFile(imgPath);
        }
    }
    // Also check timeline-screenshots fallback folder
    const fallbackPath = path.join(__dirname, 'WorkHub_DB', 'timeline-screenshots', taskId, filename);
    if (fs.existsSync(fallbackPath)) {
        return res.sendFile(fallbackPath);
    }
    res.status(404).send('Image not found');
});

// Target Windows Desktop Folder path for user bspark231101
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

// --- Added for Image Upload from Editor.js ---
app.post('/api/images/upload', (req, res) => {
    try {
        const { filename, base64 } = req.body;
        if (!filename || !base64) return res.status(400).json({ error: "Missing data" });

        const targetFolder = path.join(DESKTOP_ROOT, '05_업무_연관_파일_Task_Files', 'Editor_Images');
        if (!fs.existsSync(targetFolder)) {
            fs.mkdirSync(targetFolder, { recursive: true });
        }

        const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return res.status(400).json({ error: "Invalid base64 format" });
        }
        
        const safeName = Date.now() + '_' + filename.replace(/[^a-zA-Z0-9.\-_]/g, '');
        const filePath = path.join(targetFolder, safeName);
        
        fs.writeFileSync(filePath, Buffer.from(matches[2], 'base64'));
        
        res.json({
            success: 1,
            file: {
                url: `/images/${safeName}`
            }
        });
    } catch (err) {
        console.error("Image upload error:", err);
        res.status(500).json({ error: "Upload failed" });
    }
});
// ---------------------------------------------

let globalSettings = {
    apiKey: '',
    aiContext: '',
    desktopSyncPath: require('os').homedir() + '\\Desktop\\JKP_WorkHub_Files',
    dbPathTasks: '',
    dbPathWorkCards: '',
    customNames: {
        dashboard: '대시보드',
        search: '통합 검색 (Everything)',
        vendors: '명함첩 (WorkCard)',
        components: '공유 자료실 (양식/도면)',
        orders: '프로젝트 & 업무 관리',
        allTasks: '전체 업무 리스트'
    },
    userFolderSchema: {
        schemaName: "기본 기획팀 양식",
        levels: [
            { level: 1, label: "연도_부서명", inputType: "free_text" },
            { level: 2, label: "업무성격", inputType: "fixed_list", options: ["01_시장조사", "02_전략기획", "03_캠페인진행", "04_예산집행"] },
            { level: 3, label: "프로젝트명", inputType: "free_text", isLeaf: true }
        ],
        fileNameVariables: ["level1", "level2"]
    }
};
if (fs.existsSync(SETTINGS_FILE)) {
    try {
        const loaded = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        globalSettings.apiKey = loaded.apiKey || '';
        globalSettings.aiContext = loaded.aiContext || '';
        globalSettings.desktopSyncPath = loaded.desktopSyncPath !== undefined ? loaded.desktopSyncPath : globalSettings.desktopSyncPath;
        globalSettings.dbPathTasks = loaded.dbPathTasks || '';
        globalSettings.dbPathWorkCards = loaded.dbPathWorkCards || '';
        globalSettings.customNames = loaded.customNames || globalSettings.customNames;
        globalSettings.userFolderSchema = loaded.userFolderSchema || globalSettings.userFolderSchema;
    } catch(e) { console.error("Failed to load settings.json", e); }
}
let DESKTOP_ROOT = globalSettings.desktopSyncPath;
const DB_DIR = path.join(__dirname, 'WorkHub_DB');

// In-Memory Cache for files and folders traversal to optimize performance
let cacheFiles = null;
let cacheFolders = null;
let lastCacheTime = 0;
const CACHE_DURATION_MS = 10000; // Keep cache valid for 10 seconds

function invalidateCache() {
    cacheFiles = null;
    cacheFolders = null;
    lastCacheTime = 0;
    console.log("[CACHE] Filesystem cache invalidated.");
}

const DEFAULT_FOLDERS = [
    "0_Projects",
    "1_Areas",
    "2_Resources",
    "3_Archives",
    "05_업무_연관_파일_Task_Files"
];

// Helper to format file sizes
function formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Helper to format date-time
function formatDateTime(date) {
    const yyyy = date.getFullYear();
    let mm = date.getMonth() + 1;
    let dd = date.getDate();
    let hh = date.getHours();
    let min = date.getMinutes();
    
    if (mm < 10) mm = '0' + mm;
    if (dd < 10) dd = '0' + dd;
    if (hh < 10) hh = '0' + hh;
    if (min < 10) min = '0' + min;

    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

// Helper to secure relative path resolution
function safeResolvePath(relativePath) {
    if (!relativePath) return DESKTOP_ROOT;
    let resolved;
    if (path.isAbsolute(relativePath)) {
        resolved = path.resolve(relativePath);
    } else {
        resolved = path.join(DESKTOP_ROOT, relativePath);
    }
    if (DESKTOP_ROOT) {
        const normResolved = path.resolve(resolved).toLowerCase().replace(/\\/g, '/');
        const normRoot = path.resolve(DESKTOP_ROOT).toLowerCase().replace(/\\/g, '/');
        const normRootWithSlash = normRoot.endsWith('/') ? normRoot : normRoot + '/';
        const normResolvedWithSlash = normResolved.endsWith('/') ? normResolved : normResolved + '/';

        if (!normResolvedWithSlash.startsWith(normRootWithSlash) && normResolved !== normRoot) {
            throw new Error("Access Denied: Path traversal detected.");
        }
    }
    return resolved;
}

// -------------------------------------------------------------
// FILESYSTEM SEEDING & INITS
// -------------------------------------------------------------
const TASK_STATUS_FOLDERS = {
    'pending_approval': '01_대기',
    'in_progress': '02_진행',
    'completed': '03_완료'
};

function getStatusFolder(status) {
    return TASK_STATUS_FOLDERS[status] || '01_대기';
}

// -------------------------------------------------------------
// FILESYSTEM SEEDING & INITS
// -------------------------------------------------------------
async function initFilesystem() {
    try {
        // 1. Create root folder on Desktop if not exists
        if (DESKTOP_ROOT && !fs.existsSync(DESKTOP_ROOT)) {
            fs.mkdirSync(DESKTOP_ROOT, { recursive: true });
            console.log(`Created Desktop Root Folder: ${DESKTOP_ROOT}`);
        }

        // 2. Create PARA subfolders automatically
        if (DESKTOP_ROOT) {
            DEFAULT_FOLDERS.forEach(folder => {
                const folderPath = path.join(DESKTOP_ROOT, folder);
                if (!fs.existsSync(folderPath)) {
                    fs.mkdirSync(folderPath, { recursive: true });
                    console.log(`Created PARA Folder: ${folder}`);
                }
            });
        }

        // 3. Create hidden database dir
        if (!fs.existsSync(DB_DIR)) {
            fs.mkdirSync(DB_DIR, { recursive: true });
            console.log(`Created Database Directory: ${DB_DIR}`);
        }

        // 3.5 Init SQLite for default DB (config / settings)
        db = await open({
            filename: path.join(DB_DIR, 'workhub.sqlite'),
            driver: sqlite3.Database
        });

        await db.exec(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY, value TEXT
            );
        `);

        // Reopen connection handles for Tasks and WorkCards (applying custom settings if any)
        await openDatabaseConnections();

        // Migrate from old JSON files if they exist
        await migrateJsonToSqlite();

        // 4. Seed database files if missing
        await seedDatabaseFiles();

        // 4.5 Seed/Migrate task folders
        try {
            const tasks = await dbTasks.all('SELECT * FROM tasks');
            if (DESKTOP_ROOT && tasks && tasks.length > 0) {
                const taskFilesRoot = path.join(DESKTOP_ROOT, "05_업무_연관_파일_Task_Files");
                
                // Ensure state folders exist
                Object.values(TASK_STATUS_FOLDERS).forEach(sub => {
                    const subPath = path.join(taskFilesRoot, sub);
                    if (!fs.existsSync(subPath)) {
                        fs.mkdirSync(subPath, { recursive: true });
                        console.log(`Created status subfolder: ${sub}`);
                    }
                });

                tasks.forEach(task => {
                    if (!task.id) return;
                    const correctSub = getStatusFolder(task.status);
                    const targetPath = path.join(taskFilesRoot, correctSub, task.id);
                    
                    // Check if it already exists in the correct location
                    if (fs.existsSync(targetPath)) {
                        return; // Already in correct location
                    }
                    
                    // Check if it exists in the old root location (migration from old version)
                    const oldRootPath = path.join(taskFilesRoot, task.id);
                    if (fs.existsSync(oldRootPath)) {
                        fs.renameSync(oldRootPath, targetPath);
                        console.log(`[MIGRATE] Moved task folder from root to status folder: ${task.id} -> ${correctSub}`);
                        return;
                    }
                    
                    // Check if it exists in other state folders (out of sync)
                    let foundAndMoved = false;
                    for (const otherStatus of Object.keys(TASK_STATUS_FOLDERS)) {
                        if (otherStatus === task.status) continue;
                        const otherSub = getStatusFolder(otherStatus);
                        const otherPath = path.join(taskFilesRoot, otherSub, task.id);
                        if (fs.existsSync(otherPath)) {
                            fs.renameSync(otherPath, targetPath);
                            console.log(`[MIGRATE] Moved task folder between status folders: ${task.id} (${otherSub} -> ${correctSub})`);
                            foundAndMoved = true;
                            break;
                        }
                    }
                    
                    // If not found anywhere, create a new folder in the correct state folder
                    if (!foundAndMoved) {
                        fs.mkdirSync(targetPath, { recursive: true });
                        console.log(`[SEED] Created new task folder under ${correctSub}: ${task.id}`);
                    }
                });
            }
        } catch (e) {
            console.error("Error seeding task folders:", e);
        }

        // 5. Seed actual files on the desktop folder if empty
        // seedMockFilesOnDisk(); // Disabled by user request

    } catch (err) {
        console.error("Failed to initialize filesystem:", err);
    }
}


async function openDatabaseConnections() {
    // Close existing connections if they are open and not equal to db
    if (dbTasks && dbTasks !== db) {
        try { await dbTasks.close(); } catch(e) {}
    }
    if (dbWorkCards && dbWorkCards !== db) {
        try { await dbWorkCards.close(); } catch(e) {}
    }
    
    // Resolve tasks path
    if (globalSettings.dbPathTasks) {
        const tasksDir = path.dirname(globalSettings.dbPathTasks);
        if (!fs.existsSync(tasksDir)) {
            fs.mkdirSync(tasksDir, { recursive: true });
        }
        dbTasks = await open({
            filename: globalSettings.dbPathTasks,
            driver: sqlite3.Database
        });
        console.log(`Connected to Tasks DB: ${globalSettings.dbPathTasks}`);
    } else {
        dbTasks = db;
    }
    
    // Resolve workcards path
    if (globalSettings.dbPathWorkCards) {
        const wcDir = path.dirname(globalSettings.dbPathWorkCards);
        if (!fs.existsSync(wcDir)) {
            fs.mkdirSync(wcDir, { recursive: true });
        }
        dbWorkCards = await open({
            filename: globalSettings.dbPathWorkCards,
            driver: sqlite3.Database
        });
        console.log(`Connected to WorkCards DB: ${globalSettings.dbPathWorkCards}`);
    } else {
        dbWorkCards = db;
    }
    
    // Ensure tables exist in all databases
    await ensureTablesExist();
}

async function ensureTablesExist() {
    // 1. In Tasks DB: tasks & shared_assets
    await dbTasks.exec(`
        CREATE TABLE IF NOT EXISTS shared_assets (
            id TEXT PRIMARY KEY, name TEXT, assetNumber TEXT, category TEXT, format TEXT,
            ownerName TEXT, status TEXT, description TEXT
        );
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY, title TEXT, department TEXT, assignee TEXT, amount INTEGER,
            status TEXT, deliveryDate TEXT, itemsCount INTEGER, description TEXT, priority TEXT, folder TEXT, completedAt INTEGER, timeline TEXT
        );
    `);
    
    try {
        await dbTasks.exec('ALTER TABLE tasks ADD COLUMN folder TEXT');
    } catch(e) {}
    try {
        await dbTasks.exec('ALTER TABLE tasks ADD COLUMN completedAt INTEGER');
    } catch(e) {}
    try {
        await dbTasks.exec('ALTER TABLE tasks ADD COLUMN timeline TEXT');
    } catch(e) {}

    // 2. In WorkCards DB: work_card_ledger & partners
    await dbWorkCards.exec(`
        CREATE TABLE IF NOT EXISTS partners (
            id TEXT PRIMARY KEY, name TEXT, code TEXT, type TEXT, ceo TEXT, phone TEXT, email TEXT,
            address TEXT, registrationNumber TEXT, rating INTEGER, notes TEXT, department TEXT
        );
        CREATE TABLE IF NOT EXISTS work_card_ledger (
            card_id TEXT PRIMARY KEY,
            user_id TEXT,
            name TEXT NOT NULL,
            company TEXT,
            position TEXT,
            mobile TEXT,
            phone TEXT,
            email TEXT,
            fax TEXT,
            address TEXT,
            website_url TEXT,
            sns TEXT,
            image_front_base64 TEXT,
            image_back_base64 TEXT,
            tags TEXT,
            relationship TEXT,
            rating INTEGER,
            meet_location TEXT,
            memo TEXT,
            is_shared BOOLEAN,
            raw_ocr_text TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

async function migrateJsonToSqlite() {
    const jsonFiles = ['tasks.json', 'partners.json', 'shared_assets.json'];
    for (const file of jsonFiles) {
        const p = path.join(DB_DIR, file);
        if (fs.existsSync(p)) {
            try {
                const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
                if (file === 'tasks.json') {
                    for (const t of data) {
                        await dbTasks.run('INSERT OR IGNORE INTO tasks (id, title, department, assignee, amount, status, deliveryDate, itemsCount, description, priority) VALUES (?,?,?,?,?,?,?,?,?,?)',
                            [t.id, t.title, t.department, t.assignee, t.amount, t.status, t.deliveryDate, t.itemsCount, t.description, t.priority]);
                    }
                } else if (file === 'partners.json') {
                    for (const p of data) {
                        await dbWorkCards.run('INSERT OR IGNORE INTO partners (id, name, code, type, ceo, phone, email, address, registrationNumber, rating, notes, department) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
                            [p.id, p.name, p.code, p.type, p.ceo, p.phone, p.email, p.address, p.registrationNumber, p.rating, p.notes, p.department]);
                    }
                } else if (file === 'shared_assets.json') {
                    for (const a of data) {
                        await dbTasks.run('INSERT OR IGNORE INTO shared_assets (id, name, assetNumber, category, format, ownerName, status, description) VALUES (?,?,?,?,?,?,?,?)',
                            [a.id, a.name, a.assetNumber, a.category, a.format, a.ownerName, a.status, a.description]);
                    }
                }
                // Rename old JSON files to backup to prevent re-migration
                fs.renameSync(p, p + '.backup');
                console.log(`Migrated ${file} to SQLite`);
            } catch (e) {
                console.error("Migration error:", e);
            }
        }
    }
}

async function seedDatabaseFiles() {
    // Migrate partners to work_card_ledger
    const migrated = await dbWorkCards.get('SELECT COUNT(*) as count FROM work_card_ledger');
    if (migrated.count === 0) {
        const oldPartners = await dbWorkCards.all('SELECT * FROM partners');
        if (oldPartners.length > 0) {
            for (const p of oldPartners) {
                await dbWorkCards.run(
                    'INSERT INTO work_card_ledger (card_id, relationship, name, company, phone, email, memo) VALUES (?,?,?,?,?,?,?)',
                    [p.id, p.type || 'PARTNER', p.ceo || p.name, p.name, p.phone, p.email, p.notes]
                );
            }
            console.log(`Migrated ${oldPartners.length} partners to WorkCard Ledger.`);
        }
    }
}

function seedMockFilesOnDisk() {
    // Disabled by user request
}

// Run Inits: DB 초기화가 완전히 끝난 뒤 서버 포트를 열어서 race condition 방지
(async () => {
    await initFilesystem();

    app.listen(PORT, () => {
        console.log(`\n=============================================================`);
        console.log(`   JKP WorkHub server is running!`);
        console.log(`   URL: http://localhost:${PORT}`);
        console.log(`   Desktop sync folder: ${DESKTOP_ROOT}`);
        console.log(`=============================================================\n`);

        // Automatically open default browser on Windows
        try {
            const { exec } = require('child_process');
            exec('start http://localhost:' + PORT);
        } catch (e) {
            console.log("Could not open browser automatically:", e.message);
        }
    });
})();

// Recursive Crawl Helper to fetch ALL files on Desktop Root
function crawlDirectory(dirPath, relativePath = "") {
    let filesList = [];
    if (dirPath.endsWith('WorkHub_DB') || dirPath.endsWith('System Volume Information')) return [];

    try {
        const list = fs.readdirSync(dirPath);
        list.forEach(entry => {
            if (entry.startsWith('.')) return;
            const fullPath = path.join(dirPath, entry);
            const relPath = relativePath ? path.join(relativePath, entry) : entry;
            const stats = fs.statSync(fullPath);

            if (stats.isDirectory()) {
                filesList = filesList.concat(crawlDirectory(fullPath, relPath));
            } else {
                const ext = entry.split('.').pop().toLowerCase();
                const normalizedRel = relPath.replace(/\\/g, '/');
                const folderName = normalizedRel.includes('/') ? normalizedRel.split('/')[0] : "";
                filesList.push({
                    id: `file_${stats.ino}_${stats.mtimeMs}`,
                    name: entry,
                    extension: ext,
                    folder: folderName,
                    relativePath: relPath.replace(/\\/g, '/'),
                    size: formatSize(stats.size),
                    modifiedAt: formatDateTime(stats.mtime),
                    modifiedBy: "시스템 자동 동기화",
                    tags: [ext, folderName]
                });
            }
        });
    } catch (e) {
        console.error("Crawl error in dir:", dirPath, e);
    }
    return filesList;
}

// Recursive Crawl Helper to fetch ALL folders on Desktop Root
function crawlFolders(dirPath, relativePath = "") {
    let foldersList = [];
    if (dirPath.endsWith('WorkHub_DB') || dirPath.endsWith('System Volume Information')) return [];

    try {
        const list = fs.readdirSync(dirPath);
        list.forEach(entry => {
            if (entry.startsWith('.')) return;
            const fullPath = path.join(dirPath, entry);
            const relPath = relativePath ? path.join(relativePath, entry) : entry;
            const stats = fs.statSync(fullPath);

            if (stats.isDirectory()) {
                foldersList.push({
                    name: entry,
                    relativePath: relPath.replace(/\\/g, '/'),
                    modifiedAt: formatDateTime(stats.mtime),
                    isDir: true
                });
                foldersList = foldersList.concat(crawlFolders(fullPath, relPath));
            }
        });
    } catch (e) {
        console.error("Crawl folders error in dir:", dirPath, e);
    }
    return foldersList;
}

// -------------------------------------------------------------
// REST API ENDPOINTS
// -------------------------------------------------------------

// 1. GET ALL FILES RECURSIVELY (For search & stats & recent tables)

// --- Settings API ---
app.get('/api/settings', (req, res) => {
    res.json(globalSettings);
});

app.post('/api/settings', async (req, res) => {
    const { apiKey, desktopSyncPath, aiContext, customNames, dbPathTasks, dbPathWorkCards } = req.body;
    try {
        await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ['apiKey', apiKey]);
        await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ['desktopSyncPath', desktopSyncPath || ""]);
        await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ['aiContext', aiContext || ""]);
        await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ['customNames', JSON.stringify(customNames || {})]);
        await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ['dbPathTasks', dbPathTasks || ""]);
        await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ['dbPathWorkCards', dbPathWorkCards || ""]);
    } catch (e) { console.error("Failed to save to SQLite settings table", e); }

    globalSettings.apiKey = apiKey;
    globalSettings.aiContext = aiContext || "";
    globalSettings.desktopSyncPath = desktopSyncPath || "";
    globalSettings.customNames = customNames || {};
    globalSettings.dbPathTasks = dbPathTasks || "";
    globalSettings.dbPathWorkCards = dbPathWorkCards || "";
    
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(globalSettings, null, 2));
    
    try {
        await openDatabaseConnections();
    } catch (e) {
        console.error("Failed to reopen database connections on settings update:", e);
    }
    
    DESKTOP_ROOT = desktopSyncPath || "";
    invalidateCache(); // Force cache clear
    if (DESKTOP_ROOT && !fs.existsSync(DESKTOP_ROOT)) {
        try {
            fs.mkdirSync(DESKTOP_ROOT, { recursive: true });
        } catch (e) {}
    }

    res.json({ success: true, message: "Settings updated" });
});

// =============================================================
// UPDATE SYSTEM APIs (GitHub Releases 기반 자동 업데이트)
// =============================================================

const VERSION_FILE = path.join(__dirname, 'version.json');
const UPDATE_TMP_DIR = path.join(__dirname, 'WorkHub_Update_tmp');

// 현재 로컬 버전 및 GitHub 정보 읽기
function readVersionInfo() {
    try {
        if (fs.existsSync(VERSION_FILE)) {
            return JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
        }
    } catch (e) {}
    return { version: '1.0.0', githubOwner: '', githubRepo: '' };
}

// semver 비교: a > b 이면 true
function isNewerVersion(remote, local) {
    const parse = v => v.replace(/^v/, '').split('.').map(Number);
    const [rMaj, rMin, rPat] = parse(remote);
    const [lMaj, lMin, lPat] = parse(local);
    if (rMaj !== lMaj) return rMaj > lMaj;
    if (rMin !== lMin) return rMin > lMin;
    return rPat > lPat;
}

// 업데이트에서 덮어쓰면 안 되는 경로 목록
const UPDATE_EXCLUDE = [
    'settings.json',
    'WorkHub_DB',
    'WorkHub_Backup_',
    'WorkHub_Update_tmp',
    'node.exe',
    'node_modules',
    'server_out.txt',
    'server_err.txt'
];

function shouldExclude(name) {
    return UPDATE_EXCLUDE.some(ex => name === ex || name.startsWith(ex));
}

// 1. 현재 버전 반환
app.get('/api/update/version', (req, res) => {
    res.json(readVersionInfo());
});

// 2. GitHub에서 최신 버전 확인
app.get('/api/update/check', async (req, res) => {
    try {
        const vInfo = readVersionInfo();
        const { githubOwner, githubRepo, version: localVersion } = vInfo;
        if (!githubOwner || !githubRepo || githubOwner === 'YOUR_GITHUB_ID') {
            return res.json({ updateAvailable: false, message: 'GitHub 정보가 설정되지 않았습니다. version.json을 수정해주세요.' });
        }

        const https = require('https');
        const apiUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/releases/latest`;

        const data = await new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.github.com',
                path: `/repos/${githubOwner}/${githubRepo}/releases/latest`,
                method: 'GET',
                headers: { 'User-Agent': 'WorkHub-Updater/1.0', 'Accept': 'application/vnd.github+json' }
            };
            const req2 = https.request(options, resp => {
                let body = '';
                resp.on('data', d => body += d);
                resp.on('end', () => {
                    try { resolve(JSON.parse(body)); }
                    catch (e) { reject(new Error('GitHub 응답 파싱 실패')); }
                });
            });
            req2.on('error', reject);
            req2.setTimeout(10000, () => { req2.destroy(); reject(new Error('GitHub 연결 타임아웃')); });
            req2.end();
        });

        if (data.message === 'Not Found') {
            return res.json({ updateAvailable: false, message: '레포지토리 또는 릴리즈를 찾을 수 없습니다.' });
        }

        const remoteTag = data.tag_name || '';
        const remoteVersion = remoteTag.replace(/^v/, '');
        const updateAvailable = isNewerVersion(remoteVersion, localVersion);

        // GitHub 소스코드 ZIP URL (assets 없어도 기본 소스코드 ZIP 사용)
        let downloadUrl = `https://github.com/${githubOwner}/${githubRepo}/archive/refs/tags/${remoteTag}.zip`;
        if (data.assets && data.assets.length > 0) {
            const zipAsset = data.assets.find(a => a.name.endsWith('.zip'));
            if (zipAsset) downloadUrl = zipAsset.browser_download_url;
        }

        res.json({
            updateAvailable,
            localVersion,
            remoteVersion,
            remoteTag,
            releaseNotes: data.body || '',
            publishedAt: data.published_at || '',
            downloadUrl
        });
    } catch (err) {
        console.error('[UPDATE CHECK ERROR]', err.message);
        res.status(500).json({ updateAvailable: false, message: `업데이트 확인 실패: ${err.message}` });
    }
});

// 3. 업데이트 적용 (다운로드 → 백업 → 파일 교체)
app.post('/api/update/apply', async (req, res) => {
    const { downloadUrl, remoteVersion, remoteTag } = req.body;
    if (!downloadUrl || !remoteVersion) {
        return res.status(400).json({ success: false, message: '다운로드 URL 또는 버전 정보가 없습니다.' });
    }

    try {
        const vInfo = readVersionInfo();
        const localVersion = vInfo.version;
        const https = require('https');
        const http = require('http');
        const { execSync } = require('child_process');

        // 임시 폴더 초기화
        if (fs.existsSync(UPDATE_TMP_DIR)) {
            fs.rmSync(UPDATE_TMP_DIR, { recursive: true, force: true });
        }
        fs.mkdirSync(UPDATE_TMP_DIR, { recursive: true });

        const zipPath = path.join(UPDATE_TMP_DIR, 'update.zip');

        // ZIP 다운로드 (리다이렉트 처리)
        console.log(`[UPDATE] Downloading from: ${downloadUrl}`);
        await new Promise((resolve, reject) => {
            function doRequest(url, depth = 0) {
                if (depth > 5) return reject(new Error('리다이렉트 너무 많음'));
                const lib = url.startsWith('https') ? https : http;
                lib.get(url, { headers: { 'User-Agent': 'WorkHub-Updater/1.0' } }, resp => {
                    if (resp.statusCode === 301 || resp.statusCode === 302 || resp.statusCode === 307 || resp.statusCode === 308) {
                        return doRequest(resp.headers.location, depth + 1);
                    }
                    if (resp.statusCode !== 200) return reject(new Error(`다운로드 실패: HTTP ${resp.statusCode}`));
                    const file = fs.createWriteStream(zipPath);
                    resp.pipe(file);
                    file.on('finish', () => { file.close(); resolve(); });
                    file.on('error', reject);
                }).on('error', reject);
            }
            doRequest(downloadUrl);
        });

        console.log('[UPDATE] Download complete. Extracting...');

        // 압축 해제 (PowerShell 사용)
        const extractDir = path.join(UPDATE_TMP_DIR, 'extracted');
        fs.mkdirSync(extractDir, { recursive: true });
        execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`, { stdio: 'pipe' });

        // GitHub ZIP은 내부에 repo-tag/ 폴더가 있으므로 그 안을 소스로 사용
        let sourceDir = extractDir;
        const entries = fs.readdirSync(extractDir);
        if (entries.length === 1 && fs.statSync(path.join(extractDir, entries[0])).isDirectory()) {
            sourceDir = path.join(extractDir, entries[0]);
        }

        // 현재 파일 백업
        const backupTag = remoteTag ? remoteTag : `v${localVersion}`;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const backupDir = path.join(__dirname, `WorkHub_Backup_${backupTag}_${timestamp}`);
        fs.mkdirSync(backupDir, { recursive: true });
        console.log(`[UPDATE] Backing up current version to: ${backupDir}`);

        const backupExclude = ['WorkHub_DB', 'WorkHub_Backup_', 'WorkHub_Update_tmp', 'node_modules'];
        fs.readdirSync(__dirname).forEach(entry => {
            if (backupExclude.some(ex => entry === ex || entry.startsWith(ex))) return;
            const src = path.join(__dirname, entry);
            const dst = path.join(backupDir, entry);
            try {
                if (fs.statSync(src).isDirectory()) {
                    fs.cpSync(src, dst, { recursive: true });
                } else {
                    fs.copyFileSync(src, dst);
                }
            } catch(e) { console.warn(`[UPDATE] Backup skip: ${entry}`, e.message); }
        });

        // 새 파일로 교체 (제외 목록 스킵)
        console.log('[UPDATE] Applying new files...');
        fs.readdirSync(sourceDir).forEach(entry => {
            if (shouldExclude(entry)) {
                console.log(`[UPDATE] Skipping protected file: ${entry}`);
                return;
            }
            const src = path.join(sourceDir, entry);
            const dst = path.join(__dirname, entry);
            try {
                if (fs.statSync(src).isDirectory()) {
                    if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true, force: true });
                    fs.cpSync(src, dst, { recursive: true });
                } else {
                    fs.copyFileSync(src, dst);
                }
            } catch(e) { console.warn(`[UPDATE] Apply skip: ${entry}`, e.message); }
        });

        // version.json 업데이트
        const newVersionInfo = { ...vInfo, version: remoteVersion, releaseNotes: `${remoteTag} 업데이트 적용됨` };
        fs.writeFileSync(VERSION_FILE, JSON.stringify(newVersionInfo, null, 2), 'utf8');

        // 임시 폴더 정리
        try { fs.rmSync(UPDATE_TMP_DIR, { recursive: true, force: true }); } catch(e) {}

        console.log(`[UPDATE] Success! Updated to ${remoteVersion}`);
        res.json({ success: true, message: `v${remoteVersion} 업데이트 완료! WorkHub_실행하기.bat를 다시 실행하세요.`, backupDir: path.basename(backupDir) });

    } catch (err) {
        console.error('[UPDATE APPLY ERROR]', err);
        try { fs.rmSync(UPDATE_TMP_DIR, { recursive: true, force: true }); } catch(e) {}
        res.status(500).json({ success: false, message: `업데이트 실패: ${err.message}` });
    }
});

// 4. 백업 목록 조회
app.get('/api/update/backups', (req, res) => {
    try {
        const backups = fs.readdirSync(__dirname)
            .filter(name => name.startsWith('WorkHub_Backup_'))
            .map(name => {
                const fullPath = path.join(__dirname, name);
                const stat = fs.statSync(fullPath);
                let version = '?';
                const vFile = path.join(fullPath, 'version.json');
                if (fs.existsSync(vFile)) {
                    try { version = JSON.parse(fs.readFileSync(vFile, 'utf8')).version || '?'; } catch(e) {}
                }
                return { name, version, createdAt: stat.birthtime || stat.ctime };
            })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(backups);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. 롤백 (선택한 백업 폴더로 복원)
app.post('/api/update/rollback', (req, res) => {
    const { backupName } = req.body;
    if (!backupName || !backupName.startsWith('WorkHub_Backup_')) {
        return res.status(400).json({ success: false, message: '유효하지 않은 백업 이름입니다.' });
    }
    const backupDir = path.join(__dirname, backupName);
    if (!fs.existsSync(backupDir)) {
        return res.status(404).json({ success: false, message: '백업 폴더를 찾을 수 없습니다.' });
    }

    try {
        console.log(`[ROLLBACK] Restoring from: ${backupDir}`);
        fs.readdirSync(backupDir).forEach(entry => {
            if (shouldExclude(entry)) return;
            const src = path.join(backupDir, entry);
            const dst = path.join(__dirname, entry);
            try {
                if (fs.statSync(src).isDirectory()) {
                    if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true, force: true });
                    fs.cpSync(src, dst, { recursive: true });
                } else {
                    fs.copyFileSync(src, dst);
                }
            } catch(e) { console.warn(`[ROLLBACK] Skip: ${entry}`, e.message); }
        });
        console.log('[ROLLBACK] Complete.');
        res.json({ success: true, message: `${backupName} 로 롤백 완료! WorkHub_실행하기.bat를 다시 실행하세요.` });
    } catch (err) {
        console.error('[ROLLBACK ERROR]', err);
        res.status(500).json({ success: false, message: `롤백 실패: ${err.message}` });
    }
});

app.get('/api/files', (req, res) => {
    try {
        if (!DESKTOP_ROOT) {
            return res.json([]);
        }
        const now = Date.now();
        if (!cacheFiles || (now - lastCacheTime > CACHE_DURATION_MS)) {
            console.log("[CACHE] Files cache expired or empty. Recrawling...");
            cacheFiles = crawlDirectory(DESKTOP_ROOT);
            cacheFolders = crawlFolders(DESKTOP_ROOT);
            lastCacheTime = now;
        }
        res.json(cacheFiles);
    } catch (err) {
        console.error("Error crawling files:", err);
        res.status(500).json({ error: "Failed to read files recursively." });
    }
});

// 1.5 GET ALL FOLDERS RECURSIVELY (For folder search)
app.get('/api/folders/all', (req, res) => {
    try {
        if (!DESKTOP_ROOT) {
            return res.json([]);
        }
        const now = Date.now();
        if (!cacheFolders || (now - lastCacheTime > CACHE_DURATION_MS)) {
            console.log("[CACHE] Folders cache expired or empty. Recrawling...");
            cacheFiles = crawlDirectory(DESKTOP_ROOT);
            cacheFolders = crawlFolders(DESKTOP_ROOT);
            lastCacheTime = now;
        }
        res.json(cacheFolders);
    } catch (err) {
        console.error("Error crawling folders:", err);
        res.status(500).json({ error: "Failed to read folders recursively." });
    }
});

// 2. FILE UPLOAD (SIMULATE/CREATE REAL FILE ON DISK)
app.post('/api/files/upload', (req, res) => {
    try {
        const { name, folder, content } = req.body;
        if (!name || !folder) {
            return res.status(400).json({ error: "Missing name or folder parameter." });
        }

        const targetFolder = safeResolvePath(folder);
        if (!fs.existsSync(targetFolder)) {
            fs.mkdirSync(targetFolder, { recursive: true });
        }

        const filePath = path.join(targetFolder, name);
        const fileContent = content || `WorkHub Generated Document content for ${name}`;
        
        fs.writeFileSync(filePath, fileContent, 'utf-8');
        console.log(`User created file on Disk: ${filePath}`);

        invalidateCache();
        res.json({ success: true, message: `Successfully created ${name} in ${folder}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/files/uploadImage', express.json({limit: '50mb'}), (req, res) => {
    try {
        const { taskId, filename, base64 } = req.body;
        if (!taskId || !filename || !base64) {
            return res.status(400).json({ error: "Missing required parameters." });
        }

        // Try to save to task folder, fallback to WorkHub_DB/timeline-screenshots
        let targetFolder = null;
        if (DESKTOP_ROOT) {
            const taskFilesRoot = path.join(DESKTOP_ROOT, "05_업무_연관_파일_Task_Files");
            for (const sub of Object.values(TASK_STATUS_FOLDERS)) {
                const subPath = path.join(taskFilesRoot, sub, taskId);
                if (fs.existsSync(subPath)) {
                    targetFolder = subPath;
                    break;
                }
            }
            if (!targetFolder) {
                targetFolder = path.join(taskFilesRoot, TASK_STATUS_FOLDERS['todo'] || '01_대기', taskId);
                fs.mkdirSync(targetFolder, { recursive: true });
            }
        } else {
            // Fallback: save in WorkHub_DB
            targetFolder = path.join(__dirname, 'WorkHub_DB', 'timeline-screenshots', taskId);
            fs.mkdirSync(targetFolder, { recursive: true });
        }

        const filePath = path.join(targetFolder, filename);
        // Fix: correct regex to strip data:image/xxx;base64, prefix
        const base64Data = base64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        fs.writeFileSync(filePath, buffer);
        console.log(`[SCREENSHOT] Saved image to: ${filePath}`);

        // Return a URL that the browser can load via our API route
        const imageUrl = `/api/timeline-images/${taskId}/${encodeURIComponent(filename)}`;
        res.json({ success: true, url: imageUrl });
    } catch (err) {
        console.error('[SCREENSHOT ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// 3. DELETE A FILE ON DISK
app.delete('/api/files', (req, res) => {
    try {
        const { filename, folder } = req.body;
        if (!filename || folder === undefined || folder === null) {
            return res.status(400).json({ error: "Missing filename or folder parameters." });
        }

        const filePath = path.join(safeResolvePath(folder), filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Deleted file on Disk: ${filePath}`);
            invalidateCache();
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "File not found on disk." });
        }
    } catch (err) {
        console.error("Error deleting file:", err);
        res.status(500).json({ error: "Failed to delete file from disk." });
    }
});

// Helper function to safely launch files/folders in Windows OS.
// For directories, it uses explorer.exe directly (Unicode-safe and fast).
// For files, it uses the 'start' command to launch the file in its default program.
const { spawn, exec } = require('child_process');
function openPathInOS(targetPath) {
    console.log(`[OS OPEN] Attempting to open: ${targetPath}`);
    try {
        if (!fs.existsSync(targetPath)) {
            console.error(`[OS OPEN ERROR] Path does not exist: ${targetPath}`);
            return;
        }

        const isDir = fs.statSync(targetPath).isDirectory();
        if (isDir) {
            const ps = spawn('explorer.exe', [targetPath], {
                detached: true,
                stdio: 'ignore'
            });
            ps.unref();
        } else {
            // Use Windows 'start' command, quoting the path for spaces/special chars.
            exec(`start "" "${targetPath}"`, (err) => {
                if (err) {
                    console.error('[OS OPEN exec ERROR] cmd start failed, falling back to explorer', err);
                    const ps = spawn('explorer.exe', [targetPath], {
                        detached: true,
                        stdio: 'ignore'
                    });
                    ps.unref();
                }
            });
        }
    } catch (err) {
        console.error('[OS OPEN ERROR]', err);
    }
}

// 3.5 OPEN A FILE ON DISK DIRECTLY IN OS
app.post('/api/files/open', (req, res) => {
    try {
        const { filename, folder } = req.body;
        if (!filename || folder === undefined || folder === null) {
            return res.status(400).json({ error: "Missing filename or folder parameters." });
        }

        const filePath = path.join(safeResolvePath(folder), filename);
        
        // Auto-create file content if it doesn't exist on disk (so it can open directly in OS)
        if (!fs.existsSync(filePath)) {
            const ext = filename.split('.').pop().toLowerCase();
            let content = `WorkHub Auto-Generated Document for ${filename}\n`;
            if (ext === 'hwp') {
                content = `한글 문서 본문 - ${filename.replace(/_/g, ' ')} 자동 생성 파일.`;
            } else if (ext === 'xlsx') {
                content = `Excel Sheet Content for ${filename}`;
            } else if (ext === 'docx') {
                content = `Word Document Content for ${filename}`;
            }
            
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, content, 'utf-8');
            console.log(`Auto-created missing file for OS opening: ${filePath}`);
        }

        if (fs.existsSync(filePath)) {
            let targetToOpen = filePath;
            // Handle WorkHub link files
            if (filename.startsWith('[연동]_') && filename.endsWith('.txt')) {
                try {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const match = content.match(/원본 경로:\s*(.+)/);
                    if (match && match[1]) {
                        const originalPath = match[1].trim();
                        targetToOpen = safeResolvePath(originalPath);
                    }
                } catch(e) {
                    console.error("Error reading link file", e);
                }
            }

            openPathInOS(targetToOpen);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "File not found on disk." });
        }
    } catch (err) {
        console.error("Error launching file in OS:", err);
        res.status(500).json({ error: "Failed to launch file on PC." });
    }
});

function findFileFallback(dir, targetName, maxDepth = 4, currentDepth = 0) {
    if (currentDepth > maxDepth) return null;
    try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            if (item.name === targetName) {
                return fullPath;
            }
            if (item.isDirectory() && !item.name.startsWith('.')) {
                const found = findFileFallback(fullPath, targetName, maxDepth, currentDepth + 1);
                if (found) return found;
            }
        }
    } catch (e) {
        // Ignore permission/access errors
    }
    return null;
}

// 3.6 OPEN AN ABSOLUTE PATH IN OS (for timeline links)
app.post('/api/files/open-path', (req, res) => {
    try {
        const { absolutePath } = req.body;
        if (!absolutePath) {
            return res.status(400).json({ error: "Missing absolutePath parameter." });
        }
        
        let finalPath = absolutePath;
        let pathChanged = false;
        
        if (!fs.existsSync(absolutePath)) {
            const fileName = path.basename(absolutePath);
            const searchRoot = DESKTOP_ROOT || __dirname;
            console.log(`[OS OPEN] Path missing, searching for: ${fileName} in ${searchRoot}`);
            
            const found = findFileFallback(searchRoot, fileName, 4);
            if (found) {
                finalPath = found;
                pathChanged = true;
                console.log(`[OS OPEN] Found at new path: ${finalPath}`);
            } else {
                return res.status(404).json({ error: "File moved or deleted and could not be found." });
            }
        }

        openPathInOS(finalPath);
        res.json({ success: true, newPath: pathChanged ? finalPath : null });
    } catch (err) {
        console.error("Error opening path:", err);
        res.status(500).json({ error: "Failed to open path." });
    }
});

// 3.7 BROWSE ABSOLUTE PATH (for timeline link file picker)
app.get('/api/dir-abs', (req, res) => {
    try {
        const absPath = req.query.path || DESKTOP_ROOT || '';
        if (!absPath || !fs.existsSync(absPath)) {
            // Return desktop root contents or empty
            const rootPath = DESKTOP_ROOT || '';
            if (!rootPath || !fs.existsSync(rootPath)) {
                return res.json({ currentPath: '', parent: null, folders: [], files: [] });
            }
            return res.redirect(`/api/dir-abs?path=${encodeURIComponent(rootPath)}`);
        }

        const stat = fs.statSync(absPath);
        if (!stat.isDirectory()) {
            return res.status(400).json({ error: "Not a directory." });
        }

        const parent = path.dirname(absPath) !== absPath ? path.dirname(absPath) : null;
        const list = fs.readdirSync(absPath);
        const folders = [];
        const files = [];

        list.forEach(entry => {
            if (entry.startsWith('.') || entry === 'WorkHub_DB' || entry === 'System Volume Information') return;
            try {
                const fullPath = path.join(absPath, entry);
                const s = fs.statSync(fullPath);
                if (s.isDirectory()) {
                    folders.push({ name: entry, path: fullPath });
                } else {
                    files.push({ name: entry, path: fullPath, size: s.size });
                }
            } catch(e) { /* skip inaccessible */ }
        });

        res.json({ currentPath: absPath, parent, folders, files });
    } catch (err) {
        console.error("Error reading directory:", err);
        res.status(500).json({ error: "Failed to read directory." });
    }
});


app.get('/api/dir', (req, res) => {
    try {
        if (!DESKTOP_ROOT) {
            return res.json({ currentPath: "", folders: [], files: [] });
        }
        const relPath = req.query.path || '';
        const targetPath = safeResolvePath(relPath);

        if (!fs.existsSync(targetPath)) {
            return res.status(404).json({ error: "Directory not found." });
        }

        const list = fs.readdirSync(targetPath);
        let folders = [];
        let files = [];

        list.forEach(entry => {
            // Skip hidden items and db folder
            if (entry.startsWith('.') || entry === "WorkHub_DB" || entry === "System Volume Information") return;

            const fullPath = path.join(targetPath, entry);
            const stats = fs.statSync(fullPath);
            const entryRelPath = relPath ? `${relPath}/${entry}` : entry;

            if (stats.isDirectory()) {
                folders.push({
                    name: entry,
                    relativePath: entryRelPath.replace(/\\/g, '/'),
                    modifiedAt: formatDateTime(stats.mtime),
                    isDir: true
                });
            } else {
                const ext = entry.split('.').pop().toLowerCase();
                files.push({
                    id: `file_${stats.ino}_${stats.mtimeMs}`,
                    name: entry,
                    extension: ext,
                    relativePath: entryRelPath.replace(/\\/g, '/'),
                    size: formatSize(stats.size),
                    modifiedAt: formatDateTime(stats.mtime),
                    isDir: false
                });
            }
        });

        res.json({
            currentPath: relPath.replace(/\\/g, '/'),
            folders,
            files
        });
    } catch (err) {
        console.error("Error listing directory:", err);
        res.status(500).json({ error: "Failed to scan directory." });
    }
});

// 4.1 CREATE A DIRECTORY
app.post('/api/folders/create', (req, res) => {
    try {
        const { parentPath, folderName } = req.body;
        if (!folderName) {
            return res.status(400).json({ error: "Folder name is required." });
        }

        // Clean folder name
        const cleanName = folderName.replace(/[^a-zA-Z0-9_\-가-힣]/g, "_");
        const parentDir = safeResolvePath(parentPath);
        const folderPath = path.join(parentDir, cleanName);

        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath);
            console.log(`Created Folder on disk: ${folderPath}`);
            invalidateCache();
            res.json({ success: true, folderName: cleanName });
        } else {
            res.status(400).json({ error: "Folder already exists." });
        }
    } catch (err) {
        console.error("Error creating folder:", err);
        res.status(500).json({ error: err.message || "Failed to create folder." });
    }
});

// 4.2 RENAME A DIRECTORY
app.post('/api/folders/rename', (req, res) => {
    try {
        const { parentPath, oldName, newName } = req.body;
        if (!oldName || !newName) {
            return res.status(400).json({ error: "Old name and new name are required." });
        }

        const cleanNewName = newName.replace(/[^a-zA-Z0-9_\-가-힣]/g, "_");
        const parentDir = safeResolvePath(parentPath);
        const oldPath = path.join(parentDir, oldName);
        const newPath = path.join(parentDir, cleanNewName);

        if (fs.existsSync(oldPath)) {
            fs.renameSync(oldPath, newPath);
            console.log(`Renamed Folder on disk: ${oldPath} -> ${newPath}`);
            invalidateCache();
            res.json({ success: true, newName: cleanNewName });
        } else {
            res.status(404).json({ error: "Folder not found." });
        }
    } catch (err) {
        console.error("Error renaming folder:", err);
        res.status(500).json({ error: err.message || "Failed to rename folder." });
    }
});

// --- USER DEFINE SCHEMA HELPERS & APIs ---

function parseFileNameWithSchema(fileName) {
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    
    // 1. 뒤에서 v숫자_숫자 버전 패턴 추출
    const versionMatch = base.match(/_(v\d+_\d+)$/);
    if (!versionMatch) {
        return { valid: false, error: "버전 형식은 v1_0, v2_0과 같이 v숫자_숫자 형식이어야 합니다." };
    }
    const versionPart = versionMatch[1];
    const remain1 = base.substring(0, base.length - versionPart.length - 1);
    
    // 2. 앞에서 날짜 추출
    const firstUnderscoreIdx = remain1.indexOf('_');
    if (firstUnderscoreIdx === -1) {
        return { valid: false, error: "파일명 형식이 올바르지 않습니다. (날짜 구분자 '_' 누락)" };
    }
    const datePart = remain1.substring(0, firstUnderscoreIdx);
    const remain2 = remain1.substring(firstUnderscoreIdx + 1);
    
    // 3. 부서·프로젝트 및 상세내용 추출
    const nextUnderscoreIdx = remain2.indexOf('_');
    if (nextUnderscoreIdx === -1) {
        return { valid: false, error: "파일명 형식이 올바르지 않습니다. (부서·프로젝트와 상세내용 구분자 '_' 누락)" };
    }
    const deptProjectPart = remain2.substring(0, nextUnderscoreIdx);
    const detailPart = remain2.substring(nextUnderscoreIdx + 1);
    
    return {
        valid: true,
        date: datePart,
        deptProject: deptProjectPart,
        detail: detailPart,
        version: versionPart,
        ext: ext
    };
}

function validateFileNameWithSchema(fileName) {
    const parsed = parseFileNameWithSchema(fileName);
    if (!parsed.valid) {
        return { valid: false, error: parsed.error };
    }
    
    // 1. 날짜 검증
    const datePart = parsed.date;
    if (!/^\d{8}$/.test(datePart)) {
        return { valid: false, error: "날짜는 YYYYMMDD 형식의 8자리 숫자여야 합니다." };
    }
    const year = parseInt(datePart.substring(0, 4));
    const month = parseInt(datePart.substring(4, 6));
    const day = parseInt(datePart.substring(6, 8));
    if (month < 1 || month > 12 || day < 1 || day > 31) {
        return { valid: false, error: "유효하지 않은 날짜입니다." };
    }
    
    // 2. 버전 검증
    if (!/^v\d+_\d+$/.test(parsed.version)) {
        return { valid: false, error: "버전 형식은 v1_0, v2_0과 같이 v숫자_숫자 형식이어야 합니다." };
    }
    
    // 3. 부서·프로젝트 검증
    if (/\s/.test(parsed.deptProject)) {
        return { valid: false, error: "부서·프로젝트 명에 공백(띄어쓰기)을 사용할 수 없습니다." };
    }
    if (/[\\/:*?"<>|]/.test(parsed.deptProject)) {
        return { valid: false, error: "부서·프로젝트 명에 금지 문자가 포함되어 있습니다." };
    }
    
    // 4. 상세내용 검증
    if (/\s/.test(parsed.detail)) {
        return { valid: false, error: "상세내용에 공백(띄어쓰기)을 사용할 수 없습니다." };
    }
    if (/[\\/:*?"<>|]/.test(parsed.detail)) {
        return { valid: false, error: "상세내용에 파일명 금지 문자(\\ / : * ? \" < > |)가 포함되어 있습니다." };
    }
    
    return { valid: true };
}

// 4.2.1 GET USER SCHEMA
app.get('/api/schema', (req, res) => {
    res.json(globalSettings.userFolderSchema || {});
});

// 4.2.2 POST USER SCHEMA
app.post('/api/schema', async (req, res) => {
    try {
        const { schemaName, levels, fileNameVariables } = req.body;
        if (!schemaName || !levels || !Array.isArray(levels) || levels.length === 0) {
            return res.status(400).json({ error: "Schema name and levels are required." });
        }
        if (levels.length > 3) {
            return res.status(400).json({ error: "폴더 구조는 최대 3단계(Depth)까지만 허용됩니다." });
        }
        
        globalSettings.userFolderSchema = { schemaName, levels, fileNameVariables };
        
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(globalSettings, null, 2));
        
        try {
            await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ['userFolderSchema', JSON.stringify(globalSettings.userFolderSchema)]);
        } catch (e) {
            console.error("Failed to save schema to SQLite settings", e);
        }
        
        invalidateCache();
        res.json({ success: true, schema: globalSettings.userFolderSchema });
    } catch (err) {
        console.error("Error saving schema:", err);
        res.status(500).json({ error: "Failed to save schema." });
    }
});

// 4.2.2.1 POST PARA AI FOLDER GENERATE
app.post('/api/para/generate', async (req, res) => {
    try {
        const { apiKey, jobStyle } = req.body;
        if (!apiKey) {
            return res.status(401).json({ error: "API Key is required in settings." });
        }
        if (!jobStyle) {
            return res.status(400).json({ error: "Job style description is required." });
        }
        if (!DESKTOP_ROOT || !fs.existsSync(DESKTOP_ROOT)) {
            return res.status(400).json({ error: "로컬 폴더 경로(바탕화면 실시간 폴더)가 먼저 설정되어 있어야 합니다." });
        }

        const prompt = `당신은 사용자의 업무 스타일과 직무 설명을 바탕으로 PARA(Projects, Areas, Resources, Archives) 방법론에 맞춘 폴더 구조를 설계해주는 AI 비서입니다.
반드시 다음 4개의 최상위 폴더를 유지해야 합니다:
0_Projects
1_Areas
2_Resources
3_Archives

사용자의 설명을 분석하여 각 최상위 폴더 아래에 적절한 하위 폴더들을 생성하세요. (최대 2 depth)
응답은 오직 생성해야 할 폴더들의 상대 경로 문자열 배열을 포함하는 순수 JSON 형식이어야 합니다. 마크다운 태그(\`\`\`json 등)나 다른 텍스트를 절대 포함하지 마세요.
예시:
[
  "0_Projects/[2026-07]_상반기_결산",
  "1_Areas/급여_및_인사관리",
  "2_Resources/세법_개정_참고자료",
  "3_Archives/_임시보관"
]

사용자 업무 설명:
${jobStyle}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2 }
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(`Gemini API Error: ${errData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        let aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        // Clean up markdown formatting if present
        aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        let folderPaths = [];
        try {
            folderPaths = JSON.parse(aiText);
            if (!Array.isArray(folderPaths)) throw new Error("Parsed JSON is not an array");
        } catch (e) {
            console.error("Failed to parse AI response as JSON:", aiText);
            return res.status(500).json({ error: "AI가 올바른 JSON 형식을 반환하지 않았습니다.", details: aiText });
        }

        const createdFolders = [];
        for (const relPath of folderPaths) {
            // Validate that the paths start with PARA directories to prevent arbitrary folder creation
            if (!/^[0-3]_(Projects|Areas|Resources|Archives)/.test(relPath)) continue;

            const cleanRelPath = relPath.replace(/[<>:"|?*]/g, '_'); // Replace invalid Windows chars
            const fullPath = path.join(DESKTOP_ROOT, cleanRelPath);

            // Basic security check to prevent directory traversal
            if (fullPath.startsWith(DESKTOP_ROOT)) {
                if (!fs.existsSync(fullPath)) {
                    fs.mkdirSync(fullPath, { recursive: true });
                    createdFolders.push(cleanRelPath);
                }
            }
        }

        invalidateCache();
        res.json({ success: true, createdFolders, aiResponse: folderPaths });
    } catch (err) {
        console.error("Error generating PARA folders:", err);
        res.status(500).json({ error: err.message || "Failed to generate PARA folders." });
    }
});

// 4.2.3 RENAME A FILE
app.post('/api/files/rename', (req, res) => {
    try {
        const { parentPath, oldName, newName } = req.body;
        if (!oldName || !newName) {
            return res.status(400).json({ error: "Old name and new name are required." });
        }
        
        const cleanOldName = path.basename(oldName);
        const cleanNewName = path.basename(newName);
        
        const validationResult = validateFileNameWithSchema(cleanNewName);
        if (!validationResult.valid) {
            return res.status(400).json({ error: validationResult.error });
        }
        
        const parentDir = safeResolvePath(parentPath);
        const oldPath = path.join(parentDir, cleanOldName);
        const newPath = path.join(parentDir, cleanNewName);
        
        if (!fs.existsSync(oldPath)) {
            return res.status(404).json({ error: "File not found." });
        }
        
        if (fs.existsSync(newPath) && cleanOldName !== cleanNewName) {
            return res.status(409).json({ error: "동일한 이름의 파일이 이미 존재합니다." });
        }
        
        fs.renameSync(oldPath, newPath);
        console.log(`Renamed File on disk: ${oldPath} -> ${newPath}`);
        invalidateCache();
        res.json({ success: true, newName: cleanNewName });
    } catch (err) {
        console.error("Error renaming file:", err);
        res.status(500).json({ error: err.message || "Failed to rename file." });
    }
});

// 4.3 DELETE A DIRECTORY RECURSIVELY
app.delete('/api/folders', (req, res) => {
    try {
        const { parentPath, folderName } = req.body;
        if (!folderName) {
            return res.status(400).json({ error: "Folder name is required." });
        }

        const parentDir = safeResolvePath(parentPath);
        const folderPath = path.join(parentDir, folderName);

        if (fs.existsSync(folderPath)) {
            fs.rmSync(folderPath, { recursive: true, force: true });
            console.log(`Deleted folder recursively: ${folderPath}`);
            invalidateCache();
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Folder not found." });
        }
    } catch (err) {
        console.error("Error deleting folder:", err);
        res.status(500).json({ error: err.message || "Failed to delete folder." });
    }
});

// 5. WORKCARD DB APIs
app.get('/api/workcards', async (req, res) => {
    try {
        const cards = await dbWorkCards.all('SELECT * FROM work_card_ledger');
        res.json(cards);
    } catch (err) {
        res.status(500).json({ error: "Failed to load workcards." });
    }
});

app.post('/api/workcards', async (req, res) => {
    try {
        await dbWorkCards.run('DELETE FROM work_card_ledger');
        const cards = req.body;
        const stmt = await dbWorkCards.prepare('INSERT INTO work_card_ledger (card_id, user_id, name, company, position, mobile, phone, email, fax, address, website_url, sns, image_front_base64, image_back_base64, tags, relationship, rating, meet_location, memo, is_shared, raw_ocr_text, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        for (const c of cards) {
            await stmt.run([
                c.card_id, c.user_id, c.name, c.company, c.position, c.mobile, c.phone, c.email, c.fax, c.address, c.website_url, c.sns, c.image_front_base64, c.image_back_base64, c.tags, c.relationship, c.rating, c.meet_location, c.memo, c.is_shared, c.raw_ocr_text, c.created_at || new Date().toISOString(), new Date().toISOString()
            ]);
        }
        await stmt.finalize();
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to save workcards." });
    }
});

// 6. SHARED ASSETS DB APIs
app.get('/api/shared-assets', async (req, res) => {
    try {
        const assets = await dbTasks.all('SELECT * FROM shared_assets');
        res.json(assets);
    } catch (err) {
        res.status(500).json({ error: "Failed to load assets." });
    }
});

app.post('/api/shared-assets', async (req, res) => {
    try {
        await dbTasks.run('DELETE FROM shared_assets');
        const assets = req.body;
        const stmt = await dbTasks.prepare('INSERT INTO shared_assets (id, name, assetNumber, category, format, ownerName, status, description) VALUES (?,?,?,?,?,?,?,?)');
        for (const a of assets) {
            await stmt.run([a.id, a.name, a.assetNumber, a.category, a.format, a.ownerName, a.status, a.description]);
        }
        await stmt.finalize();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to save assets." });
    }
});

// 7. TASKS DB APIs
app.get('/api/tasks', async (req, res) => {
    try {
        const tasks = await dbTasks.all('SELECT * FROM tasks');
        tasks.forEach(t => {
            try {
                if (t.timeline) t.timeline = JSON.parse(t.timeline);
            } catch(e) { t.timeline = []; }
        });
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: "Failed to load tasks." });
    }
});

app.post('/api/tasks', async (req, res) => {
    try {
        const tasks = req.body;
        if (!Array.isArray(tasks)) {
            return res.status(400).json({ error: "Expected an array of tasks." });
        }

        // UPSERT each task individually — does NOT delete tasks missing from the payload.
        // This ensures partial saves (e.g., timeline update) don't wipe other tasks from DB.
        const stmt = await dbTasks.prepare(`
            INSERT OR REPLACE INTO tasks
            (id, title, department, assignee, amount, status, deliveryDate, itemsCount, description, priority, folder, completedAt, timeline)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        `);
        for (const t of tasks) {
            if (!t.id) continue;
            await stmt.run([
                t.id, t.title, t.department, t.assignee, t.amount,
                t.status, t.deliveryDate, t.itemsCount, t.description,
                t.priority, t.folder || 'none', t.completedAt || null,
                t.timeline ? JSON.stringify(t.timeline) : null
            ]);
        }
        await stmt.finalize();

        // Ensure folder creation and migration for tasks
        if (DESKTOP_ROOT && Array.isArray(tasks)) {
            const taskFilesRoot = path.join(DESKTOP_ROOT, "05_업무_연관_파일_Task_Files");
            
            Object.values(TASK_STATUS_FOLDERS).forEach(sub => {
                const subPath = path.join(taskFilesRoot, sub);
                if (!fs.existsSync(subPath)) {
                    fs.mkdirSync(subPath, { recursive: true });
                }
            });

            tasks.forEach(task => {
                if (!task.id) return;
                const correctSub = getStatusFolder(task.status);
                const targetPath = path.join(taskFilesRoot, correctSub, task.id);
                
                if (fs.existsSync(targetPath)) return;
                
                let moved = false;
                for (const otherStatus of Object.keys(TASK_STATUS_FOLDERS)) {
                    if (otherStatus === task.status) continue;
                    const otherSub = getStatusFolder(otherStatus);
                    const otherPath = path.join(taskFilesRoot, otherSub, task.id);
                    if (fs.existsSync(otherPath)) {
                        fs.renameSync(otherPath, targetPath);
                        console.log(`[MOVE] Moved task folder: ${task.id} (${otherSub} -> ${correctSub})`);
                        moved = true;
                        break;
                    }
                }
                
                if (!moved) {
                    const oldRootPath = path.join(taskFilesRoot, task.id);
                    if (fs.existsSync(oldRootPath)) {
                        fs.renameSync(oldRootPath, targetPath);
                        console.log(`[MOVE] Moved task folder from root: ${task.id} -> ${correctSub}`);
                        moved = true;
                    }
                }

                if (!moved) {
                    fs.mkdirSync(targetPath, { recursive: true });
                    console.log(`[CREATE] Created new task folder: ${task.id} under ${correctSub}`);
                }
            });
        }

        invalidateCache();
        res.json({ success: true });
    } catch (err) {
        console.error("Failed to save tasks & sync folders:", err);
        res.status(500).json({ error: "Failed to save tasks." });
    }
});

// DELETE a single task by ID
app.delete('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: "Missing task id." });
        await dbTasks.run('DELETE FROM tasks WHERE id = ?', [id]);

        // Also clean up task folder if it exists
        if (DESKTOP_ROOT) {
            const taskFilesRoot = path.join(DESKTOP_ROOT, "05_업무_연관_파일_Task_Files");
            for (const sub of Object.values(TASK_STATUS_FOLDERS)) {
                const taskPath = path.join(taskFilesRoot, sub, id);
                if (fs.existsSync(taskPath)) {
                    fs.rmSync(taskPath, { recursive: true, force: true });
                    console.log(`[DELETE] Removed task folder: ${taskPath}`);
                    break;
                }
            }
        }

        invalidateCache();
        res.json({ success: true });
    } catch (err) {
        console.error("Failed to delete task:", err);
        res.status(500).json({ error: "Failed to delete task." });
    }
});

// AI Summarize Task Endpoint
app.post('/api/ai/summarize-task', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: "No text provided" });
        }

        const apiKey = globalSettings.apiKey;
        const prompt = `
다음은 사용자의 업무 지시 메모입니다. 이 내용을 분석하여 아래의 JSON 포맷으로 추출해주세요.
- 업무 명칭(title): 요약된 업무 제목 (짧게)
- 담당 부서(department): 메모에서 유추되거나 언급된 부서 (기본: "공통") - [인사총무팀, 영업팀, 개발팀, 구매팀, 경영지원] 중 하나로 선택.
- 담당 실무자(assignee): 메모에 언급된 담당자 이름이나 직급 (없으면 "미정")
- 마감 기한(deliveryDate): 언급된 날짜를 YYYY-MM-DD 형식으로 변환 (현재 기준 미래, 명시되지 않았으면 빈 문자열 "")
- 우선순위(priority): 긴급함의 정도 ("보통", "긴급", "낮음" 중 하나)
- 요약 및 기재사항(description): 업무 내용에 대한 2~3문장 요약
- 연관 파일 정보(files): 만약 특정 파일이나 문서가 언급되었다면 그 키워드들의 배열 (없으면 빈 배열)

입력 메모:
"""
${text}
"""

반드시 JSON 형식의 텍스트만 출력하세요 (백틱 \`\`\`json 등 마크다운 포함하지 말고 순수 JSON만 출력).
JSON 형식:
{
  "title": "",
  "department": "",
  "assignee": "",
  "deliveryDate": "",
  "priority": "보통",
  "description": "",
  "files": []
}
`;

        // Node.js 18+ has built-in fetch
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error("Gemini API Error:", errorData);
            return res.status(500).json({ error: "AI API error" });
        }

        const data = await response.json();
        let aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        aiText = aiText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
        
        const parsedJSON = JSON.parse(aiText);
        res.json({ success: true, data: parsedJSON });

    } catch (err) {
        console.error("AI summarization error:", err);
        res.status(500).json({ error: "Failed to summarize task." });
    }
});

// AI USER SCHEMA VALIDATION FOR OPERATIONS
function validateOperationsWithSchema(operations, dirPath) {
    const schema = globalSettings.userFolderSchema;
    if (!schema) return { valid: true };

    const lvl1 = schema.levels.find(l => l.level === 1);
    const lvl2 = schema.levels.find(l => l.level === 2);
    const lvl3 = schema.levels.find(l => l.level === 3);

    for (const op of operations) {
        if (!op.target) continue;
        
        const targetPath = op.target.replace(/\\/g, '/');
        const parts = targetPath.split('/').filter(p => p.trim() !== '');

        if (op.type === "CREATE_DIR") {
            if (parts.length > 3) {
                return { valid: false, error: `폴더 구조는 최대 3단계를 초과할 수 없습니다. (위반 경로: ${op.target})` };
            }
            if (parts.length >= 2 && lvl2 && lvl2.inputType === 'fixed_list') {
                const folderLvl2 = parts[1];
                if (!lvl2.options.includes(folderLvl2)) {
                    return { valid: false, error: `2단계 폴더명 '${folderLvl2}'은(는) 허용된 카테고리 목록 [${lvl2.options.join(', ')}] 에 포함되지 않습니다.` };
                }
            }
            if (parts.length >= 1 && lvl1 && lvl1.inputType === 'fixed_list') {
                const folderLvl1 = parts[0];
                if (!lvl1.options.includes(folderLvl1)) {
                    return { valid: false, error: `1단계 폴더명 '${folderLvl1}'은(는) 허용된 카테고리 목록 [${lvl1.options.join(', ')}] 에 포함되지 않습니다.` };
                }
            }
        } else if (op.type === "CREATE_FILE" || op.type === "MOVE") {
            // MOVE에서 target이 폴더일 수 있음
            // 만약 target이 폴더 경로이고 source 파일명을 그대로 쓸 경우, 최종 파일 경로를 구성하여 검증해야 함
            let finalFileName = parts[parts.length - 1];
            let finalParts = parts;
            
            if (op.type === "MOVE" && op.source) {
                const sourceBase = path.basename(op.source);
                // target이 기존 디렉토리이거나 폴더 경로형태인 경우
                const targetFullPath = path.join(dirPath, op.target.replace(/\\/g, '/'));
                let isDestDir = false;
                if (fs.existsSync(targetFullPath)) {
                    isDestDir = fs.statSync(targetFullPath).isDirectory();
                } else {
                    // 존재하지 않더라도 확장자가 없으면 폴더로 유추
                    isDestDir = !path.extname(cleanOldName = path.basename(op.target));
                }
                
                if (isDestDir) {
                    finalFileName = sourceBase;
                    finalParts = [...parts, sourceBase];
                }
            }

            const fileVal = validateFileNameWithSchema(finalFileName);
            if (!fileVal.valid) {
                return { valid: false, error: `파일명 '${finalFileName}'이 지침에 맞지 않습니다: ${fileVal.error}` };
            }

            if (finalParts.length > 4) {
                return { valid: false, error: `파일의 폴더 경로가 3단계를 초과합니다. (위반 경로: ${op.target})` };
            }

            if (finalParts.length >= 3 && lvl2 && lvl2.inputType === 'fixed_list') {
                const folderLvl2 = finalParts[1];
                if (!lvl2.options.includes(folderLvl2)) {
                    return { valid: false, error: `부모 폴더의 2단계 카테고리 '${folderLvl2}'이(가) 허용된 목록에 없습니다.` };
                }
            }
        }
    }
    return { valid: true };
}

// AI File System Agent API
app.post('/api/ai/fs-agent', async (req, res) => {
    try {
        const { targetPath, promptText } = req.body;
        if (targetPath === undefined) return res.status(400).json({ error: "Target path required" });
        if (!promptText) return res.status(400).json({ error: "Prompt required" });

        const dirPath = safeResolvePath(targetPath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        const filesList = fs.readdirSync(dirPath).filter(entry => {
            return !entry.startsWith('.') && entry !== "desktop.ini";
        });

        const apiKey = globalSettings.apiKey;
        if (!apiKey) return res.status(400).json({ error: "AI API Key가 설정되지 않았습니다. 환경설정에서 API 키를 입력하세요." });

        const schema = globalSettings.userFolderSchema || {
            schemaName: "기본 기획팀 양식",
            levels: [
                { level: 1, label: "연도_부서명", inputType: "free_text" },
                { level: 2, label: "업무성격", inputType: "fixed_list", options: ["01_시장조사", "02_전략기획", "03_캠페인진행", "04_예산집행"] },
                { level: 3, label: "프로젝트명", inputType: "free_text", isLeaf: true }
            ],
            fileNameVariables: ["level1", "level2"]
        };

        const todayDateStr = new Date().toISOString().substring(0, 10).replace(/-/g, ''); // YYYYMMDD 형태

        const schemaDescription = `
[사용자 정의 폴더/파일 관리 지침 및 규칙]
1. 폴더 구조 설계 스키마 (최대 3단계 Depth 원칙)
   - 1단계 (대분류): ${schema.levels.find(l => l.level === 1)?.label || "연도_부서명"} (${schema.levels.find(l => l.level === 1)?.inputType === 'fixed_list' ? '고정목록형: ' + schema.levels.find(l => l.level === 1).options.join(', ') : '자유 텍스트형'})
   - 2단계 (중분류): ${schema.levels.find(l => l.level === 2)?.label || "업무성격"} (${schema.levels.find(l => l.level === 2)?.inputType === 'fixed_list' ? '고정목록형(아래 선택지 중에서만 생성해야 함): ' + schema.levels.find(l => l.level === 2).options.join(', ') : '자유 텍스트형'})
   - 3단계 (소분류 - 최하위 폴더): ${schema.levels.find(l => l.level === 3)?.label || "프로젝트명"} (이 폴더 내부에는 더 이상 하위 폴더를 만들지 않고 파일만 넣습니다.)

2. 파일 네이밍 규칙
   - 공식: 날짜(8자리)_1단계폴더명-2단계폴더명_상세내용_버전.확장자
   - 오늘 날짜(YYYYMMDD): ${todayDateStr} (반드시 YYYYMMDD 형식의 8자리 숫자로 시작)
   - 1단계폴더명-2단계폴더명: 파일이 위치하는 경로의 1단계 폴더명과 2단계 폴더명을 대시(-)로 결합해야 합니다.
   - 상세내용: 하이픈(-)을 사용해 단어 연결 (공백/띄어쓰기는 절대 금지하며 하이픈으로 대체).
   - 버전: v1_0, v1_1, v2_0 형식 (소수점 대신 언더바 사용 필수). 처음 만드는 파일은 v1_0.
   - 확장자: 원본 파일의 확장자 유지.

예시 파일명:
   - 만약 1단계가 '2026_기획팀'이고 2단계가 '01_시장조사'이면:
     ${todayDateStr}_2026_기획팀-01_시장조사_신사업-제안서_v1_0.pptx
`;

        const prompt = `
당신은 지능적인 파일 시스템 에이전트입니다. 사용자의 지시를 분석하여 필요한 파일 및 폴더 생성, 이동 작업을 수행해야 합니다.
당신은 반드시 지정된 [사용자 정의 폴더/파일 관리 지침 및 규칙]을 엄격하게 지켜야 합니다.

현재 작업 폴더 내의 기존 항목 목록:
${filesList.length > 0 ? filesList.join("\n") : "(항목 없음)"}

현재 스키마 지침:
${schemaDescription}

사용자의 지시사항: "${promptText}"

위 지시사항을 분석하여, 아래 JSON 배열 포맷으로 수행할 작업(Operations) 목록을 반환하세요.
작업은 반드시 순서대로 실행됩니다 (예: 폴더를 먼저 생성한 후, 그 안으로 파일 이동 또는 생성).

사용 가능한 작업(type) 종류:
1. "CREATE_DIR": 새 폴더 생성. (필요 속성: "target" - 생성할 폴더명(예: "2026_기획팀/01_시장조사/202603_신규프로젝트"))
2. "CREATE_FILE": 새 파일 생성 및 내용 작성. (필요 속성: "target" - 생성할 파일명(경로 포함, 예: "2026_기획팀/01_시장조사/202603_신규프로젝트/${todayDateStr}_2026_기획팀-01_시장조사_가이드문서_v1_0.txt"), "content" - 파일에 들어갈 초기 내용 문자열)
3. "MOVE": 기존 파일이나 폴더를 다른 위치로 이동. (필요 속성: "source" - 이동할 기존 항목명, "target" - 대상 폴더명 또는 새 경로. 파일을 다른 폴더로 이동시킬 때, 파일명도 위 네이밍 공식에 맞게 이름을 변경하여 이동시켜야 합니다.)

JSON 형식 예시:
[
  { "type": "CREATE_DIR", "target": "2026_기획팀/01_시장조사/202603_신규프로젝트" },
  { "type": "MOVE", "source": "구-보고서.docx", "target": "2026_기획팀/01_시장조사/202603_신규프로젝트/${todayDateStr}_2026_기획팀-01_시장조사_신사업-기획서_v1_0.docx" }
]

(주의: 반드시 마크다운이나 백틱 없이 순수 JSON 배열 문자열만 반환하세요. 생성하는 파일의 content는 문자열이어야 합니다. 모든 폴더와 파일 명명 규칙을 어기면 시스템에서 거부됩니다.)
`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error("Gemini API Error:", errorData);
            return res.status(500).json({ error: "AI API error" });
        }

        const data = await response.json();
        let aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        aiText = aiText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
        
        let operations = [];
        try {
            operations = JSON.parse(aiText);
        } catch (e) {
            return res.status(500).json({ error: "AI가 올바른 포맷을 반환하지 않았습니다.", raw: aiText });
        }

        // 서버단 스키마 규칙 검증 게이트
        const validation = validateOperationsWithSchema(operations, dirPath);
        if (!validation.valid) {
            console.warn("AI operations rejected due to schema violation:", validation.error, "AI raw response:", aiText);
            return res.status(400).json({ 
                error: `AI가 스키마 지침에 맞지 않는 파일/폴더 조작을 시도하여 차단되었습니다.\n상세 오류: ${validation.error}`,
                raw: aiText
            });
        }

        let executedCount = 0;
        for (const op of operations) {
            try {
                if (!op.target) continue;
                
                const safeTarget = op.target.replace(/\\/g, '/').replace(/\.\.\//g, '').replace(/[<>|*?"]/g, '_');
                const targetFullPath = path.join(dirPath, safeTarget);

                if (op.type === "CREATE_DIR") {
                    if (!fs.existsSync(targetFullPath)) {
                        fs.mkdirSync(targetFullPath, { recursive: true });
                        executedCount++;
                    }
                } else if (op.type === "CREATE_FILE") {
                    const targetDir = path.dirname(targetFullPath);
                    if (!fs.existsSync(targetDir)) {
                        fs.mkdirSync(targetDir, { recursive: true });
                    }
                    fs.writeFileSync(targetFullPath, op.content || "", 'utf8');
                    executedCount++;
                } else if (op.type === "MOVE" && op.source) {
                    const safeSource = op.source.replace(/\\/g, '/').replace(/\.\.\//g, '');
                    const sourceFullPath = path.join(dirPath, safeSource);
                    
                    if (fs.existsSync(sourceFullPath) && sourceFullPath !== targetFullPath) {
                        let finalDest = targetFullPath;
                        if (fs.existsSync(targetFullPath) && fs.statSync(targetFullPath).isDirectory()) {
                            finalDest = path.join(targetFullPath, path.basename(safeSource));
                        } else {
                            const targetDir = path.dirname(targetFullPath);
                            if (!fs.existsSync(targetDir)) {
                                fs.mkdirSync(targetDir, { recursive: true });
                            }
                        }
                        
                        if (sourceFullPath !== finalDest) {
                            fs.renameSync(sourceFullPath, finalDest);
                            executedCount++;
                        }
                    }
                }
            } catch (err) {
                console.error("Operation failed:", op, err);
            }
        }

        invalidateCache();
        res.json({ success: true, executedCount });

    } catch (err) {
        console.error("AI fs-agent error:", err);
        res.status(500).json({ error: "Failed to execute AI operations." });
    }
});

// AI Project Task Capture
app.post('/api/ai/task-capture', async (req, res) => {
    try {
        const { promptText } = req.body;
        if (!promptText) return res.status(400).json({ error: "Prompt required" });

        const apiKey = globalSettings.apiKey;
        if (!apiKey) return res.status(400).json({ error: "AI API Key가 설정되지 않았습니다." });

        const prompt = `당신은 똑똑한 구매/조달 업무 관제탑 어시스턴트입니다. 사용자의 메모를 분석하여 가장 적절한 제목, 칸반 상태, PARA 폴더로 분류하세요. 기한이나 조건이 있으면 설명에 추가하세요.

다음 메모를 분석해서 할 일 데이터로 만들어줘:
"${promptText}"

다음 JSON 구조를 반환하세요.
{
  "title": "작업의 핵심 제목 (짧고 명확하게)",
  "status": "inbox, todo, inprogress, waiting, done 중 하나",
  "folder": "none, projects, areas, resources, archives 중 하나",
  "description": "상세 내용, 기한, 담당자 등 추가 정보 (마크다운)"
}
결과는 마크다운 없이 순수 JSON 객체만 반환하세요.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) return res.status(500).json({ error: "AI API error" });
        const data = await response.json();
        let aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        aiText = aiText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
        
        let result = JSON.parse(aiText);
        res.json({ success: true, data: result });
    } catch (err) {
        console.error("AI task-capture error:", err);
        res.status(500).json({ error: "Failed to parse task" });
    }
});

// AI Project Task Elaborate
app.post('/api/ai/task-elaborate', async (req, res) => {
    try {
        const { title, description } = req.body;
        if (!title) return res.status(400).json({ error: "Title required" });

        const apiKey = globalSettings.apiKey;
        if (!apiKey) return res.status(400).json({ error: "AI API Key가 설정되지 않았습니다." });

        const defaultPersona = "당신은 10년 차 전문 구매/조달 실무자입니다. 주어진 업무 지시사항을 보고, 구체적인 실행 체크리스트나 협력사 발송용 이메일 초안(필요시)을 마크다운 형식으로 작성해주세요. 전문적이고 정중한 어조를 사용하세요.";
        
        let prompt = "";
        if (globalSettings.aiContext) {
            // 사용자 페르소나가 있는 경우, 오직 사용자의 지시사항만 따름
            prompt = `${globalSettings.aiContext}

업무 제목: ${title}
현재 내용:
${description || '(내용 없음)'}`;
        } else {
            // 사용자 페르소나가 없는 경우, 기존의 길고 상세한 기본 프롬프트 사용
            prompt = `${defaultPersona}

업무 제목: ${title}
현재 내용:
${description || '(내용 없음)'}

이 업무를 수행하기 위한 구체적인 액션 플랜 체크리스트를 만들어주고, 만약 외부 업체와 소통해야 하는 일이라면 이메일 초안도 함께 작성해줘.`;
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) return res.status(500).json({ error: "AI API error" });
        const data = await response.json();
        let aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        res.json({ success: true, text: aiText });
    } catch (err) {
        console.error("AI task-elaborate error:", err);
        res.status(500).json({ error: "Failed to elaborate task" });
    }
});

// AI Business Card OCR Scan using Gemini
app.post('/api/ai/scan-card', async (req, res) => {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: "Image data required" });

    const apiKey = globalSettings.apiKey;
    if (!apiKey) return res.status(400).json({ error: "AI API Key가 설정되지 않았습니다. 환경설정에서 API 키를 입력하세요." });

    let base64Data = image;
    if (image.includes(',')) {
        base64Data = image.split(',')[1];
    }

    const prompt = `
이 이미지에서 명함의 정보를 분석하고 추출하세요.
반드시 아래 정의된 JSON 포맷 문자열로만 응답하세요. 다른 설명이나 마크다운 백틱은 절대 포함하지 마십시오.

추출할 정보 포맷:
{
  "name": "성명 (추출 실패 시 빈 문자열)",
  "company": "회사/기관명 (추출 실패 시 빈 문자열)",
  "position": "직급/직책 (추출 실패 시 빈 문자열)",
  "mobile": "휴대폰 번호 (예: 010-1234-5678, 추출 실패 시 빈 문자열)",
  "phone": "회사 전화번호 (추출 실패 시 빈 문자열)",
  "email": "이메일 주소 (추출 실패 시 빈 문자열)",
  "fax": "팩스 번호 (추출 실패 시 빈 문자열)",
  "address": "회사 주소 (추출 실패 시 빈 문자열)",
  "website": "홈페이지 URL (추출 실패 시 빈 문자열)",
  "sns": "SNS 주소나 카카오톡 ID 등 (추출 실패 시 빈 문자열)",
  "memo": "부서명 또는 특이사항 요약 (추출 실패 시 빈 문자열)"
}
`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType: "image/jpeg",
                                data: base64Data
                            }
                        }
                    ]
                }]
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error("Gemini API OCR Error:", errorData);
            return res.status(500).json({ error: "AI API error" });
        }

        const data = await response.json();
        let aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        aiText = aiText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
        
        let result = {};
        try {
            result = JSON.parse(aiText);
        } catch (e) {
            console.error("Failed to parse Gemini response as JSON:", aiText);
            return res.status(500).json({ error: "AI response format error", raw: aiText });
        }

        res.json({ success: true, card: result });
    } catch (err) {
        console.error("AI OCR Exception:", err);
        res.status(500).json({ error: "Failed to scan card" });
    }
});


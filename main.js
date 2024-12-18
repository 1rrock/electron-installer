const { app, BrowserWindow, shell, ipcMain, Menu, screen, dialog } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const extract = require('extract-zip');
const axios = require('axios');

let win = null;
let serverApp;
let isInsstalled = false;

let baseUrl;
// const updateJsonPath = 'http://tst.wren.kr/1rrock/bookUpdate.json';
const updateJsonPath = 'https://kr.object.ncloudstorage.com/ybm-prd-std/3rdParty/bluega/bookUpdate2025/bookUpdate.json';

const getInstalledBookPath = () => baseUrl;
// 기존 console.log를 확장하여 log.txt에 기록
function createCustomLogger(logFilePath) {
    const originalLog = console.log;

    console.log = (...args) => {
        // 화면에 출력
        originalLog(...args);

        // log.txt에 기록
        const logMessage = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ');
        fs.appendFileSync(logFilePath, logMessage + '\n', 'utf8');
    };
}

// book.js에서 book_name 추출
function getBookJsMeta() {
    const filePath = `${app.getAppPath()}/e-abr/book/book.js`;

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const cleanedContent = fileContent.replace(/(?!\/\*{ABR\*\/)(?!\/\*ABR\}\*\/)(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g, '');
    const jsonMatch = cleanedContent.match(/abr\.cfgBook\s*=\s*\/\*{ABR\*\/\s*(\{[\s\S]*?\})\s*\/\*ABR\}\*\//);
    if (jsonMatch && jsonMatch[1]) {
        try {
            // 추출한 JSON 문자열을 JavaScript 객체로 변환
            const config = JSON.parse(jsonMatch[1]);
            return config.meta;
        } catch (error) {
            console.log('JSON 파싱 에러:', error);
            return null;
        }
    } else {
        console.log('JSON을 찾을 수 없습니다.');
        return null;
    }
}

const checkInstalled = () => {
    const exeName = process.execPath.split('\\').pop();
    const installFlagPath = path.join(baseUrl, `Uninstall ${exeName}`);

    if (fs.existsSync(installFlagPath)) {
        console.log('App is installed');
        isInsstalled = true;
        return true;
    } else {
        console.log('App is not installed');
        isInstalled = false;
        return false;
    }
};

function bookInstall() {
    const installExePath = path.join(baseUrl, 'installer.exe');
    // spawn(installExePath, null, { shell: true });
    exec(`"${installExePath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Execution failed: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Stderr: ${stderr}`);
            return;
        }
        console.log(`Output: ${stdout}`);
    });
}

async function downloadAndExtract(url) {
    const targetPath = getInstalledBookPath();
    // // 디렉토리 확인 및 생성
    // if (!fs.existsSync(targetPath)) {
    //     fs.mkdirSync(targetPath, { recursive: true }); // 디렉토리 생성
    // }

    const zipPath = path.join(targetPath, 'update.zip');

    // 다운로드
    const response = await axios({
        method: 'get',
        url: url,
        responseType: 'stream',
        onDownloadProgress(progressEvent) {
            const percentCompleted = Math.round(
                (progressEvent.loaded * 60) / progressEvent.total
            );

            if(win) {
                win.webContents.send('download-progress', percentCompleted);
            }
        },
    });

    const writer = fs.createWriteStream(zipPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', () => {
            console.log('압축풀기 시작')
            win.webContents.send('download-progress', 80);
            // 압축 풀기
            extract(zipPath, { dir: targetPath }).then(() => {
                win.webContents.send('download-progress', 100);
                console.log('압축풀기 완료');
                fs.unlinkSync(zipPath); // 압축 파일 삭제
                resolve(true);
            });
        });

        writer.on('error', (err) => {
            reject(err);
        });
    });
}

async function updateLocalIni() {
    const localSysIniPath = `${getInstalledBookPath()}/resources/app/e-abr/abr/sys.ini`;
    let iniContent = fs.readFileSync(localSysIniPath, 'utf-8');

    iniContent = iniContent.replace(/APP=\d+/, `APP=${serverApp.ver}`);
    fs.writeFileSync(localSysIniPath, iniContent, 'utf-8');
}

async function getUpdateInfo() {
    const response = await axios.get(updateJsonPath);
    if(response && response.data){
        return response.data;
    } else {
        return null;
    }
}

const checkUpdate = async () => {
    let localSysIniPath = `${getInstalledBookPath()}/resources/app/e-abr/abr/sys.ini`;
    const appId = getBookJsMeta().appId

    function getLocalVersion() {
        const iniContent = fs.readFileSync(localSysIniPath, 'utf-8');
        const match = iniContent.match(/APP=(\d+)/);
        return match ? parseInt(match[1], 10) : null;
    }

    const localVersion = getLocalVersion();

    if (localVersion === null || appId === null) {
        console.log('로컬 버전 또는 appId를 찾을 수 없습니다.');
        return false;
    }

    try {
        const updateInfo = await getUpdateInfo();
        if(!updateInfo){
            console.log('업데이트 실패')
            return false;
        }
        serverApp = updateInfo[appId];

        if (!serverApp) {
            console.log('서버에서 해당 appId의 업데이트 정보를 찾을 수 없습니다.');
            return false;
        }

        if (serverApp.ver > localVersion) {
            console.log(`업데이트가 필요합니다. (로컬 버전: ${localVersion}, 서버 버전: ${serverApp.ver})`);
            return true;
        } else {
            console.log('업데이트가 안필요')
            return false;
        }
    } catch (err) {
        console.error('업데이트 중 오류 발생:', err);
        return true;
    }
}

const _update = async () => {
    try {
        const appId = getBookJsMeta().appId;
        const updateInfo = await getUpdateInfo();
        serverApp = updateInfo[appId];
        await downloadAndExtract(serverApp.url);
        await updateLocalIni(serverApp);

        console.log('업데이트 완료.');
        if(win) {
            win.webContents.send('complete-progress');
        }
        return true;
    } catch(err) {
        console.log(err)
        return false;
    }
}

const setBaseUrl = () => {
    baseUrl = process.execPath.split('\\');
    baseUrl.pop();
    baseUrl = baseUrl.join('\\');
}

const createWindow = () => {
    const appPath = app.getAppPath();

    // log.txt 파일 경로 생성
    const logFilePath = path.join(appPath, 'log.txt');

    // 사용자 정의 로그 함수 활성화
    createCustomLogger(logFilePath);

    const { width } = screen.getPrimaryDisplay().workAreaSize;

    // 1280x720 비율에 맞춰 높이 계산
    const targetWidth = width;
    const targetHeight = Math.round((720 / 1280) * targetWidth);
    win = new BrowserWindow({
        width: targetWidth,
        height: targetHeight,
        webPreferences: {
            preload: path.join(app.getAppPath(), 'preload.js'),
            webSecurity: false,
        },
        icon: path.join(__dirname, 'icon.ico')
    });

    const htmlFilePath = path.join(app.getAppPath(), 'e-abr', 'index.html');
    win.webContents.setWindowOpenHandler(({url}) => {
        if(url.startsWith('http')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return {
            action: 'allow',
            overrideBrowserWindowOptions: {
                width: targetWidth,
                height: targetHeight,
            }
        };
    })

    ipcMain.on('bookInstall',  (event) => {
        bookInstall();
    })

    ipcMain.handle('checkUpdate',async () => {
        if(isInsstalled){
            return await checkUpdate();
        } else {
            return false;
        }
    });

    ipcMain.on('update', () => _update());

    ipcMain.on('installedRestart', () => {
        win.loadURL(`${getInstalledBookPath()}/resources/app/e-abr/index.html?APXABRDPXY=I`);
    })

    ipcMain.on('closeWindowApp', () => {
        win.close();
    })

    setBaseUrl();

    if(checkInstalled()){
        win.loadURL(`${htmlFilePath}?APXABRDPXY=I`);
    } else {
        win.loadURL(`${htmlFilePath}`);
    }

    Menu.setApplicationMenu(null)
};

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
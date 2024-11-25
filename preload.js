const { contextBridge, ipcRenderer } = require('electron/renderer');

contextBridge.exposeInMainWorld('electronAPI', {
    bookInstall: (callback) => {
        ipcRenderer.send('bookInstall');
    },
    installedRestart: () => {
        ipcRenderer.send('installedRestart');
    },
    checkUpdate: (callback) => {
        ipcRenderer.invoke('checkUpdate').then(callback);
    },
    update: () => {
        ipcRenderer.send('update');
    }
})

window.addEventListener('DOMContentLoaded', () => {
    ipcRenderer.on('download-progress', (event, current_progress) => {
        const eLoadingTag = (document.querySelector('.pageapp-iframe') && document.querySelector('.pageapp-iframe').contentDocument.querySelector('.e-loading')) || document.querySelector('.e-loading');
        if(!eLoadingTag) return;
        const eLoadingWrap = document.querySelector('.e-loading-wrap');
        if(eLoadingWrap){
            eLoadingWrap.style.display = 'flex';
        }
        const progressBar = eLoadingTag.querySelector('#dynamic')
        progressBar.style.width = current_progress + "%";
        progressBar.setAttribute("aria-valuenow", current_progress);
        progressBar.textContent = current_progress + "% Complete";
    });

    ipcRenderer.on('create-lnk-ing', () => {
        const eLoadingTag = (document.querySelector('.pageapp-iframe') && document.querySelector('.pageapp-iframe').contentDocument.querySelector('.e-loading')) || document.querySelector('.e-loading');

        const progressDesc = eLoadingTag.querySelector('.progress-desc');
        const progressDescWrap = eLoadingTag.querySelector('.progress-desc-wrap');
        progressDescWrap.style.cssText = 'display:flex;font-size: 30px;margin-bottom: 60px;margin-left:60px;width:350px;text-align: left;color:#575757;font-family: Nanum Gothic;';
        progressDesc.innerText = '바로가기 생성 중입니다';
    });

    ipcRenderer.on('complete-progress', () => {
        const eLoadingTag = (document.querySelector('.pageapp-iframe') && document.querySelector('.pageapp-iframe').contentDocument.querySelector('.e-loading')) || document.querySelector('.e-loading');

        const progressPopup = eLoadingTag.querySelector('.progress-popup');

        for(let i = 0; i < 2; i++){
            if(progressPopup.children[0]){
                progressPopup.children[0].remove()
            }
        }

        const desc = document.createElement('span');
        desc.style.cssText = "font-size:30px;text-align:center;margin-bottom:60px;color:#575757";
        desc.innerHTML = "업데이트가 완료 되었습니다.<br/>다시 실행해 주세요.";

        const btn = document.createElement('button');
        btn.textContent = '확인';
        btn.style.cssText = "position:absolute;bottom:50px;width:200px;height:40px;background-color:rgb(217 217 217);border-radius:10px;border:none;cursor:pointer;"
        btn.onclick = () => {
            ipcRenderer.send('closeWindowApp');
        }
        progressPopup.append(desc,btn);
    });

    ipcRenderer.on('book-install-progress', (event, current_progress) => {
        const eLoadingTag = (document.querySelector('.pageapp-iframe') && document.querySelector('.pageapp-iframe').contentDocument.querySelector('.e-loading')) || document.querySelector('.e-loading');
        const progressBar = eLoadingTag.querySelector('#dynamic');

        progressBar.style.width = current_progress + "%";
        progressBar.setAttribute("aria-valuenow", current_progress);
        progressBar.textContent = current_progress + "% Complete";
    });
});
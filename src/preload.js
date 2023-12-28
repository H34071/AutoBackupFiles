// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require("electron/renderer");
// Set up listeners outside the contextBridge
ipcRenderer.on("DownloadFinished", (event, fileName) => {
  updateStatusDownload(fileName, "Finished");
});

ipcRenderer.on("DownloadAllFilesFinished", (event, fileName) => {
  handleDownloadFinishedAllFiles();
});



ipcRenderer.on("Downloading", (event, fileName) => {
  updateStatusDownload(fileName, "Downloading");
});

ipcRenderer.on("DownloadFailed", (event, fileName) => {
  updateStatusDownload(fileName, "Failed");
});

ipcRenderer.on("Resume", (event, fileName) => {
  updateStatusDownload(fileName, "Resuming Download");
});

contextBridge.exposeInMainWorld("backupData", {
  loadData: () => ipcRenderer.invoke("loadData"),
  DownloadFile: (fileToDownload) =>
    ipcRenderer.send("DownloadFile", fileToDownload),
  getDownloadedFiles: () => ipcRenderer.invoke("getDownloadedFiles"),
  connectToFtp: () => ipcRenderer.invoke("connectToFtp"),
});

function updateStatusDownload(fileName, message) {
  const downloadItem = document.querySelector(
    `[data-file-name ='${fileName}'] .backup-item--process`
  );
  if (downloadItem) {
    downloadItem.textContent = message;
  }
}

function handleDownloadFinishedAllFiles() {
  console.log('Tải hết rồi a định ơi');
}
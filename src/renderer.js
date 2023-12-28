/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

document.addEventListener("DOMContentLoaded", async () => {
  const isConnection = await window.backupData.connectToFtp();

  const appElement = document.getElementById("app");

  if (!appElement) {
    console.log("error");
    return;
  }

  const connectionStatusElement = appElement.querySelector(
    ".app-header--status"
  );

  if (!connectionStatusElement) {
    return;
  }

  connectionStatusElement.textContent = isConnection
    ? "Connected"
    : "Not connected";

  const downloadNeedFiles = await window.backupData.loadData();

  if (!Array.isArray(downloadNeedFiles)) {
    const appStatusElement = appElement.querySelector(".app-body--status");
    appStatusElement.textContent = "Hiện không có file cần backup";
    return;
  }

  if (downloadNeedFiles.length === 0) {
    const appStatusElement = appElement.querySelector(".app-body--status");
    appStatusElement.textContent = "Hiện không có file cần backup";
    return;
  }

  if (downloadNeedFiles.length > 0) {
    // renderDownloadingFile(downloadNeedFiles[0]);
    // // Wait for downloadFile() to complete
    // await window.backupData.DownloadFile(downloadNeedFiles[0]);

    let isFinished = false;

    for (const file of downloadNeedFiles) {
      //   // Show file on UI
      renderDownloadingFile(file);

      await window.backupData.DownloadFile(file);
    }
    // Kiểm tra xem đã download hết tất cả các file hay chưa
    

  }
});

function renderDownloadedFiles(filesList) {
  const backupListElement = document.querySelector(".backup-list");
  const backupItemTemplate = document.querySelector("#backup-item--template");

  if (filesList.length === 0) {
    const newP = document.createElement("p");
    newP.textContent = "Hiện chưa có file nào đã được tải!";
    backupListElement.appendChild(newP);
    return;
  }

  filesList.forEach((file) => {
    const cloneItem = backupItemTemplate.content.cloneNode(true);
    let backupItem = cloneItem.querySelector("li");
    let backupItemName = backupItem.querySelector(".backup-item--name");
    backupItemName.textContent = file.name;
    backupListElement.appendChild(backupItem);
  });
}

function renderDownloadingFile(file) {
  if (!file) return;

  const downloadingList = document.querySelector(".download-list");

  if (!downloadingList) return;

  const downloadingItemTemplate = document.querySelector(
    "#backup-item--template"
  );

  const downloadingItemClone = downloadingItemTemplate.content.cloneNode(true);
  let downloadingItem = downloadingItemClone.querySelector("li");
  let downloadingItemName = downloadingItem.querySelector(".backup-item--name");
  downloadingItemName.textContent = file.name;
  downloadingItem.dataset.fileName = file.name;
  downloadingList.appendChild(downloadingItem);
}

function updateStatusDownload(fileName, message) {
  const downloadItem = document.querySelector(
    `[data-file-name ='${fileName}'] .backup-item--process`
  );
  console.log(downloadItem);
  if (downloadItem) {
    downloadItem.textContent = message;
  }
}

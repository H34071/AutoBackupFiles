const {
  app,
  autoUpdater,
  BrowserWindow,
  ipcMain,
  Tray,
  nativeImage,
  Menu,
  Notification,
} = require("electron");
const isDev = require("electron-is-dev");

const path = require("path");
const FtpClient = require("ftp");
const moment = require("moment");
const fs = require("fs");
const { errorMonitor } = require("stream");
const clientA = new FtpClient();
const clientB = new FtpClient();

let files = [];
let transferFiles = [];
let downloadedFilesLength = 0;
let tray;
let mainWindow;
let progressInterval;
const NOTIFICATION_TITLE = "Auto Backup Files";
let NOTIFICATION_BODY = "Ứng dụng dành riêng cho anh Định đã mở!";

const ftpConfigA = {
  host: "172.16.40.31",
  user: "H34071",
  password: "34071",
};

const ftpConfigB = {
  host: "172.16.40.7",
  user: "install",
  password: "Lelong@2022#",
};

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
  clientA.close();
}

async function connectToFtp() {
  try {
    await new Promise((resolve, reject) => {
      clientA.on("ready", resolve);
      clientA.on("error", reject);
      clientA.connect(ftpConfigA);
    });

    await new Promise((resolve, reject) => {
      clientB.on("ready", resolve);
      clientB.on("error", reject);
      clientB.connect(ftpConfigB);
    });

    return clientA.connected && clientB.connected;
  } catch (error) {
    console.error("FTP connection failed:", error);
    return false;
  }
}

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      preload: path.join(__dirname, "preload.js"),
    },
    show: false,
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  const INCREMENT = 0.03;
  const INTERVAL_DELAY = 100; // ms;

  let c = 0;
  progressInterval = setInterval(() => {
    // update progress bar to next value
    // values between 0 and 1 will show progress, >1 will show indeterminate or stick at 100%
    mainWindow.setProgressBar(c);

    // increment or reset progress bar
    if (c < 2) {
      c += INCREMENT;
    } else {
      c = -INCREMENT * 5; // reset to a bit less than 0 to show reset state
    }
  }, INTERVAL_DELAY);

  mainWindow.on("blur", () => {
    if (!mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.hide();
    }
  });

  mainWindow.on("close", (event) => {
    event.preventDefault();
    mainWindow.hide(); // Ẩn cửa sổ thay vì đóng
  });

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
  // checkForUpdates();
  createWindow();
  showNotification();
  const icon = nativeImage.createFromPath(`./src/images/cloud-folder.png`);
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show App",
      click: () => {
        mainWindow.show();
      },
    },
    {
      label: "Quit",
      click() {
        clearInterval(progressInterval);
        app.exit();
      },
    },
  ]);
  tray.setToolTip("Auto backup files");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.

// app.on("window-all-closed", () => {
//   if (process.platform !== "darwin") {
//     app.quit();
//   }
// });

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0 || mainWindow === null) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

ipcMain.handle("loadData", async (event, arg) => {
  try {
    const remotePath = "/u3/backup/exp/";

    // const localPath = path.join(app.getPath("userData"), "backup");
    const previousDate = moment().subtract(1, "day").format("YYYY-MM-DD");

    files = await new Promise((resolve, reject) => {
      try {
        clientA.list(remotePath, (err, files) => {
          if (err) reject(err);
          resolve(files);
        });
      } catch (error) {
        console.log(error.message);
      }
    });

    files = files
      .sort((a, b) => a?.size - b?.size)
      .filter((file) => {
        const fileDate = moment(file.date).format("YYYY-MM-DD");
        return fileDate === previousDate;
      });

    downloadedFilesLength = files.length;

    return files;
  } catch (err) {
    console.error(`Error: ${err.message}`);
  }
});

ipcMain.handle("getDownloadedFiles", async (event) => {
  const localPath = "home\test_auto_backup";

  transferFiles = await new Promise((resolve, reject) => {
    try {
      clientB.list(localPath, (err, files) => {
        if (err) reject(err);
        resolve(files);
      });
    } catch (error) {
      console.log(error.message);
    }
  });

  return transferFiles;
});

ipcMain.handle("connectToFtp", (event) => {
  return connectToFtp();
});

ipcMain.on("DownloadFile", async (event, fileToDownload) => {
  const fileDate = fileToDownload.date;
  const fileName = fileToDownload.name;
  const fileSize = fileToDownload.size;
  const remotePath = "/u3/backup/exp/";
  const localPath = "/home/test_auto_backup/";

  // const localPath = path.join(app.getPath("userData"), "backup");

  let remoteFilePath = path.join(remotePath, fileName);
  let localFilePath = path.join(localPath, fileName);
  remoteFilePath = remoteFilePath.replaceAll("\\", "/");
  localFilePath = localFilePath.replaceAll("\\", "/");

  let isFinished = false;
  let positionIndexDownload = 0;
  let localSize = 0;

  const fileTemp = localFilePath + ".tmp";

  try {
    // Kiểm tra file chưa hoàn thành quá trình tải dữ liệu
    transferFiles = await new Promise((resolve, reject) => {
      try {
        clientB.list(localPath, (err, files) => {
          if (err) reject(err);
          resolve(files);
        });
      } catch (error) {
        console.log(error.message);
      }
    });

    console.log(transferFiles);

    const unTransferFile = transferFiles.filter(
      (file) => file?.name === fileTemp
    )[0];

    if (unTransferFile) {
      localSize = unTransferFile.size;
      positionIndexDownload = localSize;
    }

    const transferedFile = transferFiles.filter(
      (file) => file?.name === localFilePath
    )[0];

    // Kiểm tra file đã hoàn thành quá trình tải dữ liệu
    if (
      transferedFile &&
      localSize > 0 &&
      positionIndexDownload === localSize
    ) {
      localSize = ftransferedFile.size;
      positionIndexDownload = localSize;
    }

    // if (
    // fs.existsSync(fileTemp) &&
    // localSize > 0 &&
    // positionIndexDownload === localSize
    // ) {
    // fs.rename(fileTemp, localFilePath, (err) => {
    //   if (err) {
    //     console.log(err);
    //   }
    // });
    // }

    // File hợp lệ đã được tải
    if (localSize > 0 && positionIndexDownload === fileSize) {
      console.log("Downloaded");
      event?.sender.send("DownloadFinished", fileName);
      return;
    }

    // Tải lại file
    if (positionIndexDownload > 0 && positionIndexDownload < fileSize) {
      console.log("REDownload...");
      isFinished = await reDownloadFile({
        position: positionIndexDownload,
        localFilePath: fileTemp,
        remoteFilePath,
        fileName,
        event,
      });
    }

    if (positionIndexDownload === 0) {
      console.log("Downloading...");

      isFinished = await downloadFile({
        localFilePath,
        remoteFilePath,
        fileName,
        fileDate,
        event,
      });
    }

    if (isFinished) {
      console.log("Downloaded");
      showNotification(`File ${fileName} đã tải xong rồi anh Định ơi!`);
      console.log(fileTemp, localFilePath);
      
      clientB.rename(fileTemp, localFilePath, (err) => {
        if (err) {
          console.log(err);
        }
      })

      event?.sender.send("DownloadFinished", fileName);

      const filesDownloaded = fs.readdirSync(localPath);

      const length = filesDownloaded.filter(
        (file) => !file.includes(".tmp")
      ).length;

      // Đã download hết các file cần thiết
      if (length === downloadedFilesLength) {
        clearInterval(progressInterval);
        showNotification(`Mọi file đã tải xong, em tắt app nhe anh Định`);
        app.exit();
      }
    }

    // Kiểm tra xem đã download hết file chưa
  } catch (error) {
    showNotification(`Có biến rồi anh Định ơi!`);
    event?.sender.send("DownloadFailed", fileName);
    console.error("Error during file download:", error);
  }
});

async function downloadFile({
  localFilePath,
  remoteFilePath,
  fileName,
  fileDate,
  event,
}) {
  try {
    let isFinished = false;

    if (!localFilePath || !remoteFilePath || !fileName) {
      throw new Error("Invalid parameters for downloadFile");
    }

    const currentDate = moment().format("YYYY-MM-DD");

    // moment(currentDate).isSame(fileDate)
    // if (!fs.existsSync(localFilePath)) {
    const tempFilePath = localFilePath + ".tmp";
    // await new Promise((resolve, reject) => {
    //   clientA.get(remoteFilePath, (err, stream) => {
    //     if (err) {
    //       console.error(`Error getting stream: ${err.message}`);
    //       reject(err);
    //       return;
    //     }

    //     const fileStream = fs.createWriteStream(tempFilePath);

    //     fileStream.on("open", () => {
    //       console.log(`Started writing to file: ${fileName}`);
    //       event.sender.send("Downloading", fileName);
    //     });

    //     fileStream.on("close", () => {
    //       isFinished = true;
    //       event.sender.send("DownloadFinished", fileName);
    //       resolve();
    //     });

    //     fileStream.on("error", (err) => {
    //       console.error(`Error writing to file: ${err.message}`);
    //       reject(err);
    //     });

    //     stream.pipe(fileStream);
    //   });
    // });
    // }

    clientA.get(remoteFilePath, (err, stream) => {
      if (err) {
        console.error(`Error getting stream: ${err.message}`);
        return;
      }
      event.sender.send("Downloading", fileName);

      clientB.put(stream, tempFilePath, (err) => {
        if (err) {
          console.error(`Error uploading file: ${err.message}`);
          return;
        }
        isFinished = true;
        console.log(`File uploaded successfully to ${tempFilePath}`);
      });
    });

    return isFinished;
  } catch (error) {
    console.error(`Error in downloadFile: ${error.message}`);
    return false;
  }
}

async function reDownloadFile({
  position,
  localFilePath,
  remoteFilePath,
  fileName,
  event,
}) {
  let isFinished = false;
  if (!position || !localFilePath || !remoteFilePath || !fileName) {
    // throw err
    // ...
    return isFinished;
  }

  try {
    clientA.restart(position, (err) => {
      if (err) {
        console.log(err);
      }
      event.sender.send("Resume", fileName);
    });

    await new Promise((resolve, reject) => {
      clientA.get(remoteFilePath, (err, ftpStream) => {
        if (err) {
          console.error(`Error getting stream: ${err.message}`);
          reject(err);
          return;
        }

        const stream = fs.createWriteStream(localFilePath, { flags: "a" });

        ftpStream.on("open", () => {
          console.log(`RESUMING to file: ${fileName}`);
          event.sender.send("Downloading", fileName);
        });

        ftpStream.on("close", () => {
          isFinished = true;
          event.sender.send("DownloadFinished", fileName);
          resolve();
        });

        ftpStream.on("error", (err) => {
          console.error(`Error writing to file: ${err.message}`);
          reject(err);
        });

        ftpStream.pipe(stream);
      });
    });

    return isFinished;
  } catch (error) {
    console.log(error.message);
    return false;
  }
}

function showNotification(message = NOTIFICATION_BODY) {
  new Notification({ title: NOTIFICATION_TITLE, body: message }).show();
}

// function checkForUpdates() {
//   if (!isDev) {
//     autoUpdater.setFeedURL({
//       provider: 'generic',
//       url: '\\172.16.40.17\資訊室\資訊人員的資料夾(DuLieuCuaCaNhan)\Loi\auto_backup',
//     });

//     autoUpdater.checkForUpdates();

//     autoUpdater.on('update-downloaded', () => {
//       // Khi cập nhật đã được tải về, hiển thị thông báo hoặc thông báo người dùng.
//       autoUpdater.quitAndInstall();
//     });
//   }
// }

const express = require("express");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 10000;
const DOWNLOAD_DIR = "/tmp/tiktok-downloads";

fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "TikTok Downloader API",
    status: "online"
  });
});

app.get("/download", async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: "Missing url parameter"
    });
  }

  if (!/^(https?:\/\/)?((www|m|vm|vt)\.)?tiktok\.com\//i.test(url)) {
    return res.status(400).json({
      success: false,
      error: "Invalid TikTok URL"
    });
  }

  const id = crypto.randomBytes(8).toString("hex");
  const output = path.join(DOWNLOAD_DIR, `${id}.mp4`);

  try {
    await runYtDlp(url, output);

    if (!fs.existsSync(output)) {
      throw new Error("Video file was not created");
    }

    const stat = fs.statSync(output);

    if (!stat.size) {
      throw new Error("Downloaded video is empty");
    }

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="tiktok_${id}.mp4"`
    );

    const stream = fs.createReadStream(output);

    stream.on("close", () => {
      cleanup(output);
    });

    stream.on("error", () => {
      cleanup(output);
    });

    stream.pipe(res);

  } catch (error) {
    cleanup(output);

    console.error("[YTDLP ERROR]", error);

    return res.status(500).json({
      success: false,
      error: "Failed to download TikTok video"
    });
  }
});

function runYtDlp(url, output) {
  return new Promise((resolve, reject) => {
    const args = [
      "--no-playlist",
      "--no-warnings",
      "--quiet",
      "--merge-output-format",
      "mp4",
      "-o",
      output,
      url
    ];

    execFile(
      "yt-dlp",
      args,
      {
        timeout: 120000,
        maxBuffer: 1024 * 1024 * 5
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error("[yt-dlp]", stderr || error.message);
          return reject(error);
        }

        resolve();
      }
    );
  });
}

function cleanup(file) {
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch (error) {
    console.error("[CLEANUP]", error.message);
  }
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`TikTok Downloader API running on port ${PORT}`);
});

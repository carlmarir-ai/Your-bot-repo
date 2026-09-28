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

/* =========================
   HOME / STATUS
========================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "TikTok Downloader API",
    status: "online"
  });
});

/* =========================
   DOWNLOAD
========================= */

app.get("/download", async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: "Missing url parameter"
    });
  }

  if (
    !/^(https?:\/\/)?((www|m|vm|vt)\.)?tiktok\.com\//i.test(url)
  ) {
    return res.status(400).json({
      success: false,
      error: "Invalid TikTok URL"
    });
  }

  const id = crypto.randomBytes(8).toString("hex");
  const output = path.join(
    DOWNLOAD_DIR,
    `${id}.mp4`
  );

  console.log("[DOWNLOAD] URL:", url);
  console.log("[DOWNLOAD] Output:", output);

  try {
    await runYtDlp(url, output);

    if (!fs.existsSync(output)) {
      throw new Error(
        "Video file was not created"
      );
    }

    const stat = fs.statSync(output);

    console.log(
      "[DOWNLOAD] File size:",
      stat.size,
      "bytes"
    );

    if (!stat.size) {
      throw new Error(
        "Downloaded video is empty"
      );
    }

    res.setHeader(
      "Content-Type",
      "video/mp4"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="tiktok_${id}.mp4"`
    );

    const stream =
      fs.createReadStream(output);

    stream.on("close", () => {
      cleanup(output);
    });

    stream.on("error", (error) => {
      console.error(
        "[STREAM ERROR]",
        error
      );

      cleanup(output);
    });

    stream.pipe(res);

  } catch (error) {

    console.error(
      "[YTDLP ERROR]",
      error
    );

    cleanup(output);

    return res.status(500).json({
      success: false,
      error: "Failed to download TikTok video"
    });
  }
});

/* =========================
   YT-DLP
========================= */

function runYtDlp(url, output) {
  return new Promise((resolve, reject) => {

    /* Check yt-dlp version first */

    execFile(
      "yt-dlp",
      ["--version"],
      (versionError, versionStdout, versionStderr) => {

        console.log(
          "[YTDLP VERSION]",
          versionStdout ||
          versionStderr ||
          versionError?.message ||
          "unknown"
        );

        const args = [
          "--no-playlist",
          "--no-warnings",

          "--merge-output-format",
          "mp4",

          "-o",
          output,

          url
        ];

        console.log(
          "[YTDLP COMMAND]",
          "yt-dlp",
          ...args
        );

        execFile(
          "yt-dlp",
          args,
          {
            timeout: 120000,
            maxBuffer: 10 * 1024 * 1024
          },

          (error, stdout, stderr) => {

            console.log(
              "[YTDLP STDOUT]",
              stdout || ""
            );

            console.log(
              "[YTDLP STDERR]",
              stderr || ""
            );

            if (error) {
              return reject(error);
            }

            resolve();
          }
        );
      }
    );
  });
}

/* =========================
   CLEANUP
========================= */

function cleanup(file) {
  try {

    if (
      file &&
      fs.existsSync(file)
    ) {
      fs.unlinkSync(file);

      console.log(
        "[CLEANUP] Removed:",
        file
      );
    }

  } catch (error) {

    console.error(
      "[CLEANUP ERROR]",
      error.message
    );
  }
}

/* =========================
   START SERVER
========================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `TikTok Downloader API running on port ${PORT}`
    );
  }
);

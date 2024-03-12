const express = require("express");
const path = require("path");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./media");
    // cb(null, path.join(__dirname, "/media/"));
  },
  filename: function (req, file, cb) {
    // const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, req.body.streamid + ".mp4");
  },
});
const uploadController = require("../controllers/upload");
const upload = multer({ storage });
module.exports = (context) => {
  let router = express.Router();
  router.get("/", uploadController.getVideos.bind(context));
  router.post("/upload", upload.single("video"), async (req, res) => {
    try {
      //console.log(req.body);
      const streamId = validateStreamId(req.body.streamid);
      console.log("trimmed stream id : " + streamId);
      if (!req.file) {
        res
          .status(500)
          .send({ error: "please provide video to convert, with key: video" });
      }
      const isMP4 = req.file.originalname.toLowerCase().endsWith(".mp4");
      if (!isMP4) {
        res.status(500).send({ error: "only mp4 video is supported" });
      }
      await transcodeVideo(req.file.filename, "./media", streamId);
      // await transcodeVideo(req.file.filename, path.join(__dirname, "/media"));
      console.log(streamId);
    } catch (err) {
      console.log(err);
      res.status(500).send({ error: err.message });
    }
    console.log(req.file);
    res.json(req.file);
  });

  router.delete("/delete/:id", uploadController.deleteVideo.bind(context));

  return router;
};

const transcodeVideo = async (filename, filepath, streamId) => {
  return new Promise((resolve, reject) => {
    const inputFilePath = path.join(filepath, filename);
    fs.mkdirSync(path.join(filepath, "live", streamId));
    const outputFilePath = path.join(filepath, "live", streamId, "index.m3u8");
    const options = [
      "-codec: copy",
      "-start_number 0",
      "-hls_time 10",
      "-hls_list_size 0",
      "-f hls",
    ];
    ffmpeg(inputFilePath)
      .output(outputFilePath)
      .addOptions(options)
      .on("end", () => {
        ffmpeg(inputFilePath)
          .screenshots({
            timestamps: ["10%"],
            folder: filepath + "/screenshots",
            filename: `${streamId}.jpg`,
            // size: "720x?",
          })
          .on("end", () => {
            resolve();
          })
          .on("error", (err) => reject(err));
      })
      .on("error", (err) => reject(err))
      .run();
  });
};

function validateStreamId(streamId) {
  if (!streamId) {
    throw new Error("streamid is required");
  }

  const trimmedStreamId = streamId.trim();

  if (trimmedStreamId.includes(" ") || trimmedStreamId.length > 15) {
    throw new Error(
      "streamid cannot contain spaces or be longer than 15 characters"
    );
  }

  return trimmedStreamId;
}

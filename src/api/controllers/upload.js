const fs = require("fs");
const path = require("path");
function getVideos(req, res, next) {
  //    const transcodeFiles = fs.readdirSync(path.join(__dirname, "/uploads"));
  const transcodeFiles = fs.readdirSync("./media/live");
  const videos = transcodeFiles
    .filter((file) => {
      const indexPath = path.join("./media/live", file, "index.m3u8");
      return fs.existsSync(indexPath);
    })
    .map((filename) => {
      return {
        streamId: filename,
        url: `http://localhost:3000/live/${filename}/index.m3u8`,
        thumbnailUrl: `http://localhost:3000/uploads/screenshots/${filename}.jpg`,
      };
    });
  res.json(videos);
}
function deleteVideo(req, res, next) {
  const filename = req.params.id;
  try {
    deleteVideoById(filename);
    res.status(200).send({ message: "Video deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Error deleting video" });
  }
}

const deleteVideoById = (filename) => {
  // Delete original video file
  if (fs.existsSync("./media/" + filename + ".mp4")) {
    fs.unlinkSync("./media/" + filename + ".mp4");
  }

  // Delete HLS files
  const hlsFilename = "index.m3u8";
  //   const hlsFilename = filename.split(".").slice(0, -1).join(".") + ".m3u8";
  if (fs.existsSync(path.join("./media/live", filename, hlsFilename))) {
    fs.unlinkSync(path.join("./media/live", filename, hlsFilename));
  }

  // Delete HLS ts segments
  fs.readdirSync(path.join("./media/live", filename))
    .filter((file) => file.endsWith(".ts"))
    .forEach((file) =>
      fs.unlinkSync(path.join("./media/live", filename, file))
    );
  //Delete folder with ts segments
  const liveStreamDir = path.join("./media/live", filename);

  if (fs.existsSync(liveStreamDir)) {
    fs.rmdirSync(liveStreamDir, { recursive: true });
  }
  // Delete screenshot
  const screenshotFilename = `${filename}.jpg`;
  if (fs.existsSync(path.join("./media/screenshots", screenshotFilename))) {
    fs.unlinkSync(path.join("./media/screenshots", screenshotFilename));
  }
};
exports.getVideos = getVideos;
exports.deleteVideo = deleteVideo;

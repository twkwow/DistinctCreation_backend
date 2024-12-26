import express from "express";
import multer from "multer";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import AdmZip from "adm-zip";
import fs from "fs";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const app = express();
const port = 3001;

app.use(
  cors({
    origin: ["http://localhost:3000"],
    credentials: true,
  })
);

const upload = multer({
  storage: multer.diskStorage({
    destination: "./uploads",
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${file.originalname}`;
      cb(null, uniqueName);
    },
  }),
  fileFilter: (req, file, cb) => {
    const validTypes = [
      "image/jpeg",
      "image/png",
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream",
    ];
    cb(null, validTypes.includes(file.mimetype));
  },
});

app.post("/uploadSingle", upload.single("picture"), async (req, res) => {
  console.log("am i here");
  console.log(req.file);
  if (!req.file) return res.status(400).send({ error: "Invalid image file" });

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${
    req.file.filename
  }`;
  const thumbnails = [];

  try {
    const image = sharp(req.file.path);
    const metadata = await image.metadata();

    if (metadata.width >= 128 && metadata.height >= 128) {
      // Generate 32px wide thumbnail
      const thumbnail32Path = path.join(
        __dirname,
        "uploads",
        `thumb32-${req.file.filename}`
      );
      await image.resize({ width: 32 }).toFile(thumbnail32Path);
      thumbnails.push(
        `${req.protocol}://${req.get("host")}/uploads/thumb32-${
          req.file.filename
        }`
      );

      // Generate 64px wide thumbnail
      const thumbnail64Path = path.join(
        __dirname,
        "uploads",
        `thumb64-${req.file.filename}`
      );
      await image.resize({ width: 64 }).toFile(thumbnail64Path);
      thumbnails.push(
        `${req.protocol}://${req.get("host")}/uploads/thumb64-${
          req.file.filename
        }`
      );
    } else {
      // If image is smaller than 128px by 128px, use the original image as the thumbnail
      console.log("small image use itself as thumbnail");
      thumbnails.push(fileUrl);
    }

    res
      .status(200)
      .send({ message: "File uploaded successfully", fileUrl, thumbnails });
  } catch (error) {
    console.log("Error generating thumbnails", error);
    res.status(500).send({ error: "Error generating thumbnails" });
  }
});

app.post("/uploadSingleOrZip", upload.single("file"), async (req, res) => {
  console.log("Received upload request");
  console.log(req.file);
  if (!req.file) return res.status(400).send({ error: "Invalid file" });

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${
    req.file.filename
  }`;

  if (req.file.mimetype.startsWith("image/")) {
    // Handle single image file
    console.log("Single image file uploaded", fileUrl);
    return res
      .status(200)
      .send({ message: "File uploaded successfully", fileUrl });
  }

  if (req.file.mimetype.includes("zip")) {
    // Handle ZIP file
    const zip = new AdmZip(req.file.path);
    const zipEntries = zip.getEntries();
    const imageLinks = [];
    zipEntries.forEach((zipEntry) => {
      if (zipEntry.entryName.match(/\.(jpg|jpeg|png)$/i)) {
        const fileName = `${Date.now()}-${zipEntry.entryName}`;
        const filePath = path.join(__dirname, "uploads", fileName);

        // Ensure the directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filePath, zipEntry.getData());
        const imageUrl = `${req.protocol}://${req.get(
          "host"
        )}/uploads/${fileName}`;
        imageLinks.push(imageUrl);
      }
    });

    console.log("ZIP file extracted and images uploaded", imageLinks);
    return res
      .status(201)
      .send({ message: "Files uploaded successfully", imageLinks });
  }

  return res.status(400).send({ error: "Unsupported file type" });
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.listen(port, () =>
  console.log(`Server running on http://localhost:${port}`)
);

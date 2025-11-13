// server.js
const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const fs = require("fs");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// SOCKET.IO with CORS (Netlify + Render)
const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

// Port for Render
const port = process.env.PORT || 8000;

// ----------------------------------------------------------
// CORRECT ROOT DIRECTORY
// ----------------------------------------------------------
const ROOT_DIR = path.join(__dirname, "..", "..");
const PUBLIC_PATH = path.join(ROOT_DIR, "public");
const DATA_FILE = path.join(ROOT_DIR, "data.json");

// ----------------------------------------------------------
// MIDDLEWARE  (⭐ FIX ADDED BELOW)
// ----------------------------------------------------------
app.use(cors());
app.use(express.json());

// ⭐⭐ FIX ADDED → THIS MAKES req.body.type WORK ⭐⭐
app.use(express.urlencoded({ extended: true }));

app.use(express.static(PUBLIC_PATH));

// ----------------------------------------------------------
// STATIC PAGE ROUTES
// ----------------------------------------------------------
const pages = ["index", "about", "contact", "dashboard", "gallery", "members", "schemes"];

pages.forEach((page) => {
    app.get(`/${page === "index" ? "" : page}`, (req, res) => {
        res.sendFile(path.join(PUBLIC_PATH, `${page}.html`));
    });
});

// ----------------------------------------------------------
// DATA FUNCTIONS
// ----------------------------------------------------------
function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        return { info: [], members: [], schemes: [], images: [] };
    }
    return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ----------------------------------------------------------
// INFO ROUTES (WITH TYPE SUPPORT)
// ----------------------------------------------------------
app.get("/api/info", (req, res) => {
    res.json({ info: loadData().info });
});

app.post("/admin/upload", (req, res) => {

    const { title, description, type } = req.body;

    if (!title || !description) {
        return res.status(400).json({ status: "error", message: "Missing title/description" });
    }

    const data = loadData();

    const newInfo = {
        id: Date.now(),
        title,
        description,
        type: type || "General"
    };

    data.info.push(newInfo);
    saveData(data);

    io.emit("new-data", { type: "info", info: newInfo });
    res.json({ status: "success", info: newInfo });
});

app.delete("/admin/delete/info/:id", (req, res) => {
    const data = loadData();
    data.info = data.info.filter((i) => i.id != req.params.id);
    saveData(data);

    io.emit("new-data", { type: "info" });
    res.json({ status: "success" });
});

// ----------------------------------------------------------
// MEMBERS ROUTES
// ----------------------------------------------------------
app.get("/api/members", (req, res) => {
    res.json({ members: loadData().members });
});

app.post("/admin/members", (req, res) => {
    const { name, role, contact } = req.body;
    if (!name || !role || !contact) {
        return res.status(400).json({ status: "error", message: "Missing fields" });
    }

    const data = loadData();
    const newMember = { id: Date.now(), name, role, contact };
    data.members.push(newMember);
    saveData(data);

    io.emit("new-data", { type: "members", member: newMember });
    res.json({ status: "success", member: newMember });
});

app.delete("/admin/delete/member/:id", (req, res) => {
    const data = loadData();
    data.members = data.members.filter((m) => m.id != req.params.id);
    saveData(data);

    io.emit("new-data", { type: "members" });
    res.json({ status: "success" });
});

// ----------------------------------------------------------
// SCHEMES ROUTES
// ----------------------------------------------------------
app.get("/api/schemes", (req, res) => {
    res.json({ schemes: loadData().schemes });
});

app.post("/admin/schemes", (req, res) => {
    const { title, description, start, end } = req.body;
    if (!title || !description || !start || !end) {
        return res.status(400).json({ status: "error", message: "Missing fields" });
    }

    const data = loadData();
    const newScheme = { id: Date.now(), title, description, start, end };
    data.schemes.push(newScheme);
    saveData(data);

    io.emit("new-data", { type: "schemes", scheme: newScheme });
    res.json({ status: "success", scheme: newScheme });
});

app.delete("/admin/delete/scheme/:id", (req, res) => {
    const data = loadData();
    data.schemes = data.schemes.filter((s) => s.id != req.params.id);
    saveData(data);

    io.emit("new-data", { type: "schemes" });
    res.json({ status: "success" });
});

// ----------------------------------------------------------
// GALLERY ROUTES
// ----------------------------------------------------------
const upload = multer({ storage: multer.memoryStorage() });

app.get("/api/gallery", (req, res) => {
    res.json({ images: loadData().images });
});

app.post("/admin/gallery", upload.single("image"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ status: "error", message: "No file uploaded" });
    }

    const data = loadData();
    const newImg = {
        id: Date.now(),
        url: `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
        alt: "Uploaded Image",
    };

    data.images.push(newImg);
    saveData(data);

    io.emit("new-data", { type: "gallery", image: newImg });
    res.json({ status: "success", image: newImg });
});

app.delete("/admin/delete/image/:id", (req, res) => {
    const data = loadData();
    data.images = data.images.filter((img) => img.id != req.params.id);
    saveData(data);

    io.emit("new-data", { type: "gallery" });
    res.json({ status: "success" });
});

// ----------------------------------------------------------
// SOCKET.IO EVENTS
// ----------------------------------------------------------
io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    socket.on("disconnect", () => console.log("User disconnected:", socket.id));
});

// ----------------------------------------------------------
// START SERVER
// ----------------------------------------------------------
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

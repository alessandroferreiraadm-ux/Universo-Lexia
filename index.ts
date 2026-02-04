import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import chatRoutes from "./chat-routes.js";
import whatsappWebhook from "./whatsapp-webhook.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.json());
  app.use(express.static(staticPath));

  app.use("/api/chat", chatRoutes);
  app.use("/api/whatsapp", whatsappWebhook);

  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`Chat API: http://localhost:${port}/api/chat`);
    console.log(`WhatsApp Webhook: http://localhost:${port}/api/whatsapp/webhook`);
  });
}

startServer().catch((error) => {
  console.error("Erro:", error);
  process.exit(1);
});

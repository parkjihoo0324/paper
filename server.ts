import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON 및 대용량 이미지 업로드를 위한 설정
  app.use(express.json({ limit: '10mb' }));
  app.use(cors());

  // API Route: 이미지 분석
  app.post("/api/analyze", async (req, res) => {
    const { image } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Server API Key is not configured." });
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const base64Data = image.split(',')[1];
      
      const prompt = `이 이미지는 고등학생의 수업 유인물입니다. 다음 작업을 수행해주세요:
1. 모든 텍스트를 정확하게 추출(OCR)해주세요.
2. 핵심 내용을 공부하기 좋게 요약해주세요.
3. 적절한 제목을 정해주세요.

출력 형식:
[TITLE]: 제목
[SUMMARY]: 요약 내용
[ORIGINAL]: 추출된 전체 텍스트`;

      const response = await model.generateContent([
        prompt,
        { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
      ]);
      
      res.json({ text: response.response.text() });
    } catch (error) {
      console.error("AI Analysis Error:", error);
      res.status(500).json({ error: "Analysis failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  Upload, 
  FileText, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  BookOpen,
  Camera,
  Layers,
  Settings,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// --- Types ---
interface AnalysisResult {
  originalText: string;
  summary: string;
  title: string;
}

export default function App() {
  const [apiKey, setApiKey] = useState<string>(localStorage.getItem('gemini_api_key') || (process.env.GEMINI_API_KEY as string) || '');
  const [showSettings, setShowSettings] = useState(!apiKey);
  const [tempKey, setTempKey] = useState(apiKey);
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('gemini_api_key', tempKey);
    setApiKey(tempKey);
    setShowSettings(false);
    setError(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('이미지 파일(JPG, PNG 등)만 업로드 가능합니다.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
        setError(null);
        setResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
        setError(null);
        setResult(null);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const analyzeImage = async () => {
    if (!image) return;
    if (!apiKey) {
      setShowSettings(true);
      setError('Gemini API 키가 필요합니다. 설정에서 입력해주세요.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const base64Data = image.split(',')[1];
      
      const prompt = `
        이 이미지는 고등학생의 수업 유인물입니다. 다음 작업을 수행해주세요:
        1. 이미지 내 모든 텍스트를 정확하게 추출(OCR)해주세요.
        2. 추출된 내용을 바탕으로 고등학생이 이해하기 쉽게 핵심 내용을 요약해주세요.
        3. 이 자료에 어울리는 적절한 제목을 정해주세요.

        출력 형식(JSON 아님, 일반 텍스트):
        [TITLE]: 제목
        [SUMMARY]: 요약 내용
        [ORIGINAL]: 추출된 전체 텍스트
      `;

      const response = await model.generateContent([
        { text: prompt },
        { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
      ]);

      const text = response.response.text();
      
      const titleMatch = text.match(/\[TITLE\]:(.*?)(\n|$)/i);
      const summaryMatch = text.match(/\[SUMMARY\]:([\s\S]*?)(\[ORIGINAL\]|$)/i);
      const originalMatch = text.match(/\[ORIGINAL\]:([\s\S]*)/i);

      setResult({
        title: titleMatch ? titleMatch[1].trim() : "수업 유인물 분석",
        summary: summaryMatch ? summaryMatch[1].trim() : "요약 내용을 파싱하는 데 실패했습니다.",
        originalText: originalMatch ? originalMatch[1].trim() : "원문을 파싱하는 데 실패했습니다."
      });
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('API_KEY_INVALID')) {
        setError('API 키가 유효하지 않습니다. 설정을 확인해주세요.');
        setShowSettings(true);
      } else {
        setError('이미지 분석 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const downloadPDF = async () => {
    if (!result || !resultRef.current) return;

    try {
      const canvas = await html2canvas(resultRef.current, {
        scale: 2,
        backgroundColor: '#FFFFFF',
        useCORS: true
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
      pdf.save(`${result.title || 'study_note'}.pdf`);
    } catch (err) {
      setError('PDF 생성에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex flex-col">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
            <BookOpen className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Paper2Digital</h1>
        </div>
        
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-500">
          <button 
            onClick={() => setShowSettings(true)}
            className="hover:text-slate-800 cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
          <div className="h-8 w-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">AI</div>
        </nav>
      </header>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl relative"
            >
              <button 
                onClick={() => setShowSettings(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-bold mb-4 text-slate-900">Gemini AI 설정</h2>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                Google AI Studio에서 발급받은 API 키를 입력해주세요. <br/>
                발급받은 키는 브라우저에만 안전하게 저장됩니다.
              </p>
              <form onSubmit={saveApiKey} className="space-y-4">
                <input 
                  type="password" 
                  value={tempKey}
                  onChange={(e) => setTempKey(e.target.value)}
                  placeholder="API 키 입력 (AIZA...)"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700">저장하기</button>
                  {apiKey && <button type="button" onClick={() => setShowSettings(false)} className="px-4 bg-slate-100 rounded-xl font-bold text-slate-600">취소</button>}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="flex-1 max-w-[1400px] w-full mx-auto p-6 gap-6 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Column */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center hover:border-blue-400 bg-slate-50/50 transition-all cursor-pointer h-72 group"
          >
            <input type="file" className="hidden" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" />
            {image ? (
              <img src={image} className="w-full h-full object-contain rounded-xl" />
            ) : (
              <>
                <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 border border-slate-100 group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8 text-blue-500" />
                </div>
                <p className="text-sm font-bold text-slate-900">학습 유인물 업로드</p>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">JPG, PNG (Max 10MB)</p>
              </>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <button
              onClick={analyzeImage}
              disabled={isAnalyzing || !image}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
            >
              {isAnalyzing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Layers className="w-5 h-5" />}
              {isAnalyzing ? "분석 중..." : "AI 스마트 요약 시작"}
            </button>
            
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 leading-relaxed">
              <h4 className="font-bold text-slate-900 mb-1 border-b border-slate-200 pb-1 uppercase tracking-widest">Guide</h4>
              <ul className="space-y-1 mt-2">
                <li>• 밝은 곳에서 수직으로 촬영하세요.</li>
                <li>• 필기 내용도 최대한 인식하여 요약합니다.</li>
                <li>• 분석 후 오답노트용 PDF로 저장하세요.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[600px]">
          <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0 bg-white">
            <span className="text-sm font-bold text-slate-950">AI Analysis Report</span>
            {result && (
              <button 
                onClick={downloadPDF}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-800"
              >
                <Download className="w-3.5 h-3.5" /> PDF 저장
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {result ? (
              <div ref={resultRef} className="space-y-8 max-w-[800px] mx-auto">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <h2 className="text-2xl font-bold text-slate-950 mb-2 leading-tight">{result.title}</h2>
                  <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    Gemini AI Optimized Study Material
                  </p>
                </motion.div>

                <div className="grid grid-cols-1 gap-8">
                  <section>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-4 border-b border-blue-50 pb-2">Core Summary</h4>
                    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">{result.summary}</div>
                  </section>
                  
                  <section className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">OCR Transcription</h4>
                    <div className="text-[10px] text-slate-400 font-mono leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto custom-scrollbar">
                      {result.originalText}
                    </div>
                  </section>
                </div>

                <div className="p-4 rounded-xl border border-yellow-100 bg-yellow-50 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-yellow-800 leading-relaxed font-medium">
                    본 자료는 학습 보조용으로 제작되었습니다. 정확한 내용은 반드시 원본 교재를 확인하세요.
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 py-20">
                <FileText className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-sm font-bold text-slate-400">사진을 올리고 스마트 요약을 시작하세요</p>
                <p className="text-[11px] mt-1">Your AI Study Buddy for High School</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="h-10 bg-white border-t border-slate-200 px-8 flex items-center justify-between text-[10px] font-bold text-slate-400 shrink-0 uppercase tracking-widest">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-blue-500"></span>
            System Ready
          </span>
          <span className="text-slate-100">|</span>
          <span>Paper2Digital v2.0</span>
        </div>
        <div className="hidden sm:block">© 2026 Developed for Academic Excellence</div>
      </footer>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-12 left-1/2 -translate-x-1/2 px-6 py-3 bg-red-600 text-white rounded-xl shadow-xl z-50 text-xs font-bold flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4" /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
      `}</style>
    </div>
  );
}

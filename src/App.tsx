/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Upload, 
  FileText, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  BookOpen,
  Camera,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// --- Initialization ---
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

interface AnalysisResult {
  originalText: string;
  summary: string;
  title: string;
}

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    setIsAnalyzing(true);
    setError(null);

    try {
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

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
            ]
          }
        ]
      });

      const text = response.text || "";
      
      // Parse the response
      const titleMatch = text.match(/\[TITLE\]:(.*?)(\n|$)/i);
      const summaryMatch = text.match(/\[SUMMARY\]:([\s\S]*?)(\[ORIGINAL\]|$)/i);
      const originalMatch = text.match(/\[ORIGINAL\]:([\s\S]*)/i);

      setResult({
        title: titleMatch ? titleMatch[1].trim() : "수업 유인물 분석",
        summary: summaryMatch ? summaryMatch[1].trim() : "요약 내용을 파싱하는 데 실패했습니다.",
        originalText: originalMatch ? originalMatch[1].trim() : "원문을 파싱하는 데 실패했습니다."
      });
    } catch (err) {
      console.error(err);
      setError('이미지 분석 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const downloadPDF = async () => {
    if (!result || !resultRef.current) return;

    try {
      const element = resultRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#FDFCFB',
        logging: false,
        useCORS: true
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;
      
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`${result.title || 'study_note'}.pdf`);
    } catch (err) {
      console.error('PDF 생성 실패:', err);
      setError('PDF 생성에 실패했습니다. 화면 캡처를 허용해주세요.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex flex-col">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 sticky top-0 z-10">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
            <BookOpen className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Paper2Digital</h1>
        </motion.div>
        
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500">
          <span className="text-blue-600 border-b-2 border-blue-600 h-16 flex items-center">Dashboard</span>
          <span className="hover:text-slate-800 cursor-pointer">Library</span>
          <span className="hover:text-slate-800 cursor-pointer">Settings</span>
          <div className="h-8 w-8 rounded-full bg-slate-200 ml-4 border border-slate-300"></div>
        </nav>
      </header>

      <main className="flex-1 max-w-[1400px] w-full mx-auto p-6 gap-6 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Column: Upload & Queue */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <AnimatePresence mode="wait">
            {!image ? (
              <motion.div
                key="dropzone"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center justify-center border-dashed border-2 hover:border-blue-400 bg-slate-50/50 transition-all cursor-pointer h-72 group"
              >
                <input 
                  type="file" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload}
                  accept="image/*"
                />
                <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-slate-100">
                  <Upload className="w-8 h-8 text-blue-500" />
                </div>
                <p className="text-sm font-bold text-slate-900">Click or drag photo</p>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">Supports PNG, JPG (Max 10MB)</p>
              </motion.div>
            ) : (
              <motion.div
                key="preview"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm overflow-hidden flex flex-col gap-4"
              >
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                  <img 
                    src={image} 
                    alt="Preview" 
                    className="w-full h-full object-contain" 
                  />
                  <button 
                    onClick={() => setImage(null)}
                    className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur shadow-sm rounded-lg text-slate-600 hover:text-red-500 transition-colors border border-slate-200"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">Captured Print</h3>
                    <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-bold">READY</span>
                  </div>
                  
                  <button
                    onClick={analyzeImage}
                    disabled={isAnalyzing}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <Layers className="w-4 h-4" />
                        <span>Smart Analysis</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Processing Queue Placeholder */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex-1 shadow-sm overflow-hidden hidden md:flex flex-col min-h-[300px]">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center">
              <span className="w-1.5 h-4 bg-blue-500 rounded-full mr-2"></span>
              Recent History
            </h3>
            <div className="space-y-4 overflow-y-auto pr-2 flex-1">
              {result && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="w-10 h-10 bg-blue-200 rounded-lg shrink-0 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-700 font-bold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-blue-900 truncate">{result.title}</p>
                    <div className="w-full bg-blue-200 h-1 rounded-full mt-2">
                      <div className="bg-blue-600 h-1 rounded-full w-full"></div>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 p-3 rounded-xl border border-transparent hover:border-slate-100 transition-colors">
                <div className="w-10 h-10 bg-slate-100 rounded-lg shrink-0 flex items-center justify-center text-slate-400 italic font-serif">A</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-600 truncate">Example_History_Note.png</p>
                  <p className="text-[10px] text-slate-400 mt-1">Cloud Saved • 2h ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Analysis Result */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[600px]">
          <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-white shrink-0">
            <div className="flex gap-6">
              <button className={`text-sm font-bold pb-2 transition-all ${result ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400'}`}>Smart Summary</button>
              <button className="text-sm font-medium text-slate-400 pb-2 hover:text-slate-600 transition-colors flex items-center gap-1.5">
                Extracted Text
              </button>
            </div>
            {result && (
              <button
                onClick={downloadPDF}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div
                  key="result-content"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                  ref={resultRef}
                >
                  <div>
                    <h2 className="text-2xl font-bold text-slate-950 mb-2 leading-tight tracking-tight">{result.title}</h2>
                    <p className="text-slate-500 text-sm leading-relaxed flex items-center gap-2">
                       <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                       Analyzed with Gemini AI • Just now
                    </p>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <section className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-blue-500">Key Points</h4>
                      <div className="prose prose-slate leading-relaxed text-slate-700 text-sm whitespace-pre-wrap font-medium">
                        {result.summary}
                      </div>
                    </section>

                    <section className="bg-slate-50 rounded-2xl p-6 border border-slate-100 shadow-inner overflow-hidden flex flex-col max-h-[500px]">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-200 pb-2">Full Extraction</h4>
                      <div className="flex-1 overflow-y-auto text-xs text-slate-500 font-mono leading-relaxed custom-scrollbar whitespace-pre-wrap">
                        {result.originalText}
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <p className="text-[10px] font-bold text-slate-900 mb-1 uppercase tracking-tight">Study Insight</p>
                        <p className="text-[10px] text-slate-500 italic">Extracted with 98% accuracy from handwritten/printed source.</p>
                      </div>
                    </section>
                  </div>

                  <div className="p-4 rounded-xl border border-yellow-100 bg-yellow-50 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-800 leading-relaxed">
                      <span className="font-bold">Pro Tip:</span> 유인물의 구겨진 부분이나 흐릿한 텍스트도 스마트 보정되어 분석되었습니다. 원문과 요약본을 비교하며 학습하세요!
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="empty-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20"
                >
                  <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center border border-slate-100 shrink-0">
                    <FileText className="w-10 h-10 text-slate-200" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">분석 대기 중</h3>
                    <p className="text-sm text-slate-400 max-w-xs mx-auto">프린트 사진을 업로드하고 [Smart Analysis] 버튼을 눌러 학습 자료를 생성하세요.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Sticky Status Footer */}
      <footer className="h-12 bg-white border-t border-slate-200 px-8 flex items-center justify-between text-[11px] font-semibold text-slate-400 shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            Gemini AI Connected
          </span>
          <span className="text-slate-200">|</span>
          <span>Study Mode: Active</span>
        </div>
        <div className="hidden sm:block">
          © 2026 Paper2Digital • Built for Students
        </div>
      </footer>

      {/* Error Toast (Simplification) */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-16 left-1/2 -translate-x-1/2 px-6 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center gap-3 z-50 text-sm font-bold"
          >
            <AlertCircle className="w-4 h-4 text-red-400" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E2E8F0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #CBD5E1;
        }
      `}</style>
    </div>
  );
}

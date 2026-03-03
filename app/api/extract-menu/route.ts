import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    // 檢查金鑰是否存在
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: '系統未設定 Gemini API Key' }, { status: 500 });
    }

    // 取得前端傳來的圖片 base64 資料
    const body = await req.json();
    const { base64Image, mimeType } = body;

    if (!base64Image) {
      return NextResponse.json({ error: '沒有收到圖片' }, { status: 400 });
    }

    // 初始化 Gemini API (使用 gemini-1.5-flash 模型，速度快且支援視覺)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 設定給 AI 的提示詞 (Prompt)，強制它輸出乾淨的 JSON
    const prompt = `
      請辨識這張菜單圖片中的所有餐點品項與價格。
      請「嚴格」輸出為 JSON 陣列格式，絕對不要包含任何 Markdown 標記（例如 \`\`\`json）、不要有任何其他說明文字，
      也不要包含金錢符號，如果是飲料菜單，要把不同容量視為不同品項，並且把同名稱不同容量的擺在一起。
      每個品項包含三個欄位：
      - "name": 餐點名稱 (字串)
      - "price": 價格 (數字，若無則填 0)
      - "description": 備註或說明 (字串，若無則填空字串 "")
      
      範例格式：
      [
        {"name": "排骨飯", "price": 90, "description": "附湯"},
        {"name": "雞腿飯", "price": 100, "description": ""}
      ]
    `;

    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: mimeType
      }
    };

    // 呼叫 Gemini 進行辨識
    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text();

    // 清理可能的 Markdown 殘留，確保是純 JSON
    const cleanedText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    // 解析 JSON
    const menuData = JSON.parse(cleanedText);

    return NextResponse.json({ menu: menuData });

  } catch (error: any) {
    console.error('Gemini API 錯誤:', error);
    return NextResponse.json({ error: error.message || '辨識失敗，請檢查圖片或稍後再試' }, { status: 500 });
  }
}
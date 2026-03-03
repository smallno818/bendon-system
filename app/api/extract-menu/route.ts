import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: '系統未設定 Gemini API Key' }, { status: 500 });
    }

    const body = await req.json();
    const { base64Image, mimeType } = body;

    if (!base64Image) {
      return NextResponse.json({ error: '沒有收到圖片' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // ★ 根據您的清單，直接使用最強的 2.5 Pro 模型
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const prompt = `
      你是一個專業的資料輸入員。請仔細辨識這張菜單圖片中的所有「餐點品項」與「價格」。
      
      規則：
      1. 只需要提取餐點名稱與價格。
      2. 價格請轉換為純數字。若沒有標示價格，請填寫 0。
      3. 若有備註（如大小份、辣度），請填入 description 欄位；若無則填寫 ""。
      4. 飲料的菜單，不同容量同名稱的飲料要變成兩個項目擺在一起，但是把容量加在名稱中。
      5. 請嚴格按照以下 JSON 陣列格式輸出：
      [
        {"name": "餐點名稱", "price": 100, "description": "備註"}
      ]
    `;

    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: mimeType
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text();
    
    // 解析 AI 吐出來的 JSON
    const menuData = JSON.parse(text);

    return NextResponse.json({ menu: menuData });

  } catch (error: any) {
    console.error('Gemini API 錯誤:', error);
    return NextResponse.json({ error: error.message || '辨識失敗' }, { status: 500 });
  }
}
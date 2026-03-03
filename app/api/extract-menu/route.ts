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
    
    // ★ 關鍵：使用穩定且免費額度高的 gemini-1.5-flash
    // 並強制開啟 JSON 模式，這會讓辨識準確度大幅提升！
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    // ★ 優化提示詞：給予更明確的規則，幫助 Flash 集中注意力
    const prompt = `
      你是一個專業的資料輸入員。請仔細辨識這張菜單圖片中的所有「餐點品項」與「價格」。
      
      規則：
      1. 只需要提取餐點名稱與價格，不要包含店家名稱或營業時間。
      2. 價格請轉換為純數字（例如：將 "100元" 轉換為 100）。若沒有標示價格，請填寫 0。
      3. 若有大小碗、加料等說明，請填入 description 欄位；若無則填寫空字串 ""。
      4. 如果是飲料菜單，不同容量要視為不同品項，並且把相同名稱的擺在前後項目中
      5. 請嚴格遵守以下 JSON 陣列格式輸出：
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
    
    // 因為已經強制開啟 JSON 模式，吐出來的一定是乾淨的 JSON，直接 Parse 即可！
    const menuData = JSON.parse(text);

    return NextResponse.json({ menu: menuData });

  } catch (error: any) {
    console.error('Gemini API 錯誤:', error);
    return NextResponse.json({ error: error.message || '辨識失敗，請檢查圖片或稍後再試' }, { status: 500 });
  }
}
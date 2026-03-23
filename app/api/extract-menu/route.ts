import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || '');

export async function POST(request: Request) {
  try {
    // ★ 接收前端傳來的自訂提示詞 (prompt)
    const { base64Image, mimeType, prompt } = await request.json();

    if (!base64Image || !mimeType) {
      return NextResponse.json({ error: 'Missing image data' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // ★ 如果前端有傳提示詞就用前端的，沒有就用預設的
    const defaultPrompt = 
    `
      你是一個專業的資料輸入員。請仔細辨識這張菜單圖片中的所有「餐點品項」與「價格」。
      
      規則：
      1. 只需要提取餐點名稱與價格。
      2. 價格請轉換為純數字。若沒有標示價格，請填寫 0。
      3. 若有備註（如大小份、辣度），請填入 description 欄位；若無則填寫 ""。
      4. 如果是飲料的菜單，把容量加入餐點名稱、同名稱不同容量擺在一起、價格不同。
      5. 請嚴格按照以下 JSON 陣列格式輸出：
      [
        {"name": "餐點名稱", "price": 100, "description": "備註"}
      ]
    `;
    const finalPrompt = prompt || defaultPrompt;

    const result = await model.generateContent([
      finalPrompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
    ]);

    const text = result.response.text();
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    const jsonString = jsonMatch ? jsonMatch[1] : text.replace(/```/g, '');
    const menuData = JSON.parse(jsonString);

    return NextResponse.json({ menu: menuData });
  } catch (error: any) {
    console.error('Error extracting menu:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
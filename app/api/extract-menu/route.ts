import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: '系統未設定 Gemini API Key' }, { status: 500 });
    }

    // 【安全診斷模式】：由 Vercel 伺服器在背景向 Google 索取清單，金鑰絕不會傳到瀏覽器
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResponse.json();

    if (listData.models) {
      // 抽出所有支援 generateContent (內容生成) 的模型名稱
      const availableModels = listData.models
        .filter((m: any) => m.supportedGenerationMethods.includes('generateContent'))
        .map((m: any) => m.name.replace('models/', '')) // 去掉 models/ 前綴方便閱讀
        .join(' \n- '); // 換行排列
      
      return NextResponse.json({ error: `【安全診斷成功】您的金鑰目前支援以下模型：\n\n- ${availableModels}` }, { status: 400 });
    } else {
      // 如果金鑰無效或被封鎖，會在這裡吐出錯誤原因
      return NextResponse.json({ error: `取得清單失敗，Google API 回應：${JSON.stringify(listData)}` }, { status: 400 });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
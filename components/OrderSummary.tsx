import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type SummaryItem = {
  name: string;
  count: number;
  total: number;
  orderDetails: { id: number; customer_name: string }[];
};

type Props = {
  storeName: string;
  summary: SummaryItem[];
  totalAmount: number;
  totalCount: number;
  isExpired: boolean;
  onDeleteOrder: (id: number, name: string) => void;
};

export function OrderSummary({ storeName, summary, totalAmount, totalCount, isExpired, onDeleteOrder }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);

    try {
      // 1. 等待一下，確保畫面渲染完成
      await new Promise(resolve => setTimeout(resolve, 100));

      // 2. 開始轉換
      const canvas = await html2canvas(printRef.current, {
        scale: 1.5, // 降低一點解析度，提高手機成功率
        useCORS: true,
        allowTaint: true,
        logging: false, // 關閉除錯紀錄
        backgroundColor: '#ffffff', // 強制白底
        // 在截圖時去除陰影與圓角，減少運算負擔
        onclone: (clonedDoc) => {
          const element = clonedDoc.querySelector('[data-print-target]') as HTMLElement;
          if (element) {
            element.style.boxShadow = 'none';
            element.style.borderRadius = '0px';
            element.style.border = '1px solid #ddd';
          }
        }
      });

      // 3. 轉成圖片
      const imgData = canvas.toDataURL('image/jpeg', 0.9); // 改用 JPEG 壓縮，減少檔案大小

      // 4. 建立 PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      // 5. 輸出
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`訂單_${storeName.replace(/\s+/g, '_')}.pdf`);

    } catch (e: any) {
      console.error(e);
      // 顯示真實錯誤訊息
      alert(`PDF 匯出失敗：${e.message || e}\n\n建議：請嘗試直接使用手機截圖功能。`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div 
      ref={printRef} 
      data-print-target // 標記這個是用來截圖的目標
      className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 mb-10"
    >
      <div className="flex justify-between items-center mb-6">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            {storeName} 
            {isExpired && <span className="text-red-500 text-sm border border-red-500 px-2 rounded">已結單</span>}
          </h2>
          <p className="text-sm text-gray-500">今日訂單統計</p>
        </div>
        
        {/* data-html2canvas-ignore 會讓這個區塊在 PDF 中自動消失 */}
        <div className="flex gap-2 print:hidden" data-html2canvas-ignore="true">
          <button 
            onClick={handleExportPDF} 
            disabled={isExporting}
            className={`text-white px-4 py-2 rounded flex items-center gap-2 text-sm shadow-md font-bold transition ${isExporting ? 'bg-gray-400 cursor-wait' : 'bg-red-600 hover:bg-red-700'}`}
          >
            {isExporting ? '處理中...' : '📄 匯出 PDF'}
          </button>
          <button 
            onClick={() => window.print()} 
            className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700 flex items-center gap-2 text-sm shadow-md font-bold transition"
          >
            🖨️ 列印
          </button>
        </div>
      </div>

      {summary.length === 0 ? (
        <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300 print:hidden">
          目前還沒有人點餐，快當第一個！
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider border-b border-gray-200">
                <th className="p-3 font-semibold">品項</th>
                <th className="p-3 text-center font-semibold">數量</th>
                <th className="p-3 text-right font-semibold">小計</th>
                <th className="p-3 font-semibold w-1/3">訂購人</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.map((row) => (
                <tr key={row.name} className="hover:bg-blue-50/50 transition">
                  <td className="p-3 font-medium text-gray-800">{row.name}</td>
                  <td className="p-3 text-center">
                    <span className="bg-blue-100 text-blue-800 py-1 px-2 rounded font-bold text-xs print:bg-transparent print:text-black print:border print:border-gray-300">{row.count}</span>
                  </td>
                  <td className="p-3 text-right font-bold text-gray-800">${row.total}</td>
                  <td className="p-3 text-sm text-gray-500">
                    <div className="flex flex-wrap gap-2">
                      {row.orderDetails.map((detail) => (
                        <span key={detail.id} className="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                          {detail.customer_name}
                          {!isExpired && (
                            <button 
                              // 這裡也加上 ignore，避免 PDF 出現紅色的刪除叉叉
                              data-html2canvas-ignore="true" 
                              onClick={() => onDeleteOrder(detail.id, detail.customer_name)}
                              className="text-red-400 hover:text-red-600 font-bold ml-1 print:hidden"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-900 text-white font-bold print:bg-gray-200 print:text-black">
                <td className="p-3 rounded-bl-xl">總計</td>
                <td className="p-3 text-center">{totalCount} 份</td>
                <td className="p-3 text-right text-xl text-yellow-400 print:text-black">
                  ${totalAmount}
                </td>
                <td className="p-3 rounded-br-xl"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
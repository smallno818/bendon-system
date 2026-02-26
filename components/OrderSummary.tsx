import React from 'react';

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
  
  return (
    <>
      {/* ★ 新增列印專用樣式：強制縮放與縮減邊界 */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 5mm; /* 將紙張邊距縮小到 5mm */
          }
          body {
            -webkit-print-color-adjust: exact;
          }
          .print-content {
            zoom: 0.70; /* ★ 關鍵：將內容縮小為 70% */
            width: 100%;
          }
          /* 隱藏瀏覽器預設的頁首頁尾 (視瀏覽器支援度) */
          .no-print {
            display: none;
          }
        }
      `}</style>

      {/* 在外層加上 print-content class */}
      <div className="print-content bg-white p-6 rounded-xl shadow-lg border border-gray-100 mb-10">
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              {storeName} 
              {isExpired && <span className="text-red-500 text-sm border border-red-500 px-2 rounded print:hidden">已結單</span>}
            </h2>
            <p className="text-sm text-gray-500">今日訂單統計</p>
          </div>
          
          <div className="flex gap-2 print:hidden">
            <button 
              onClick={() => window.print()} 
              className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700 flex items-center gap-2 text-sm shadow-md font-bold transition"
            >
              🖨️ 在電腦上列印
            </button>
          </div>
        </div>

        {summary.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300 print:hidden">
            目前還沒有人點餐，快當第一個！
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* 增加 print:text-sm 強制列印時字體變小 */}
            <table className="w-full text-left border-collapse print:text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider border-b border-gray-200 print:bg-gray-100">
                  <th className="p-3 font-semibold">品項</th>
                  <th className="p-3 text-center font-semibold">數量</th>
                  <th className="p-3 text-right font-semibold">小計</th>
                  <th className="p-3 font-semibold w-1/3">訂購人</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summary.map((row) => (
                  <tr key={row.name} className="hover:bg-blue-50/50 transition break-inside-avoid">
                    <td className="p-3 font-medium text-gray-800">{row.name}</td>
                    <td className="p-3 text-center">
                      <span className="bg-blue-100 text-blue-800 py-1 px-2 rounded font-bold text-xs print:bg-transparent print:text-black print:border print:border-gray-300">{row.count}</span>
                    </td>
                    <td className="p-3 text-right font-bold text-gray-800">${row.total}</td>
                    <td className="p-3 text-sm text-gray-500">
                      <div className="flex flex-wrap gap-2">
                        {row.orderDetails.map((detail) => (
                          <span key={detail.id} className="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded border border-gray-200 print:border-gray-300">
                            {detail.customer_name}
                            {!isExpired && (
                              <button 
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
    </>
  );
}
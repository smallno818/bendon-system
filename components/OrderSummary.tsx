import React from 'react';
import { SummaryItem } from '@/types'; 

type Props = {
  storeName: string;
  storePhone?: string | null; // ★ 新增：接收店家電話 (加上 ? 和 null 允許沒有電話的情況)
  summary: SummaryItem[];
  totalAmount: number;
  totalCount: number;
  isExpired: boolean;
  endTime: string;
  onDeleteOrder: (id: number, name: string) => void;
  onOrder?: (item: string, price: number, qty: number, remark?: string) => void; 
  onPrint?: () => void;
};

export function OrderSummary({ storeName, storePhone, summary, totalAmount, totalCount, isExpired, endTime, onDeleteOrder, onOrder, onPrint }: Props) {
  
  const formattedEndTime = new Date(endTime).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  return (
    <>
      <style jsx global>{`
        @media print {
          @page { margin: 5mm; }
          body { -webkit-print-color-adjust: exact; }
          .print-content { zoom: 0.90; width: 100%; }
          .no-print { display: none; }
        }
      `}</style>

      <div className="print-content bg-white p-6 rounded-xl shadow-lg border border-gray-100 mb-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex flex-col">
            <h2 className="text-2xl font-bold text-gray-800 flex flex-wrap items-center gap-2">
              {storeName} 
              {isExpired && <span className="text-red-500 text-sm border border-red-500 px-2 rounded print:hidden">已結單</span>}
            </h2>
            
            <div className="text-sm text-gray-500 mt-1 flex flex-wrap items-center gap-2">
              {/* ★ 新增：顯示店家電話 (如果有提供的話) */}
              {storePhone && (
                <>
                  <span className="font-medium text-gray-600 print:text-black print:font-bold">
                    📞 {storePhone}
                  </span>
                  <span className="hidden sm:inline text-gray-300 print:hidden">|</span>
                </>
              )}
              <span>訂單統計明細</span>
              <span className="hidden sm:inline text-gray-300 print:hidden">|</span>
              <span className="print:text-black print:font-bold print:text-base">
                結單時間：{formattedEndTime}
              </span>
            </div>
          </div>
          
          <div className="flex gap-2 print:hidden w-full sm:w-auto">
            <button onClick={onPrint || (() => window.print())} className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700 flex items-center gap-2 text-sm shadow-md font-bold transition">
              🖨️ 列印訂單
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
                <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider border-b border-gray-200 print:bg-gray-100 print:text-black">
                  <th className="p-3 font-semibold min-w-[140px]">品項</th>
                  <th className="p-3 text-right font-semibold whitespace-nowrap">單價</th>
                  <th className="p-3 text-center font-semibold whitespace-nowrap">數量</th>
                  <th className="p-3 text-right font-semibold whitespace-nowrap">小計</th>
                  <th className="p-3 font-semibold w-1/3 min-w-[150px]">訂購人</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summary.map((row) => {
                  const unitPrice = Math.round((row.total / row.count) * 10) / 10;
                  
                  return (
                  <tr key={`${row.name}-${unitPrice}`} className="hover:bg-blue-50/50 transition break-inside-avoid">
                    <td className="p-3 font-medium text-gray-800 print:text-black break-words whitespace-normal">
                      <div className="flex items-start sm:items-center gap-2">
                        {!isExpired && onOrder && (
                          <button
                            onClick={() => onOrder(row.name, unitPrice, 1, '')}
                            className="flex-shrink-0 mt-0.5 sm:mt-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors shadow-sm font-bold text-lg print:hidden border border-emerald-200"
                            title="+1 快速跟單"
                          >
                            +
                          </button>
                        )}
                        <span>{row.name}</span>
                      </div>
                    </td>
                    
                    <td className="p-3 text-right text-gray-500 print:text-gray-800 font-medium whitespace-nowrap">
                      ${unitPrice}
                    </td>

                    <td className="p-3 text-center whitespace-nowrap">
                      <span className="bg-blue-100 text-blue-800 py-1 px-2 rounded font-bold text-xs print:bg-transparent print:text-black print:border print:border-gray-400 print:text-sm">
                        {row.count}
                      </span>
                    </td>
                    
                    <td className="p-3 text-right font-bold text-gray-800 print:text-black whitespace-nowrap">
                      ${row.total}
                    </td>
                    
                    <td className="p-3 text-sm text-gray-500 print:text-black">
                      <div className="flex flex-wrap gap-2">
                        {row.orderDetails.map((detail) => (
                          <span key={detail.id} className="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded border border-gray-200 print:bg-transparent print:border-gray-400">
                            <span className="print:font-bold">{detail.customer_name}</span>

                            {detail.remark && (
                              <span className="text-xs text-gray-500 print:text-gray-700 font-normal">
                                ({detail.remark})
                              </span>
                            )}
                            
                            {detail.quantity > 1 && (
                              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-1 rounded ml-1 print:bg-transparent print:text-black print:border print:border-black">
                                x{detail.quantity}
                              </span>
                            )}

                            {!isExpired && (
                              <button 
                                onClick={() => onDeleteOrder(detail.id, detail.customer_name)}
                                className="text-red-400 hover:text-red-600 font-bold ml-1 print:hidden"
                                title={`刪除 ${detail.customer_name} 的 ${detail.quantity} 份餐點`}
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
              <tfoot>
                <tr className="bg-gray-900 text-white font-bold print:bg-gray-200 print:text-black">
                  <td className="p-3 rounded-bl-xl print:rounded-none border-t border-black" colSpan={2}>總計</td>
                  <td className="p-3 text-center border-t border-black">{totalCount} 份</td>
                  <td className="p-3 text-right text-xl text-yellow-400 print:text-black border-t border-black">
                    ${totalAmount}
                  </td>
                  <td className="p-3 rounded-br-xl print:rounded-none border-t border-black"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
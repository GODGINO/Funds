import React, { useMemo, useEffect, useState } from 'react';
import { Fund } from '../types';
import FundChart from './FundChart';
import ConfirmationModal from './ConfirmationModal';
import { calculateZigzag } from '../services/chartUtils';

interface FundDetailModalProps {
  fund: Fund;
  onClose: () => void;
  onDelete: (code: string) => void;
  zigzagThreshold: number;
}

const FundDetailModal: React.FC<FundDetailModalProps> = ({ fund, onClose, onDelete, zigzagThreshold }) => {
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    const { chartData, lastPivotDate } = useMemo(() => {
        const baseChartData = [...fund.data];
        if (fund.realTimeData && !isNaN(fund.realTimeData.estimatedNAV)) {
            baseChartData.push({
                date: fund.realTimeData.estimationTime,
                unitNAV: fund.realTimeData.estimatedNAV,
                cumulativeNAV: fund.realTimeData.estimatedNAV,
                dailyGrowthRate: fund.realTimeData.estimatedChange,
                subscriptionStatus: 'N/A',
                redemptionStatus: 'N/A',
                dividendDistribution: 'N/A',
            });
        }
        
        const zigzagPoints = calculateZigzag(baseChartData, zigzagThreshold);
        const zigzagMap = new Map(zigzagPoints.map(p => [p.date, p.unitNAV]));

        const finalChartData = baseChartData.map(p => ({
            ...p,
            zigzagNAV: zigzagMap.get(p.date)
        }));

        const pivotDate = zigzagPoints.length >= 2 ? zigzagPoints[zigzagPoints.length - 2]?.date : null;

        return { chartData: finalChartData, lastPivotDate: pivotDate };
    }, [fund.data, fund.realTimeData, zigzagThreshold]);
    
    // Effect to handle Escape key press for the main modal
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                // Do not close if the confirmation modal is open
                if (!isConfirmModalOpen) {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose, isConfirmModalOpen]);

    const handleOpenConfirmModal = () => {
        setIsConfirmModalOpen(true);
    };
    
    const handleConfirmDelete = () => {
        onDelete(fund.code);
        setIsConfirmModalOpen(false); // This will also close the main modal via parent state change
    };

    return (
        <>
            <div 
                className="fixed inset-0 bg-gray-900 bg-opacity-75 z-50 flex justify-center items-center transition-opacity" 
                onClick={(e) => {
                    // Only close if the backdrop itself is clicked and confirm modal is not open
                    if (e.target === e.currentTarget && !isConfirmModalOpen) {
                        onClose();
                    }
                }}
                aria-modal="true"
                role="dialog"
            >
                <div 
                    className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-3xl m-4 transform transition-all" 
                >
                    {/* Modal Header */}
                    <div className="flex justify-between items-center px-6 py-4 border-b dark:border-gray-700">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleOpenConfirmModal}
                                className="p-1 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-red-500 focus:outline-none"
                                aria-label="Delete fund"
                            >
                                <svg className="h-6 w-6 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                {fund.name}
                                <span className="ml-2 text-base font-normal text-gray-500 dark:text-gray-400">{fund.code}</span>
                            </h2>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none"
                            aria-label="Close"
                        >
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Modal Body */}
                    <div className="p-6">
                        <div className="h-[400px]">
                            <FundChart 
                              chartData={chartData} 
                              lastPivotDate={lastPivotDate}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="确认删除"
                message={`您确定要取消订阅基金 ${fund.name} (${fund.code}) 吗？`}
            />
        </>
    );
};

export default FundDetailModal;
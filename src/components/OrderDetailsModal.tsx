import React from 'react';

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any; // Consider creating a specific type for the order
}

const DetailItem = ({ label, value, className = '' }: { label: string, value: React.ReactNode, className?: string }) => (
  <div className={`flex justify-between items-start py-2 px-3 rounded-lg transition-colors duration-200 hover:bg-white/5 ${className}`}>
    <span className="text-sm text-gray-400">{label}:</span>
    <span className="text-sm text-white font-semibold text-right break-all">{value}</span>
  </div>
);

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ isOpen, onClose, order }) => {
  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-fadeIn">
      <div className="bg-gradient-to-br from-[#0A0A0F] to-[#11131A] rounded-xl p-6 w-full max-w-lg mx-4 border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
        <div className="flex justify-between items-start gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg md:text-xl font-semibold text-blue-400 leading-tight">
              Order #{order.id} Details
            </h3>
            <p className="text-sm text-blue-300/80 mt-2">
              Submitted on {new Date(order.claimed_at).toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} className="text-blue-300/60 hover:text-blue-300 transition-colors flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {/* Player Information */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-400 mb-2">Player Information</h4>
            <div className="space-y-1">
              <DetailItem label="Name" value={`${order.telegram_first_name || 'N/A'} ${order.telegram_last_name || ''}`} />
              <DetailItem label="Username" value={`@${order.telegram_username || 'N/A'}`} />
              <DetailItem label="Telegram ID" value={order.telegram_id || 'N/A'} />
            </div>
          </div>

          {/* Portfolio Details */}
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <h4 className="text-sm font-medium text-green-400 mb-2">Portfolio Details</h4>
            <div className="space-y-1">
              <DetailItem label="Portfolio Value" value={`$${order.portfolio_value?.toLocaleString() || '0'}`} />
              <DetailItem label="TON Balance" value={`${order.ton_balance?.toFixed(4) || '0.0000'} TON`} />
              <DetailItem label="STK Amount" value={`${order.stk_amount?.toLocaleString() || '0'} STK`} />
              <DetailItem label="STKN Balance" value={`${order.stkn_balance?.toLocaleString() || '0'} STKN`} />
              <DetailItem label="Mining Balance" value={`${order.total_stk_mining?.toLocaleString() || '0'} STK`} />
              <DetailItem label="NFT Token ID" value={order.nft_token_id || 'Not provided'} />
            </div>
          </div>

          {/* Claim Information */}
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
            <h4 className="text-sm font-medium text-purple-400 mb-2">Claim Information</h4>
            <div className="space-y-1">
              <DetailItem label="Claim Amount" value={`${order.claim_amount?.toLocaleString() || '0'} STK`} />
              <DetailItem label="Approval Status" value={order.approval_status || 'Unknown'} />
              <DetailItem label="Payment Status" value={order.payment_status || 'Unknown'} />
              <DetailItem label="Network" value={order.network || 'Unknown'} />
            </div>
          </div>

          {/* Wallet & Session */}
          <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-400 mb-2">Wallet & Session</h4>
            <div className="space-y-1">
              <DetailItem label="Wallet" value={order.wallet_address || 'Not provided'} />
              <DetailItem label="Session ID" value={order.session_id || 'N/A'} />
            </div>
          </div>

          {/* Timestamps */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <h4 className="text-sm font-medium text-yellow-400 mb-2">Timestamps</h4>
            <div className="space-y-1">
              <DetailItem label="Submitted" value={order.claimed_at ? new Date(order.claimed_at).toLocaleString() : 'N/A'} />
              <DetailItem label="Approved" value={order.approved_at ? new Date(order.approved_at).toLocaleString() : 'Not approved'} />
              <DetailItem label="Payment Date" value={order.payment_processed_at ? new Date(order.payment_processed_at).toLocaleString() : 'N/A'} />
            </div>
          </div>

          {/* Admin & Transaction Info */}
          {(order.rejection_reason || order.admin_notes || order.payment_tx_hash) && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <h4 className="text-sm font-medium text-red-400 mb-2">Admin & Transaction Info</h4>
              <div className="space-y-1">
                {order.rejection_reason && <DetailItem label="Rejection Reason" value={order.rejection_reason} />}
                {order.admin_notes && <DetailItem label="Admin Notes" value={order.admin_notes} />}
                {order.payment_tx_hash && <DetailItem label="Transaction" value={order.payment_tx_hash} />}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:from-blue-500 hover:to-purple-500 active:scale-95 transition-all duration-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
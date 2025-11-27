// components/AlertDialog.js - Alert/Notification Dialog
import Modal from './Modal';
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

export default function AlertDialog({
    isOpen,
    onClose,
    title,
    message,
    type = "info", // success, error, warning, info
    confirmText = "OK"
}) {
    const typeConfig = {
        success: {
            icon: CheckCircle,
            iconColor: 'text-green-400',
            bgColor: 'bg-green-900/20',
            buttonColor: 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
        },
        error: {
            icon: XCircle,
            iconColor: 'text-red-400',
            bgColor: 'bg-red-900/20',
            buttonColor: 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
        },
        warning: {
            icon: AlertCircle,
            iconColor: 'text-yellow-400',
            bgColor: 'bg-yellow-900/20',
            buttonColor: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
        },
        info: {
            icon: Info,
            iconColor: 'text-blue-400',
            bgColor: 'bg-blue-900/20',
            buttonColor: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
        }
    };

    const config = typeConfig[type] || typeConfig.info;
    const IconComponent = config.icon;

    return (
        <Modal isOpen={isOpen} onClose={onClose} showCloseButton={false}>
            <div className="text-center">
                {/* Icon */}
                <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${config.bgColor} mb-4`}>
                    <IconComponent className={`h-6 w-6 ${config.iconColor}`} />
                </div>

                {/* Title */}
                {title && (
                    <h3 className="text-xl font-semibold text-white mb-3">
                        {title}
                    </h3>
                )}

                {/* Message */}
                <div className="text-gray-300 text-sm mb-6 whitespace-pre-line">
                    {message}
                </div>

                {/* Button */}
                <button
                    onClick={onClose}
                    className={`w-full px-6 py-2.5 text-white rounded-lg transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 ${config.buttonColor}`}
                >
                    {confirmText}
                </button>
            </div>
        </Modal>
    );
}

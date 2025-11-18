import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000); // Auto-dismiss after 3 seconds

    return () => {
      clearTimeout(timer);
    };
  }, [onClose]);

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-blue-600 text-white py-3 px-6 rounded-full shadow-2xl z-50 animate-toast-in">
       <style>{`
        @keyframes toast-in {
            from { transform: translate(-50%, 100%); opacity: 0; }
            to { transform: translate(-50%, 0); opacity: 1; }
        }
        .animate-toast-in { animation: toast-in 0.5s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
       `}</style>
      <p>{message}</p>
    </div>
  );
};

export default Toast;

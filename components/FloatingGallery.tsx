import React, { useState, useEffect, useRef } from 'react';
import type { SalesMemoImage } from '../types';
import { XIcon, TrashIcon, MinimizeIcon } from './icons';

interface FloatingGalleryProps {
    images: SalesMemoImage[];
    onClose: () => void;
    onDelete: (id: number) => void;
}

const FloatingGallery: React.FC<FloatingGalleryProps> = ({ images, onClose, onDelete }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isMinimized, setIsMinimized] = useState(false);
    const [position, setPosition] = useState({ x: 50, y: 50 });
    const [isDragging, setIsDragging] = useState(false);
    const galleryRef = useRef<HTMLDivElement>(null);
    const dragStartPos = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        setIsDragging(true);
        dragStartPos.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        };
        // Add a class to body to prevent text selection while dragging
        document.body.style.userSelect = 'none';
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging || !galleryRef.current) return;
        const newX = e.clientX - dragStartPos.current.x;
        const newY = e.clientY - dragStartPos.current.y;
        setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        // Remove the style from body
        document.body.style.userSelect = '';
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);
    
    useEffect(() => {
        // If images are deleted, make sure the index is not out of bounds
        if (currentIndex >= images.length && images.length > 0) {
            setCurrentIndex(images.length - 1);
        } else if (images.length === 0) {
            onClose(); // Auto-close if no images are left
        }
    }, [images, currentIndex, onClose]);

    const nextImage = () => setCurrentIndex(prev => (prev + 1) % images.length);
    const prevImage = () => setCurrentIndex(prev => (prev - 1 + images.length) % images.length);

    const handleDelete = () => {
        if (images[currentIndex]) {
            if (window.confirm("آیا از حذف این یادداشت تصویری اطمینان دارید؟")) {
                 onDelete(images[currentIndex].id);
            }
        }
    };
    
    if (isMinimized) {
        return (
             <div 
                style={{
                    position: 'fixed',
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                    cursor: 'move',
                }}
                onMouseDown={handleMouseDown}
                className="bg-blue-600 text-white rounded-xl shadow-2xl p-3 z-50 flex items-center"
            >
                <span className="font-semibold">گالری یادداشت‌ها</span>
                <button onClick={() => setIsMinimized(false)} className="ml-2 p-1 rounded-full hover:bg-white/20 transition-colors">
                    <XIcon className="w-5 h-5 transform rotate-45" />
                </button>
            </div>
        )
    }

    return (
        <div
            ref={galleryRef}
            className="fixed bg-white/70 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-sm flex flex-col z-50 overflow-hidden border border-gray-200/80"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                maxHeight: '70vh'
            }}
        >
            <div
                className="bg-slate-100/80 p-3 flex justify-between items-center cursor-move border-b border-slate-200"
                onMouseDown={handleMouseDown}
            >
                <h3 className="font-bold text-slate-700">گالری یادداشت‌ها</h3>
                <div className="flex items-center space-x-1 space-x-reverse">
                    <button onClick={() => setIsMinimized(true)} className="p-1 rounded-full text-slate-600 hover:bg-slate-200"><MinimizeIcon className="w-5 h-5"/></button>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-600 hover:bg-slate-200"><XIcon className="w-5 h-5"/></button>
                </div>
            </div>

            <div className="flex-grow p-4 pb-20 md:pb-4 flex items-center justify-center">
                 {images.length > 0 && images[currentIndex] ? (
                    <img src={images[currentIndex].imageData} alt="Sales Memo" className="max-w-full max-h-full object-contain rounded-lg" />
                 ) : (
                    <p className="text-slate-500">یادداشتی برای نمایش وجود ندارد.</p>
                 )}
            </div>

            {images.length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 md:static bg-slate-100/80 p-3 flex justify-between items-center border-t border-slate-200">
                    <button onClick={handleDelete} className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition-colors"><TrashIcon /></button>
                    <div className="flex items-center space-x-4 space-x-reverse">
                        <button onClick={prevImage} className="font-bold text-2xl text-slate-600 hover:text-blue-600">&lt;</button>
                        <span className="font-semibold text-slate-700">{currentIndex + 1} / {images.length}</span>
                        <button onClick={nextImage} className="font-bold text-2xl text-slate-600 hover:text-blue-600">&gt;</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FloatingGallery;
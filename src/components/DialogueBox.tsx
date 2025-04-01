import { useEffect, useRef, useState, useCallback } from "react";

interface DialogueBoxProps {
    npcName: string;
    message: string;
    options?: string[];
    onOptionSelect?: (option: string) => void;
    onClose: () => void;
    isOpen: boolean;
}

const DialogueBox = ({
    npcName,
    message,
    options = [],
    onOptionSelect,
    onClose,
    isOpen,
}: DialogueBoxProps) => {
    const [isTyping, setIsTyping] = useState(false);
    const [displayedText, setDisplayedText] = useState("");
    const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
    const dialogueRef = useRef<HTMLDivElement>(null);

    // Track previous message length to handle streaming properly
    const prevMessageLengthRef = useRef(0);

    useEffect(() => {
        if (isOpen && message) {
            // Only reset animation if dialogue was closed or a completely new message starts
            const isNewMessage = prevMessageLengthRef.current > message.length;
            
            if (isNewMessage) {
                setIsTyping(true);
                setDisplayedText(''); // Reset for new messages
                prevMessageLengthRef.current = 0;
            }
            
            // Only animate the new portion of text for streaming
            const startIndex = isNewMessage ? 0 : prevMessageLengthRef.current;
            let index = startIndex;
            
            // Update the ref to track message length
            prevMessageLengthRef.current = message.length;
            
            // If we're already at the end of the message, no need to animate
            if (index >= message.length) {
                setDisplayedText(message);
                setIsTyping(false);
                return;
            }
            
            setIsTyping(true);
            
            const intervalId = setInterval(() => {
                if (index < message.length) {
                    setDisplayedText(message.substring(0, index + 1));
                    index++;
                } else {
                    setIsTyping(false);
                    clearInterval(intervalId);
                }
            }, 30); // Adjust typing speed here
            
            return () => {
                clearInterval(intervalId);
            };
        } else if (!isOpen) {
            // Reset when dialogue closes
            prevMessageLengthRef.current = 0;
            setIsTyping(false);
        }
    }, [message, isOpen]);

    // Reset selected option when dialogue opens or options change
    useEffect(() => {
        setSelectedOptionIndex(0);
    }, [isOpen, options]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isOpen) return;

        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
            case 'ArrowUp':
                if (isTyping || options.length === 0) return;
                e.preventDefault();
                setSelectedOptionIndex(prev => 
                    prev > 0 ? prev - 1 : options.length - 1
                );
                break;
            case 'ArrowDown':
                if (isTyping || options.length === 0) return;
                e.preventDefault();
                setSelectedOptionIndex(prev => 
                    prev < options.length - 1 ? prev + 1 : 0
                );
                break;
            case 'Enter':
                if (isTyping || options.length === 0) return;
                e.preventDefault();
                if (selectedOptionIndex >= 0 && selectedOptionIndex < options.length) {
                    onOptionSelect?.(options[selectedOptionIndex]);
                }
                break;
        }
    }, [isOpen, isTyping, options, onOptionSelect, selectedOptionIndex, onClose]);
    

    // Add event listener for keyboard navigation
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    if (!isOpen) return null;

    return (
        <div
            className={`
        fixed bottom-0 left-0 right-0 p-4 
        bg-gray-900/95 text-white
        border-t-2 border-gray-700 
        overflow-y-visible
        z-50 pointer-events-auto
        ${isOpen ? "block" : "hidden"}
    `}
            ref={dialogueRef}
        >
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold text-yellow-400">
                    {npcName}
                </h3>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors"
                    aria-label="Close dialogue"
                >
                    ✕
                </button>
            </div>

            <div className="mb-4 min-h-[60px]">
                {displayedText}
                {isTyping && <span className="animate-pulse">▋</span>}
            </div>

            <div className="flex flex-col gap-2">
                {options.map((option, index) => (
                    <button
                        key={index}
                        onClick={() => onOptionSelect?.(option)}
                        className={`text-left p-2 rounded transition-colors ${index === selectedOptionIndex ? 'bg-gray-700 border-l-4 border-yellow-400' : 'hover:bg-gray-700'}`}
                    >
                        {option}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default DialogueBox;

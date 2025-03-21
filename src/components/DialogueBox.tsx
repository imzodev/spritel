import { useEffect, useRef, useState } from "react";

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
    const dialogueRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && message) {
            setIsTyping(true);
            setDisplayedText(''); // Ensure reset
            let index = 0;
    
            const intervalId = setInterval(() => {
                if (index < message.length) {
                    setDisplayedText(message.substring(0, index + 1)); // Fix issue
                    index++;
                } else {
                    setIsTyping(false);
                    clearInterval(intervalId);
                }
            }, 30); // Adjust typing speed here
    
            return () => {
                clearInterval(intervalId);
                setIsTyping(false);
            };
        }
    }, [message, isOpen]);
    

    if (!isOpen) return null;

    return (
        <div
            className={`
                fixed bottom-0 left-0 right-0 p-4 
                bg-gray-900/95 text-white
                border-t-2 border-gray-700 
                max-h-[200px] overflow-y-auto
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
                        onClick={() => onOptionSelect(option)}
                        className="text-left hover:bg-gray-700 p-2 rounded transition-colors"
                    >
                        {option}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default DialogueBox;

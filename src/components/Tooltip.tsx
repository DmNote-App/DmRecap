"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
}

export default function Tooltip({ content, children }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div
            className="relative inline-flex"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
            onClick={() => setIsVisible(!isVisible)}
        >
            {children}
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-1/2 top-full mt-2 -translate-x-1/2 z-50 whitespace-nowrap pointer-events-none"
                    >
                        <div className="bg-gray-900/90 text-white text-xs px-3 py-1.5 rounded-lg shadow-xl backdrop-blur-sm border border-white/10">
                            {content}
                            <div className="absolute -top-1 left-1/2 -ml-1 border-4 border-transparent border-b-gray-900/90" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

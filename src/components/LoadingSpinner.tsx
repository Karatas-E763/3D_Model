"use client";

import { motion } from "framer-motion";

interface LoadingSpinnerProps {
  progress: number;
  message?: string;
}

export default function LoadingSpinner({
  progress,
  message = "Cargando modelo 3D...",
}: LoadingSpinnerProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label={`${message} ${progress}%`}
    >
      <div className="relative h-24 w-24">
        <svg className="h-24 w-24 -rotate-90 transform" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="#1e88e5"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${progress * 2.64} 264`}
            className="transition-all duration-300"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-[#1e88e5]">
          {progress}%
        </span>
      </div>
      <p className="mt-4 text-sm font-medium text-[#1a3a5c]">{message}</p>
      <p className="mt-1 text-xs text-gray-500">
        Optimizando visualización del modelo...
      </p>
    </motion.div>
  );
}

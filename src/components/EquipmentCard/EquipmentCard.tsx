"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { FaCheck, FaWifi, FaBatteryFull, FaShieldAlt, FaMobileAlt, FaCamera, FaBrain, FaHdd, FaMoon, FaCrosshairs, FaTint, FaMagnet, FaBell, FaExclamationTriangle, FaMapMarkerAlt, FaVolumeMute, FaTint as FaWater } from "react-icons/fa";
import type { Product } from "@/types";

const specIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  signal: FaWifi,
  battery: FaBatteryFull,
  shield: FaShieldAlt,
  platform: FaMobileAlt,
  camera: FaCamera,
  ai: FaBrain,
  storage: FaHdd,
  night: FaMoon,
  precision: FaCrosshairs,
  ultrasonic: FaTint,
  tank: FaTint,
  report: FaHdd,
  magnet: FaMagnet,
  wireless: FaWifi,
  alert: FaBell,
  sos: FaExclamationTriangle,
  gps: FaMapMarkerAlt,
  silent: FaVolumeMute,
  waterproof: FaWater,
};

interface EquipmentCardProps {
  product: Product;
  hotspotLabel?: string;
  onAddToQuote: () => void;
  onClose: () => void;
}

export default function EquipmentCard({
  product,
  hotspotLabel,
  onAddToQuote,
  onClose,
}: EquipmentCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#1e88e5]" />
          <span className="text-sm text-gray-600">
            Punto seleccionado:{" "}
            <strong className="text-[#1a3a5c]">{hotspotLabel}</strong>
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Cerrar panel"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mb-4 flex gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-50">
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-contain p-1"
              sizes="80px"
            />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#1a3a5c]">{product.name}</h3>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">
              {product.description}
            </p>
          </div>
        </div>

        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#1a3a5c]">
          Beneficios principales
        </h4>
        <ul className="mb-4 space-y-1.5">
          {product.benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-sm text-gray-700">
              <FaCheck className="mt-0.5 shrink-0 text-[#1e88e5]" />
              {benefit}
            </li>
          ))}
        </ul>

        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#1a3a5c]">
          Características técnicas
        </h4>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {product.technicalSpecs.map((spec) => {
            const SpecIcon = specIconMap[spec.icon] ?? FaShieldAlt;
            return (
              <div
                key={spec.label}
                className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2"
              >
                <SpecIcon className="shrink-0 text-[#1e88e5]" />
                <span className="text-xs text-gray-700">{spec.label}</span>
              </div>
            );
          })}
        </div>

        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#1a3a5c]">
          Ventajas de instalación
        </h4>
        <ul className="space-y-1">
          {product.advantages.map((adv) => (
            <li key={adv} className="text-xs text-gray-600">
              • {adv}
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-gray-100 p-4">
        <motion.button
          type="button"
          onClick={onAddToQuote}
          className="w-full rounded-xl bg-[#1e88e5] py-3 text-sm font-semibold text-white shadow-md hover:bg-[#1565c0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e88e5] focus-visible:ring-offset-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Agregar a cotización — {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(product.price)}
        </motion.button>
      </div>
    </motion.div>
  );
}

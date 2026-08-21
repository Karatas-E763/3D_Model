"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import {
  FaTruck,
  FaBus,
  FaCar,
  FaMotorcycle,
  FaAmbulance,
  FaCube,
  FaUser,
  FaTruckLoading,
} from "react-icons/fa";
import { GiForklift, GiMineTruck } from "react-icons/gi";
import type { Category } from "@/types";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  truck: FaTruck,
  bus: FaBus,
  car: FaCar,
  excavator: GiMineTruck,
  forklift: GiForklift,
  motorcycle: FaMotorcycle,
  ambulance: FaAmbulance,
  trailer: FaTruckLoading,
  person: FaUser,
  cube: FaCube,
};

interface CategoryCardProps {
  category: Category;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onHover?: (glbPath: string) => void;
}

export default function CategoryCard({
  category,
  isSelected,
  onSelect,
  onHover,
}: CategoryCardProps) {
  const Icon = iconMap[category.icon] ?? FaCube;

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(category.id)}
      onMouseEnter={() => onHover?.(category.glbPath)}
      onFocus={() => onHover?.(category.glbPath)}
      className={`group relative flex w-full flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-md transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e88e5] focus-visible:ring-offset-2 ${
        isSelected
          ? "border-[#1e88e5] ring-2 ring-[#1e88e5]/30"
          : "border-gray-100 hover:shadow-xl"
      }`}
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.98 }}
      aria-label={`Seleccionar ${category.title}`}
      aria-pressed={isSelected}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-50">
        <Image
          src={category.image}
          alt={category.title}
          fill
          className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 576px) 100vw, (max-width: 992px) 50vw, 20vw"
          priority
        />
      </div>

      <div className="relative flex flex-col items-center px-4 pb-5 pt-8">
        <div
          className="absolute -top-7 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full shadow-lg"
          style={{ backgroundColor: category.iconColor }}
        >
          <Icon className="text-xl text-white" aria-hidden />
        </div>

        <h3 className="mb-1 text-center text-sm font-bold uppercase tracking-wide text-[#1a3a5c] md:text-base">
          {category.title}
        </h3>
        <p className="text-center text-xs leading-relaxed text-[#4a6a8a] md:text-sm">
          {category.description}
        </p>
      </div>
    </motion.button>
  );
}

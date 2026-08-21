"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import categoriesData from "@/data/categories.json";
import CategoryCard from "@/components/CategoryCard";
import Header from "@/components/Sidebar/Header";
import { preloadGLB } from "@/hooks/useGLBLoader";
import type { Category } from "@/types";

const categories = categoriesData as Category[];

export default function HomePage() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setTimeout(() => {
      router.push(`/vehiculo/${id}`);
    }, 300);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f0f4f8] to-[#e8edf3]">
      <Header />
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10 text-center"
        >
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl md:text-4xl lg:text-[2.75rem]">
            <span className="text-[#1a3a5c]">¿QUÉ TIPO DE UNIDAD </span>
            <span className="text-[#1e88e5]">DESEAS COTIZAR?</span>
          </h1>

          <div className="mx-auto my-6 flex max-w-lg items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#1e88e5]/40" />
            <div className="h-2 w-2 rounded-full bg-[#1e88e5]" />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#1e88e5]/40" />
          </div>

          <p className="mx-auto max-w-2xl text-base text-[#4a6a8a] sm:text-lg">
            Selecciona la categoría que mejor describa tu unidad o activo
          </p>
        </motion.div>

        {/* First row: 5 cards */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mx-auto grid max-w-[1400px] grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        >
          {categories.slice(0, 5).map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <CategoryCard
                category={category}
                isSelected={selectedId === category.id}
                onSelect={handleSelect}
                onHover={preloadGLB}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Second row: 4 cards centered */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mx-auto mt-5 grid max-w-[1120px] grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4"
        >
          {categories.slice(5).map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 + index * 0.05 }}
            >
              <CategoryCard
                category={category}
                isSelected={selectedId === category.id}
                onSelect={handleSelect}
                onHover={preloadGLB}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </main>
  );
}

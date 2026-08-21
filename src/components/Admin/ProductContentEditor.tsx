"use client";

import { useState } from "react";
import { FaChevronDown, FaChevronUp, FaPlus, FaTrash } from "react-icons/fa";
import { PRODUCT_SPEC_ICONS } from "@/components/Admin/productSpecIcons";
import type { Product } from "@/types";

type ProductContent = Pick<Product, "benefits" | "technicalSpecs" | "advantages">;

interface ProductContentEditorProps {
  content: ProductContent;
  onChange: (content: ProductContent) => void;
}

type SectionKey = "benefits" | "technicalSpecs" | "advantages";

const SECTIONS: { key: SectionKey; title: string; hint: string }[] = [
  {
    key: "benefits",
    title: "Beneficios principales",
    hint: "Lista con viñetas y marca de verificación en la ficha del equipo.",
  },
  {
    key: "technicalSpecs",
    title: "Características técnicas",
    hint: "Cuadrícula de especificaciones con icono y etiqueta.",
  },
  {
    key: "advantages",
    title: "Ventajas de instalación",
    hint: "Lista de ventajas mostradas al final de la ficha del equipo.",
  },
];

export default function ProductContentEditor({ content, onChange }: ProductContentEditorProps) {
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    benefits: true,
    technicalSpecs: false,
    advantages: false,
  });

  const toggleSection = (key: SectionKey) => {
    setOpenSections((current) => ({ ...current, [key]: !current[key] }));
  };

  const updateBenefits = (benefits: string[]) => onChange({ ...content, benefits });
  const updateTechnicalSpecs = (technicalSpecs: ProductContent["technicalSpecs"]) =>
    onChange({ ...content, technicalSpecs });
  const updateAdvantages = (advantages: string[]) => onChange({ ...content, advantages });

  return (
    <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#1a3a5c]">
        Contenido de la ficha
      </p>

      {SECTIONS.map((section) => {
        const isOpen = openSections[section.key];
        const count =
          section.key === "technicalSpecs"
            ? content.technicalSpecs.length
            : content[section.key].length;

        return (
          <div
            key={section.key}
            className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50/60"
          >
            <button
              type="button"
              onClick={() => toggleSection(section.key)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <div>
                <p className="text-sm font-semibold text-[#1a3a5c]">{section.title}</p>
                <p className="text-xs text-gray-500">{section.hint}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200">
                  {count}
                </span>
                {isOpen ? (
                  <FaChevronUp className="text-gray-400" />
                ) : (
                  <FaChevronDown className="text-gray-400" />
                )}
              </div>
            </button>

            {isOpen && (
              <div className="space-y-2 border-t border-gray-200 bg-white px-4 py-3">
                {section.key === "benefits" && (
                  <StringListEditor
                    items={content.benefits}
                    placeholder="Ej. Localización en tiempo real 24/7"
                    onChange={updateBenefits}
                  />
                )}
                {section.key === "technicalSpecs" && (
                  <TechnicalSpecsEditor
                    items={content.technicalSpecs}
                    onChange={updateTechnicalSpecs}
                  />
                )}
                {section.key === "advantages" && (
                  <StringListEditor
                    items={content.advantages}
                    placeholder="Ej. Instalación en cabina sin obstrucción"
                    onChange={updateAdvantages}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StringListEditor({
  items,
  placeholder,
  onChange,
}: {
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
}) {
  const updateItem = (index: number, value: string) => {
    const next = [...items];
    next[index] = value;
    onChange(next);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={`${index}-${item}`} className="flex items-start gap-2">
          <div className="flex shrink-0 flex-col gap-1 pt-2">
            <button
              type="button"
              onClick={() => moveItem(index, -1)}
              disabled={index === 0}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
              aria-label="Subir"
            >
              <FaChevronUp className="text-[10px]" />
            </button>
            <button
              type="button"
              onClick={() => moveItem(index, 1)}
              disabled={index === items.length - 1}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
              aria-label="Bajar"
            >
              <FaChevronDown className="text-[10px]" />
            </button>
          </div>
          <input
            type="text"
            value={item}
            onChange={(e) => updateItem(index, e.target.value)}
            placeholder={placeholder}
            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => removeItem(index)}
            className="mt-2 shrink-0 rounded-lg p-2 text-red-500 hover:bg-red-50"
            aria-label="Eliminar"
          >
            <FaTrash className="text-xs" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="inline-flex items-center gap-2 rounded-xl border border-dashed border-[#1e88e5]/40 px-3 py-2 text-sm font-medium text-[#1e88e5] hover:bg-blue-50"
      >
        <FaPlus className="text-xs" />
        Agregar ítem
      </button>
    </div>
  );
}

function TechnicalSpecsEditor({
  items,
  onChange,
}: {
  items: ProductContent["technicalSpecs"];
  onChange: (items: ProductContent["technicalSpecs"]) => void;
}) {
  const updateItem = (index: number, patch: Partial<ProductContent["technicalSpecs"][number]>) => {
    const next = [...items];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {items.map((spec, index) => (
        <div key={`${index}-${spec.label}`} className="grid gap-2 sm:grid-cols-[160px_1fr_auto]">
          <select
            value={spec.icon}
            onChange={(e) => updateItem(index, { icon: e.target.value })}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          >
            {PRODUCT_SPEC_ICONS.map((icon) => (
              <option key={icon.value} value={icon.value}>
                {icon.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={spec.label}
            onChange={(e) => updateItem(index, { label: e.target.value })}
            placeholder="Ej. Resolución Full HD 1080p"
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => removeItem(index)}
            className="rounded-lg p-2 text-red-500 hover:bg-red-50 sm:mt-0"
            aria-label="Eliminar"
          >
            <FaTrash className="text-xs" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([...items, { icon: PRODUCT_SPEC_ICONS[0].value, label: "" }])
        }
        className="inline-flex items-center gap-2 rounded-xl border border-dashed border-[#1e88e5]/40 px-3 py-2 text-sm font-medium text-[#1e88e5] hover:bg-blue-50"
      >
        <FaPlus className="text-xs" />
        Agregar característica
      </button>
    </div>
  );
}

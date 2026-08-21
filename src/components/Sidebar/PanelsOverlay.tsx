"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import EquipmentCard from "@/components/EquipmentCard/EquipmentCard";
import QuotePanel from "@/components/QuotePanel/QuotePanel";
import VideoPlayer from "@/components/VideoPlayer/VideoPlayer";
import { useAppStore } from "@/store/useAppStore";
import { useCMSProducts } from "@/hooks/useCMS";
import { useModalZoomLock } from "@/hooks/useModalZoomLock";
import { useQuoteTotals, formatPrice } from "@/hooks/useProducts";
import type { Product } from "@/types";

type MobilePanel = "equipment" | "quote";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isMobile;
}

function PanelsContent({
  product,
  selectedHotspotLabel,
  modalZoom,
  isMobile,
  onClose,
}: {
  product: Product;
  selectedHotspotLabel?: string;
  modalZoom: number;
  isMobile: boolean;
  onClose: () => void;
}) {
  const addToQuote = useAppStore((s) => s.addToQuote);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("equipment");
  const { total, itemCount } = useQuoteTotals();

  const zoomStyle = {
    "--modal-zoom": isMobile ? 1 : modalZoom,
  } as CSSProperties;

  return (
    <>
      <div className="shrink-0 border-b border-gray-200 bg-white lg:hidden">
        <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1e88e5]">
              Punto: {selectedHotspotLabel ?? "Cabina"}
            </p>
            <p className="truncate text-base font-bold leading-tight text-[#1a3a5c]">
              {product.name}
            </p>
            <p className="mt-1 text-sm text-gray-600">
              {formatPrice(product.price)}
              {itemCount > 0 && (
                <span className="font-semibold text-[#1e88e5]">
                  {" "}
                  · {itemCount} en cotización · {formatPrice(total)}
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-gray-400 hover:bg-gray-100"
            aria-label="Cerrar paneles"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 px-4 pb-3">
          <button
            type="button"
            onClick={() => setMobilePanel("equipment")}
            className={`rounded-xl px-3 py-2.5 text-xs font-bold uppercase tracking-wide transition ${
              mobilePanel === "equipment"
                ? "bg-[#1e88e5] text-white shadow-sm"
                : "bg-gray-50 text-[#1a3a5c] ring-1 ring-gray-200"
            }`}
          >
            Equipo
          </button>
          <button
            type="button"
            onClick={() => setMobilePanel("quote")}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold uppercase tracking-wide transition ${
              mobilePanel === "quote"
                ? "bg-[#1e88e5] text-white shadow-sm"
                : "bg-gray-50 text-[#1a3a5c] ring-1 ring-gray-200"
            }`}
          >
            Cotización
            {itemCount > 0 && (
              <span
                className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                  mobilePanel === "quote"
                    ? "bg-white text-[#1e88e5]"
                    : "bg-[#1e88e5] text-white"
                }`}
              >
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div
        className="modal-zoom-lock flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 lg:flex-row lg:gap-4 lg:p-0"
        style={zoomStyle}
      >
        <div
          className={`min-h-0 flex-col gap-3 overflow-hidden lg:flex lg:flex-1 lg:w-[48%] ${
            mobilePanel === "equipment" ? "flex flex-1" : "hidden"
          }`}
        >
          <div className="min-h-0 flex-1 overflow-hidden max-lg:[&>div>div:first-child]:hidden">
            <EquipmentCard
              product={product}
              hotspotLabel={selectedHotspotLabel ?? "Cabina"}
              onAddToQuote={() => {
                addToQuote(product.id);
                setMobilePanel("quote");
              }}
              onClose={onClose}
            />
          </div>
          <div className="hidden shrink-0 lg:block [&_.aspect-video]:max-h-[6.5rem]">
            <VideoPlayer
              key={product.video || product.id}
              src={product.video || "/assets/videos/video.mp4"}
              title="¿CÓMO FUNCIONA DIRECTRACK GPS PRO?"
            />
          </div>
        </div>

        <div
          className={`min-h-0 flex-col overflow-hidden lg:flex lg:flex-1 lg:w-[52%] ${
            mobilePanel === "quote" ? "flex flex-1" : "hidden"
          }`}
        >
          <QuotePanel />
        </div>
      </div>
    </>
  );
}

export default function PanelsOverlay() {
  const panelsOpen = useAppStore((s) => s.panelsOpen);
  const selectedProduct = useAppStore((s) => s.selectedProduct);
  const selectedHotspot = useAppStore((s) => s.selectedHotspot);
  const setPanelsOpen = useAppStore((s) => s.setPanelsOpen);
  const syncQuoteWithProductCatalog = useAppStore((s) => s.syncQuoteWithProductCatalog);
  const { products } = useCMSProducts();
  const modalZoom = useModalZoomLock();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!products.length) return;
    syncQuoteWithProductCatalog(products.map((p) => p.id));
  }, [products, syncQuoteWithProductCatalog]);

  const product = selectedProduct ?? products[0] ?? null;

  useEffect(() => {
    if (!panelsOpen || !isMobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [panelsOpen, isMobile]);

  const sheetMotion = isMobile
    ? {
        initial: { opacity: 0, y: "100%" },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: "100%" },
      }
    : {
        initial: { opacity: 0, x: 48 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: 48 },
      };

  return (
    <AnimatePresence>
      {panelsOpen && product && (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
            onClick={() => setPanelsOpen(false)}
            aria-label="Cerrar paneles"
          />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-x-0 bottom-0 top-[4.5rem] z-40 flex flex-col justify-end overflow-hidden lg:inset-x-auto lg:bottom-16 lg:left-auto lg:right-6 lg:top-[10.5rem] lg:items-start lg:justify-end"
            aria-hidden={!panelsOpen}
          >
            <motion.div
              {...sheetMotion}
              transition={{ type: "spring", stiffness: 280, damping: 30 }}
              className="pointer-events-auto flex h-full min-h-0 w-full flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-[#f5f7fa] shadow-2xl lg:h-full lg:max-w-[920px] lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none"
            >
              <PanelsContent
                key={product.id}
                product={product}
                selectedHotspotLabel={selectedHotspot?.label}
                modalZoom={modalZoom}
                isMobile={isMobile}
                onClose={() => setPanelsOpen(false)}
              />
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

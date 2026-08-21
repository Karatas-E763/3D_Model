"use client";

import { useRef, useState, useCallback } from "react";
import {
  FaPlay,
  FaPause,
  FaVolumeUp,
  FaVolumeMute,
  FaExpand,
} from "react-icons/fa";

interface VideoPlayerProps {
  src: string;
  title?: string;
}

export default function VideoPlayer({
  src,
  title = "¿Cómo funciona DirectTrack GPS PRO?",
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  }, []);

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setProgress((video.currentTime / video.duration) * 100);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const value = Number(e.target.value);
    video.currentTime = (value / 100) * video.duration;
    setProgress(value);
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen();
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-900">
      <p className="bg-[#1a3a5c] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">
        {title}
      </p>
      <div className="relative aspect-video w-full">
        <video
          ref={videoRef}
          src={src}
          className="h-full w-full object-cover"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() =>
            setDuration(videoRef.current?.duration ?? 0)
          }
          onEnded={() => setPlaying(false)}
          playsInline
          preload="none"
          aria-label={title}
        />
        {!playing && (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 transition hover:bg-black/40"
            aria-label="Reproducir video"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1e88e5] text-white shadow-lg">
              <FaPlay className="ml-1" />
            </span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 bg-gray-900 px-3 py-2">
        <button
          type="button"
          onClick={togglePlay}
          className="text-white hover:text-[#1e88e5]"
          aria-label={playing ? "Pausar" : "Reproducir"}
        >
          {playing ? <FaPause /> : <FaPlay />}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={progress}
          onChange={handleSeek}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-gray-600 accent-[#1e88e5]"
          aria-label="Progreso del video"
        />
        <span className="min-w-[40px] text-xs text-gray-400">
          {formatTime((progress / 100) * duration)}
        </span>
        <button
          type="button"
          onClick={toggleMute}
          className="text-white hover:text-[#1e88e5]"
          aria-label={muted ? "Activar sonido" : "Silenciar"}
        >
          {muted ? <FaVolumeMute /> : <FaVolumeUp />}
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="text-white hover:text-[#1e88e5]"
          aria-label="Pantalla completa"
        >
          <FaExpand />
        </button>
      </div>
    </div>
  );
}

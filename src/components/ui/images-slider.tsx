
"use client";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import React, { useEffect, useState, useRef } from "react";

export const ImagesSlider = ({
  images,
  children,
  overlay = true,
  overlayClassName,
  className,
  autoplay = true,
  direction = "up",
  slideDuration = 7000,
}: {
  images: string[];
  children: React.ReactNode;
  overlay?: React.ReactNode;
  overlayClassName?: string;
  className?: string;
  autoplay?: boolean;
  direction?: "up" | "down";
  slideDuration?: number;
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadedImages, setLoadedImages] = useState<string[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const autoplayTimerRef = useRef<number | null>(null);
  
  // Preload all images on component mount
  useEffect(() => {
    const preloadImages = async () => {
      setLoading(true);
      
      if (!images || images.length === 0) {
        setLoading(false);
        return;
      }
      
      // Create an array of promises for loading each image
      const loadPromises = images.map((image) => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.src = image;
          img.onload = () => resolve(image);
          img.onerror = (e) => reject(e);
        });
      });
      
      try {
        const loaded = await Promise.all(loadPromises);
        setLoadedImages(loaded as string[]);
        setLoading(false);
      } catch (error) {
        console.error("Error loading images:", error);
        setLoading(false);
      }
    };
    
    preloadImages();
    
    // Clean up any timers when unmounting
    return () => {
      if (autoplayTimerRef.current) {
        clearTimeout(autoplayTimerRef.current);
      }
    };
  }, [images]);
  
  // Handle next slide with debouncing to prevent rapid transitions
  const handleNext = () => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    const nextIndex = (currentIndex + 1) % images.length;
    setCurrentIndex(nextIndex);
    
    // Reset transition state after animation completes
    setTimeout(() => {
      setIsTransitioning(false);
    }, 700); // Slightly longer than animation duration
  };
  
  // Handle previous slide with debouncing
  const handlePrevious = () => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    const prevIndex = (currentIndex - 1 + images.length) % images.length;
    setCurrentIndex(prevIndex);
    
    // Reset transition state after animation completes
    setTimeout(() => {
      setIsTransitioning(false);
    }, 700); // Slightly longer than animation duration
  };
  
  // Set up autoplay with cleanup
  useEffect(() => {
    if (autoplay && !loading && !isTransitioning) {
      autoplayTimerRef.current = window.setTimeout(() => {
        handleNext();
      }, slideDuration);
    }
    
    return () => {
      if (autoplayTimerRef.current) {
        clearTimeout(autoplayTimerRef.current);
      }
    };
  }, [autoplay, slideDuration, currentIndex, loading, isTransitioning]);
  
  // Add keyboard controls
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        handleNext();
      } else if (event.key === "ArrowLeft") {
        handlePrevious();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentIndex, isTransitioning]);
  
  // Improved animation variants with smoother transitions
  const slideVariants = {
    enter: {
      opacity: 0,
      scale: 1.05,
      y: direction === "up" ? "2%" : "-2%",
    },
    center: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        opacity: { duration: 0.7, ease: "easeInOut" },
        scale: { duration: 0.7, ease: [0.645, 0.045, 0.355, 1.0] },
        y: { duration: 0.7, ease: [0.645, 0.045, 0.355, 1.0] },
      },
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      y: direction === "up" ? "-2%" : "2%",
      transition: {
        opacity: { duration: 0.5, ease: "easeInOut" },
        scale: { duration: 0.5, ease: [0.645, 0.045, 0.355, 1.0] },
        y: { duration: 0.5, ease: [0.645, 0.045, 0.355, 1.0] },
      },
    },
  };
  
  return (
    <div
      className={cn(
        "overflow-hidden h-full w-full relative flex items-center justify-center bg-black",
        className
      )}
    >
      {children}
      
      {overlay && (
        <div
          className={cn("absolute inset-0 bg-black/60 z-40", overlayClassName)}
        />
      )}
      
      {!loading && loadedImages.length > 0 && (
        <AnimatePresence initial={false} mode="sync">
          <motion.div
            key={currentIndex}
            className="absolute inset-0 w-full h-full"
            initial="enter"
            animate="center"
            exit="exit"
            variants={slideVariants}
          >
            <img
              src={loadedImages[currentIndex]}
              className="h-full w-full object-cover object-center"
              alt={`Slide ${currentIndex + 1}`}
              style={{ position: 'absolute', inset: 0 }}
            />
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};

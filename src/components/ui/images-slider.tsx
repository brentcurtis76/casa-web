
"use client";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import React, { useEffect, useState } from "react";

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
  const [loading, setLoading] = useState(false);
  const [loadedImages, setLoadedImages] = useState<string[]>([]);
  const [nextIndex, setNextIndex] = useState<number | null>(null);

  const handleNext = () => {
    const next = currentIndex + 1 === images.length ? 0 : currentIndex + 1;
    setNextIndex(next);
    // We'll update currentIndex after the animation completes
  };

  const handlePrevious = () => {
    const prev = currentIndex - 1 < 0 ? images.length - 1 : currentIndex - 1;
    setNextIndex(prev);
    // We'll update currentIndex after the animation completes
  };

  useEffect(() => {
    if (nextIndex !== null) {
      // Wait a short time to ensure both images are displayed before transitioning
      const timer = setTimeout(() => {
        setCurrentIndex(nextIndex);
        setNextIndex(null);
      }, 500); // Half a second delay for smoother transition
      return () => clearTimeout(timer);
    }
  }, [nextIndex]);

  useEffect(() => {
    loadImages();
  }, [images]);

  const loadImages = () => {
    if (images.length === 0) return;
    
    setLoading(true);
    console.log("Attempting to load images:", images);
    
    if (!images || images.length === 0) {
      setLoading(false);
      return;
    }
    
    const loadPromises = images.map((image) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = image;
        img.onload = () => {
          console.log("Image loaded successfully:", image);
          resolve(image);
        };
        img.onerror = (e) => {
          console.error("Failed to load image:", image, e);
          reject(e);
        };
      });
    });

    Promise.all(loadPromises)
      .then((loadedImages) => {
        console.log("All images loaded successfully:", loadedImages);
        setLoadedImages(loadedImages as string[]);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error loading images:", error);
        setLoading(false);
      });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        handleNext();
      } else if (event.key === "ArrowLeft") {
        handlePrevious();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    let interval: any;
    if (autoplay) {
      interval = setInterval(() => {
        handleNext();
      }, slideDuration);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearInterval(interval);
    };
  }, [slideDuration, currentIndex]); // Added currentIndex to dependencies

  const slideVariants = {
    initial: {
      scale: 1, // Start at full scale
      opacity: 0,
      rotateX: 45,
    },
    visible: {
      scale: 1,
      rotateX: 0,
      opacity: 1,
      transition: {
        duration: 1,
        ease: [0.645, 0.045, 0.355, 1.0],
      },
    },
    upExit: {
      opacity: 0, // Fade out instead of moving away
      y: "-10%", // Reduced movement
      transition: {
        duration: 0.5, // Faster exit
      },
    },
    downExit: {
      opacity: 0, // Fade out instead of moving away
      y: "10%", // Reduced movement
      transition: {
        duration: 0.5, // Faster exit
      },
    },
  };

  const areImagesLoaded = loadedImages.length > 0 || (!loading && images.length > 0);

  return (
    <div
      className={cn(
        "overflow-hidden h-full w-full relative flex items-center justify-center bg-black", // Added bg-black to prevent gray background
        className
      )}
      style={{
        perspective: "1000px",
      }}
    >
      {children}
      
      {overlay && (
        <div
          className={cn("absolute inset-0 bg-black/60 z-40", overlayClassName)}
        />
      )}

      {areImagesLoaded && (
        <AnimatePresence mode="sync"> {/* Use sync mode to ensure smooth transitions */}
          <motion.img
            key={currentIndex}
            src={loadedImages[currentIndex] || images[currentIndex]}
            initial="initial"
            animate="visible"
            exit={direction === "up" ? "upExit" : "downExit"}
            variants={slideVariants}
            className="image h-full w-full absolute inset-0 object-cover object-center"
          />
          {nextIndex !== null && (
            <motion.img
              key={`next-${nextIndex}`}
              src={loadedImages[nextIndex] || images[nextIndex]}
              initial="initial"
              animate="visible"
              variants={slideVariants}
              className="image h-full w-full absolute inset-0 object-cover object-center z-30"
            />
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

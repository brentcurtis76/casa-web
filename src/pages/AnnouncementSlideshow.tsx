import { useEffect, useState } from 'react';

// Brand colors from CASA Brand Kit
const COLORS = {
  primaryBlack: '#1A1A1A',
  amberAccent: '#D4A853',
  amberLight: '#E8C97A',
  offWhite: '#FAF8F5',
  warmCream: '#FAF8F5',
  mediumGray: '#8A8A8A',
  charcoal: '#333333',
};

interface SlideImage {
  url: string;
  name: string;
  quote: string; // Inspirational text for this image
}

interface Announcement {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  highlight: string; // Big highlight text (e.g., "600 cenas")
  details: string[]; // Bullet points
  date: string;
  time: string;
  location: string;
  callToAction: string;
  images: SlideImage[];
}

// Pre-configured announcements with signed URLs
// NOTE: These URLs expire after 7 days. To refresh, generate new signed URLs from Supabase dashboard.
const announcements: Announcement[] = [
  {
    id: 'cenas-navidad',
    title: 'Cenas de Navidad',
    subtitle: '600 cenas para quienes más lo necesitan',
    description: 'Un tiempo especial para compartir en comunidad durante esta temporada navideña.',
    highlight: '600 cenas',
    details: [
      'Donando',
      'Cocinando',
      'Repartiendo',
    ],
    date: '23 y 24 de Diciembre',
    time: '',
    location: 'Colegio Puelmapu - Peñalolén',
    callToAction: 'Súmate y transforma una noche',
    images: [
      {
        url: 'https://mulsqxfhxxdsadxsljss.supabase.co/storage/v1/object/sign/Media/Cenas%20de%20Navidad/WhatsApp%20Image%202025-12-06%20at%2017.28.32.jpeg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84N2ZkZDdiMi1lYjczLTRhZWItOGNmZS0yOTZjODQ3M2ExYzAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJNZWRpYS9DZW5hcyBkZSBOYXZpZGFkL1doYXRzQXBwIEltYWdlIDIwMjUtMTItMDYgYXQgMTcuMjguMzIuanBlZyIsImlhdCI6MTc2NTYzNzE5MywiZXhwIjoxNzY2MjQxOTkzfQ.dhhL5TbDyqsWugHpPxrdHChqK0BKp_ZV_ckh4d8Bm1w',
        name: 'Cena 1',
        quote: 'Compartir es multiplicar la alegría',
      },
      {
        url: 'https://mulsqxfhxxdsadxsljss.supabase.co/storage/v1/object/sign/Media/Cenas%20de%20Navidad/WhatsApp%20Image%202025-12-06%20at%2017.29.27%20(1).jpeg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84N2ZkZDdiMi1lYjczLTRhZWItOGNmZS0yOTZjODQ3M2ExYzAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJNZWRpYS9DZW5hcyBkZSBOYXZpZGFkL1doYXRzQXBwIEltYWdlIDIwMjUtMTItMDYgYXQgMTcuMjkuMjcgKDEpLmpwZWciLCJpYXQiOjE3NjU2MzcxOTgsImV4cCI6MTc2NjI0MTk5OH0.AtBR3awZYciABKEixLRVULJ2PVrCI1qDbevsDgt6QaU',
        name: 'Cena 2',
        quote: 'Juntos hacemos la diferencia',
      },
      {
        url: 'https://mulsqxfhxxdsadxsljss.supabase.co/storage/v1/object/sign/Media/Cenas%20de%20Navidad/WhatsApp%20Image%202025-12-06%20at%2017.29.28.jpeg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84N2ZkZDdiMi1lYjczLTRhZWItOGNmZS0yOTZjODQ3M2ExYzAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJNZWRpYS9DZW5hcyBkZSBOYXZpZGFkL1doYXRzQXBwIEltYWdlIDIwMjUtMTItMDYgYXQgMTcuMjkuMjguanBlZyIsImlhdCI6MTc2NTYzNzIwOSwiZXhwIjoxNzY2MjQyMDA5fQ.XPDvLCR32GyqFqCrHTUrXxZRIy_0Zy-rSMbgZ8OE0E4',
        name: 'Cena 3',
        quote: 'El amor se sirve en cada plato',
      },
      {
        url: 'https://mulsqxfhxxdsadxsljss.supabase.co/storage/v1/object/sign/Media/Cenas%20de%20Navidad/WhatsApp%20Image%202025-12-06%20at%2017.35.28.jpeg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84N2ZkZDdiMi1lYjczLTRhZWItOGNmZS0yOTZjODQ3M2ExYzAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJNZWRpYS9DZW5hcyBkZSBOYXZpZGFkL1doYXRzQXBwIEltYWdlIDIwMjUtMTItMDYgYXQgMTcuMzUuMjguanBlZyIsImlhdCI6MTc2NTYzNzIxNSwiZXhwIjoxNzY2MjQyMDE1fQ.IU3c3cdp8-zm9GnZCXTsq5opx8rr-3zcOT1Z-uy1Wpg',
        name: 'Cena 4',
        quote: 'Una cena, una esperanza',
      },
    ],
  },
  {
    id: 'noche-velas',
    title: 'Noche de Velas',
    subtitle: 'Nuestra celebración navideña comunitaria',
    description: 'Culminamos nuestro Adviento celebrando la llegada de Emanuel - Dios Con Nosotros.',
    highlight: 'Emanuel',
    details: [],
    date: 'Domingo 21 de Diciembre',
    time: '19:30 hrs',
    location: 'CASA',
    callToAction: 'Dios Con Nosotros',
    images: [
      {
        url: 'https://mulsqxfhxxdsadxsljss.supabase.co/storage/v1/object/sign/Media/Noche%20de%20Velas/Jackie%20&%20Ceci.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84N2ZkZDdiMi1lYjczLTRhZWItOGNmZS0yOTZjODQ3M2ExYzAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJNZWRpYS9Ob2NoZSBkZSBWZWxhcy9KYWNraWUgJiBDZWNpLmpwZyIsImlhdCI6MTc2NTYzNzIyOCwiZXhwIjoxNzY2MjQyMDI4fQ.8EHBVIL4Fbha2uWXhiVpZvrjLdaobh4zikXd-LCqauY',
        name: 'Jackie & Ceci',
        quote: 'La luz brilla en la oscuridad',
      },
      {
        url: 'https://mulsqxfhxxdsadxsljss.supabase.co/storage/v1/object/sign/Media/Noche%20de%20Velas/Leo.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84N2ZkZDdiMi1lYjczLTRhZWItOGNmZS0yOTZjODQ3M2ExYzAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJNZWRpYS9Ob2NoZSBkZSBWZWxhcy9MZW8uanBnIiwiaWF0IjoxNzY1NjM3MjM0LCJleHAiOjE3NjYyNDIwMzR9.LvYRXXCvxKxAHjZRY0q_ucavykjrhE8vcT5_NF0OlAU',
        name: 'Leo',
        quote: 'Somos luz para el mundo',
      },
      {
        url: 'https://mulsqxfhxxdsadxsljss.supabase.co/storage/v1/object/sign/Media/Noche%20de%20Velas/Marcela.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84N2ZkZDdiMi1lYjczLTRhZWItOGNmZS0yOTZjODQ3M2ExYzAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJNZWRpYS9Ob2NoZSBkZSBWZWxhcy9NYXJjZWxhLmpwZyIsImlhdCI6MTc2NTYzNzI0MCwiZXhwIjoxNzY2MjQyMDQwfQ.H478V6p5hETfeiLBTYEXHQdc8N0zJ9DA02ppGCh9wyY',
        name: 'Marcela',
        quote: 'En comunidad, celebramos',
      },
      {
        url: 'https://mulsqxfhxxdsadxsljss.supabase.co/storage/v1/object/sign/Media/Noche%20de%20Velas/Rafa%20y%20Renato%202.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84N2ZkZDdiMi1lYjczLTRhZWItOGNmZS0yOTZjODQ3M2ExYzAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJNZWRpYS9Ob2NoZSBkZSBWZWxhcy9SYWZhIHkgUmVuYXRvIDIuanBnIiwiaWF0IjoxNzY1NjM3MjQ1LCJleHAiOjE3NjYyNDIwNDV9.HSl6Gp-EkbqLdQOehxZwLloqwHqmh34UfdznITXtuuM',
        name: 'Rafa y Renato',
        quote: 'Esperanza que nos une',
      },
    ],
  },
];

// Duration settings (in milliseconds)
const TITLE_SLIDE_DURATION = 10000; // 10 seconds for title slides (more content now)
const PHOTO_SLIDE_DURATION = 7000; // 7 seconds per photo (time for animated text)
const TRANSITION_DURATION = 1500; // 1.5 seconds fade transition

export default function AnnouncementSlideshow() {
  const [currentAnnouncementIndex, setCurrentAnnouncementIndex] = useState(0);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0); // 0 = title, 1+ = photos
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Preload images on mount
  useEffect(() => {
    const preloadImages = async () => {
      const imagePromises = announcements.flatMap(announcement =>
        announcement.images.map(img => {
          return new Promise<void>((resolve) => {
            const image = new Image();
            image.onload = () => resolve();
            image.onerror = () => resolve();
            image.src = img.url;
          });
        })
      );

      await Promise.all(imagePromises);
      setIsLoading(false);
    };

    preloadImages();
  }, []);

  // Calculate total slides for current announcement
  const getCurrentTotalSlides = () => {
    const currentAnnouncement = announcements[currentAnnouncementIndex];
    return 1 + (currentAnnouncement?.images?.length || 0);
  };

  // Auto-advance slides
  useEffect(() => {
    if (isLoading) return;

    const totalSlides = getCurrentTotalSlides();
    const isLastSlide = currentSlideIndex >= totalSlides - 1;
    const isLastAnnouncement = currentAnnouncementIndex >= announcements.length - 1;

    const duration = currentSlideIndex === 0 ? TITLE_SLIDE_DURATION : PHOTO_SLIDE_DURATION;

    const timer = setTimeout(() => {
      setIsTransitioning(true);

      setTimeout(() => {
        if (isLastSlide) {
          if (isLastAnnouncement) {
            setCurrentAnnouncementIndex(0);
          } else {
            setCurrentAnnouncementIndex(prev => prev + 1);
          }
          setCurrentSlideIndex(0);
        } else {
          setCurrentSlideIndex(prev => prev + 1);
        }
        setIsTransitioning(false);
      }, TRANSITION_DURATION);
    }, duration);

    return () => clearTimeout(timer);
  }, [currentSlideIndex, currentAnnouncementIndex, isLoading]);

  if (isLoading) {
    return (
      <div
        className="w-screen h-screen flex items-center justify-center"
        style={{ backgroundColor: COLORS.primaryBlack }}
      >
        <div className="text-center">
          <div
            className="w-16 h-16 border-4 rounded-full animate-spin mx-auto mb-4"
            style={{
              borderColor: COLORS.amberAccent,
              borderTopColor: 'transparent',
            }}
          />
          <p
            className="font-['Montserrat'] text-lg"
            style={{ color: COLORS.offWhite }}
          >
            Cargando anuncios...
          </p>
        </div>
      </div>
    );
  }

  const currentAnnouncement = announcements[currentAnnouncementIndex];
  const isShowingTitle = currentSlideIndex === 0;
  const currentPhoto = !isShowingTitle && currentAnnouncement?.images?.[currentSlideIndex - 1];
  const isCenasNavidad = currentAnnouncement?.id === 'cenas-navidad';

  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{
        aspectRatio: '4/3',
        maxHeight: '100vh',
        maxWidth: 'calc(100vh * 4 / 3)',
        margin: '0 auto',
        backgroundColor: COLORS.primaryBlack,
      }}
    >
      {/* Title Slide */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center p-12 transition-opacity"
        style={{
          opacity: isShowingTitle && !isTransitioning ? 1 : 0,
          transitionDuration: `${TRANSITION_DURATION}ms`,
          backgroundColor: COLORS.offWhite,
        }}
      >
        {/* Decorative top element */}
        <div
          className={`flex items-center gap-3 mb-6 ${isShowingTitle && !isTransitioning ? 'title-animate' : ''}`}
          style={{ '--delay': '0s' } as React.CSSProperties}
        >
          <div className="w-12 h-[2px] line-expand-left" style={{ backgroundColor: COLORS.mediumGray }} />
          <div className="w-3 h-3 rounded-full dot-pulse" style={{ backgroundColor: COLORS.amberAccent }} />
          <div className="w-12 h-[2px] line-expand-right" style={{ backgroundColor: COLORS.mediumGray }} />
        </div>

        {/* Main title */}
        <h1
          className={`font-['Merriweather'] font-light text-center mb-4 ${isShowingTitle && !isTransitioning ? 'title-animate' : ''}`}
          style={{
            color: COLORS.primaryBlack,
            fontSize: 'clamp(2.5rem, 7vw, 4.5rem)',
            letterSpacing: '0.02em',
            lineHeight: 1.1,
            '--delay': '0.2s',
          } as React.CSSProperties}
        >
          {currentAnnouncement?.title}
        </h1>

        {/* Subtitle / Highlight */}
        <p
          className={`font-['Montserrat'] text-center mb-6 tracking-wider ${isShowingTitle && !isTransitioning ? 'title-animate' : ''}`}
          style={{
            color: COLORS.amberAccent,
            fontSize: 'clamp(1.1rem, 2.5vw, 1.6rem)',
            fontWeight: 600,
            '--delay': '0.4s',
          } as React.CSSProperties}
        >
          {currentAnnouncement?.subtitle}
        </p>

        {/* Description */}
        <p
          className={`font-['Merriweather'] italic text-center max-w-2xl mb-8 ${isShowingTitle && !isTransitioning ? 'title-animate' : ''}`}
          style={{
            color: COLORS.charcoal,
            fontSize: 'clamp(0.95rem, 1.8vw, 1.15rem)',
            lineHeight: 1.7,
            '--delay': '0.6s',
          } as React.CSSProperties}
        >
          {currentAnnouncement?.description}
        </p>

        {/* Cenas de Navidad specific: How to help */}
        {isCenasNavidad && currentAnnouncement?.details.length > 0 && (
          <div
            className={`mb-8 text-center ${isShowingTitle && !isTransitioning ? 'title-animate' : ''}`}
            style={{ '--delay': '0.8s' } as React.CSSProperties}
          >
            <p
              className="font-['Montserrat'] font-semibold mb-4"
              style={{ color: COLORS.primaryBlack, fontSize: '1.1rem' }}
            >
              ¿Cómo ayudar?
            </p>
            <div className="flex items-center justify-center gap-6">
              {currentAnnouncement.details.map((detail, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 ${isShowingTitle && !isTransitioning ? 'detail-item-animate' : ''}`}
                  style={{ '--detail-delay': `${0.9 + idx * 0.15}s` } as React.CSSProperties}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: COLORS.amberAccent }}
                  />
                  <span
                    className="font-['Montserrat']"
                    style={{ color: COLORS.charcoal, fontSize: '1rem' }}
                  >
                    {detail}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Event details card */}
        <div
          className={`flex items-center gap-6 p-5 rounded-xl mb-6 ${isShowingTitle && !isTransitioning ? 'card-animate' : ''}`}
          style={{
            backgroundColor: 'rgba(212, 168, 83, 0.12)',
            border: `1px solid ${COLORS.amberLight}`,
            '--delay': isCenasNavidad ? '1.4s' : '0.8s',
          } as React.CSSProperties}
        >
          <div className="text-center px-4">
            <p
              className="font-['Montserrat'] font-bold mb-1"
              style={{ color: COLORS.primaryBlack, fontSize: '1.15rem' }}
            >
              {currentAnnouncement?.date}
            </p>
            <p
              className="font-['Montserrat'] text-xs uppercase tracking-wider"
              style={{ color: COLORS.mediumGray }}
            >
              Fecha
            </p>
          </div>
          {currentAnnouncement?.time && (
            <>
              <div className="w-[1px] h-10" style={{ backgroundColor: COLORS.amberLight }} />
              <div className="text-center px-4">
                <p
                  className="font-['Montserrat'] font-bold mb-1"
                  style={{ color: COLORS.primaryBlack, fontSize: '1.15rem' }}
                >
                  {currentAnnouncement?.time}
                </p>
                <p
                  className="font-['Montserrat'] text-xs uppercase tracking-wider"
                  style={{ color: COLORS.mediumGray }}
                >
                  Hora
                </p>
              </div>
            </>
          )}
          <div className="w-[1px] h-10" style={{ backgroundColor: COLORS.amberLight }} />
          <div className="text-center px-4">
            <p
              className="font-['Montserrat'] font-bold mb-1"
              style={{ color: COLORS.primaryBlack, fontSize: '1.15rem' }}
            >
              {currentAnnouncement?.location}
            </p>
            <p
              className="font-['Montserrat'] text-xs uppercase tracking-wider"
              style={{ color: COLORS.mediumGray }}
            >
              Lugar
            </p>
          </div>
        </div>

        {/* Call to action */}
        <p
          className={`font-['Merriweather'] text-center mt-2 ${isShowingTitle && !isTransitioning ? 'cta-animate' : ''}`}
          style={{
            color: COLORS.amberAccent,
            fontSize: 'clamp(1rem, 2vw, 1.3rem)',
            fontWeight: 400,
            fontStyle: 'italic',
            '--delay': isCenasNavidad ? '1.7s' : '1.1s',
          } as React.CSSProperties}
        >
          {currentAnnouncement?.callToAction}
        </p>

        {/* Decorative bottom element */}
        <div
          className={`flex items-center gap-3 mt-8 ${isShowingTitle && !isTransitioning ? 'title-animate' : ''}`}
          style={{ '--delay': isCenasNavidad ? '2s' : '1.4s' } as React.CSSProperties}
        >
          <div className="w-8 h-[2px] line-expand-left" style={{ backgroundColor: COLORS.mediumGray }} />
          <div className="w-2 h-2 rounded-full dot-pulse" style={{ backgroundColor: COLORS.amberAccent }} />
          <div className="w-8 h-[2px] line-expand-right" style={{ backgroundColor: COLORS.mediumGray }} />
        </div>
      </div>

      {/* Photo Slide with Ken Burns Effect and Animated Text */}
      {currentPhoto && (
        <div
          className="absolute inset-0 transition-opacity"
          style={{
            opacity: !isShowingTitle && !isTransitioning ? 1 : 0,
            transitionDuration: `${TRANSITION_DURATION}ms`,
          }}
        >
          {/* Photo with Ken Burns effect */}
          <div className="absolute inset-0 overflow-hidden">
            <img
              key={currentPhoto.url}
              src={currentPhoto.url}
              alt={currentPhoto.name}
              className="w-full h-full object-cover kenburns-animation"
            />
          </div>

          {/* Gradient overlay for text legibility */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.15) 100%)',
            }}
          />

          {/* Animated inspirational quote - centered */}
          <div className="absolute inset-0 flex items-center justify-center p-16">
            <p
              key={`quote-${currentSlideIndex}`}
              className="font-['Merriweather'] text-center quote-animation"
              style={{
                color: COLORS.offWhite,
                fontSize: 'clamp(1.8rem, 5vw, 3rem)',
                fontWeight: 300,
                fontStyle: 'italic',
                textShadow: '0 2px 20px rgba(0,0,0,0.5)',
                maxWidth: '80%',
                lineHeight: 1.4,
              }}
            >
              "{currentPhoto.quote}"
            </p>
          </div>

          {/* Section label at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-[2px]" style={{ backgroundColor: COLORS.amberAccent }} />
              <span
                className="font-['Montserrat'] text-sm uppercase tracking-[0.2em]"
                style={{ color: COLORS.amberAccent }}
              >
                {currentAnnouncement?.title}
              </span>
            </div>

            {/* Photo counter */}
            <p
              className="font-['Montserrat'] text-sm"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              {currentSlideIndex} de {currentAnnouncement?.images?.length || 0}
            </p>
          </div>
        </div>
      )}

      {/* Progress indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
        {announcements.map((_, idx) => (
          <div
            key={idx}
            className="w-3 h-3 rounded-full transition-all duration-300"
            style={{
              backgroundColor: idx === currentAnnouncementIndex
                ? COLORS.amberAccent
                : 'rgba(255,255,255,0.3)',
              transform: idx === currentAnnouncementIndex ? 'scale(1.3)' : 'scale(1)',
            }}
          />
        ))}
      </div>

      {/* Animation styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;1,300;1,400&family=Montserrat:wght@400;500;600;700&display=swap');

        /* Ken Burns effect for photos */
        .kenburns-animation {
          animation: kenBurns ${PHOTO_SLIDE_DURATION + TRANSITION_DURATION}ms ease-in-out forwards;
        }

        @keyframes kenBurns {
          0% {
            transform: scale(1) translate(0%, 0%);
          }
          100% {
            transform: scale(1.1) translate(-1.5%, -1%);
          }
        }

        /* Quote animation for photo slides */
        .quote-animation {
          animation: fadeInUp 1.2s ease-out forwards;
        }

        @keyframes fadeInUp {
          0% {
            opacity: 0;
            transform: translateY(30px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Title slide animations */
        .title-animate {
          opacity: 0;
          transform: translateY(20px);
          animation: elegantFadeIn 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          animation-delay: var(--delay, 0s);
        }

        @keyframes elegantFadeIn {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Detail items staggered animation */
        .detail-item-animate {
          opacity: 0;
          transform: translateX(-10px);
          animation: slideInFromLeft 0.5s ease-out forwards;
          animation-delay: var(--detail-delay, 0s);
        }

        @keyframes slideInFromLeft {
          0% {
            opacity: 0;
            transform: translateX(-10px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        /* Card scale and fade animation */
        .card-animate {
          opacity: 0;
          transform: scale(0.95);
          animation: cardReveal 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          animation-delay: var(--delay, 0s);
        }

        @keyframes cardReveal {
          0% {
            opacity: 0;
            transform: scale(0.95);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* Call to action with subtle glow */
        .cta-animate {
          opacity: 0;
          animation: ctaGlow 1s ease-out forwards;
          animation-delay: var(--delay, 0s);
        }

        @keyframes ctaGlow {
          0% {
            opacity: 0;
            text-shadow: none;
          }
          60% {
            opacity: 1;
            text-shadow: 0 0 20px rgba(212, 168, 83, 0.4);
          }
          100% {
            opacity: 1;
            text-shadow: none;
          }
        }

        /* Decorative line expand animations */
        .line-expand-left {
          transform-origin: right center;
          animation: lineExpandLeft 0.6s ease-out forwards;
          animation-delay: 0.1s;
        }

        .line-expand-right {
          transform-origin: left center;
          animation: lineExpandRight 0.6s ease-out forwards;
          animation-delay: 0.1s;
        }

        @keyframes lineExpandLeft {
          0% {
            transform: scaleX(0);
            opacity: 0;
          }
          100% {
            transform: scaleX(1);
            opacity: 1;
          }
        }

        @keyframes lineExpandRight {
          0% {
            transform: scaleX(0);
            opacity: 0;
          }
          100% {
            transform: scaleX(1);
            opacity: 1;
          }
        }

        /* Dot pulse animation */
        .dot-pulse {
          animation: dotPulse 0.8s ease-out forwards;
        }

        @keyframes dotPulse {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.3);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

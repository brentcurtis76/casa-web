import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, Utensils, Star, ExternalLink, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { MesaAbiertaSignup } from "./MesaAbiertaSignup";
import { AuthModal } from "@/components/auth/AuthModal";
import { useNavigate, Link } from "react-router-dom";

interface NextMonth {
  id: string;
  month_date: string;
  registration_deadline: string;
  dinner_date: string;
  status: string;
}

interface Stats {
  totalParticipants: number;
  hostsNeeded: number;
  spotsAvailable: number;
}

interface FeaturedTestimonial {
  id: string;
  testimonial_text: string;
  rating: number;
  profiles: {
    full_name: string;
  };
  mesa_abierta_months: {
    month_date: string;
  };
}

export function MesaAbiertaSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [nextMonth, setNextMonth] = useState<NextMonth | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [testimonials, setTestimonials] = useState<FeaturedTestimonial[]>([]);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [loading, setLoading] = useState(true);
  const [signupOpen, setSignupOpen] = useState(false);
  const [signupRole, setSignupRole] = useState<'host' | 'guest'>('guest');
  const [hasActiveParticipation, setHasActiveParticipation] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingSignupRole, setPendingSignupRole] = useState<'host' | 'guest' | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);



  const fetchNextMonth = async () => {
    try {
      const { data, error } = await supabase
        .from('mesa_abierta_months')
        .select('*')
        .eq('status', 'open')
        .gte('registration_deadline', new Date().toISOString())
        .order('month_date', { ascending: true })
        .limit(1)
        .single();

      if (error) throw error;

      if (data) {
        setNextMonth(data);
        await fetchStats(data.id);
      }
    } catch (error) {
      console.error('Error fetching next month:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (monthId: string) => {
    try {
      const { data: participants, error } = await supabase
        .from('mesa_abierta_participants')
        .select('role_preference, has_plus_one, host_max_guests')
        .eq('month_id', monthId)
        .eq('status', 'pending');

      if (error) throw error;

      const hosts = participants?.filter(p => p.role_preference === 'host') || [];
      const guests = participants?.filter(p => p.role_preference === 'guest').length || 0;
      const plusOnes = participants?.filter(p => p.has_plus_one).length || 0;

      // Calculate total capacity from actual host_max_guests values
      const totalHostCapacity = hosts.reduce((sum, host) => sum + (host.host_max_guests || 0), 0);

      const totalGuestSlots = guests + plusOnes;
      const hostsNeeded = Math.ceil(totalGuestSlots / 5);
      const spotsAvailable = Math.max(0, totalHostCapacity - totalGuestSlots);

      setStats({
        totalParticipants: participants?.length || 0,
        hostsNeeded: hostsNeeded - hosts.length,
        spotsAvailable
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchTestimonials = async () => {
    try {
      const { data, error } = await supabase
        .from('mesa_abierta_testimonials')
        .select(`
          id,
          testimonial_text,
          rating,
          participant_id,
          month_id
        `)
        .eq('is_approved', true)
        .eq('is_featured', true)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      // For now, use placeholder data for the nested relations
      // This can be enhanced later with separate queries if needed
      const transformedData = data?.map((item: any) => ({
        id: item.id,
        testimonial_text: item.testimonial_text,
        rating: item.rating,
        profiles: { full_name: 'Participante' },
        mesa_abierta_months: { month_date: new Date().toISOString() }
      })) || [];

      setTestimonials(transformedData);
    } catch (error) {
      console.error('Error fetching testimonials:', error);
      // Don't fail silently - just don't show testimonials
      setTestimonials([]);
    }
  };

  const checkActiveParticipation = async () => {
    if (!user) return;

    try {
      const { data: participants, error } = await supabase
        .from('mesa_abierta_participants')
        .select('id, mesa_abierta_months(dinner_date)')
        .eq('user_id', user.id)
        .neq('status', 'cancelled');

      if (error) {
        console.error('Error checking participation:', error);
        return;
      }

      // Filter client-side for future dinner dates
      const now = new Date().toISOString();
      const hasActive = participants?.some(p =>
        p.mesa_abierta_months &&
        (p.mesa_abierta_months as any).dinner_date >= now
      ) || false;

      setHasActiveParticipation(hasActive);
    } catch (error) {
      console.error('Error checking participation:', error);
    }
  };

  const checkAdminStatus = async () => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('mesa_abierta_admin_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      setIsAdmin(!!data && !error);
    } catch (error) {
      setIsAdmin(false);
    }
  };

  // Testimonial carousel auto-rotation
  useEffect(() => {
    if (testimonials.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [testimonials.length]);

  const handleSignUp = (role: 'host' | 'guest') => {
    if (!user) {
      // Store the intended role and open auth modal
      setPendingSignupRole(role);
      setAuthModalOpen(true);
      return;
    }

    setSignupRole(role);
    setSignupOpen(true);
  };

  const handleAuthSuccess = () => {
    // After successful authentication, open the signup modal with the pending role
    setAuthModalOpen(false);
    if (pendingSignupRole && user) {
      setSignupRole(pendingSignupRole);
      setSignupOpen(true);
      setPendingSignupRole(null);
    }
  };

  const handleSignupClose = () => {
    setSignupOpen(false);
    // Refresh stats and participation check after signup
    if (nextMonth) {
      fetchStats(nextMonth.id);
    }
    if (user) {
      checkActiveParticipation();
    }
  };

  // Testimonial carousel auto-rotation
  useEffect(() => {
    if (testimonials.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [testimonials.length]);

  useEffect(() => {
    console.log('MesaAbiertaSection mounted');
    fetchNextMonth();
    fetchTestimonials();
  }, []);

  useEffect(() => {
    if (user) {
      checkActiveParticipation();
      checkAdminStatus();

      // If user just logged in and had a pending signup role, open the signup modal
      if (pendingSignupRole) {
        setAuthModalOpen(false);
        setSignupRole(pendingSignupRole);
        setSignupOpen(true);
        setPendingSignupRole(null);
      }
    } else {
      setIsAdmin(false);
    }
  }, [user]);

  if (loading) {
    return (
      <section id="mesa-abierta" className="section bg-stone-100">
        <div className="container-custom">
          <div className="text-center py-20">
            <div className="animate-pulse">
              <div className="h-12 bg-stone-200 rounded w-1/2 mx-auto mb-4"></div>
              <div className="h-6 bg-stone-200 rounded w-1/3 mx-auto"></div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Olive branch SVG component
  const OliveBranch = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <svg viewBox="0 0 200 300" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.5">
      {/* Main stem */}
      <path d="M100 280 Q90 200, 100 120 Q110 60, 90 20" strokeLinecap="round" />
      {/* Leaves - left side */}
      <ellipse cx="70" cy="60" rx="25" ry="10" transform="rotate(-30 70 60)" />
      <ellipse cx="65" cy="100" rx="25" ry="10" transform="rotate(-40 65 100)" />
      <ellipse cx="70" cy="140" rx="25" ry="10" transform="rotate(-35 70 140)" />
      <ellipse cx="65" cy="180" rx="25" ry="10" transform="rotate(-45 65 180)" />
      <ellipse cx="70" cy="220" rx="25" ry="10" transform="rotate(-30 70 220)" />
      {/* Leaves - right side */}
      <ellipse cx="130" cy="80" rx="25" ry="10" transform="rotate(30 130 80)" />
      <ellipse cx="135" cy="120" rx="25" ry="10" transform="rotate(40 135 120)" />
      <ellipse cx="130" cy="160" rx="25" ry="10" transform="rotate(35 130 160)" />
      <ellipse cx="135" cy="200" rx="25" ry="10" transform="rotate(45 135 200)" />
      {/* Olives */}
      <ellipse cx="55" cy="130" rx="8" ry="10" fill="currentColor" fillOpacity="0.1" />
      <ellipse cx="145" cy="150" rx="8" ry="10" fill="currentColor" fillOpacity="0.1" />
      <ellipse cx="60" cy="200" rx="8" ry="10" fill="currentColor" fillOpacity="0.1" />
    </svg>
  );

  // Plate with utensils SVG component
  const PlaceSetting = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <svg viewBox="0 0 120 80" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1">
      {/* Plate - outer rim */}
      <ellipse cx="60" cy="45" rx="35" ry="28" />
      {/* Plate - inner circle */}
      <ellipse cx="60" cy="45" rx="22" ry="17" />
      {/* Fork - left side */}
      <path d="M15 15 L15 55" strokeLinecap="round" />
      <path d="M12 15 L12 28" strokeLinecap="round" />
      <path d="M15 15 L15 28" strokeLinecap="round" />
      <path d="M18 15 L18 28" strokeLinecap="round" />
      <path d="M12 28 Q15 32, 18 28" />
      {/* Knife - right side */}
      <path d="M105 15 L105 55" strokeLinecap="round" />
      <path d="M105 15 Q110 20, 108 35 L105 35" />
      {/* Spoon - far right */}
      <ellipse cx="115" cy="22" rx="4" ry="8" />
      <path d="M115 30 L115 55" strokeLinecap="round" />
    </svg>
  );

  // Wine glass SVG component
  const WineGlass = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <svg viewBox="0 0 40 80" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1">
      {/* Glass bowl */}
      <path d="M8 5 Q8 30, 20 35 Q32 30, 32 5" />
      <path d="M8 5 L32 5" />
      {/* Stem */}
      <path d="M20 35 L20 65" strokeLinecap="round" />
      {/* Base */}
      <ellipse cx="20" cy="70" rx="12" ry="4" />
      {/* Wine level hint */}
      <path d="M12 18 Q20 22, 28 18" strokeOpacity="0.3" />
    </svg>
  );

  return (
    <section id="mesa-abierta" className="section bg-stone-100 min-h-[200px] relative overflow-hidden">
      {/* Admin Button - only visible to admins */}
      {isAdmin && (
        <div className="absolute top-4 right-4 z-10">
          <Link to="/mesa-abierta/admin">
            <Button variant="outline" size="sm" className="gap-2 bg-white/80">
              <Settings className="w-4 h-4" />
              Panel de Administración
            </Button>
          </Link>
        </div>
      )}

      {/* Decorative Hero Section */}
      <div className="relative py-16 md:py-24">
        {/* Olive branch decorations */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Olive branches - corners only */}
          <OliveBranch className="absolute -top-8 -left-8 w-36 h-52 text-stone-400 opacity-50 -rotate-45" />
          <OliveBranch className="absolute -top-8 -right-8 w-36 h-52 text-stone-400 opacity-50 rotate-45 scale-x-[-1]" />
          <OliveBranch className="absolute -bottom-8 -left-8 w-36 h-52 text-stone-400 opacity-50 rotate-[135deg]" />
          <OliveBranch className="absolute -bottom-8 -right-8 w-36 h-52 text-stone-400 opacity-50 -rotate-[135deg] scale-x-[-1]" />

          {/* Place settings - middle sides, well spaced from corners */}
          <PlaceSetting className="absolute top-[45%] left-[3%] w-28 h-20 text-stone-400 opacity-45 -rotate-12 hidden md:block" />
          <PlaceSetting className="absolute top-[45%] right-[3%] w-28 h-20 text-stone-400 opacity-45 rotate-12 hidden md:block" />

          {/* Wine glasses - upper middle area */}
          <WineGlass className="absolute top-[20%] left-[18%] w-10 h-20 text-stone-400 opacity-45 rotate-6 hidden md:block" />
          <WineGlass className="absolute top-[20%] right-[18%] w-10 h-20 text-stone-400 opacity-45 -rotate-6 hidden md:block" />

          {/* Additional wine glasses - lower area, spread out */}
          <WineGlass className="absolute bottom-[15%] left-[25%] w-8 h-16 text-stone-400 opacity-35 -rotate-8 hidden lg:block" />
          <WineGlass className="absolute bottom-[15%] right-[25%] w-8 h-16 text-stone-400 opacity-35 rotate-8 hidden lg:block" />
        </div>

        {/* Content */}
        <div className="container-custom relative z-10">
          <div className="text-center max-w-4xl mx-auto px-4">
            <h1 className="text-5xl md:text-7xl font-serif font-bold text-stone-900 mb-8 tracking-tight">
              La Mesa Abierta
            </h1>
            <p className="text-lg md:text-xl text-stone-700 mb-6 leading-relaxed">
              Una cena mensual llena de sorpresas donde compartimos comida
              <br className="hidden md:block" />
              y comunidad con personas que aún no conoces.
            </p>
            <p className="text-base md:text-lg text-stone-600 italic">
              No sabrás quién es el anfitrión ni quiénes serán los otros invitados
              <br className="hidden md:block" />
              hasta que llegues. ¡Déjate sorprender!
            </p>
          </div>
        </div>
      </div>

      <div className="container-custom pb-16">

        {/* Next Dinner Info Card */}
        {nextMonth && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="mb-12"
          >
            <Card className="border-stone-200 shadow-lg bg-white/90 backdrop-blur-sm">
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Dinner Date */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 flex items-center justify-center bg-stone-100 rounded-full flex-shrink-0">
                      <Calendar className="w-6 h-6 text-stone-700" />
                    </div>
                    <div>
                      <p className="text-sm text-stone-500 font-medium">Próxima Cena</p>
                      <p className="text-lg font-semibold text-stone-800">
                        {format(new Date(nextMonth.dinner_date + 'T12:00:00'), "EEEE, d 'de' MMMM", { locale: es })}
                      </p>
                    </div>
                  </div>

                  {/* Registration Deadline */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 flex items-center justify-center bg-stone-100 rounded-full flex-shrink-0">
                      <Clock className="w-6 h-6 text-stone-700" />
                    </div>
                    <div>
                      <p className="text-sm text-stone-500 font-medium">Inscripción hasta</p>
                      <p className="text-lg font-semibold text-stone-800">
                        {format(new Date(nextMonth.registration_deadline), "d 'de' MMMM, HH:mm", { locale: es })}
                      </p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 flex items-center justify-center bg-stone-100 rounded-full flex-shrink-0">
                      <Users className="w-6 h-6 text-stone-700" />
                    </div>
                    <div>
                      <p className="text-sm text-stone-500 font-medium">Estado</p>
                      {stats && (
                        <div className="space-y-1">
                          <p className="text-sm text-stone-700">
                            {stats.totalParticipants} inscritos
                          </p>
                          {stats.hostsNeeded > 0 && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              Se necesitan {stats.hostsNeeded} anfitriones más
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* CTA Buttons */}
                <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                  {hasActiveParticipation ? (
                    <Button
                      onClick={() => navigate('/mesa-abierta/dashboard')}
                      size="lg"
                      className="bg-stone-800 hover:bg-stone-900 text-white px-8"
                    >
                      Ver Mi Participación
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleSignUp('guest')}
                      size="lg"
                      className="bg-stone-800 hover:bg-stone-900 text-white px-8"
                    >
                      Inscríbete Aquí
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* No Active Month Message */}
        {!nextMonth && !loading && (
          <div className="text-center py-12">
            <Card className="border-stone-200 bg-white/80">
              <CardContent className="p-8">
                <Utensils className="w-16 h-16 text-stone-400 mx-auto mb-4" />
                <h3 className="text-2xl font-medium text-stone-700 mb-2">
                  Próximamente
                </h3>
                <p className="text-stone-600">
                  La próxima cena aún no ha sido programada.
                  Mantente atento a nuestras comunicaciones.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Featured Testimonials Carousel */}
        {testimonials.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            viewport={{ once: true }}
            className="mt-16"
          >
            <h3 className="text-2xl md:text-3xl font-light text-center text-stone-800 mb-8">
              Lo Que Dicen Nuestros Participantes
            </h3>

            <div className="relative max-w-3xl mx-auto">
              <Card className="border-stone-200 bg-white shadow-md">
                <CardContent className="p-8">
                  <div className="flex justify-center mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-5 h-5 ${i < testimonials[currentTestimonial].rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-gray-300'
                          }`}
                      />
                    ))}
                  </div>

                  <motion.div
                    key={currentTestimonial}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-center"
                  >
                    <p className="text-lg text-stone-700 mb-6 italic">
                      "{testimonials[currentTestimonial].testimonial_text}"
                    </p>
                    <p className="text-sm text-stone-500">
                      — {testimonials[currentTestimonial].profiles.full_name},{' '}
                      {format(
                        new Date(testimonials[currentTestimonial].mesa_abierta_months.month_date),
                        "MMMM yyyy",
                        { locale: es }
                      )}
                    </p>
                  </motion.div>

                  {/* Carousel Dots */}
                  {testimonials.length > 1 && (
                    <div className="flex justify-center gap-2 mt-6">
                      {testimonials.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentTestimonial(index)}
                          className={`w-2 h-2 rounded-full transition-all ${index === currentTestimonial
                              ? 'w-8 bg-stone-700'
                              : 'bg-stone-300 hover:bg-stone-400'
                            }`}
                          aria-label={`Ver testimonial ${index + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-16"
        >
          <h3 className="text-2xl md:text-3xl font-light text-center text-stone-800 mb-12">
            ¿Cómo Funciona?
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Inscríbete",
                description: "Elige ser anfitrión o invitado. Comparte tus restricciones alimentarias para que todos puedan disfrutar."
              },
              {
                step: "2",
                title: "Espera la Asignación",
                description: "El miércoles anterior a la cena recibirás tu asignación por email y WhatsApp con la dirección y lo que debes llevar."
              },
              {
                step: "3",
                title: "¡Disfruta!",
                description: "Comparte una cena deliciosa con miembros de CASA. Haz nuevas amistades y vive la sorpresa."
              }
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="w-16 h-16 flex items-center justify-center bg-stone-800 text-white text-2xl font-bold rounded-full mx-auto mb-4">
                  {item.step}
                </div>
                <h4 className="text-xl font-medium text-stone-800 mb-2">
                  {item.title}
                </h4>
                <p className="text-stone-600">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Sign-up Dialog */}
        {nextMonth && (
          <MesaAbiertaSignup
            open={signupOpen}
            onClose={handleSignupClose}
            monthId={nextMonth.id}
            preferredRole={signupRole}
          />
        )}

        {/* Auth Modal */}
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => {
            setAuthModalOpen(false);
            setPendingSignupRole(null);
          }}
          defaultTab="signup"
        />
      </div>
    </section>
  );
}

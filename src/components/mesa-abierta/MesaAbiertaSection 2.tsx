import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, Utensils, Star, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { MesaAbiertaSignup } from "./MesaAbiertaSignup";
import { AuthModal } from "@/components/auth/AuthModal";
import { useNavigate } from "react-router-dom";

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
          mesa_abierta_participants!inner(
            profiles!inner(full_name)
          ),
          mesa_abierta_months!inner(month_date)
        `)
        .eq('is_approved', true)
        .eq('is_featured', true)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      // Transform the data structure
      const transformedData = data?.map((item: any) => ({
        id: item.id,
        testimonial_text: item.testimonial_text,
        rating: item.rating,
        profiles: item.mesa_abierta_participants.profiles,
        mesa_abierta_months: item.mesa_abierta_months
      })) || [];

      setTestimonials(transformedData);
    } catch (error) {
      console.error('Error fetching testimonials:', error);
    }
  };

  const checkActiveParticipation = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('mesa_abierta_participants')
        .select('id, mesa_abierta_months!inner(dinner_date)')
        .eq('user_id', user.id)
        .gte('mesa_abierta_months.dinner_date', new Date().toISOString())
        .neq('status', 'cancelled')
        .limit(1)
        .single();

      setHasActiveParticipation(!!data && !error);
    } catch (error) {
      console.error('Error checking participation:', error);
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

      // If user just logged in and had a pending signup role, open the signup modal
      if (pendingSignupRole) {
        setAuthModalOpen(false);
        setSignupRole(pendingSignupRole);
        setSignupOpen(true);
        setPendingSignupRole(null);
      }
    }
  }, [user]);

  if (loading) {
    return (
      <section id="mesa-abierta" className="section bg-gradient-to-b from-white to-casa-50">
        <div className="container-custom">
          <div className="text-center py-20">
            <div className="animate-pulse">
              <div className="h-12 bg-casa-200 rounded w-1/2 mx-auto mb-4"></div>
              <div className="h-6 bg-casa-200 rounded w-1/3 mx-auto"></div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="mesa-abierta" className="section bg-gradient-to-b from-white to-casa-50 min-h-[200px]">
      <div className="container-custom">
        {/* Header */}
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex flex-col items-center mb-6">
            <img
              src="https://mulsqxfhxxdsadxsljss.supabase.co/storage/v1/object/sign/Media/La%20Mesa%20Abierta%20Logo.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84N2ZkZDdiMi1lYjczLTRhZWItOGNmZS0yOTZjODQ3M2ExYzAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJNZWRpYS9MYSBNZXNhIEFiaWVydGEgTG9nby5wbmciLCJpYXQiOjE3NjI4OTQxNzQsImV4cCI6MTg0MDY1NDE3NH0.iAn0riDQJ-EZXSxDBk_5VjckQbBhLzX6l4bDQ6xKCeM"
              alt="La Mesa Abierta Logo"
              className="h-40 md:h-56 w-auto"
            />
          </div>
          <p className="text-lg text-center text-casa-600 max-w-3xl mx-auto mb-4">
            Una cena mensual llena de sorpresas donde compartimos comida y
            comunidad con hermanos que aún no conoces.
          </p>
          <p className="text-base text-casa-500 italic">
            No sabrás quién es el anfitrión ni quiénes serán los otros invitados
            hasta que llegues. ¡Déjate sorprender!
          </p>
        </div>

        {/* Next Dinner Info Card */}
        {nextMonth && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="mb-12"
          >
            <Card className="border-casa-200 shadow-lg bg-white">
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Dinner Date */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 flex items-center justify-center bg-casa-100 rounded-full flex-shrink-0">
                      <Calendar className="w-6 h-6 text-casa-700" />
                    </div>
                    <div>
                      <p className="text-sm text-casa-500 font-medium">Próxima Cena</p>
                      <p className="text-lg font-semibold text-casa-800">
                        {format(new Date(nextMonth.dinner_date), "EEEE, d 'de' MMMM", { locale: es })}
                      </p>
                    </div>
                  </div>

                  {/* Registration Deadline */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 flex items-center justify-center bg-casa-100 rounded-full flex-shrink-0">
                      <Clock className="w-6 h-6 text-casa-700" />
                    </div>
                    <div>
                      <p className="text-sm text-casa-500 font-medium">Inscripción hasta</p>
                      <p className="text-lg font-semibold text-casa-800">
                        {format(new Date(nextMonth.registration_deadline), "d 'de' MMMM, HH:mm", { locale: es })}
                      </p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 flex items-center justify-center bg-casa-100 rounded-full flex-shrink-0">
                      <Users className="w-6 h-6 text-casa-700" />
                    </div>
                    <div>
                      <p className="text-sm text-casa-500 font-medium">Estado</p>
                      {stats && (
                        <div className="space-y-1">
                          <p className="text-sm text-casa-700">
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
                      className="bg-casa-700 hover:bg-casa-800 text-white px-8"
                    >
                      Ver Mi Participación
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleSignUp('guest')}
                      size="lg"
                      className="bg-casa-700 hover:bg-casa-800 text-white px-8"
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
            <Card className="border-casa-200 bg-casa-50">
              <CardContent className="p-8">
                <Utensils className="w-16 h-16 text-casa-400 mx-auto mb-4" />
                <h3 className="text-2xl font-medium text-casa-700 mb-2">
                  Próximamente
                </h3>
                <p className="text-casa-600">
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
            <h3 className="text-2xl md:text-3xl font-light text-center text-casa-800 mb-8">
              Lo Que Dicen Nuestros Participantes
            </h3>

            <div className="relative max-w-3xl mx-auto">
              <Card className="border-casa-200 bg-white shadow-md">
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
                    <p className="text-lg text-casa-700 mb-6 italic">
                      "{testimonials[currentTestimonial].testimonial_text}"
                    </p>
                    <p className="text-sm text-casa-500">
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
                              ? 'w-8 bg-casa-700'
                              : 'bg-casa-300 hover:bg-casa-400'
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
          <h3 className="text-2xl md:text-3xl font-light text-center text-casa-800 mb-12">
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
                description: "El lunes anterior a la cena recibirás tu asignación por email y WhatsApp con la dirección y lo que debes llevar."
              },
              {
                step: "3",
                title: "¡Disfruta!",
                description: "Comparte una cena deliciosa con hermanos de CASA. Haz nuevas amistades y vive la sorpresa."
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
                <div className="w-16 h-16 flex items-center justify-center bg-casa-700 text-white text-2xl font-bold rounded-full mx-auto mb-4">
                  {item.step}
                </div>
                <h4 className="text-xl font-medium text-casa-800 mb-2">
                  {item.title}
                </h4>
                <p className="text-casa-600">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Final CTA */}
        {nextMonth && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            viewport={{ once: true }}
            className="mt-16 text-center"
          >
            {hasActiveParticipation ? (
              <>
                <p className="text-lg text-casa-600 mb-6">
                  Ya estás inscrito. ¡Revisa los detalles de tu participación!
                </p>
                <Button
                  onClick={() => navigate('/mesa-abierta/dashboard')}
                  size="lg"
                  className="bg-casa-700 hover:bg-casa-800 text-white px-12"
                >
                  Ver Mi Dashboard
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </>
            ) : (
              <>
                <p className="text-lg text-casa-600 mb-6">
                  ¿Listo para una experiencia única de comunidad?
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    onClick={() => handleSignUp('host')}
                    size="lg"
                    className="bg-casa-700 hover:bg-casa-800 text-white px-12"
                  >
                    Inscribirme como Anfitrión
                  </Button>
                  <Button
                    onClick={() => handleSignUp('guest')}
                    size="lg"
                    variant="outline"
                    className="border-casa-700 text-casa-700 hover:bg-casa-50 px-12"
                  >
                    Inscribirme como Invitado
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        )}

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

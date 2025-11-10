import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, Utensils, Star } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { MesaAbiertaSignup } from "./MesaAbiertaSignup";

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
  const [nextMonth, setNextMonth] = useState<NextMonth | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [testimonials, setTestimonials] = useState<FeaturedTestimonial[]>([]);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [loading, setLoading] = useState(true);
  const [signupOpen, setSignupOpen] = useState(false);
  const [signupRole, setSignupRole] = useState<'host' | 'guest'>('guest');

  useEffect(() => {
    fetchNextMonth();
    fetchTestimonials();
  }, []);

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
        .select('role_preference, has_plus_one')
        .eq('month_id', monthId)
        .eq('status', 'pending');

      if (error) throw error;

      const hosts = participants?.filter(p => p.role_preference === 'host').length || 0;
      const guests = participants?.filter(p => p.role_preference === 'guest').length || 0;
      const plusOnes = participants?.filter(p => p.has_plus_one).length || 0;

      const totalGuestSlots = guests + plusOnes;
      const hostsNeeded = Math.ceil(totalGuestSlots / 5);
      const spotsAvailable = Math.max(0, (hosts * 5) - totalGuestSlots);

      setStats({
        totalParticipants: participants?.length || 0,
        hostsNeeded: hostsNeeded - hosts,
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
      toast({
        title: "Inicia sesión",
        description: "Debes iniciar sesión para inscribirte en La Mesa Abierta",
        variant: "destructive"
      });
      return;
    }

    setSignupRole(role);
    setSignupOpen(true);
  };

  const handleSignupClose = () => {
    setSignupOpen(false);
    // Refresh stats after signup
    if (nextMonth) {
      fetchStats(nextMonth.id);
    }
  };

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
    <section id="mesa-abierta" className="section bg-gradient-to-b from-white to-casa-50">
      <div className="container-custom">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 mb-4"
          >
            <Utensils className="w-8 h-8 text-casa-700" />
            <h2 className="text-4xl md:text-5xl font-light text-casa-800">
              La Mesa Abierta
            </h2>
          </motion.div>
          <p className="text-lg text-center text-casa-600 max-w-3xl mx-auto mb-4">
            Una cena mensual llena de sorpresas donde compartimos comida y
            comunidad con hermanos que aún no conoces.
          </p>
          <p className="text-base text-casa-500 italic">
            No sabrás quién es el anfitrión ni quiénes serán los otros invitados
            hasta que llegues. ¡Déjate sorprender!
          </p>
        </motion.div>

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
                              {stats.hostsNeeded} anfitriones más necesarios
                            </Badge>
                          )}
                          {stats.spotsAvailable > 0 && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              {stats.spotsAvailable} cupos disponibles
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* CTA Buttons */}
                <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    onClick={() => handleSignUp('host')}
                    size="lg"
                    className="bg-casa-700 hover:bg-casa-800 text-white px-8"
                  >
                    Ser Anfitrión
                  </Button>
                  <Button
                    onClick={() => handleSignUp('guest')}
                    size="lg"
                    variant="outline"
                    className="border-casa-700 text-casa-700 hover:bg-casa-50 px-8"
                  >
                    Ser Invitado
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* No Active Month Message */}
        {!nextMonth && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center py-12"
          >
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
          </motion.div>
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
                        className={`w-5 h-5 ${
                          i < testimonials[currentTestimonial].rating
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
                          className={`w-2 h-2 rounded-full transition-all ${
                            index === currentTestimonial
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
      </div>
    </section>
  );
}

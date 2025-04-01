import { Mail, MapPin, Phone } from "lucide-react";
import { FacebookIcon, InstagramIcon, TwitterIcon, YoutubeIcon } from "@/components/icons/SocialIcons";
export function Footer() {
  return <footer className="bg-casa-800 text-white pt-16 pb-8">
      <div className="container-custom">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="mb-4">
              <img alt="CASA Logo" className="h-16 w-auto" src="/lovable-uploads/675de6a8-e016-487d-87ce-0c956d83bdc3.png" />
            </div>
            <p className="text-casa-100 mb-6">
              Un espacio de amor, inclusión y esperanza para todos. Donde cada persona es bienvenida tal como es.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-casa-200 hover:text-white transition w-6 h-6">
                <FacebookIcon />
              </a>
              <a href="https://www.instagram.com/anglicanasanandres" className="text-casa-200 hover:text-white transition w-6 h-6">
                <InstagramIcon />
              </a>
              <a href="#" className="text-casa-200 hover:text-white transition w-6 h-6">
                <TwitterIcon />
              </a>
              <a href="https://www.youtube.com/c/ComunidadAnglicanaSanAndrés" className="text-casa-200 hover:text-white transition w-6 h-6">
                <YoutubeIcon />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-lg mb-4">Enlaces Rápidos</h4>
            <ul className="space-y-2">
              <li>
                <a href="#proposito" className="text-casa-200 hover:text-white transition">Sentido & Propósito</a>
              </li>
              <li>
                <a href="#equipo" className="text-casa-200 hover:text-white transition">Equipo y Liderazgo</a>
              </li>
              <li>
                <a href="#participar" className="text-casa-200 hover:text-white transition">Participar</a>
              </li>
              <li>
                <a href="#eventos" className="text-casa-200 hover:text-white transition">Eventos</a>
              </li>
              <li>
                <a href="#sermones" className="text-casa-200 hover:text-white transition">Reflexiones</a>
              </li>
              <li>
                <a href="#oracion" className="text-casa-200 hover:text-white transition">Oración</a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-lg mb-4">Horarios</h4>
            <div className="space-y-3">
              <div>
                <p className="font-medium">Liturgia Dominical</p>
                <p className="text-casa-200">Domingos 11:00 AM</p>
              </div>
              <div>
                <p className="font-medium">Grupos en CASA</p>
                <p className="text-casa-200">Jueves por medio 7:00 PM</p>
              </div>
              <div>
                <p className="font-medium">Oficina</p>
                <p className="text-casa-200">Lunes a Viernes con cita previa</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-lg mb-4">Contacto</h4>
            <ul className="space-y-3">
              <li className="flex">
                <MapPin className="h-5 w-5 mr-3 text-casa-300 flex-shrink-0" />
                <span className="text-casa-200">Av. Vicente Pérez Rosales 1765, La Reina, Santiago</span>
              </li>
              <li className="flex">
                <Phone className="h-5 w-5 mr-3 text-casa-300 flex-shrink-0" />
                <span className="text-casa-200">+56941623577</span>
              </li>
              <li className="flex">
                <Mail className="h-5 w-5 mr-3 text-casa-300 flex-shrink-0" />
                <span className="text-casa-200">sanandres@iach.cl</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-casa-700 pt-8 text-center text-casa-300">
          <p>&copy; {new Date().getFullYear()} CASA. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>;
}
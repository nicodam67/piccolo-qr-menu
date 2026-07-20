import type { SupportedLocaleCode } from "@/config/locales";
import type { DayKey, OpeningStatus } from "./types";

type ScheduleCopy = {
  hours: string; call: string; directions: string; open: string; closed: string;
  closedToday: string; openingSoon: string; closingSoon: string;
  unavailable: string; firstShift: string; secondShift: string; today: string;
  closesAt: string; opensTodayAt: string; opensTomorrowAt: string;
  opensOnDayAt: string; close: string; days: Record<DayKey, string>;
};

const days = (
  monday: string, tuesday: string, wednesday: string, thursday: string,
  friday: string, saturday: string, sunday: string,
): Record<DayKey, string> => ({
  monday, tuesday, wednesday, thursday, friday, saturday, sunday,
});

const copies: Record<SupportedLocaleCode, ScheduleCopy> = {
  es: { hours:"Horario",call:"Llamar",directions:"Cómo llegar",open:"Abierto",closed:"Cerrado",closedToday:"Cerrado hoy",openingSoon:"Abre próximamente",closingSoon:"Cierra próximamente",unavailable:"Horario no disponible",firstShift:"Primer turno",secondShift:"Segundo turno",today:"Hoy",closesAt:"Cierra a las {time}",opensTodayAt:"Abre hoy a las {time}",opensTomorrowAt:"Abre mañana a las {time}",opensOnDayAt:"Abre el {day} a las {time}",close:"Cerrar horario",days:days("lunes","martes","miércoles","jueves","viernes","sábado","domingo") },
  ca: { hours:"Horari",call:"Trucar",directions:"Com arribar",open:"Obert",closed:"Tancat",closedToday:"Tancat avui",openingSoon:"Obre aviat",closingSoon:"Tanca aviat",unavailable:"Horari no disponible",firstShift:"Primer torn",secondShift:"Segon torn",today:"Avui",closesAt:"Tanca a les {time}",opensTodayAt:"Obre avui a les {time}",opensTomorrowAt:"Obre demà a les {time}",opensOnDayAt:"Obre {day} a les {time}",close:"Tancar horari",days:days("dilluns","dimarts","dimecres","dijous","divendres","dissabte","diumenge") },
  en: { hours:"Hours",call:"Call",directions:"Directions",open:"Open",closed:"Closed",closedToday:"Closed today",openingSoon:"Opening soon",closingSoon:"Closing soon",unavailable:"Hours unavailable",firstShift:"First service",secondShift:"Second service",today:"Today",closesAt:"Closes at {time}",opensTodayAt:"Opens today at {time}",opensTomorrowAt:"Opens tomorrow at {time}",opensOnDayAt:"Opens {day} at {time}",close:"Close hours",days:days("Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday") },
  ro: { hours:"Program",call:"Sună",directions:"Indicații",open:"Deschis",closed:"Închis",closedToday:"Închis astăzi",openingSoon:"Se deschide în curând",closingSoon:"Se închide în curând",unavailable:"Program indisponibil",firstShift:"Primul interval",secondShift:"Al doilea interval",today:"Astăzi",closesAt:"Se închide la {time}",opensTodayAt:"Se deschide astăzi la {time}",opensTomorrowAt:"Se deschide mâine la {time}",opensOnDayAt:"Se deschide {day} la {time}",close:"Închide programul",days:days("luni","marți","miercuri","joi","vineri","sâmbătă","duminică") },
  fr: { hours:"Horaires",call:"Appeler",directions:"Itinéraire",open:"Ouvert",closed:"Fermé",closedToday:"Fermé aujourd’hui",openingSoon:"Ouvre bientôt",closingSoon:"Ferme bientôt",unavailable:"Horaires indisponibles",firstShift:"Premier service",secondShift:"Deuxième service",today:"Aujourd’hui",closesAt:"Ferme à {time}",opensTodayAt:"Ouvre aujourd’hui à {time}",opensTomorrowAt:"Ouvre demain à {time}",opensOnDayAt:"Ouvre {day} à {time}",close:"Fermer les horaires",days:days("lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche") },
  de: { hours:"Öffnungszeiten",call:"Anrufen",directions:"Anfahrt",open:"Geöffnet",closed:"Geschlossen",closedToday:"Heute geschlossen",openingSoon:"Öffnet bald",closingSoon:"Schließt bald",unavailable:"Öffnungszeiten nicht verfügbar",firstShift:"Erste Schicht",secondShift:"Zweite Schicht",today:"Heute",closesAt:"Schließt um {time}",opensTodayAt:"Öffnet heute um {time}",opensTomorrowAt:"Öffnet morgen um {time}",opensOnDayAt:"Öffnet {day} um {time}",close:"Öffnungszeiten schließen",days:days("Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag") },
  nl: { hours:"Openingstijden",call:"Bellen",directions:"Route",open:"Open",closed:"Gesloten",closedToday:"Vandaag gesloten",openingSoon:"Gaat binnenkort open",closingSoon:"Sluit binnenkort",unavailable:"Openingstijden niet beschikbaar",firstShift:"Eerste dienst",secondShift:"Tweede dienst",today:"Vandaag",closesAt:"Sluit om {time}",opensTodayAt:"Opent vandaag om {time}",opensTomorrowAt:"Opent morgen om {time}",opensOnDayAt:"Opent {day} om {time}",close:"Openingstijden sluiten",days:days("maandag","dinsdag","woensdag","donderdag","vrijdag","zaterdag","zondag") },
  eu: { hours:"Ordutegia",call:"Deitu",directions:"Nola iritsi",open:"Irekita",closed:"Itxita",closedToday:"Gaur itxita",openingSoon:"Laster irekiko da",closingSoon:"Laster itxiko da",unavailable:"Ordutegia ez dago erabilgarri",firstShift:"Lehen txanda",secondShift:"Bigarren txanda",today:"Gaur",closesAt:"{time}(e)tan ixten da",opensTodayAt:"Gaur {time}(e)tan irekitzen da",opensTomorrowAt:"Bihar {time}(e)tan irekitzen da",opensOnDayAt:"{day} {time}(e)tan irekitzen da",close:"Ordutegia itxi",days:days("astelehena","asteartea","asteazkena","osteguna","ostirala","larunbata","igandea") },
  it: { hours:"Orari",call:"Chiama",directions:"Indicazioni",open:"Aperto",closed:"Chiuso",closedToday:"Chiuso oggi",openingSoon:"Apre a breve",closingSoon:"Chiude a breve",unavailable:"Orari non disponibili",firstShift:"Primo turno",secondShift:"Secondo turno",today:"Oggi",closesAt:"Chiude alle {time}",opensTodayAt:"Apre oggi alle {time}",opensTomorrowAt:"Apre domani alle {time}",opensOnDayAt:"Apre {day} alle {time}",close:"Chiudi orari",days:days("lunedì","martedì","mercoledì","giovedì","venerdì","sabato","domenica") },
};

export function getScheduleCopy(locale: string) {
  return copies[locale as SupportedLocaleCode] ?? copies.es;
}

export type SpecialScheduleCopy = {
  specialToday: string;
  closedForReason: string;
  reopensTodayAt: string;
};

const specialCopies: Record<SupportedLocaleCode, SpecialScheduleCopy> = {
  es: { specialToday: "Hoy tenemos horario especial", closedForReason: "Cerrado por {reason}", reopensTodayAt: "Vuelve a abrir hoy a las {time}" },
  ca: { specialToday: "Avui tenim horari especial", closedForReason: "Tancat per {reason}", reopensTodayAt: "Torna a obrir avui a les {time}" },
  en: { specialToday: "Special hours today", closedForReason: "Closed for {reason}", reopensTodayAt: "Reopens today at {time}" },
  ro: { specialToday: "Program special astăzi", closedForReason: "Închis pentru {reason}", reopensTodayAt: "Se redeschide astăzi la {time}" },
  fr: { specialToday: "Horaires spéciaux aujourd’hui", closedForReason: "Fermé pour {reason}", reopensTodayAt: "Rouvre aujourd’hui à {time}" },
  de: { specialToday: "Heute gelten Sonderöffnungszeiten", closedForReason: "Geschlossen wegen {reason}", reopensTodayAt: "Öffnet heute wieder um {time}" },
  nl: { specialToday: "Vandaag gelden speciale openingstijden", closedForReason: "Gesloten wegens {reason}", reopensTodayAt: "Opent vandaag opnieuw om {time}" },
  eu: { specialToday: "Gaur ordutegi berezia dugu", closedForReason: "{reason} dela eta itxita", reopensTodayAt: "Gaur {time}(e)tan irekiko da berriro" },
  it: { specialToday: "Oggi abbiamo un orario speciale", closedForReason: "Chiuso per {reason}", reopensTodayAt: "Riapre oggi alle {time}" },
};

export function getSpecialScheduleCopy(locale: string) {
  return specialCopies[locale as SupportedLocaleCode] ?? specialCopies.es;
}

const fill = (template: string, values: Record<string, string>) =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, value),
    template,
  );

export function formatOpeningStatus(
  status: OpeningStatus,
  copy: ScheduleCopy,
  specialCopy: SpecialScheduleCopy = specialCopies.es,
) {
  const label =
    status.state === "open" ? copy.open :
    status.state === "closingSoon" ? copy.closingSoon :
    status.state === "openingSoon" ? copy.openingSoon :
    status.state === "closedToday" ? copy.closedToday :
    status.state === "unavailable" ? copy.unavailable : copy.closed;
  let detail = "";
  if (status.isSpecial && status.reason && !status.isOpen) {
    return {
      label: fill(specialCopy.closedForReason, { reason: status.reason }),
      detail: status.nextOpening
        ? status.reopensToday
          ? fill(specialCopy.reopensTodayAt, {
              time: status.nextOpening.opensAt,
            })
          : ""
        : "",
    };
  }
  if (status.closesAt) detail = fill(copy.closesAt, { time: status.closesAt });
  else if (status.nextOpening) {
    const values = {
      time: status.nextOpening.opensAt,
      day: copy.days[status.nextOpening.day],
    };
    detail =
      status.reopensToday ? fill(specialCopy.reopensTodayAt, values) :
      status.nextOpening.dayOffset === 0 ? fill(copy.opensTodayAt, values) :
      status.nextOpening.dayOffset === 1 ? fill(copy.opensTomorrowAt, values) :
      fill(copy.opensOnDayAt, values);
  }
  if (status.isSpecial && (status.isOpen || !status.reason)) {
    detail = detail
      ? `${specialCopy.specialToday}. ${detail}`
      : specialCopy.specialToday;
  }
  return { label, detail };
}

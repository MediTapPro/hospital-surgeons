'use client';

import { BadgeCheck, MapPin, Star, Stethoscope } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import Link from 'next/link';

interface DoctorSpecialty {
  id: string;
  name: string;
}

interface DoctorCardProps {
  id: string;
  name: string;
  primarySpecialty: string;
  specialties: DoctorSpecialty[];
  experienceYears: number;
  rating: number;
  totalReviews: number;
  distanceKm: number;
  city: string | null;
  state: string | null;
  photoUrl: string | null;
}

export function DoctorCard({
  id,
  name,
  primarySpecialty,
  specialties,
  experienceYears,
  rating,
  totalReviews,
  distanceKm,
  city,
  state,
  photoUrl,
}: DoctorCardProps) {
  const secondarySpecialties = specialties
    .filter((s) => s.name !== primarySpecialty)
    .map((s) => s.name);

  return (
    <article className="bg-white/85 backdrop-blur-sm border border-slate-100 rounded-2xl p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.01]">
      <div className="flex items-start gap-4">
        <Avatar className="w-16 h-16 rounded-xl border border-slate-100">
          {photoUrl && (
            <AvatarImage src={photoUrl} alt={`${name} profile`} className="object-cover" />
          )}
          <AvatarFallback className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-xl font-bold">
            {name.charAt(0)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-bold text-slate-950 text-base">{name}</h3>
            <BadgeCheck className="w-4 h-4 text-emerald-500 shrink-0" aria-label="Verified doctor" />
          </div>

          <p className="text-sm font-semibold text-blue-700 flex items-center gap-1.5 mt-0.5">
            <Stethoscope className="w-3.5 h-3.5" />
            {primarySpecialty}
          </p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span className="font-semibold text-slate-700">{rating.toFixed(1)}</span>
              <span>({totalReviews})</span>
            </span>
            <span>{experienceYears} yrs exp</span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {distanceKm.toFixed(1)} km away
            </span>
          </div>

          {(city || state) && (
            <p className="text-[11px] text-slate-400 mt-1">
              {[city, state].filter(Boolean).join(', ')}
            </p>
          )}

          {secondarySpecialties.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {secondarySpecialties.slice(0, 3).map((name) => (
                <span
                  key={name}
                  className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-bold border border-indigo-100/60"
                >
                  {name}
                </span>
              ))}
              {secondarySpecialties.length > 3 && (
                <span className="px-2 py-0.5 bg-slate-50 text-slate-500 rounded-md text-[10px] font-bold border border-slate-100">
                  +{secondarySpecialties.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end mt-4 pt-3 border-t border-slate-100/50">
        <Link
          href={`/patient/book-home-visit/${id}`}
          className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
        >
          Book Home Visit
        </Link>
      </div>
    </article>
  );
}

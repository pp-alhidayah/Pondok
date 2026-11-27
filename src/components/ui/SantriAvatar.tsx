import React, { useEffect, useState } from 'react';

interface SantriAvatarProps {
  nama: string;
  foto?: string | null;
  /** Ukuran + gaya wrapper, mis. "w-10 h-10" atau "h-32 w-24". */
  className?: string;
  textClassName?: string;
  rounded?: 'full' | 'lg';
}

/** Avatar santri: menampilkan foto dengan fallback inisial bila foto kosong/rusak. */
export const SantriAvatar: React.FC<SantriAvatarProps> = ({
  nama,
  foto,
  className = 'w-10 h-10',
  textClassName = 'text-xs',
  rounded = 'full',
}) => {
  const [gagal, setGagal] = useState(false);

  useEffect(() => {
    setGagal(false);
  }, [foto]);

  const inisial = nama.trim() ? nama.trim().substring(0, 2).toUpperCase() : 'ST';

  return (
    <div
      className={`${className} ${rounded === 'full' ? 'rounded-full' : 'rounded-lg'} flex shrink-0 items-center justify-center overflow-hidden border border-emerald-300 bg-emerald-100 font-bold text-emerald-700 ${textClassName}`}
    >
      {foto && !gagal ? (
        <img
          src={foto}
          alt={`Foto ${nama}`}
          loading="lazy"
          onError={() => setGagal(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        inisial
      )}
    </div>
  );
};

export default SantriAvatar;

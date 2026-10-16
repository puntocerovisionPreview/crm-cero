import React from 'react';

interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  className = '',
}) => {
  const pixelSizes = {
    xs: 'h-6 max-w-[100px]',
    sm: 'h-8 max-w-[140px]',
    md: 'h-10 max-w-[180px]',
    lg: 'h-14 max-w-[240px]',
  };

  return (
    <div className={`flex items-center ${className}`}>
      <img 
        src="/logo.png" 
        alt="Logo" 
        className={`${pixelSizes[size]} w-auto object-contain select-none`}
        loading="eager"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};


import React from 'react';
import BrandLoader from './BrandLoader';

export default function Preloader({ message = 'Chargement de votre session…' }: { message?: string }) {
  return <BrandLoader fullPage label={message}/>;
}

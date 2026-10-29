import React, { useState } from 'react';
export default function UserAvatar({ photo, name, size = 40 }: { photo?: string; name: string; size?: number }) {
 const [failedPhoto, setFailedPhoto] = useState<string>();
 const initials = name.trim().split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase() || '?';
 return <span className="user-avatar" style={{width:size,height:size}}>{photo && failedPhoto !== photo ? <img src={photo} alt={`Photo de ${name}`} onError={() => setFailedPhoto(photo)} /> : <span aria-label={`Avatar de ${name}`}>{initials}</span>}</span>;
}
export function systemRoleLabel(role?: string): string {
 const labels: Record<string,string> = { SUPER_ADMIN:'Super administrateur', DIRECTEUR_GENERAL:'Directeur général', DIRECTEUR:'Directeur', SECRETAIRE:'Secrétaire', CHEF_DIVISION:'Chef de division', CHEF_SERVICE:'Chef de service', CHEF_BUREAU:'Chef de bureau', AGENT:'Agent' };
 return role ? labels[role] || role.replace(/_/g,' ') : 'Utilisateur';
}

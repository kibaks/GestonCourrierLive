export function apiValidationError(data:{message?:string;errors?:Record<string,string|string[]>},fallback='Données invalides.'):string {
 const details=[...new Set(Object.values(data.errors||{}).flatMap(value=>Array.isArray(value)?value:[value]).map(value=>String(value).trim()).filter(Boolean))];
 return details.length?details.join('\n'):data.message||fallback;
}

import {jsPDF} from 'jspdf';
export interface CahierPdfRow {id:string;values:string[];qrDataUrl?:string;sens?:string}
export interface CahierPdfOptions {
 title:string;subtitle:string;organisationName:string;organisationAddress:string;showHeader:boolean;
 includeStats:boolean;showBorders:boolean;showRowNumbers:boolean;includeQrCode:boolean;
 paperSize:'a4'|'a3'|'letter';orientation:'portrait'|'landscape';fontSize:number;
 tableMargin:number;columnPadding:number;tableAlign:'left'|'center'|'right';
 columns:{key?:string;label:string;width:number;visible:boolean}[];filterSens:string;filterDateDebut:string;filterDateFin:string;
}
const clean=(value:string)=>String(value||'').replace(/<[^>]*>/g,'').replace(/[’‘]/g,"'").replace(/[–—]/g,'-').replace(/\u00a0/g,' ');
/** The printed register uses the same paper, ink, heading and ruled grid as the screen. */
export function buildCahierRegisterPdf(rows:CahierPdfRow[],options:CahierPdfOptions):jsPDF {
 const columns=options.columns.filter(column=>column.visible);
 if(!columns.length)throw new Error('Le registre doit comporter au moins une colonne visible.');
 const doc=new jsPDF({orientation:options.orientation,unit:'mm',format:options.paperSize});
 const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight();
 const margin=Math.max(10,Math.min(30,options.tableMargin)),left=margin+5,right=W-margin,available=right-left;
 const font=options.fontSize,line=font*.3528*1.4,pad=Math.max(1.5,options.columnPadding),bottom=H-19;
 doc.setFont('helvetica','normal');doc.setFontSize(font);
 const numberWidth=Math.max(10,doc.getTextWidth('000')+pad*2),qrWidth=16;
 const fixed=(options.showRowNumbers?numberWidth:0)+(options.includeQrCode?qrWidth:0),sum=columns.reduce((value,column)=>value+column.width,0);
 const minimums=columns.map((column,index)=>{
  if(column.key==='numero')return 32;
  if(column.key==='objet')return 45;
  if(['expediteur','destinataire'].includes(column.key||''))return 28;
  if(column.key?.toLowerCase().startsWith('date'))return doc.getTextWidth('27/10/2026')+pad*2;
  if(['statut','priorite'].includes(column.key||''))return Math.min(45,Math.max(20,...rows.map(row=>doc.getTextWidth(clean(row.values[index]||''))+pad*2)));
  return 20;
 });
 const minimumTotal=minimums.reduce((a,b)=>a+b,0),remaining=available-fixed-minimumTotal;
 if(remaining<0)throw new Error('Les colonnes ne tiennent pas sur ce papier : choisissez le paysage, un papier plus grand ou une police plus petite.');
 const widths=[...(options.showRowNumbers?[numberWidth]:[]),...columns.map((column,index)=>minimums[index]+column.width/sum*remaining),...(options.includeQrCode?[qrWidth]:[])];
 if(widths.some(width=>width<=pad*2+1))throw new Error('Colonnes trop étroites : réduisez les marges ou choisissez un papier plus grand.');
 const labels=[...(options.showRowNumbers?['N°']:[]),...columns.map(column=>column.label),...(options.includeQrCode?['QR']:[])];
 const ink:[number,number,number]=[30,58,102],rule:[number,number,number]=[163,178,199];
 let y=margin;
 const wrap=(value:string,width:number)=>doc.splitTextToSize(clean(value||'-'),width-pad*2) as string[];
 const centered=(value:string,size:number,family='times',style='bold')=>{
  doc.setFont(family,style);doc.setFontSize(size);doc.setTextColor(...ink);
  const lines=doc.splitTextToSize(clean(value),available) as string[];const height=size*.3528*1.3;
  doc.text(lines,left+available/2,y+height*.8,{align:'center'});y+=lines.length*height;
 };
 const tableHeader=()=>{
  doc.setFont('helvetica','bold');doc.setFontSize(font-1);
  const cells=labels.map((label,index)=>wrap(label,widths[index]));const height=Math.max(12,...cells.map(cell=>cell.length*line+pad*2));
  let x=left;cells.forEach((cell,index)=>{doc.setFillColor(230,237,248);doc.setDrawColor(128,151,182);doc.setLineWidth(.25);doc.rect(x,y,widths[index],height,'FD');doc.setTextColor(...ink);doc.text(cell,x+widths[index]/2,y+pad+line*.8,{align:'center'});x+=widths[index];});y+=height;
 };
 const pageHeader=(continued=false)=>{
  doc.setFillColor(255,254,248);doc.rect(0,0,W,H,'F');
  // A restrained binding margin survives black-and-white printing too.
  doc.setFillColor(...ink);doc.rect(margin-6,margin,2.5,H-margin*2,'F');doc.setDrawColor(180,157,103);doc.setLineWidth(.6);doc.line(margin-2,margin,margin-2,H-margin);
  y=margin+2;
  if(options.showHeader){
   centered('REPUBLIQUE DEMOCRATIQUE DU CONGO',8,'helvetica');y+=3;
   centered(options.organisationName||'Autorité de Régulation des Marchés Publics',13);y+=2;
   centered(options.organisationAddress||'Kinshasa - ARMP',8,'helvetica','normal');y+=5;
   doc.setDrawColor(...ink);doc.setLineWidth(.5);doc.line(left+available*.12,y,right-available*.12,y);y+=3;
   centered(options.title||'Cahier registre des courriers',14);y+=3;
   doc.line(left+available*.12,y,right-available*.12,y);y+=4;
   if(options.subtitle){centered(options.subtitle,9,'helvetica','normal');y+=3;}
  }else{centered(options.title||'Cahier registre',10);y+=3;}
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(83,102,131);
  const kind=options.filterSens==='ENTRANT'?'Arrivée':options.filterSens==='SORTANT'?'Départ':'Correspondance générale';
  const from=options.filterDateDebut?options.filterDateDebut.split('-').reverse().join('/'):'début';const to=options.filterDateFin?options.filterDateFin.split('-').reverse().join('/'):'ce jour';
  const period=options.filterDateDebut||options.filterDateFin?`Réception : ${from} au ${to}`:'Toutes les dates';
  const caption=[`Registre : ${kind}${continued?' - suite':''}`,period,`${rows.length} inscription(s)`];
  if(options.includeStats)caption.push(`${rows.filter(row=>row.sens==='ENTRANT').length} arrivées / ${rows.filter(row=>row.sens==='SORTANT').length} départs`);
  const meta=doc.splitTextToSize(clean(caption.join('   |   ')),available) as string[];doc.text(meta,left,y+3);y+=meta.length*4+3;
  doc.setDrawColor(...rule);doc.setLineWidth(.2);doc.line(left,y,right,y);y+=4;tableHeader();
 };
 const nextPage=()=>{doc.addPage();pageHeader(true);};pageHeader();
 const tableStart=y;
 if(bottom-tableStart<line+pad*2)throw new Error('La mise en page ne laisse pas assez de place pour les lignes. Réduisez la police ou l’en-tête.');
 rows.forEach((row,index)=>{
  doc.setFont('helvetica','normal');doc.setFontSize(font);
  const values=[...(options.showRowNumbers?[String(index+1).padStart(3,'0')]:[]),...row.values,...(options.includeQrCode?['']:[])];
  const cells=values.map((value,i)=>{
   const column=columns[i-(options.showRowNumbers?1:0)];
   if(column?.key!=='numero'||!value.includes('/'))return wrap(value,widths[i]);
   const pieces=clean(value).split('/');const lines:string[]=[];let current='';
   pieces.forEach((piece,index)=>{const part=piece+(index<pieces.length-1?'/':'');if(current&&doc.getTextWidth(current+part)>widths[i]-pad*2){lines.push(current);current='';}if(doc.getTextWidth(part)>widths[i]-pad*2){lines.push(...wrap(part,widths[i]));}else current+=part;});
   if(current)lines.push(current);return lines.length?lines:['-'];
  });const maxLines=Math.max(1,...cells.map(cell=>cell.length));let offset=0;
  // Keep ordinary rows together; only oversized rows continue onto another page.
  const closing=index===rows.length-1?28:0;
  const fullHeight=Math.max(options.includeQrCode?18:12,maxLines*line+pad*2);
  if(y+fullHeight+closing>bottom&&fullHeight+closing<bottom-tableStart)nextPage();
  while(offset<maxLines){
   if(bottom-y<Math.max(options.includeQrCode&&offset===0?18:0,line+pad*2)+closing)nextPage();
   const count=Math.min(maxLines-offset,Math.max(1,Math.floor((bottom-y-pad*2-closing)/line)));
   const height=Math.max(options.includeQrCode&&offset===0?18:10,count*line+pad*2);let x=left;
   cells.forEach((cell,i)=>{
    doc.setFillColor(255,254,248);doc.setDrawColor(...rule);doc.setLineWidth(.2);doc.rect(x,y,widths[i],height,options.showBorders?'FD':'F');
    if(!options.showBorders)doc.line(x,y+height,x+widths[i],y+height);
    doc.setDrawColor(229,234,241);doc.setLineWidth(.08);for(let ruled=y+6;ruled<y+height-1;ruled+=6)doc.line(x,ruled,x+widths[i],ruled);
    doc.setFont('helvetica','normal');doc.setFontSize(font);doc.setTextColor(...ink);
    const part=cell.slice(offset,offset+count);if(part.length)doc.text(part,x+pad,y+pad+line*.8);
    if(options.includeQrCode&&i===cells.length-1&&offset===0&&row.qrDataUrl)doc.addImage(row.qrDataUrl,'PNG',x+2,y+2,12,12);
    x+=widths[i];
   });y+=height;offset+=count;if(offset<maxLines)nextPage();
  }
 });
 if(!rows.length){doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text('Aucun courrier pour les filtres sélectionnés.',left,y+10);y+=15;}
 // Administrative closing area, never inferred from read status.
 if(y+28>bottom)nextPage();y+=9;doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(83,102,131);doc.text('Visa du responsable',left,y);doc.text('Date et cachet du service',right-52,y);doc.setDrawColor(...rule);doc.setLineDashPattern([1,1],0);doc.line(left,y+15,left+55,y+15);doc.rect(right-52,y+3,52,15);doc.setLineDashPattern([],0);
 const pages=doc.getNumberOfPages();for(let page=1;page<=pages;page++){doc.setPage(page);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(99,114,138);doc.text('Canevas interne ARMP | Références administratives conservées',left,H-9);doc.text(`Feuillet ${page} / ${pages}`,right,H-9,{align:'right'});}
 return doc;
}

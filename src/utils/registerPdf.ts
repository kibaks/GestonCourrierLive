import jsPDF from 'jspdf';
import { RegisterColumn,RegisterMode,RegisterRow,registerTitles,registerValue } from '../services/registreService';
export type RegisterPdfOptions={mode:RegisterMode;columns:RegisterColumn[];organisation:string;unit:string;from:string;to:string;paper:'a4'|'a3';visa:boolean};
const plain=(value:string)=>value.replace(/[’‘]/g,"'").replace(/[–—]/g,'-').replace(/\u00a0/g,' ');
export function buildRegisterPdf(rows:RegisterRow[],options:RegisterPdfOptions):jsPDF{
 const doc=new jsPDF('l','mm',options.paper);const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight(),margin=12,font=8,line=3.7,padding=2;
 const widths=[10,...options.columns.map(c=>c.width)];const total=widths.reduce((a,b)=>a+b,0);const scaled=widths.map(w=>w/total*(W-margin*2));
 const labels=['N°',...options.columns.map(c=>c.label)];
 const wrap=(value:string,width:number)=>doc.splitTextToSize(plain(value||'-'),Math.max(3,width-padding*2)) as string[];
 let y=margin;
 const tableHeader=()=>{doc.setFont('helvetica','bold');doc.setFontSize(font);const cells=labels.map((v,i)=>wrap(v,scaled[i]));const h=Math.max(11,...cells.map(v=>v.length*line+padding*2));let x=margin;cells.forEach((value,i)=>{doc.setFillColor(30,64,125);doc.setDrawColor(203,214,233);doc.rect(x,y,scaled[i],h,'FD');doc.setTextColor(255);doc.text(value,x+padding,y+padding+line*.8);x+=scaled[i];});y+=h;};
 const pageHeader=(continuation=false)=>{y=margin;doc.setTextColor(35,53,80);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('REPUBLIQUE DEMOCRATIQUE DU CONGO',margin,y);y+=6;doc.setFontSize(13);doc.text(plain(options.organisation||'ARMP'),margin,y);y+=7;doc.setFontSize(12);doc.text(plain(registerTitles[options.mode])+(continuation?' - suite':''),margin,y);y+=5;doc.setFont('helvetica','normal');doc.setFontSize(8);const caption=[options.unit||'Tous les services',options.from||options.to?`Periode : ${options.from||'debut'} au ${options.to||'ce jour'}`:'Toutes les dates',options.mode==='depart'?"Periode d'inscription":options.mode==='arrivee'?'Periode de reception':'Periode de transmission'];const lines=doc.splitTextToSize(plain(caption.join(' | ')),W-margin*2);doc.text(lines,margin,y);y+=lines.length*3.5+4;tableHeader();};
 const newPage=()=>{doc.addPage();pageHeader(true);};pageHeader();
 rows.forEach((row,index)=>{
  doc.setFont('helvetica','normal');doc.setFontSize(font);const values=[String(index+1),...options.columns.map(c=>registerValue(row,c.key))];const cells=values.map((value,i)=>wrap(value,scaled[i]));let offset=0;const maxLines=Math.max(...cells.map(cell=>cell.length));
  while(offset<maxLines){if(H-17-y<line+padding*2)newPage();const capacity=Math.max(1,Math.floor((H-17-y-padding*2)/line));const take=Math.min(maxLines-offset,capacity);const h=Math.max(9,take*line+padding*2);if(y+h>H-16){newPage();continue;}let x=margin;cells.forEach((cell,i)=>{doc.setFillColor(...(index%2?[245,248,253]:[255,255,255]) as [number,number,number]);doc.setDrawColor(210,220,235);doc.rect(x,y,scaled[i],h,'FD');doc.setFont('helvetica','normal');doc.setFontSize(font);doc.setTextColor(35,53,80);const part=cell.slice(offset,offset+take);if(part.length)doc.text(part,x+padding,y+padding+line*.8);x+=scaled[i];});y+=h;offset+=take;if(offset<maxLines)newPage();}
 });
 if(!rows.length){doc.setTextColor(100);doc.text('Aucune inscription pour les filtres selectionnes.',margin,y+10);y+=15;}
 if(options.visa){if(y+30>H-17)newPage();y+=9;doc.setTextColor(70);doc.setFontSize(9);doc.text('Visa du responsable : ____________________',margin,y);doc.text('Date et cachet : ____________________',W/2,y);}
 const pages=doc.getNumberOfPages();for(let page=1;page<=pages;page++){doc.setPage(page);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(110);doc.text('Canevas interne ARMP - v1 | Donnees non renseignees : -',margin,H-8);doc.text(`Page ${page} / ${pages}`,W-margin,H-8,{align:'right'});}
 return doc;
}

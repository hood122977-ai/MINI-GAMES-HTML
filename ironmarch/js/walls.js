/** Four-connected wall cells prevent fast pointer movement from leaving holes. */
export function wallStroke(a,b){
 let x=Math.round((a.x-20)/40),y=Math.round((a.y-20)/40);
 const tx=Math.round((b.x-20)/40),ty=Math.round((b.y-20)/40),dx=Math.abs(tx-x),dy=Math.abs(ty-y),sx=Math.sign(tx-x),sy=Math.sign(ty-y);
 const cells=[{x:x*40+20,y:y*40+20}];let ix=0,iy=0;
 while(ix<dx||iy<dy){if(ix<dx&&(iy===dy||(ix+.5)/(dx||1)<=(iy+.5)/(dy||1))){x+=sx;ix++;}else{y+=sy;iy++;}cells.push({x:x*40+20,y:y*40+20});}
 return cells;
}

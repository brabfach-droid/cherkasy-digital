// Independent visual invariants: dark surfaces must not be near white and
// ordinary enabled controls/text must maintain readable contrast.
export async function auditTheme(page, label) {
 const errors=await page.evaluate(()=>{
  const parse=v=>{const m=v.match(/[\d.]+/g);return m?m.map(Number):[0,0,0,0]};
  const lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
  const mix=(fg,bg)=>{const a=fg[3]??1;return fg.slice(0,3).map((v,i)=>v*a+bg[i]*(1-a))};
  const background=el=>{let chain=[];for(let e=el;e;e=e.parentElement)chain.push(e);let c=[255,255,255];for(const e of chain.reverse()){const s=getComputedStyle(e);let value=parse(s.backgroundColor);if(s.backgroundImage!=='none'){const colors=s.backgroundImage.match(/rgba?\([^)]+\)/g);if(colors?.length)value=parse(colors[0])}c=mix(value,c)}return c};
  const root=document.querySelector('#theme-fixture')||document.querySelector('main');const bad=[];
  for(const el of root.querySelectorAll('*')){
   const s=getComputedStyle(el),r=el.getBoundingClientRect();if(!r.width||!r.height||s.visibility==='hidden'||s.display==='none'||el.closest('iframe,.qr,.broadcast'))continue;
   const c=parse(s.backgroundColor);
   if((c[3]??1)>.95&&lum(c)>.72)bad.push({reason:'light background',tag:el.tagName,cls:el.className,bg:s.backgroundColor});
   const text=[...el.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
   if(!text||el.disabled||el.closest('[disabled]')||s.opacity!=='1')continue;
   const bg=background(el),fg=parse(s.color);const l1=lum(fg),l2=lum(bg),ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
   const big=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&Number(s.fontWeight)>=700);
   if(ratio<(big?3:4.5))bad.push({reason:'low contrast',tag:el.tagName,cls:el.className,text:el.textContent.trim().slice(0,50),ratio:Number(ratio.toFixed(2)),fg:s.color,bg:bg.map(Math.round)});
  }
  return bad;
 });
 if(errors.length)throw new Error(label+': '+JSON.stringify(errors.slice(0,25)));
}
export async function auditComponents(page){
 await page.evaluate(()=>{
  const box=document.createElement('section');box.id='theme-fixture';box.innerHTML=`
  <aside class="workspace"><aside><nav><a>Навігація</a><a class="active">Активний розділ</a></nav></aside></aside>
  <div class="panel"><h2>Панель</h2><p>Текст панелі</p><input placeholder="Введіть текст" value="Значення"><select><option>Опція</option></select><textarea>Відповідь</textarea></div>
  <div class="table-wrap"><table><thead><tr><th>Заголовок таблиці</th></tr></thead><tbody><tr><td>Дані таблиці</td></tr></tbody></table></div>
  <div class="steps"><span>Дані</span><span class="active">Документи</span></div>
  <div class="file-upload"><label>Файл<input type="file"></label><small>Підказка</small></div>
  <div class="editor"><div class="editor-toolbar"><button class="button secondary small">Редагувати</button></div><textarea>Вміст</textarea></div>
  <div class="revision-diff"><pre>Історія документа</pre></div>
  <div class="help-cta"><h2>Допомога</h2><p>Зверніться до нас</p></div>
  <div class="alert">Інформація</div><div class="alert error">Помилка</div><div class="alert success">Збережено</div>
  <div class="message own"><small>Час повідомлення</small><p>Власне повідомлення</p></div>
  <div class="message internal"><p>Внутрішня нотатка</p></div>
  <button class="button">Зберегти</button><button class="button secondary">Назад</button><button class="button soft">Дія</button><button class="button outline">Переглянути</button><button class="button ghost">Закрити</button><button class="button danger">Видалити</button>
  <div class="announcement"><p>Важливе повідомлення</p></div>
  ${['info','warning','danger','critical','maintenance','service'].map(c=>`<div class="global-announcement ${c}"><strong>Оголошення ${c}</strong><p>Опис</p><button class="button secondary">Деталі</button></div>`).join('')}
  ${['normal','info','warning','danger','critical','unknown'].map(c=>`<div class="status-card ${c}"><h3>Стан міста</h3><p>Опис стану</p><small>Час оновлення</small></div>`).join('')}
  ${['draft','submitted','received','in_review','needs_more_info','approved','completed','rejected','cancelled'].map(c=>`<span class="badge ${c}">${c}</span>`).join('')}
  <div class="install-prompt">Встановити застосунок</div><button class="air-alert-status">Тривоги немає</button><button class="air-alert-status active">Повітряна тривога</button><button class="air-alert-status unknown">Дані недоступні</button>
  <div class="calendar-grid"><div><a>Подія сьогодні</a></div></div><div class="workspace-drawer"><a class="active">Мій кабінет</a></div>`;
  document.body.append(box);
 });
 await auditTheme(page,'component states');
 await page.locator('#theme-fixture>.button.soft').hover();await auditTheme(page,'soft button hover');
 await page.locator('#theme-fixture>.button.outline').hover();await auditTheme(page,'outline button hover');
 await page.locator('#theme-fixture>.button.ghost').hover();await auditTheme(page,'ghost button hover');
 await page.evaluate(()=>document.querySelector('#theme-fixture').remove());
}

(() => {
"use strict";
const TYPES={
 heart:["HKQuantityTypeIdentifierHeartRate","/min","♥"],steps:["HKQuantityTypeIdentifierStepCount","steps","👟"],
 oxygen:["HKQuantityTypeIdentifierOxygenSaturation","%","◉"],weight:["HKQuantityTypeIdentifierBodyMass","kg","⚖"],
 glucose:["HKQuantityTypeIdentifierBloodGlucose","mg/dL","◈"],energy:["HKQuantityTypeIdentifierActiveEnergyBurned","kcal","⚡"],
 sleep:["HKCategoryTypeIdentifierSleepAnalysis","h","☾"],wrist:["HKQuantityTypeIdentifierAppleSleepingWristTemperature","°C","♨"]
};
const LANG={
tr:{title:"Cihazlarım ve Apple Sağlık",intro:"Apple Watch Series 8 sağlık kayıtlarını görüntüle.",open:"Cihazlarım",choose:"Cihazını seç",phone:"Apple Sağlık (iPhone)",watch:"Apple Watch Series 8",notice:"Cihaz seçimi gerçek Bluetooth bağlantısı veya Apple Sağlık erişim izni vermez.",continue:"Devam et",back:"Geri",close:"Kapat",select:"Aktarılacak veri türleri",selectInfo:"Yalnızca işaretlediğin veri türleri içe aktarılır. Bu işlem Apple Sağlık izni vermez.",save:"Seçimleri kaydet",import:"Sağlık verilerini içe aktar",guide:"Bu web uygulaması Apple HealthKit'e doğrudan bağlanamaz. iPhone'da Sağlık → profil fotoğrafı → Tüm Sağlık Verilerini Dışa Aktar seçeneğini aç. ZIP'i Dosyalar'da çıkartıp export.xml dosyasını seç. Dosya telefonunda işlenir; sunucuya gönderilmez.",file:"export.xml dosyasını seç",results:"Verileri gör",data:"Sağlık verilerim",dataInfo:"Son içe aktarılan ölçümler. Eksik veriler için örnek değer gösterilmez.",update:"Dosyadan güncelle",none:"Kayıt yok",notConnected:"Otomatik bağlantı yok",last:"Son aktarım",never:"Henüz aktarım yok",large:"Dosya 20 MB sınırını aşıyor.",invalid:"Geçerli bir Apple Sağlık export.xml dosyası seç.",reading:"Dosya okunuyor…",noMatch:"Son 90 günde seçili türde ölçüm bulunamadı.",done:"Aktarılan veri türü",error:"Dosya okunamadı.",storage:"Veriler bu cihazda kaydedilemedi.",notLive:"Bu dosya aktarımıdır; canlı veya otomatik senkronizasyon değildir.",labels:{heart:"Nabız",steps:"Adım sayısı",oxygen:"Kandaki oksijen",weight:"Kilo",glucose:"Kan şekeri",energy:"Aktif enerji",sleep:"Uyku",wrist:"Bilek sıcaklığı"}},
en:{title:"My devices and Apple Health",intro:"View Apple Watch Series 8 health records.",open:"My devices",choose:"Choose a device",phone:"Apple Health (iPhone)",watch:"Apple Watch Series 8",notice:"Choosing a device does not pair over Bluetooth or grant Apple Health access.",continue:"Continue",back:"Back",close:"Close",select:"Data to import",selectInfo:"Only selected data types are imported. This does not grant Apple Health permissions.",save:"Save selection",import:"Import health data",guide:"This web app cannot connect directly to Apple HealthKit. On iPhone open Health → profile photo → Export All Health Data. Unzip the file in Files and select export.xml. The file is processed locally and is not sent to a server.",file:"Choose export.xml",results:"View data",data:"My health data",dataInfo:"Latest imported measurements. No sample values are shown for missing data.",update:"Update from file",none:"No record",notConnected:"No automatic connection",last:"Last import",never:"Not imported yet",large:"File exceeds the 20 MB limit.",invalid:"Choose a valid Apple Health export.xml.",reading:"Reading file…",noMatch:"No matching measurements in the last 90 days.",done:"Imported data types",error:"Could not read file.",storage:"Could not save data on this device.",notLive:"File import is not live or automatic synchronization.",labels:{heart:"Heart rate",steps:"Steps",oxygen:"Blood oxygen",weight:"Weight",glucose:"Blood glucose",energy:"Active energy",sleep:"Sleep",wrist:"Wrist temperature"}},
de:{title:"Meine Geräte und Apple Health",intro:"Gesundheitsdaten der Apple Watch Series 8 ansehen.",open:"Meine Geräte",choose:"Gerät auswählen",phone:"Apple Health (iPhone)",watch:"Apple Watch Series 8",notice:"Die Geräteauswahl koppelt kein Bluetooth-Gerät und erteilt keinen Apple-Health-Zugriff.",continue:"Weiter",back:"Zurück",close:"Schließen",select:"Zu importierende Daten",selectInfo:"Nur ausgewählte Datentypen werden importiert. Dies erteilt keine Apple-Health-Berechtigung.",save:"Auswahl speichern",import:"Gesundheitsdaten importieren",guide:"Diese Web-App kann nicht direkt auf Apple HealthKit zugreifen. Auf dem iPhone Health → Profilfoto → Alle Gesundheitsdaten exportieren öffnen. ZIP in Dateien entpacken und export.xml wählen. Die Datei wird lokal verarbeitet und nicht an einen Server gesendet.",file:"export.xml auswählen",results:"Daten ansehen",data:"Meine Gesundheitsdaten",dataInfo:"Zuletzt importierte Messungen. Fehlende Werte werden nicht erfunden.",update:"Aus Datei aktualisieren",none:"Kein Eintrag",notConnected:"Keine automatische Verbindung",last:"Letzter Import",never:"Noch kein Import",large:"Datei überschreitet 20 MB.",invalid:"Gültige Apple Health export.xml auswählen.",reading:"Datei wird gelesen…",noMatch:"Keine passenden Messungen der letzten 90 Tage.",done:"Importierte Datentypen",error:"Datei konnte nicht gelesen werden.",storage:"Daten konnten nicht gespeichert werden.",notLive:"Dateiimport ist keine Live- oder automatische Synchronisierung.",labels:{heart:"Puls",steps:"Schritte",oxygen:"Blutsauerstoff",weight:"Gewicht",glucose:"Blutzucker",energy:"Aktive Energie",sleep:"Schlaf",wrist:"Handgelenktemperatur"}}
};
const P="scDevicePreferences",D="scDeviceSnapshot";
function read(key,def){try{return JSON.parse(localStorage.getItem(key))||def}catch{return def}}
let pref=read(P,{device:"watch",types:Object.keys(TYPES)}),data=read(D,{values:{},date:null});
let page="choose",opened=false,status="";
const panel=document.getElementById("panel-health");if(!panel)return;
const root=document.createElement("div");root.className="card";root.id="healthDevicesCard";panel.insertBefore(root,panel.firstElementChild);
const css=document.createElement("style");
css.textContent='.sc-device-note{background:var(--accent-soft);padding:13px;border-radius:14px;font-size:13px;line-height:1.5;margin:12px 0}.sc-device-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.sc-device-actions .btn{flex:1}.sc-device-tile{display:flex;gap:12px;align-items:center;width:100%;text-align:left;background:var(--surface-2);border:1px solid var(--border);border-radius:14px;color:var(--text);padding:13px;margin:8px 0}.sc-device-tile[aria-pressed=true]{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}.sc-device-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}.sc-device-grid label,.sc-data-tile{border:1px solid var(--border);background:var(--surface-2);border-radius:12px;padding:10px}.sc-device-grid label{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text)}.sc-device-grid input{width:18px;height:18px;flex:0 0 auto;margin:0}.sc-data-tile strong{display:block;font-size:19px;margin:8px 0}.sc-data-tile small{font-size:11px;color:var(--muted)}';
document.head.appendChild(css);
const esc=x=>String(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const lang=()=>LANG[localStorage.getItem("appLanguage")]||LANG.tr;
const date=x=>new Date(x).toLocaleString(localStorage.getItem("appLanguage")==="de"?"de-DE":localStorage.getItem("appLanguage")==="en"?"en-US":"tr-TR");
const btn=(key,label,secondary=true)=>'<button type="button" class="btn'+(secondary?" secondary":"")+'" data-action="'+key+'">'+esc(label)+'</button>';
function render(){
 const t=lang();let body="";
 if(opened&&page==="choose"){
  body='<h3>'+esc(t.choose)+'</h3><div class="sc-device-note">'+esc(t.notice)+'</div>'+
  ["watch","phone"].map(k=>'<button class="sc-device-tile" data-device="'+k+'" aria-pressed="'+String(pref.device===k)+'"><span style="font-size:26px">'+(k==="watch"?"⌚":"♥")+'</span><strong>'+esc(t[k])+'</strong></button>').join("")+
  '<div class="sc-device-actions">'+btn("select",t.continue,false)+'</div>';
 }else if(opened&&page==="select"){
  body='<h3>'+esc(t.select)+'</h3><div class="sc-device-note">'+esc(t.selectInfo)+'</div><div class="sc-device-grid">'+
  Object.keys(TYPES).map(k=>'<label><input type="checkbox" data-type="'+k+'" '+(pref.types.includes(k)?"checked":"")+'>'+esc(t.labels[k])+'</label>').join("")+
  '</div><div class="sc-device-actions">'+btn("choose",t.back)+btn("save",t.save,false)+'</div>';
 }else if(opened&&page==="import"){
  body='<h3>'+esc(t.import)+'</h3><div class="sc-device-note">'+esc(t.guide)+'</div>'+
  '<label for="scAppleXml">'+esc(t.file)+'</label><input class="field" type="file" id="scAppleXml" accept=".xml,text/xml,application/xml">'+
  '<p class="note" role="status">'+esc(status||t.notLive)+'</p><div class="sc-device-actions">'+btn("select",t.back)+btn("results",t.results,false)+'</div>';
 }else if(opened&&page==="results"){
  body='<h3>'+esc(t.data)+'</h3><p class="note">'+esc(t.dataInfo)+'</p><div class="sc-device-grid">'+
  pref.types.map(k=>{const v=data.values[k];return '<div class="sc-data-tile"><span>'+esc(TYPES[k][2]+" "+t.labels[k])+'</span><strong>'+esc(v?v.value+" "+v.unit:t.none)+'</strong><small>'+esc(v?date(v.at):"—")+'</small></div>'}).join("")+
  '</div><p class="note">'+esc(t.notLive)+'</p><div class="sc-device-actions">'+btn("import",t.update)+btn("select",t.select)+'</div>';
 }
 root.innerHTML='<div class="card-head"><h3>'+esc(t.title)+'</h3><span style="font-size:26px">⌚</span></div><p class="note">'+esc(t.intro)+'</p>'+
 '<div class="sc-device-note">'+esc(t.notConnected)+' · '+esc(t[pref.device])+'<br>'+esc(t.last)+': '+esc(data.date?date(data.date):t.never)+'</div>'+
 (opened?body+'<div class="sc-device-actions">'+btn("close",t.close)+'</div>':btn("choose",t.open,false));
}
root.addEventListener("click",event=>{
 const d=event.target.closest("[data-device]");
 if(d){pref.device=d.dataset.device;localStorage.setItem(P,JSON.stringify(pref));render();return}
 const b=event.target.closest("[data-action]");if(!b)return;
 const action=b.dataset.action;
 if(action==="close"){opened=false;render();return}
 if(action==="save"){
  pref.types=[...root.querySelectorAll("[data-type]:checked")].map(x=>x.dataset.type);
  localStorage.setItem(P,JSON.stringify(pref));page="import";
 }else page=action;
 opened=true;render();
});
root.addEventListener("change",e=>{if(e.target.id==="scAppleXml")void importFile(e.target.files?.[0]);});
async function importFile(file){
 if(!file)return;
 if(file.size>20*1024*1024){status=lang().large;render();return}
 if(!/\.xml$/i.test(file.name)){status=lang().invalid;render();return}
 status=lang().reading;render();
 try{
  const doc=new DOMParser().parseFromString(await file.text(),"application/xml");
  if(doc.querySelector("parsererror")||doc.documentElement.nodeName!=="HealthData")throw Error("xml");
  const lookup=Object.fromEntries(Object.entries(TYPES).map(([k,v])=>[v[0],k]));
  const mostRecent={},totals={steps:new Map(),energy:new Map(),sleep:new Map()},now=Date.now(),cutoff=now-90*86400000;
  for(const rec of doc.getElementsByTagName("Record")){
   const k=lookup[rec.getAttribute("type")];if(!k||!pref.types.includes(k))continue;
   const at=Date.parse(rec.getAttribute("endDate")||"");if(!Number.isFinite(at)||at<cutoff||at>now+86400000)continue;
   const unit=rec.getAttribute("unit")||"",raw=rec.getAttribute("value")||"";
   if(k==="sleep"){
    if(!/Asleep/.test(raw))continue;
    const start=Date.parse(rec.getAttribute("startDate")||""),hours=(at-start)/3600000;
    if(!Number.isFinite(hours)||hours<=0||hours>24)continue;
    const day=new Date(at).toISOString().slice(0,10),old=totals.sleep.get(day)||{value:0,at};
    totals.sleep.set(day,{value:old.value+hours,at:Math.max(old.at,at)});continue;
   }
   let value=Number(raw);if(!Number.isFinite(value))continue;
   if(k==="steps"||k==="energy"){
    const day=new Date(at).toISOString().slice(0,10),old=totals[k].get(day)||{value:0,at};
    totals[k].set(day,{value:old.value+value,at:Math.max(old.at,at)});continue;
   }
   if(k==="oxygen"&&unit==="%"&&value<=1)value*=100;
   if(k==="weight"&&unit==="lb")value*=0.45359237;
   if(k==="glucose"&&unit==="mmol/L")value*=18.0182;
   if(k==="wrist"&&unit==="degF")value=(value-32)*5/9;
   if(k==="heart"&&(value<20||value>260))continue;
   if(k==="oxygen"&&(value<30||value>100))continue;
   if(!mostRecent[k]||at>mostRecent[k].at)mostRecent[k]={value,at};
  }
  for(const k of Object.keys(totals)){
   const list=[...totals[k].values()].sort((a,b)=>b.at-a.at);
   if(list.length)mostRecent[k]=list[0];
  }
  const keys=Object.keys(mostRecent);
  if(!keys.length){status=lang().noMatch;render();return}
  for(const k of keys){
   const v=mostRecent[k];
   data.values[k]={value:Number(v.value.toFixed(k==="steps"||k==="energy"?0:1)),unit:TYPES[k][1],at:v.at};
  }
  data.date=Date.now();
  try{localStorage.setItem(D,JSON.stringify(data))}
  catch{status=lang().storage;render();return}
  status=lang().done+": "+keys.length;page="results";render();
 }catch{status=lang().error;render()}
}
document.getElementById("languageSelect")?.addEventListener("change",render);
render();
})();
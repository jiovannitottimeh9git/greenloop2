// GreenLoop frontend: communicates with the PHP backend through ../api.php
let csrfToken = '';
async function getCsrfToken(){
  try { const r=await fetch('../api.php?action=csrf',{credentials:'same-origin'}); const d=await r.json(); if(d.success) csrfToken=d.csrf; }
  catch(e){ console.error('Could not obtain security token',e); }
}
getCsrfToken();
async function sendForm(url,form,messageEl){
  const button=form.querySelector('button[type="submit"],button:not([type])');
  if(button){button.disabled=true;button.dataset.original=button.innerHTML;button.innerHTML='Please wait…';}
  try{
    if(!csrfToken) await getCsrfToken();
    const response=await fetch(url,{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':csrfToken},body:new FormData(form)});
    const data=await response.json();
    if(messageEl){messageEl.textContent=data.message || (data.success?'Completed.':'Something went wrong.');messageEl.className='form-message '+(data.success?'success':'error');}
    if(data.success && data.reference && form.id==='requestForm'){
      messageEl.innerHTML=`${data.message}<br><strong>Your reference: ${data.reference}</strong><br><a href="track.html">Track your collection</a>`;form.reset();
    }
    if(data.success && data.redirect) window.location.href='../'+data.redirect;
    if(data.success && form.id!=='requestForm') form.reset();
  }catch(e){if(messageEl){messageEl.textContent='Could not connect to the server. Ensure Apache and MySQL are running.';messageEl.className='form-message error';}}
  finally{if(button){button.disabled=false;button.innerHTML=button.dataset.original;}}
}
const requestForm=document.getElementById('requestForm');
if(requestForm)requestForm.addEventListener('submit',e=>{e.preventDefault();const message=document.getElementById('requestMessage');if(!requestLatitude.value||!requestLongitude.value){message.textContent='Pin your pickup location on the map or add your current GPS location.';message.className='form-message error';return;}sendForm('../api.php?action=create_request',requestForm,message);});
const requestMapElement=document.getElementById('requestMap');
const requestAddress=document.getElementById('requestAddress');
const requestLatitude=document.getElementById('requestLat');
const requestLongitude=document.getElementById('requestLng');
const mapLocationStatus=document.getElementById('mapLocationStatus');
const locationSearchInput=document.getElementById('locationSearch');
const locationSearchButton=document.getElementById('searchLocationButton');
const locationSearchStatus=document.getElementById('locationSearchStatus');
const locationSearchResults=document.getElementById('locationSearchResults');
let requestMap=null,requestMarker=null;
function setPickupLocation(latitude,longitude,centerMap=false,label=''){
  requestAddress.value=label;
  requestLatitude.value=latitude.toFixed(6);
  requestLongitude.value=longitude.toFixed(6);
  if(mapLocationStatus)mapLocationStatus.textContent=label?`Selected location: ${label}`:`Pickup pin selected: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}.`;
  if(!requestMap)return;
  const position=[latitude,longitude];
  if(!requestMarker){
    requestMarker=L.marker(position,{draggable:true}).addTo(requestMap);
    requestMarker.on('dragend',()=>{const point=requestMarker.getLatLng();setPickupLocation(point.lat,point.lng);});
  }else requestMarker.setLatLng(position);
  if(centerMap)requestMap.setView(position,Math.max(requestMap.getZoom(),15));
}
if(requestMapElement){
  if(typeof L==='undefined'){
    if(mapLocationStatus)mapLocationStatus.textContent='Map could not load. You can still add your GPS location.';
  }else{
    requestMap=L.map(requestMapElement,{zoomControl:true,scrollWheelZoom:true}).setView([5.6037,-0.187],12);
    const requestTiles=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'});
    requestTiles.on('tileerror',()=>{if(mapLocationStatus)mapLocationStatus.textContent='Map tiles could not load. Try again or add your GPS location.';});
    requestTiles.addTo(requestMap);
    requestMap.on('click',event=>setPickupLocation(event.latlng.lat,event.latlng.lng));
  }
  requestForm?.addEventListener('reset',()=>window.setTimeout(()=>{
    if(requestMarker&&requestMap){requestMap.removeLayer(requestMarker);requestMarker=null;}
    if(mapLocationStatus)mapLocationStatus.textContent='Click the map to set your pickup location.';
    if(locationSearchResults)locationSearchResults.replaceChildren();
    if(locationSearchStatus)locationSearchStatus.textContent='';
    const status=document.getElementById('locationStatus');
    if(status)status.textContent='Optional';
  },0));
}
if(locationSearchButton&&locationSearchInput&&locationSearchResults&&locationSearchStatus){
  locationSearchButton.addEventListener('click',async()=>{
    const query=locationSearchInput.value.trim();
    locationSearchResults.replaceChildren();
    if(query.length<2){locationSearchStatus.textContent='Enter at least 2 characters to search.';return;}
    if(!requestMap){locationSearchStatus.textContent='Map is unavailable. You can still add your GPS location.';return;}
    locationSearchButton.disabled=true;
    locationSearchStatus.textContent='Searching locations…';
    try{
      const params=new URLSearchParams({format:'jsonv2',limit:'5',countrycodes:'gh',q:query});
      const response=await fetch(`https://nominatim.openstreetmap.org/search?${params}`,{headers:{'Accept-Language':'en'}});
      if(!response.ok)throw new Error(`Location search returned HTTP ${response.status}.`);
      const places=await response.json();
      if(!places.length){locationSearchStatus.textContent='No locations found. Try a nearby area or landmark.';return;}
      places.forEach(place=>{
        const latitude=Number(place.lat),longitude=Number(place.lon);
        if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return;
        const result=document.createElement('button');
        result.type='button';
        result.className='location-result';
        result.textContent=place.display_name;
        result.addEventListener('click',()=>{
          setPickupLocation(latitude,longitude,true,place.display_name);
          locationSearchStatus.textContent='Location selected. You can adjust the pin on the map.';
          locationSearchResults.replaceChildren();
        });
        locationSearchResults.append(result);
      });
      locationSearchStatus.textContent=locationSearchResults.childElementCount
        ?'Choose a search result to set your pickup pin.'
        :'No usable locations found. Try another search.';
    }catch(error){
      locationSearchStatus.textContent='Location search is unavailable. Try again or place a pin on the map.';
      console.error('Pickup location search failed',error);
    }finally{
      locationSearchButton.disabled=false;
    }
  });
  locationSearchInput.addEventListener('keydown',event=>{
    if(event.key==='Enter'){event.preventDefault();locationSearchButton.click();}
  });
}
const locBtn=document.getElementById('getLocation');
if(locBtn)locBtn.addEventListener('click',()=>{const status=document.getElementById('locationStatus');if(!navigator.geolocation){status.textContent='Not supported';return;}status.textContent='Finding location…';navigator.geolocation.getCurrentPosition(p=>{setPickupLocation(p.coords.latitude,p.coords.longitude,true);status.textContent='Location added';},()=>{status.textContent='Permission unavailable';},{enableHighAccuracy:true,timeout:12000});});
const menu=document.querySelector('.menu-toggle');if(menu)menu.addEventListener('click',()=>document.querySelector('.main-nav')?.classList.toggle('open'));

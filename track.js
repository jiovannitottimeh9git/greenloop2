const csrfToken=document.querySelector('meta[name="csrf-token"]')?.content||'';
let map=null,truckMarker=null,refreshTimer=null,lastRef='',lastPhone='';
const form=document.getElementById('trackForm'),msg=document.getElementById('trackMessage'),result=document.getElementById('trackResult');
function statusClass(s){return 'status-pill status-'+String(s).toLowerCase().replaceAll(' ','-');}
async function loadTrack(){
 const params=new URLSearchParams({reference:lastRef,phone:lastPhone});
 try{
  const r=await fetch('../api.php?action=track&'+params.toString());const d=await r.json();
  if(!d.success){msg.textContent=d.message;msg.className='form-message error';return;}
  msg.textContent='';result.classList.remove('hidden');
  const q=d.request;document.getElementById('trackRef').textContent=q.reference_code;
  document.getElementById('trackAddress').textContent=q.address+', '+q.region;
  const st=document.getElementById('trackStatus');st.textContent=q.status;st.className=statusClass(q.status);
  document.getElementById('trackCategory').textContent=q.waste_category;
  document.getElementById('trackDate').textContent=q.preferred_date||'To be confirmed';
  document.getElementById('trackVehicle').textContent=d.vehicle?d.vehicle.registration_number+' · '+d.vehicle.vehicle_type:'Not assigned yet';
  document.getElementById('trackUpdated').textContent=d.location?new Date(d.location.recorded_at.replace(' ','T')).toLocaleString():'Waiting for driver GPS';
  const center=d.location?[Number(d.location.latitude),Number(d.location.longitude)]:[-0.187,5.6037];
  if(!map){map=L.map('trackingMap').setView(center,d.location?15:12);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);}
  if(d.location){if(!truckMarker)truckMarker=L.marker(center).addTo(map).bindPopup('GreenLoop collection vehicle');else truckMarker.setLatLng(center);map.setView(center,15);}
  else if(!truckMarker) L.marker(center).addTo(map).bindPopup('Accra map preview · vehicle location not available yet');
 }catch(e){msg.textContent='Unable to load tracking information. Please try again.';msg.className='form-message error';}
}
if(form)form.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(form);lastRef=fd.get('reference').trim();lastPhone=fd.get('phone').trim();loadTrack();clearInterval(refreshTimer);refreshTimer=setInterval(loadTrack,7000);});

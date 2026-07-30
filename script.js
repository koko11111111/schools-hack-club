/* ============================================================
   This file assumes firebase-config.js has already run and
   created two globals: `db` (Firestore) and `auth` (Firebase Auth).
   Load order in index.html matters: firebase SDKs, then
   firebase-config.js, then this file.
   ============================================================ */

/* ============================================================
   NAVIGATION
   ============================================================ */
function showPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  document.querySelectorAll('.navlinks button').forEach(b=>b.classList.toggle('active', b.dataset.page===name));
  window.scrollTo({top:0, behavior:'smooth'});
  if(name==='admin'){
    isAdmin ? showAdminPanel() : showAdminLoginForm();
  }
}
document.querySelectorAll('.navlinks button').forEach(b=>{
  b.addEventListener('click', ()=>showPage(b.dataset.page));
});

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

/* ============================================================
   FALLBACK CONTENT
   Shown before the "site/content" document exists in Firestore
   (i.e. before an admin has ever clicked "Save site content").
   ============================================================ */
function defaultSiteContent(){
  return {
    eyebrow: 'High school coding club · est. this year',
    headlinePlain: 'We build real things, ',
    headlineEm: 'every week.',
    sub: "A student-led Hack Club chapter where we design, code, and ship actual projects — websites, games, tools — together. No experience required. Just curiosity.",
    meetingDay: 'Thursday · after school',
    meetingNote: 'Location and time confirmed with the school — details shared in the club chat.'
  };
}

let siteContent = defaultSiteContent();

/* ============================================================
   SITE CONTENT (Firestore doc: site/content)
   Live-updates for every visitor, not just the admin's browser.
   ============================================================ */
db.collection('site').doc('content').onSnapshot(doc=>{
  siteContent = doc.exists ? doc.data() : defaultSiteContent();
  renderHero();
  renderMeeting();
  if(isAdmin) fillSiteContentForm();
});

function renderHero(){
  document.getElementById('hero-eyebrow').textContent = siteContent.eyebrow;
  document.getElementById('hero-headline').innerHTML =
    escapeHtml(siteContent.headlinePlain) + '<em>' + escapeHtml(siteContent.headlineEm) + '</em>';
  document.getElementById('hero-sub').textContent = siteContent.sub;
}

function renderMeeting(){
  document.getElementById('meeting-day').textContent = siteContent.meetingDay;
  document.getElementById('meeting-note').textContent = siteContent.meetingNote;
}

function saveSiteContent(){
  const updated = {
    eyebrow: document.getElementById('f-eyebrow').value.trim(),
    headlinePlain: document.getElementById('f-headline-plain').value,
    headlineEm: document.getElementById('f-headline-em').value.trim(),
    sub: document.getElementById('f-sub').value.trim(),
    meetingDay: document.getElementById('f-meeting-day').value.trim(),
    meetingNote: document.getElementById('f-meeting-note').value.trim()
  };
  db.collection('site').doc('content').set(updated)
    .then(flashSaved)
    .catch(err=>alert('Could not save: ' + err.message));
}

function fillSiteContentForm(){
  document.getElementById('f-eyebrow').value = siteContent.eyebrow;
  document.getElementById('f-headline-plain').value = siteContent.headlinePlain;
  document.getElementById('f-headline-em').value = siteContent.headlineEm;
  document.getElementById('f-sub').value = siteContent.sub;
  document.getElementById('f-meeting-day').value = siteContent.meetingDay;
  document.getElementById('f-meeting-note').value = siteContent.meetingNote;
}

function flashSaved(){
  const bar = document.createElement('div');
  bar.textContent = 'Saved.';
  bar.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#C9A227;color:#0F1A1C;padding:10px 22px;border-radius:999px;font-family:JetBrains Mono, monospace;font-size:12px;z-index:999;';
  document.body.appendChild(bar);
  setTimeout(()=>bar.remove(), 1400);
}

function resetSiteData(){
  if(!confirm('Reset the homepage text (eyebrow, headline, meeting info) back to defaults? This does NOT touch the team list or chat.')) return;
  db.collection('site').doc('content').set(defaultSiteContent())
    .then(flashSaved)
    .catch(err=>alert('Could not reset: ' + err.message));
}

/* ============================================================
   TEAM (Firestore collection: team)
   ============================================================ */
let teamList = [];

db.collection('team').orderBy('order').onSnapshot(snap=>{
  teamList = [];
  snap.forEach(d=>teamList.push({id: d.id, ...d.data()}));
  renderTeam();
  if(isAdmin) renderAdminTeamList();
});

function renderTeam(){
  const grid = document.getElementById('team-grid');
  grid.innerHTML = '';
  teamList.forEach(m=>{
    const card = document.createElement('div');
    card.className = 'cartouche';
    card.innerHTML = `
      <div class="avatar">${escapeHtml(m.avatar)}</div>
      <h3>${escapeHtml(m.name)}</h3>
      <div class="role">${escapeHtml(m.role)}</div>
      <p class="desc">${escapeHtml(m.desc)}</p>
    `;
    grid.appendChild(card);
  });
}

let editingTeamId = null;

function renderAdminTeamList(){
  const list = document.getElementById('admin-team-list');
  list.innerHTML = '';
  teamList.forEach(m=>{
    const row = document.createElement('div');
    row.className = 'admin-row';
    row.innerHTML = `
      <div class="admin-row-text"><strong>${escapeHtml(m.avatar)}</strong>${escapeHtml(m.name)} — ${escapeHtml(m.role)}</div>
      <div class="admin-row-actions">
        <button type="button">Edit</button>
        <button type="button" class="danger">Delete</button>
      </div>
    `;
    const [editBtn, delBtn] = row.querySelectorAll('button');
    editBtn.onclick = ()=>startEditTeamMember(m);
    delBtn.onclick = ()=>deleteTeamMember(m.id, m.name);
    list.appendChild(row);
  });
}

function startEditTeamMember(m){
  editingTeamId = m.id;
  document.getElementById('f-avatar').value = m.avatar;
  document.getElementById('f-name').value = m.name;
  document.getElementById('f-role').value = m.role;
  document.getElementById('f-desc').value = m.desc;
  document.getElementById('f-hackatime').value = m.hackatime || '';
  document.getElementById('team-form-title').textContent = 'Edit team member';
  document.getElementById('team-form-submit').textContent = 'Save changes';
  document.getElementById('team-form-cancel').style.display = 'inline-block';
}

function cancelTeamEdit(){
  editingTeamId = null;
  ['f-avatar','f-name','f-role','f-desc','f-hackatime'].forEach(id=>document.getElementById(id).value = '');
  document.getElementById('team-form-title').textContent = 'Add team member';
  document.getElementById('team-form-submit').textContent = 'Add member';
  document.getElementById('team-form-cancel').style.display = 'none';
}

function saveTeamMember(){
  const avatar = document.getElementById('f-avatar').value.trim() || '?';
  const name = document.getElementById('f-name').value.trim();
  const role = document.getElementById('f-role').value.trim();
  const desc = document.getElementById('f-desc').value.trim();
  const hackatime = document.getElementById('f-hackatime').value.trim();
  if(!name){ alert('Please enter a name.'); return; }

  const promise = editingTeamId
    ? db.collection('team').doc(editingTeamId).set({avatar, name, role, desc, hackatime}, {merge:true})
    : db.collection('team').add({avatar, name, role, desc, hackatime, order: Date.now()});

  promise
    .then(()=>{ cancelTeamEdit(); flashSaved(); })
    .catch(err=>alert('Could not save: ' + err.message));
}

function deleteTeamMember(id, name){
  if(!confirm('Remove ' + name + ' from the team page?')) return;
  db.collection('team').doc(id).delete()
    .then(()=>{ if(editingTeamId === id) cancelTeamEdit(); })
    .catch(err=>alert('Could not delete: ' + err.message));
}

/* ============================================================
   CHAT
   Room list is fixed here (not in Firestore) — only the
   messages inside each room are stored remotely.
   ============================================================ */
const ROOMS = {
  general:    {title:'# general',       sub:'club-wide'},
  projects:   {title:'# show-and-tell',  sub:'share what you built'},
  'dm-sara':  {title:'Sara',             sub:'direct message'},
  'dm-omar':  {title:'Omar',             sub:'direct message'}
};

let currentRoom = 'general';
let unsubscribeMessages = null;

function getDeviceId(){
  let id = localStorage.getItem('tols_device_id');
  if(!id){
    id = 'dev-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);
    localStorage.setItem('tols_device_id', id);
  }
  return id;
}

function getMyName(){
  let name = localStorage.getItem('tols_my_name');
  if(!name){
    name = prompt('What name should show next to your messages?', 'Guest') || 'Guest';
    localStorage.setItem('tols_my_name', name);
  }
  return name;
}

function openRoom(name){
  currentRoom = name;
  document.querySelectorAll('.chat-item').forEach(i=>i.classList.toggle('active', i.dataset.room===name));

  const meta = ROOMS[name];
  document.getElementById('chat-room-title').textContent = meta.title;
  document.getElementById('chat-room-sub').textContent = meta.sub;
  document.getElementById('chat-text').placeholder = 'Message ' + meta.title;

  if(unsubscribeMessages) unsubscribeMessages();
  unsubscribeMessages = db.collection('rooms').doc(name).collection('messages')
    .orderBy('createdAt')
    .onSnapshot(snap=>{
      const messages = [];
      snap.forEach(d=>messages.push({id: d.id, ...d.data()}));
      renderRoomMessages(messages);
      if(isAdmin) renderAdminMessages();
    });
}

function renderRoomMessages(messages){
  const myDevice = getDeviceId();
  const log = document.getElementById('chat-log');
  log.innerHTML = '';
  messages.forEach(m=>{
    const isMe = m.deviceId === myDevice;
    const div = document.createElement('div');
    div.className = 'msg' + (isMe ? ' me' : '');
    div.innerHTML = '<div class="who"></div><div class="bubble"></div>';
    div.querySelector('.who').textContent = isMe ? 'You' : m.who;
    div.querySelector('.bubble').textContent = m.text;
    log.appendChild(div);
  });
  log.scrollTop = log.scrollHeight;
}

function sendMsg(){
  const input = document.getElementById('chat-text');
  const text = input.value.trim();
  if(!text) return;
  db.collection('rooms').doc(currentRoom).collection('messages').add({
    who: getMyName(),
    deviceId: getDeviceId(),
    text,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(err=>alert('Could not send: ' + err.message));
  input.value = '';
}

/* ============================================================
   ADMIN — CHAT MODERATION
   ============================================================ */
function populateRoomSelect(){
  const sel = document.getElementById('admin-room-select');
  sel.innerHTML = '';
  Object.keys(ROOMS).forEach(key=>{
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = ROOMS[key].title;
    sel.appendChild(opt);
  });
  sel.value = currentRoom;
}

function renderAdminMessages(){
  const roomKey = document.getElementById('admin-room-select').value || currentRoom;
  db.collection('rooms').doc(roomKey).collection('messages').orderBy('createdAt').get()
    .then(snap=>{
      const list = document.getElementById('admin-msg-list');
      list.innerHTML = '';
      if(snap.empty){
        const empty = document.createElement('p');
        empty.className = 'admin-note';
        empty.textContent = 'No messages in this room.';
        list.appendChild(empty);
        return;
      }
      snap.forEach(d=>{
        const m = d.data();
        const row = document.createElement('div');
        row.className = 'admin-row';
        row.innerHTML = `
          <div class="admin-row-text"><strong>${escapeHtml(m.who)}</strong>${escapeHtml(m.text)}</div>
          <div class="admin-row-actions"><button type="button" class="danger">Delete</button></div>
        `;
        row.querySelector('button').onclick = ()=>deleteMessage(roomKey, d.id);
        list.appendChild(row);
      });
    });
}

function deleteMessage(roomKey, id){
  db.collection('rooms').doc(roomKey).collection('messages').doc(id).delete()
    .then(()=>renderAdminMessages())
    .catch(err=>alert('Could not delete: ' + err.message));
}

function clearRoomMessages(){
  const roomKey = document.getElementById('admin-room-select').value;
  if(!confirm('Delete all messages in ' + ROOMS[roomKey].title + '? This cannot be undone.')) return;
  db.collection('rooms').doc(roomKey).collection('messages').get()
    .then(snap=>{
      const batch = db.batch();
      snap.forEach(d=>batch.delete(d.ref));
      return batch.commit();
    })
    .then(()=>renderAdminMessages())
    .catch(err=>alert('Could not clear room: ' + err.message));
}

/* ============================================================
   JOIN FORM -> Firestore collection: signups
   ============================================================ */
function submitSignup(){
  const name = document.getElementById('join-name').value.trim();
  const grade = document.getElementById('join-grade').value.trim();
  const curious = document.getElementById('join-curious').value.trim();
  if(!name){ alert('Please enter your name.'); return; }

  db.collection('signups').add({
    name, grade, curious,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(()=>{
    alert("Thanks! We'll follow up with meeting details.");
    document.getElementById('join-name').value = '';
    document.getElementById('join-grade').value = '';
    document.getElementById('join-curious').value = '';
  }).catch(err=>alert('Something went wrong, please try again: ' + err.message));
}

/* ============================================================
   ADMIN — LOGIN (Firebase Authentication)
   ============================================================ */
let isAdmin = false;

function adminLogin(){
  const email = document.getElementById('admin-email').value.trim();
  const pass = document.getElementById('admin-pass').value;
  const err = document.getElementById('admin-login-error');
  err.textContent = '';
  auth.signInWithEmailAndPassword(email, pass)
    .catch(()=>{ err.textContent = 'Incorrect email or password.'; });
}

function adminLogout(){
  auth.signOut();
}

auth.onAuthStateChanged(user=>{
  isAdmin = !!user;
  if(document.getElementById('page-admin').classList.contains('active')){
    isAdmin ? showAdminPanel() : showAdminLoginForm();
  }
  if(isAdmin){
    subscribeSignups();
  } else if(unsubscribeSignups){
    unsubscribeSignups();
    unsubscribeSignups = null;
  }
});

function showAdminLoginForm(){
  document.getElementById('admin-login').style.display = 'block';
  document.getElementById('admin-content').style.display = 'none';
  document.getElementById('admin-email').value = '';
  document.getElementById('admin-pass').value = '';
  document.getElementById('admin-login-error').textContent = '';
}

function showAdminPanel(){
  document.getElementById('admin-login').style.display = 'none';
  document.getElementById('admin-content').style.display = 'block';
  fillSiteContentForm();
  renderAdminTeamList();
  populateRoomSelect();
  renderAdminMessages();
}

/* ============================================================
   ADMIN — SIGN-UPS (Firestore collection: signups)
   Only subscribed while an admin is logged in — matches the
   Firestore rule that signups are admin-read-only.
   ============================================================ */
let unsubscribeSignups = null;

function subscribeSignups(){
  if(unsubscribeSignups) return;
  unsubscribeSignups = db.collection('signups').orderBy('createdAt', 'desc').onSnapshot(snap=>{
    const list = document.getElementById('admin-signups-list');
    if(!list) return;
    list.innerHTML = '';
    if(snap.empty){
      const empty = document.createElement('p');
      empty.className = 'admin-note';
      empty.textContent = 'No sign-ups yet.';
      list.appendChild(empty);
      return;
    }
    snap.forEach(d=>{
      const s = d.data();
      const row = document.createElement('div');
      row.className = 'admin-row';
      row.innerHTML = `
        <div class="admin-row-text"><strong>${escapeHtml(s.name)}</strong>${escapeHtml(s.grade)} — ${escapeHtml(s.curious)}</div>
        <div class="admin-row-actions"><button type="button" class="danger">Delete</button></div>
      `;
      row.querySelector('button').onclick = ()=>{
        db.collection('signups').doc(d.id).delete();
      };
      list.appendChild(row);
    });
  });
}

/* ============================================================
   PROJECT GALLERY (Firestore collection: projects)
   Anyone can post, only the admin can delete.
   ============================================================ */
let projectsList = [];

db.collection('projects').orderBy('createdAt', 'desc').onSnapshot(snap=>{
  projectsList = [];
  snap.forEach(d=>projectsList.push({id: d.id, ...d.data()}));
  renderProjects();
  if(isAdmin) renderAdminProjects();
});

function renderProjects(){
  const grid = document.getElementById('projects-grid');
  if(!grid) return;
  grid.innerHTML = '';
  if(!projectsList.length){
    grid.innerHTML = '<p style="color:rgba(15,26,28,.6)">Nothing posted yet — be the first!</p>';
    return;
  }
  projectsList.forEach(p=>{
    const card = document.createElement('div');
    card.className = 'step';
    card.innerHTML = `
      <h3>${escapeHtml(p.title)}</h3>
      <p>${escapeHtml(p.desc)}</p>
      <p style="margin-top:10px;font-family:var(--font-mono);font-size:11.5px;color:var(--clay)">by ${escapeHtml(p.author)}</p>
      ${p.link ? `<a href="${escapeHtml(p.link)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;font-size:.85rem;text-decoration:underline">View project →</a>` : ''}
    `;
    grid.appendChild(card);
  });
}

function submitProject(){
  const title = document.getElementById('proj-title').value.trim();
  const author = document.getElementById('proj-author').value.trim();
  const desc = document.getElementById('proj-desc').value.trim();
  const link = document.getElementById('proj-link').value.trim();
  if(!title || !author){ alert('Please add a title and your name.'); return; }
  db.collection('projects').add({
    title, author, desc, link,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(()=>{
    ['proj-title','proj-author','proj-desc','proj-link'].forEach(id=>document.getElementById(id).value = '');
  }).catch(err=>alert('Could not post: ' + err.message));
}

function renderAdminProjects(){
  const list = document.getElementById('admin-projects-list');
  if(!list) return;
  list.innerHTML = '';
  if(!projectsList.length){
    list.innerHTML = '<p class="admin-note">No projects posted yet.</p>';
    return;
  }
  projectsList.forEach(p=>{
    const row = document.createElement('div');
    row.className = 'admin-row';
    row.innerHTML = `
      <div class="admin-row-text"><strong>${escapeHtml(p.author)}</strong>${escapeHtml(p.title)}</div>
      <div class="admin-row-actions"><button type="button" class="danger">Delete</button></div>
    `;
    row.querySelector('button').onclick = ()=>{
      if(confirm('Delete "' + p.title + '"?')) db.collection('projects').doc(p.id).delete();
    };
    list.appendChild(row);
  });
}

/* ============================================================
   RESOURCE LIBRARY (Firestore collection: resources)
   Admin-managed, same pattern as the team list.
   ============================================================ */
let resourcesList = [];
let editingResourceId = null;

db.collection('resources').orderBy('order').onSnapshot(snap=>{
  resourcesList = [];
  snap.forEach(d=>resourcesList.push({id: d.id, ...d.data()}));
  renderResources();
  if(isAdmin) renderAdminResources();
});

function renderResources(){
  const grid = document.getElementById('resources-grid');
  if(!grid) return;
  grid.innerHTML = '';
  if(!resourcesList.length){
    grid.innerHTML = '<p style="color:rgba(15,26,28,.6)">No resources added yet.</p>';
    return;
  }
  resourcesList.forEach(r=>{
    const card = document.createElement('div');
    card.className = 'step';
    card.innerHTML = `
      <h3><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener" style="text-decoration:underline">${escapeHtml(r.title)}</a></h3>
      <p>${escapeHtml(r.desc)}</p>
    `;
    grid.appendChild(card);
  });
}

function renderAdminResources(){
  const list = document.getElementById('admin-resources-list');
  if(!list) return;
  list.innerHTML = '';
  resourcesList.forEach(r=>{
    const row = document.createElement('div');
    row.className = 'admin-row';
    row.innerHTML = `
      <div class="admin-row-text"><strong>${escapeHtml(r.title)}</strong>${escapeHtml(r.url)}</div>
      <div class="admin-row-actions">
        <button type="button">Edit</button>
        <button type="button" class="danger">Delete</button>
      </div>
    `;
    const [editBtn, delBtn] = row.querySelectorAll('button');
    editBtn.onclick = ()=>startEditResource(r);
    delBtn.onclick = ()=>{
      if(confirm('Remove "' + r.title + '"?')) db.collection('resources').doc(r.id).delete();
    };
    list.appendChild(row);
  });
}

function startEditResource(r){
  editingResourceId = r.id;
  document.getElementById('r-title').value = r.title;
  document.getElementById('r-url').value = r.url;
  document.getElementById('r-desc').value = r.desc;
  document.getElementById('resource-form-title').textContent = 'Edit resource';
  document.getElementById('resource-form-submit').textContent = 'Save changes';
  document.getElementById('resource-form-cancel').style.display = 'inline-block';
}

function cancelResourceEdit(){
  editingResourceId = null;
  ['r-title','r-url','r-desc'].forEach(id=>document.getElementById(id).value = '');
  document.getElementById('resource-form-title').textContent = 'Add resource';
  document.getElementById('resource-form-submit').textContent = 'Add resource';
  document.getElementById('resource-form-cancel').style.display = 'none';
}

function saveResource(){
  const title = document.getElementById('r-title').value.trim();
  const url = document.getElementById('r-url').value.trim();
  const desc = document.getElementById('r-desc').value.trim();
  if(!title || !url){ alert('Please add a title and a link.'); return; }

  const promise = editingResourceId
    ? db.collection('resources').doc(editingResourceId).set({title, url, desc}, {merge:true})
    : db.collection('resources').add({title, url, desc, order: Date.now()});

  promise
    .then(()=>{ cancelResourceEdit(); flashSaved(); })
    .catch(err=>alert('Could not save: ' + err.message));
}

/* ============================================================
   MEETING RSVP (Firestore collection: rsvps, doc id = device id)
   No login needed — one RSVP per browser/device.
   ============================================================ */
db.collection('rsvps').onSnapshot(snap=>{
  const countEl = document.getElementById('rsvp-count');
  if(!countEl) return;
  countEl.textContent = snap.size + (snap.size === 1 ? ' person coming Thursday' : ' people coming Thursday');

  const mine = snap.docs.some(d=>d.id === getDeviceId());
  const btn = document.getElementById('rsvp-btn');
  if(btn) btn.textContent = mine ? "Can't make it anymore" : "I'm coming";
});

function toggleRsvp(){
  const ref = db.collection('rsvps').doc(getDeviceId());
  ref.get().then(doc=>{
    if(doc.exists) return ref.delete();
    return ref.set({createdAt: firebase.firestore.FieldValue.serverTimestamp()});
  }).catch(err=>alert('Could not update RSVP: ' + err.message));
}

/* ============================================================
   HACKATIME LEADERBOARD (Firestore collection: leaderboard)
   The admin's API key is stored only in this browser's
   localStorage and only used from the logged-in admin's own
   session — it never gets written to Firestore or the public
   site. The RESULTS (name + hours) are what gets saved and
   shown publicly.
   ============================================================ */
function getHackatimeKey(){
  const input = document.getElementById('hackatime-key');
  let key = (input && input.value.trim()) || localStorage.getItem('tols_hackatime_key') || '';
  if(key) localStorage.setItem('tols_hackatime_key', key);
  return key;
}

function refreshLeaderboard(){
  const key = getHackatimeKey();
  if(!key){ alert('Paste your Hackatime API key first.'); return; }
  const members = teamList.filter(m=>m.hackatime);
  if(!members.length){ alert('No team members have a Hackatime username set yet — add one in the Team card.'); return; }

  const status = document.getElementById('leaderboard-status');
  status.textContent = 'Fetching…';

  Promise.all(members.map(m=>
    fetch('https://hackatime.hackclub.com/api/v1/users/' + encodeURIComponent(m.hackatime) + '/stats', {
      headers: { 'Authorization': 'Bearer ' + key }
    })
      .then(r=>r.json())
      .then(data=>db.collection('leaderboard').doc(m.id).set({
        displayName: m.name,
        username: m.hackatime,
        totalSeconds: data.total_seconds || 0,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }))
      .catch(err=>console.warn('Could not fetch Hackatime stats for', m.hackatime, err))
  )).then(()=>{
    status.textContent = 'Updated ' + new Date().toLocaleTimeString();
  });
}

db.collection('leaderboard').orderBy('totalSeconds', 'desc').onSnapshot(snap=>{
  const list = document.getElementById('leaderboard-list');
  if(!list) return;
  list.innerHTML = '';
  if(snap.empty){
    list.innerHTML = '<p class="admin-note">No stats yet — check back after the next meeting.</p>';
    return;
  }
  let rank = 0;
  snap.forEach(d=>{
    rank++;
    const l = d.data();
    const hours = (l.totalSeconds / 3600).toFixed(1);
    const row = document.createElement('div');
    row.className = 'admin-row';
    row.innerHTML = `<div class="admin-row-text"><strong>#${rank}</strong>${escapeHtml(l.displayName)}</div><div class="admin-row-actions">${hours} hrs</div>`;
    list.appendChild(row);
  });
});

/* ============================================================
   INIT
   ============================================================ */
renderHero();
renderMeeting();
openRoom('general');

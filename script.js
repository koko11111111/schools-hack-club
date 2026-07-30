/* ============================================================
   This file assumes firebase-config.js has already run and
   created two globals: `db` (Firestore) and `auth` (Firebase Auth).
   Load order in index.html matters: firebase SDKs, then
   firebase-config.js, then this file.
   ============================================================ */

/* ============================================================
   CONFIG — put YOUR OWN email(s) here. Whoever logs in with one
   of these emails gets the Admin tab and admin powers. Everyone
   else who signs up is a regular member.
   ============================================================ */
const ADMIN_EMAILS = ['kokomina946@gmail.com'];

let currentUser = null;   // Firebase Auth user, or null if logged out
let myProfile = null;     // users/{uid} doc: {name, grade, curious, email}
let isAdmin = false;

/* ============================================================
   NAVIGATION
   ============================================================ */
function showPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  document.querySelectorAll('.navlinks button').forEach(b=>b.classList.toggle('active', b.dataset.page===name));
  window.scrollTo({top:0, behavior:'smooth'});
  if(name==='admin') renderAdminGate();
  if(name==='chat') renderChatGate();
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
   AUTH — one email/password flow for everyone. Signing up
   creates a users/{uid} profile (that's how you "join").
   Admin-ness is just: is your email in ADMIN_EMAILS?
   ============================================================ */
let authMode = 'signup'; // or 'login'

function toggleAuthMode(){
  authMode = authMode === 'signup' ? 'login' : 'signup';
  const isSignup = authMode === 'signup';
  document.getElementById('signup-only-fields').style.display = isSignup ? 'block' : 'none';
  document.getElementById('auth-form-title').textContent = isSignup ? 'Create your account' : 'Log in';
  document.getElementById('auth-form-sub').textContent = isSignup
    ? 'Tell us a bit about you — this becomes your profile.'
    : 'Welcome back — enter your email and password.';
  document.getElementById('auth-submit-btn').textContent = isSignup ? 'Create account' : 'Log in';
  document.getElementById('auth-toggle-link').textContent = isSignup
    ? 'Already have an account? Log in'
    : "New here? Create an account";
  document.getElementById('auth-error').textContent = '';
}

function handleAuthSubmit(){
  const email = document.getElementById('auth-email').value.trim();
  const pass = document.getElementById('auth-pass').value;
  const errEl = document.getElementById('auth-error');
  errEl.textContent = '';

  if(!email || !pass){ errEl.textContent = 'Please fill in your email and password.'; return; }

  if(authMode === 'signup'){
    const name = document.getElementById('su-name').value.trim();
    const grade = document.getElementById('su-grade').value.trim();
    const curious = document.getElementById('su-curious').value.trim();
    if(!name){ errEl.textContent = 'Please enter your name.'; return; }

    auth.createUserWithEmailAndPassword(email, pass)
      .then(cred => db.collection('users').doc(cred.user.uid).set({
        name, email, grade, curious,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }))
      .then(()=>showPage('home'))
      .catch(err=> errEl.textContent = err.message);
  } else {
    auth.signInWithEmailAndPassword(email, pass)
      .then(()=>showPage('home'))
      .catch(()=> errEl.textContent = 'Incorrect email or password.');
  }
}

function loadMyProfile(){
  return db.collection('users').doc(currentUser.uid).get().then(doc=>{
    myProfile = doc.exists ? doc.data() : null;
    renderAccountArea();
  });
}

function renderAccountArea(){
  const box = document.getElementById('account-box');
  if(currentUser){
    const label = (myProfile && myProfile.name) ? myProfile.name : currentUser.email;
    box.innerHTML = `<span class="account-name">${escapeHtml(label)}</span><button id="logout-btn" class="account-logout">Log out</button>`;
    document.getElementById('logout-btn').onclick = ()=>auth.signOut();
  } else {
    box.innerHTML = `<button id="login-open-btn" class="account-logout">Log in / Join</button>`;
    document.getElementById('login-open-btn').onclick = ()=>{ authMode='login'; toggleAuthMode(); toggleAuthMode(); showPage('join'); };
  }
}

auth.onAuthStateChanged(user=>{
  currentUser = user;
  if(user){
    isAdmin = ADMIN_EMAILS.includes(user.email);
    loadMyProfile().then(()=>{
      subscribeAllMembers();
    });
  } else {
    isAdmin = false;
    myProfile = null;
    if(unsubscribeAllMembers){ unsubscribeAllMembers(); unsubscribeAllMembers = null; }
    allMembers = [];
  }
  document.getElementById('admin-nav-btn').style.display = isAdmin ? 'inline-block' : 'none';
  renderAccountArea();
  renderChatGate();
  renderProjectGate();

  if(document.getElementById('page-admin').classList.contains('active')) renderAdminGate();
  if(document.getElementById('page-chat').classList.contains('active')) renderChatGate();
});

function renderChatGate(){
  const locked = document.getElementById('chat-locked');
  const unlocked = document.getElementById('chat-unlocked');
  if(currentUser){
    locked.style.display = 'none';
    unlocked.style.display = 'block';
    openRoom(currentRoom);
  } else {
    locked.style.display = 'block';
    unlocked.style.display = 'none';
  }
}

function renderProjectGate(){
  const note = document.getElementById('project-gate-note');
  const card = document.getElementById('project-form-card');
  if(!note || !card) return;
  const fields = card.querySelectorAll('input, .btn-solid');
  note.style.display = currentUser ? 'none' : 'block';
  fields.forEach(f=>{
    if(f.classList.contains('btn-solid') || f.tagName === 'INPUT'){
      f.style.opacity = currentUser ? '1' : '0.4';
      f.style.pointerEvents = currentUser ? 'auto' : 'none';
    }
  });
}

function renderAdminGate(){
  const notAllowed = document.getElementById('admin-not-allowed');
  const content = document.getElementById('admin-content');
  if(isAdmin){
    notAllowed.style.display = 'none';
    content.style.display = 'block';
    document.getElementById('admin-who-label').textContent = 'Logged in as ' + (currentUser.email);
    fillSiteContentForm();
    renderAdminTeamList();
    populateRoomSelect();
    renderAdminMessages();
  } else {
    content.style.display = 'none';
    notAllowed.style.display = 'block';
    document.getElementById('admin-not-allowed-text').textContent = currentUser
      ? "Your account (" + currentUser.email + ") isn't an admin on this site."
      : "You need to be logged in with an admin account to see this page.";
  }
}

/* ============================================================
   FALLBACK CONTENT
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
   TEAM (Firestore collection: team) — leadership cards.
   Still admin-managed directly, separate from regular members.
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
   CHAT — member-only. Uses your account's name + uid, no more
   nickname prompt or device id.
   ============================================================ */
const ROOMS = {
  general:    {title:'# general',       sub:'club-wide'},
  projects:   {title:'# show-and-tell',  sub:'share what you built'}
};

let currentRoom = 'general';
let unsubscribeMessages = null;

function dmRoomId(uidA, uidB){
  return 'dm__' + [uidA, uidB].sort().join('__');
}

function getRoomMeta(name){
  if(ROOMS[name]) return ROOMS[name];
  const otherUid = name.replace(/^dm__/, '').split('__').find(id => id !== (currentUser && currentUser.uid));
  const other = allMembers.find(m=>m.id === otherUid);
  return {title: other ? other.name : 'Direct message', sub:'direct message'};
}

function openRoom(name){
  currentRoom = name;
  document.querySelectorAll('.chat-item').forEach(i=>i.classList.toggle('active', i.dataset.room===name));

  const meta = getRoomMeta(name);
  document.getElementById('chat-room-title').textContent = meta.title;
  document.getElementById('chat-room-sub').textContent = meta.sub;
  document.getElementById('chat-text').placeholder = 'Message ' + meta.title;

  if(!currentUser) return;

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
  const log = document.getElementById('chat-log');
  log.innerHTML = '';
  messages.forEach(m=>{
    const isMe = currentUser && m.uid === currentUser.uid;
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
  if(!currentUser) return;
  const input = document.getElementById('chat-text');
  const text = input.value.trim();
  if(!text) return;
  const who = (myProfile && myProfile.name) ? myProfile.name : currentUser.email;
  db.collection('rooms').doc(currentRoom).collection('messages').add({
    who,
    uid: currentUser.uid,
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
   ALL MEMBERS (Firestore collection: users)
   Shared by: the DM sidebar (everyone needs to see names to pick
   who to message) and the admin Members panel (sees grade/curious
   too, since only the admin's own reads include those fields).
   ============================================================ */
let allMembers = [];
let unsubscribeAllMembers = null;

function subscribeAllMembers(){
  if(unsubscribeAllMembers) return;
  unsubscribeAllMembers = db.collection('users').onSnapshot(snap=>{
    allMembers = [];
    snap.forEach(d=>allMembers.push({id: d.id, ...d.data()}));
    renderDmList();
    if(isAdmin) renderAdminMembersList();
  });
}

function renderDmList(){
  const container = document.getElementById('dm-list');
  if(!container || !currentUser) return;
  const others = allMembers.filter(m=>m.id !== currentUser.uid).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  container.innerHTML = '';
  if(!others.length){
    container.innerHTML = '<p class="admin-note" style="padding:0 10px 0 4px;font-size:.8rem">No other members yet — invite some friends to join.</p>';
    return;
  }
  others.forEach(m=>{
    const roomId = dmRoomId(currentUser.uid, m.id);
    const div = document.createElement('div');
    div.className = 'chat-item' + (currentRoom === roomId ? ' active' : '');
    div.dataset.room = roomId;
    const initial = ((m.name || '?').trim().charAt(0) || '?').toUpperCase();
    div.innerHTML = `<span class="av-sm">${escapeHtml(initial)}</span> ${escapeHtml(m.name || 'Member')}`;
    div.onclick = ()=>openRoom(roomId);
    container.appendChild(div);
  });
}

function renderAdminMembersList(){
  const list = document.getElementById('admin-members-list');
  if(!list) return;
  list.innerHTML = '';
  if(!allMembers.length){
    list.innerHTML = '<p class="admin-note">No members yet.</p>';
    return;
  }
  allMembers
    .slice()
    .sort((a,b)=>(b.createdAt?.seconds||0) - (a.createdAt?.seconds||0))
    .forEach(m=>{
      const row = document.createElement('div');
      row.className = 'admin-row';
      row.innerHTML = `<div class="admin-row-text"><strong>${escapeHtml(m.name)}</strong>${escapeHtml(m.grade || '')} — ${escapeHtml(m.curious || '')}</div>`;
      list.appendChild(row);
    });
}

/* ============================================================
   MEETING RSVP (Firestore collection: rsvps, doc id = your uid)
   Requires an account now — one RSVP per member.
   ============================================================ */
db.collection('rsvps').onSnapshot(snap=>{
  const countEl = document.getElementById('rsvp-count');
  if(!countEl) return;
  countEl.textContent = snap.size + (snap.size === 1 ? ' person coming Thursday' : ' people coming Thursday');

  const mine = currentUser && snap.docs.some(d=>d.id === currentUser.uid);
  const btn = document.getElementById('rsvp-btn');
  if(btn) btn.textContent = mine ? "Can't make it anymore" : "I'm coming";
});

function toggleRsvp(){
  if(!currentUser){ alert('Log in or create an account first.'); showPage('join'); return; }
  const ref = db.collection('rsvps').doc(currentUser.uid);
  ref.get().then(doc=>{
    if(doc.exists) return ref.delete();
    return ref.set({createdAt: firebase.firestore.FieldValue.serverTimestamp()});
  }).catch(err=>alert('Could not update RSVP: ' + err.message));
}

/* ============================================================
   HACKATIME LEADERBOARD (Firestore collection: leaderboard)
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
   PROJECT GALLERY (Firestore collection: projects)
   Requires an account to post. Anyone can read/browse.
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
  if(!currentUser){ alert('Log in or create an account first.'); showPage('join'); return; }
  const title = document.getElementById('proj-title').value.trim();
  const desc = document.getElementById('proj-desc').value.trim();
  const link = document.getElementById('proj-link').value.trim();
  const author = (myProfile && myProfile.name) ? myProfile.name : currentUser.email;
  if(!title){ alert('Please add a title.'); return; }
  db.collection('projects').add({
    title, author, desc, link,
    authorUid: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(()=>{
    ['proj-title','proj-desc','proj-link'].forEach(id=>document.getElementById(id).value = '');
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
   INIT
   ============================================================ */
renderHero();
renderMeeting();
renderChatGate();
renderProjectGate();
